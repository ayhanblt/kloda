use crate::backup_root::{self, Directories};
use crate::file_protocol::{Error, OperationState, Result, Upload};
use crate::file_receiver::rows::{self, Entry};
use crate::store::Store;
use rusqlite::{params, OptionalExtension};
use serde::Serialize;
use std::collections::{BTreeMap, BTreeSet};

#[path = "backup_retention_actions.rs"]
mod actions;
#[path = "backup_retention_files.rs"]
mod files;
#[path = "backup_retention_photos.rs"]
mod photos;
#[path = "backup_retention_protocol.rs"]
mod protocol;
pub(crate) use photos::validate_publication;
pub(crate) use protocol::{admit_create, live_identity, live_identity_from_connection};

const RETENTION_MS: i64 = 30 * 24 * 60 * 60 * 1000;
const GRAPH_LIMIT: usize = 65536;
#[derive(Clone)]
struct Saved {
    folder: String,
    copy: [u8; 24],
    live: [u8; 24],
    restore: Option<[u8; 24]>,
    ready: bool,
}
#[derive(Clone)]
struct Deleted {
    at: i64,
    expires: i64,
    phase: i64,
    dependencies: Vec<String>,
    signature: Option<String>,
}
struct Item {
    sid: [u8; 16],
    fingerprint: [u8; 32],
    entry: Entry,
    saved: Option<Saved>,
    deleted: Option<Deleted>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct View {
    id: String,
    device_fingerprint: String,
    name: String,
    source_revision: String,
    size: String,
    kind: &'static str,
    state: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    deleted_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    expires_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error_code: Option<Error>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Page {
    items: Vec<View>,
    #[serde(skip_serializing_if = "Option::is_none")]
    next_cursor: Option<String>,
}
fn now() -> Result<i64> {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .ok()
        .and_then(|v| i64::try_from(v.as_millis()).ok())
        .ok_or(Error::OutcomeUnknown)
}
fn deleted(store: &Store, id: &str) -> Result<Option<Deleted>> {
    store
        .conn
        .query_row(
            "SELECT deleted_at,expires_at,phase,dependencies,photo_signature FROM backup_deletions WHERE id=?1",
            [id],
            |r| {
                let json: String = r.get(3)?;
                let dependencies: Vec<String> =
                    serde_json::from_str(&json).map_err(|_| rusqlite::Error::InvalidQuery)?;
                if json.len() > 8192
                    || dependencies.len() > 8
                    || dependencies.iter().collect::<BTreeSet<_>>().len() != dependencies.len()
                    || dependencies
                        .iter()
                        .any(|v| crate::qr_base64::fixed::<16>(v).is_err())
                {
                    return Err(rusqlite::Error::InvalidQuery);
                }
                Ok(Deleted {
                    at: r.get(0)?,
                    expires: r.get(1)?,
                    phase: r.get(2)?,
                    dependencies,
                    signature:r.get(4)?,
                })
            },
        )
        .optional()
        .map_err(rows::storage)
}
fn saved(store: &Store, id: &str) -> Result<Option<Saved>> {
    store.conn.query_row("SELECT folder,copy_identity,live_identity,restore_identity,ready FROM backup_protections WHERE id=?1",[id],|r| {
        let blob = |i| -> rusqlite::Result<[u8;24]> { r.get::<_,Vec<u8>>(i)?.try_into().map_err(|_|rusqlite::Error::InvalidQuery) };
        let restore: Option<Vec<u8>> = r.get(3)?;
        Ok(Saved {folder:r.get(0)?,copy:blob(1)?,live:blob(2)?,restore:restore.map(|v|v.try_into().map_err(|_|rusqlite::Error::InvalidQuery)).transpose()?,ready:r.get(4)?})
    }).optional().map_err(rows::storage)
}
fn load(store: &Store) -> Result<BTreeMap<String, Item>> {
    store.ready()?;
    let mut stmt = store
        .conn
        .prepare("SELECT id,sid FROM file_operations WHERE state=4 ORDER BY id LIMIT 65537")
        .map_err(rows::storage)?;
    let records = stmt
        .query_map([], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, Vec<u8>>(1)?))
        })
        .map_err(rows::storage)?;
    let mut result = BTreeMap::new();
    for row in records {
        if result.len() == GRAPH_LIMIT {
            return Err(Error::BackupBusy);
        }
        let (id, sid) = row.map_err(rows::storage)?;
        let sid: [u8; 16] = sid.try_into().map_err(|_| Error::OutcomeUnknown)?;
        let record = store.record(&sid)?.ok_or(Error::OutcomeUnknown)?;
        if record.role != crate::store_rows::RecordRole::Pc
            || record
                .peer
                .as_ref()
                .is_none_or(|p| p.fingerprint() != record.expected)
        {
            return Err(Error::OutcomeUnknown);
        }
        result.insert(
            id.clone(),
            Item {
                sid,
                fingerprint: record.expected,
                entry: rows::get(&store.conn, &sid, &id)?,
                saved: saved(store, &id)?,
                deleted: deleted(store, &id)?,
            },
        );
    }
    Ok(result)
}
fn directories(store: &Store, item: &Item) -> Result<Directories> {
    let folder = if let Some(saved) = &item.saved {
        saved.folder.clone()
    } else {
        let scope = store
            .backup_scope(&item.sid)?
            .ok_or(Error::BackupScopeChanged)?;
        if scope.binding != item.entry.binding {
            return Err(Error::BackupScopeChanged);
        }
        scope.folder
    };
    Ok(backup_root::acquire(
        &folder,
        &item.fingerprint,
        item.entry.binding,
    )?)
}
fn folder(store: &Store, item: &Item) -> Result<String> {
    if let Some(saved) = &item.saved {
        return Ok(saved.folder.clone());
    }
    let scope = store
        .backup_scope(&item.sid)?
        .ok_or(Error::BackupScopeChanged)?;
    if scope.binding != item.entry.binding {
        return Err(Error::BackupScopeChanged);
    }
    Ok(scope.folder)
}
fn active(item: &Item) -> bool {
    item.deleted.as_ref().is_none_or(|v| v.phase == 4)
}
fn retained(item: &Item) -> bool {
    item.deleted.as_ref().is_none_or(|v| v.phase != 6)
}

