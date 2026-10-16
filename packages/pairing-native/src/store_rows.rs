use crate::error::{PairingError, Result};
use crate::key::Spki;
use crate::qr::LanHint;
use crate::store::storage;
use rusqlite::{Connection, Row};
use std::net::IpAddr;

#[derive(Clone, Copy, Eq, PartialEq, Debug)]
pub(crate) enum RecordRole {
    Pc = 1,
    Phone = 2,
}
#[derive(Clone, Copy, Eq, PartialEq, Debug)]
pub(crate) enum RecordState {
    Consumed = 1,
    Complete = 2,
    Revoked = 3,
    Pending = 4,
    PinnedPendingAck = 5,
}

/// Native-only read view. Neither pending nor a peer pin grants file authority.
#[derive(Clone)]
pub(crate) struct Record {
    pub(crate) sid: [u8; 16],
    pub(crate) role: RecordRole,
    pub(crate) expected: [u8; 32],
    pub(crate) peer: Option<Spki>,
    pub(crate) state: RecordState,
    pub(crate) hint: Option<LanHint>,
}

const SELECT: &str = "SELECT r.sid,r.version,r.role,r.local,r.epoch,r.expected,r.peer,r.state,
    h.ip,h.port FROM records r LEFT JOIN hints h ON h.sid=r.sid";

pub(super) fn load(
    conn: &Connection,
    sid: &[u8; 16],
    local: &Spki,
    epoch: &[u8; 16],
) -> Result<Option<Record>> {
    let mut statement = conn
        .prepare(
            "SELECT r.sid,r.version,r.role,r.local,r.epoch,r.expected,
        r.peer,r.state,h.ip,h.port FROM records r LEFT JOIN hints h ON h.sid=r.sid
        WHERE r.sid=?1",
        )
        .map_err(storage)?;
    let mut rows = statement.query([sid.as_slice()]).map_err(storage)?;
    match rows.next().map_err(storage)? {
        Some(row) => Ok(Some(decode(row, local, epoch)?)),
        None => Ok(None),
    }
}

#[cfg(test)]
pub(super) fn validate_all(
    conn: &Connection,
    local: &Spki,
    epoch: &[u8; 16],
) -> Result<Vec<Record>> {
    let mut records = Vec::new();
    visit(conn, local, epoch, |record| {
        records.push(record);
        Ok(())
    })?;
    Ok(records)
}

pub(super) fn visit(
    conn: &Connection,
    local: &Spki,
    epoch: &[u8; 16],
    mut consume: impl FnMut(Record) -> Result<()>,
) -> Result<()> {
    let mut foreign = conn.prepare("PRAGMA foreign_key_check").map_err(storage)?;
    if foreign
        .query([])
        .map_err(storage)?
        .next()
        .map_err(storage)?
        .is_some()
    {
        return Err(PairingError::StorageFailure);
    }
    let mut statement = conn.prepare(SELECT).map_err(storage)?;
    let mut rows = statement.query([]).map_err(storage)?;
    while let Some(row) = rows.next().map_err(storage)? {
        consume(decode(row, local, epoch)?)?;
    }
    Ok(())
}

pub(super) fn blob<const N: usize>(row: &Row<'_>, index: usize) -> Result<[u8; N]> {
    row.get_ref(index)
        .map_err(storage)?
        .as_blob()
        .map_err(storage)?
        .try_into()
        .map_err(|_| PairingError::StorageFailure)
}

