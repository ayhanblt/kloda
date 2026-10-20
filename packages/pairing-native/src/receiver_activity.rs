use crate::error::{PairingError, Result};
use crate::store::{storage, Store};
use crate::store_rows::{RecordRole, RecordState};
use rusqlite::params;
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Activity {
    pub(crate) receiver_available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) error_code: Option<&'static str>,
    pub(crate) items: Vec<Item>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) next_cursor: Option<String>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Item {
    pub(crate) id: String,
    pub(crate) device_fingerprint: String,
    pub(crate) name: String,
    pub(crate) received_bytes: String,
    pub(crate) total_bytes: String,
    pub(crate) state: &'static str,
}

/// Local-owner history only: journal rows never confer a current file grant.
pub(crate) fn read(store: &Store, after: Option<&str>) -> Result<Activity> {
    if let Some(cursor) = after {
        crate::qr_base64::fixed::<16>(cursor).map_err(|_| PairingError::InvalidRequest)?;
    }
    store.ready()?;
    let mut statement = store
        .conn
        .prepare(
            "SELECT id,sid,name,offset,size,state FROM file_operations
         WHERE (?1 IS NULL OR id>?1) ORDER BY id LIMIT 33",
        )
        .map_err(storage)?;
    let mut rows = statement.query(params![after]).map_err(storage)?;
    let mut items = Vec::with_capacity(33);
    while let Some(row) = rows.next().map_err(storage)? {
        let id: String = row.get(0).map_err(storage)?;
        crate::qr_base64::fixed::<16>(&id).map_err(storage)?;
        let sid = crate::store_rows::blob::<16>(row, 1)?;
        let record = store.record(&sid)?.ok_or(PairingError::StorageFailure)?;
        if record.role != RecordRole::Pc
            || !matches!(record.state, RecordState::Complete | RecordState::Revoked)
            || record
                .peer
                .as_ref()
                .is_none_or(|peer| peer.fingerprint() != record.expected)
        {
            return Err(PairingError::StorageFailure);
        }
        let name: String = row.get(2).map_err(storage)?;
        let offset: i64 = row.get(3).map_err(storage)?;
        let size: i64 = row.get(4).map_err(storage)?;
        let state: i64 = row.get(5).map_err(storage)?;
        if !crate::file_schema::safe_name(&name)
            || offset < 0
            || offset > size
            || (state != 1 && offset != size)
        {
            return Err(PairingError::StorageFailure);
        }
        let state = match state {
            1 => "receiving",
            2 => "validating",
            3 => "publishing",
            4 => "completed",
            _ => return Err(PairingError::StorageFailure),
        };
        items.push(Item {
            id,
            device_fingerprint: crate::qr_base64::encode(&record.expected),
            name,
            received_bytes: offset.to_string(),
            total_bytes: size.to_string(),
            state,
        });
    }
    let next_cursor = if items.len() > 32 {
        items.pop();
        items.last().map(|item| item.id.clone())
    } else {
        None
    };
    Ok(Activity {
        receiver_available: false,
        error_code: None,
        items,
        next_cursor,
    })
}