pub(crate) fn list(store: &Store, after: Option<&str>, trash: bool) -> Result<String> {
    if let Some(id) = after {
        crate::qr_base64::fixed::<16>(id).map_err(|_| Error::InvalidRequest)?;
    }
    let items = load(store)?;
    let graph = photos::graph(store, &items);
    let resources = graph
        .as_ref()
        .map(|g| g.resources.clone())
        .unwrap_or_default();
    let mut views = Vec::new();
    for (id, item) in &items {
        if after.is_some_and(|cursor| id.as_str() <= cursor)
            || resources.contains(id)
            || !retained(item)
            || (active(item) == trash)
        {
            continue;
        }
        let photo = item.entry.operation.name.starts_with(photos::PREFIX);
        let error = graph.as_ref().err().copied().or_else(|| {
            if !active(item) && item.deleted.as_ref().is_some_and(|d| d.phase != 2) {
                return Some(Error::OutcomeUnknown);
            }
            files::verify_visible(store, item).err()
        });
        views.push(View {
            id: id.clone(),
            device_fingerprint: crate::qr_base64::encode(&item.fingerprint),
            name: item.entry.operation.name.clone(),
            source_revision: item.entry.operation.source_revision.clone(),
            size: item.entry.operation.size.to_string(),
            kind: if photo { "photos" } else { "files" },
            state: if error.is_some() {
                "unavailable"
            } else if trash {
                "trash"
            } else {
                "active"
            },
            deleted_at: item.deleted.as_ref().map(|d| d.at.to_string()),
            expires_at: item
                .deleted
                .as_ref()
                .filter(|_| trash)
                .map(|d| d.expires.to_string()),
            error_code: error,
        });
        if views.len() == 33 {
            break;
        }
    }
    let next_cursor = if views.len() > 32 {
        views.pop();
        views.last().map(|v| v.id.clone())
    } else {
        None
    };
    serde_json::to_string(&Page {
        items: views,
        next_cursor,
    })
    .map_err(|_| Error::OutcomeUnknown)
}

pub(crate) fn mutate<T>(
    store: &mut Store,
    ids: &str,
    restore: bool,
    authorize: impl Fn() -> crate::error::Result<T>,
) -> Result<String> {
    if ids.len() > 1024 {
        return Err(Error::InvalidRequest);
    }
    let ids: Vec<String> = serde_json::from_str(ids).map_err(|_| Error::InvalidRequest)?;
    if ids.is_empty() || ids.len() > 32 || ids.iter().collect::<BTreeSet<_>>().len() != ids.len() {
        return Err(Error::InvalidRequest);
    }
    for id in &ids {
        crate::qr_base64::fixed::<16>(id).map_err(|_| Error::InvalidRequest)?;
    }
    let mut results = Vec::new();
    for id in ids {
        // Hold the foreground authorization lock through the durable transition and filesystem work.
        let result = authorize()
            .map_err(Error::from)
            .and_then(|_permit| actions::change(store, &id, restore, now()?));
        results
            .push(serde_json::json!({"id":id,"success":result.is_ok(),"errorCode":result.err()}));
    }
    serde_json::to_string(&serde_json::json!({"items":results})).map_err(|_| Error::OutcomeUnknown)
}
pub(crate) fn maintenance(store: &mut Store) -> Result<()> {
    actions::maintain(store, now()?)
}

#[cfg(test)]
#[path = "backup_retention_tests.rs"]
mod tests;