fn decode(row: &Row<'_>, local: &Spki, epoch: &[u8; 16]) -> Result<Record> {
    let sid = blob(row, 0)?;
    let version: i64 = row.get(1).map_err(storage)?;
    let role = match row.get::<_, i64>(2).map_err(storage)? {
        1 => RecordRole::Pc,
        2 => RecordRole::Phone,
        _ => return Err(PairingError::StorageFailure),
    };
    if version != 1 {
        return Err(PairingError::StorageFailure);
    }
    if blob::<91>(row, 3)? != *local.as_bytes() || blob::<16>(row, 4)? != *epoch {
        return Err(PairingError::ContinuityLost);
    }
    let expected = blob(row, 5)?;
    let peer = match row.get_ref(6).map_err(storage)? {
        rusqlite::types::ValueRef::Null => None,
        value => Some(
            Spki::parse(value.as_blob().map_err(storage)?)
                .map_err(|_| PairingError::StorageFailure)?,
        ),
    };
    let state = match row.get::<_, i64>(7).map_err(storage)? {
        1 => RecordState::Consumed,
        2 => RecordState::Complete,
        3 => RecordState::Revoked,
        4 => RecordState::Pending,
        5 => RecordState::PinnedPendingAck,
        _ => return Err(PairingError::StorageFailure),
    };
    if let Some(key) = &peer {
        if key.fingerprint() != expected {
            return Err(PairingError::StorageFailure);
        }
    }
    let ip = match row.get_ref(8).map_err(storage)? {
        rusqlite::types::ValueRef::Null => None,
        value => Some(value.as_str().map_err(storage)?),
    };
    let port: Option<i64> = row.get(9).map_err(storage)?;
    let hint = match (role, ip, port) {
        (RecordRole::Pc, None, None) => None,
        (RecordRole::Phone, Some(ip), Some(port)) => {
            let hint = LanHint {
                ip: crate::qr_ip::parse(ip).map_err(|_| PairingError::StorageFailure)?,
                port: port.try_into().map_err(|_| PairingError::StorageFailure)?,
            };
            if hint.port == 0 {
                return Err(PairingError::StorageFailure);
            }
            Some(hint)
        }
        _ => return Err(PairingError::StorageFailure),
    };
    let valid = match role {
        RecordRole::Pc => {
            peer.is_some()
                && matches!(
                    state,
                    RecordState::Consumed | RecordState::Complete | RecordState::Revoked
                )
        }
        RecordRole::Phone => match state {
            RecordState::Pending => peer.is_none(),
            RecordState::PinnedPendingAck | RecordState::Complete => peer.is_some(),
            RecordState::Revoked => true,
            RecordState::Consumed => false,
        },
    };
    if !valid {
        return Err(PairingError::StorageFailure);
    }
    Ok(Record {
        sid,
        role,
        expected,
        peer,
        state,
        hint,
    })
}

pub(super) fn validate_hint(hint: &LanHint) -> Result<()> {
    let allowed = match hint.ip {
        IpAddr::V4(ip) => ip.is_private() || ip.is_link_local(),
        IpAddr::V6(ip) => {
            let prefix = ip.segments()[0];
            prefix & 0xfe00 == 0xfc00 || prefix & 0xe000 == 0x2000
        }
    };
    if !allowed || hint.port == 0 {
        return Err(PairingError::InvalidQr);
    }
    Ok(())
}

pub(super) fn require(record: Option<Record>, role: RecordRole, peer: &Spki) -> Result<Record> {
    let record = record.ok_or(PairingError::TlsRejected)?;
    if record.role != role
        || record.expected != peer.fingerprint()
        || record.peer.as_ref().is_some_and(|saved| saved != peer)
    {
        return Err(PairingError::TlsRejected);
    }
    if record.state == RecordState::Revoked {
        return Err(PairingError::Revoked);
    }
    Ok(record)
}

pub(super) fn repair_required(
    conn: &Connection,
    local: &Spki,
    epoch: &[u8; 16],
    role: RecordRole,
    expected: &[u8; 32],
) -> Result<Option<[u8; 16]>> {
    let mut revoked = None;
    visit(conn, local, epoch, |record| {
        if record.role != role || record.expected != *expected {
            return Ok(());
        }
        if record.state != RecordState::Revoked {
            return Err(PairingError::AlreadyPaired);
        }
        if revoked.is_none_or(|saved| record.sid < saved) {
            revoked = Some(record.sid);
        }
        Ok(())
    })?;
    Ok(revoked)
}

pub(super) fn new_peer(
    conn: &Connection,
    local: &Spki,
    epoch: &[u8; 16],
    role: RecordRole,
    sid: &[u8; 16],
    expected: &[u8; 32],
    consent: Option<[u8; 16]>,
) -> Result<()> {
    let required = repair_required(conn, local, epoch, role, expected)?;
    match (required, consent) {
        (None, None) => Ok(()),
        (Some(old), Some(approved)) if old == approved && old != *sid => Ok(()),
        _ => Err(PairingError::Revoked),
    }
}
