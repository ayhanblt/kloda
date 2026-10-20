use crate::error::{PairingError, Result};
use crate::status::BackupScopeStatus;
use crate::store::{storage, Store};
use crate::store_rows::{Record, RecordRole, RecordState};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Devices {
    pub(crate) items: Vec<Device>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) next_cursor: Option<String>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Device {
    record_id: String,
    peer_fingerprint: String,
    trust: &'static str,
    backup_scope: BackupScopeStatus,
}

// Native owner metadata only; trust and current file authority remain separate.
pub(crate) fn read(
    store: &Store,
    after: Option<&str>,
    scope: impl Fn(&Record) -> BackupScopeStatus,
) -> Result<Devices> {
    let cursor = after
        .map(crate::qr_base64::fixed::<16>)
        .transpose()
        .map_err(|_| PairingError::InvalidRequest)?;
    store.ready()?;
    let mut statement = store
        .conn
        .prepare(
            "SELECT sid FROM records WHERE role=1 AND state IN (1,2,3)
         AND (?1 IS NULL OR sid>?1) ORDER BY sid LIMIT 33",
        )
        .map_err(storage)?;
    let mut rows = statement
        .query([cursor.as_ref().map(|sid| sid.as_slice())])
        .map_err(storage)?;
    let mut items = Vec::with_capacity(33);
    while let Some(row) = rows.next().map_err(storage)? {
        let sid = crate::store_rows::blob::<16>(row, 0)?;
        items.push(read_record(store, &sid, &scope)?);
    }
    let next_cursor = if items.len() > 32 {
        items.pop();
        items.last().map(|item| item.record_id.clone())
    } else {
        None
    };
    Ok(Devices { items, next_cursor })
}

pub(crate) fn read_one(
    store: &Store,
    reference: &str,
    scope: impl Fn(&Record) -> BackupScopeStatus,
) -> Result<Device> {
    let sid = crate::qr_base64::fixed::<16>(reference).map_err(|_| PairingError::InvalidRequest)?;
    read_record(store, &sid, &scope)
}

fn read_record(
    store: &Store,
    sid: &[u8; 16],
    scope: &impl Fn(&Record) -> BackupScopeStatus,
) -> Result<Device> {
    let record = store.record(sid)?.ok_or(PairingError::CandidateStale)?;
    let trust = match (record.role, record.state) {
        (RecordRole::Pc, RecordState::Complete) => "complete",
        (RecordRole::Pc, RecordState::Consumed) => "consumed_pending_ack",
        (RecordRole::Pc, RecordState::Revoked) => "revoked",
        _ => return Err(PairingError::CandidateStale),
    };
    if record
        .peer
        .as_ref()
        .is_none_or(|peer| peer.fingerprint() != record.expected)
    {
        return Err(PairingError::StorageFailure);
    }
    Ok(Device {
        record_id: crate::qr_base64::encode(sid),
        peer_fingerprint: crate::qr_base64::encode(&record.expected),
        trust,
        backup_scope: scope(&record),
    })
}

pub(crate) fn backup_status(
    store: &Store,
    record: &Record,
    fatal: Option<PairingError>,
) -> BackupScopeStatus {
    let mut status = BackupScopeStatus {
        state: "not_approved",
        folder: None,
        revision: None,
        error_code: None,
    };
    if let Some(error) = fatal {
        status.state = "unavailable";
        status.error_code = Some(error.code());
        return status;
    }
    let scope = match store.backup_scope(&record.sid) {
        Ok(Some(scope)) => scope,
        Ok(None) => return status,
        Err(error) => {
            status.state = "unavailable";
            status.error_code = Some(error.code());
            return status;
        }
    };
    status.revision = Some(scope.revision.to_string());
    if !scope.approved {
        status.state = "revoked";
    } else {
        match crate::backup_root::verify(&scope.folder, &record.expected, scope.binding) {
            Ok(()) => status.state = "approved",
            Err(error) => {
                status.state = "unavailable";
                status.error_code = Some(error.code());
            }
        }
    }
    status.folder = Some(scope.folder);
    status
}

#[cfg(test)]
#[path = "paired_devices_tests.rs"]
mod tests;
