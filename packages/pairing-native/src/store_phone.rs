use crate::error::{PairingError, Result};
use crate::key::Spki;
use crate::qr::LanHint;
use crate::store::{storage, Store};
use crate::store_rows::{load, new_peer, require, validate_hint, Record, RecordRole, RecordState};
use rusqlite::params;

impl Store {
    pub(crate) fn phone_pending(
        &mut self,
        sid: &[u8; 16],
        expected: &[u8; 32],
        hint: &LanHint,
        repair_consent: Option<[u8; 16]>,
    ) -> Result<Record> {
        validate_hint(hint)?;
        self.write(|tx, local, epoch| {
            if let Some(record) = load(tx, sid, local, epoch)? {
                return Err(if record.state == RecordState::Revoked {
                    PairingError::Revoked
                } else {
                    PairingError::AlreadyPaired
                });
            }
            new_peer(
                tx,
                local,
                epoch,
                RecordRole::Phone,
                sid,
                expected,
                repair_consent,
            )?;
            tx.execute(
                "INSERT INTO records(sid,version,role,local,epoch,expected,peer,state)
                VALUES(?1,1,2,?2,?3,?4,NULL,4)",
                params![
                    sid.as_slice(),
                    local.as_bytes().as_slice(),
                    epoch.as_slice(),
                    expected.as_slice()
                ],
            )
            .map_err(storage)?;
            tx.execute(
                "INSERT INTO hints(sid,ip,port) VALUES(?1,?2,?3)",
                params![sid.as_slice(), hint.ip.to_string(), i64::from(hint.port)],
            )
            .map_err(storage)?;
            load(tx, sid, local, epoch)?.ok_or(PairingError::StorageFailure)
        })
    }

    pub(crate) fn phone_recover(&self, sid: &[u8; 16], peer: &Spki) -> Result<Record> {
        require(self.record(sid)?, RecordRole::Phone, peer)
    }

    pub(crate) fn phone_pin(&mut self, sid: &[u8; 16], peer: &Spki) -> Result<Record> {
        self.write(|tx, local, epoch| {
            let mut record = require(load(tx, sid, local, epoch)?, RecordRole::Phone, peer)?;
            if record.state == RecordState::Pending {
                let changed = tx
                    .execute(
                        "UPDATE records SET peer=?2,state=5 WHERE sid=?1 AND state=4",
                        params![sid.as_slice(), peer.as_bytes().as_slice()],
                    )
                    .map_err(storage)?;
                if changed != 1 {
                    return Err(PairingError::StorageFailure);
                }
                record.peer = Some(peer.clone());
                record.state = RecordState::PinnedPendingAck;
            } else if !matches!(
                record.state,
                RecordState::PinnedPendingAck | RecordState::Complete
            ) {
                return Err(PairingError::TlsRejected);
            }
            Ok(record)
        })
    }

    pub(crate) fn phone_complete(&mut self, sid: &[u8; 16], peer: &Spki) -> Result<Record> {
        self.write(|tx, local, epoch| {
            let mut record = require(load(tx, sid, local, epoch)?, RecordRole::Phone, peer)?;
            if record.state == RecordState::PinnedPendingAck {
                let changed = tx
                    .execute(
                        "UPDATE records SET state=2 WHERE sid=?1 AND state=5",
                        [sid.as_slice()],
                    )
                    .map_err(storage)?;
                if changed != 1 {
                    return Err(PairingError::StorageFailure);
                }
                record.state = RecordState::Complete;
            } else if record.state != RecordState::Complete {
                return Err(PairingError::TlsRejected);
            }
            Ok(record)
        })
    }

    pub(crate) fn phone_revoke(&mut self, sid: &[u8; 16]) -> Result<Record> {
        self.revoke(sid, RecordRole::Phone)
    }
}
