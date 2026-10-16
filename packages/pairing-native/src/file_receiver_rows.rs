use crate::backup_root::Binding;
use crate::file_protocol::{Error, Operation, OperationState, Result, Upload};
use crate::store::Store;
use crate::store_acl::Scope;
use rusqlite::{
    params, Connection, ErrorCode, OptionalExtension, Row, Transaction, TransactionBehavior,
};

pub(super) struct Entry {
    pub(super) id: [u8; 16],
    pub(super) operation: Operation,
    pub(super) revision: i64,
    pub(super) binding: Binding,
    pub(super) identity: [u8; 24],
}

fn blob<const N: usize>(row: &Row<'_>, index: usize) -> rusqlite::Result<[u8; N]> {
    row.get_ref(index)?
        .as_blob()?
        .try_into()
        .map_err(|_| rusqlite::Error::InvalidQuery)
}

fn decode(row: &Row<'_>) -> rusqlite::Result<Entry> {
    let state = match row.get::<_, i64>(8)? {
        1 => OperationState::Receiving,
        2 => OperationState::Validating,
        3 => OperationState::Publishing,
        4 => OperationState::Completed,
        _ => return Err(rusqlite::Error::InvalidQuery),
    };
    let id: String = row.get(0)?;
    let opaque_id =
        crate::qr_base64::fixed::<16>(&id).map_err(|_| rusqlite::Error::InvalidQuery)?;
    let size: i64 = row.get(6)?;
    let offset: i64 = row.get(7)?;
    let entry = Entry {
        id: opaque_id,
        operation: Operation {
            id,
            request_id: row.get(1)?,
            source_id: row.get(2)?,
            source_revision: row.get(3)?,
            name: row.get(4)?,
            sha256: crate::qr_base64::encode(&blob::<32>(row, 5)?),
            size: size
                .try_into()
                .map_err(|_| rusqlite::Error::IntegralValueOutOfRange(6, size))?,
            offset: offset
                .try_into()
                .map_err(|_| rusqlite::Error::IntegralValueOutOfRange(7, offset))?,
            state,
        },
        revision: row.get(9)?,
        binding: Binding {
            root: blob(row, 10)?,
            peer: blob(row, 11)?,
        },
        identity: blob(row, 12)?,
    };
    if entry.revision <= 0
        || entry.identity == [0; 24]
        || entry.operation.offset > entry.operation.size
        || (state != OperationState::Receiving && entry.operation.offset != entry.operation.size)
        || !crate::file_schema::safe_name(&entry.operation.name)
        || entry.operation.source_revision.is_empty()
        || entry.operation.source_revision.len() > 1024
    {
        return Err(rusqlite::Error::InvalidQuery);
    }
    for id in [&entry.operation.request_id, &entry.operation.source_id] {
        crate::qr_base64::fixed::<16>(id).map_err(|_| rusqlite::Error::InvalidQuery)?;
    }
    Ok(entry)
}

pub(super) fn get(conn: &Connection, sid: &[u8; 16], id: &str) -> Result<Entry> {
    crate::qr_base64::fixed::<16>(id).map_err(|_| Error::InvalidRequest)?;
    conn.query_row(
        "SELECT id,request_id,source_id,source_revision,name,sha256,size,offset,state,revision,
        root,peer_root,file_identity FROM file_operations WHERE sid=?1 AND id=?2",
        params![sid.as_slice(), id],
        decode,
    )
    .optional()
    .map_err(storage)?
    .ok_or(Error::NotFound)
}

pub(super) fn readable(
    conn: &Connection,
    sid: &[u8; 16],
    peer: &crate::key::Spki,
    id: &str,
) -> Result<Entry> {
    crate::qr_base64::fixed::<16>(id).map_err(|_| Error::InvalidRequest)?;
    conn.query_row(
        "SELECT f.id,f.request_id,f.source_id,f.source_revision,f.name,f.sha256,f.size,
        f.offset,f.state,f.revision,f.root,f.peer_root,f.file_identity FROM file_operations f
        JOIN records r ON r.sid=f.sid WHERE f.id=?1 AND (f.sid=?2 OR
        (f.state=4 AND r.role=1 AND r.state IN (2,3) AND r.expected=?3 AND r.peer=?4))",
        params![
            id,
            sid.as_slice(),
            peer.fingerprint().as_slice(),
            peer.as_bytes().as_slice()
        ],
        decode,
    )
    .optional()
    .map_err(storage)?
    .ok_or(Error::NotFound)
}

pub(super) fn by_request(conn: &Connection, sid: &[u8; 16], id: &str) -> Result<Option<Entry>> {
    conn.query_row(
        "SELECT id,request_id,source_id,source_revision,name,sha256,size,offset,state,revision,
        root,peer_root,file_identity FROM file_operations WHERE sid=?1 AND request_id=?2",
        params![sid.as_slice(), id],
        decode,
    )
    .optional()
    .map_err(storage)
}

pub(super) fn list(
    conn: &Connection,
    peer: &crate::key::Spki,
    scope: &Scope,
    directories: &crate::backup_root::Directories,
    after: Option<&str>,
) -> Result<Vec<Operation>> {
    if let Some(id) = after {
        crate::qr_base64::fixed::<16>(id).map_err(|_| Error::InvalidRequest)?;
    }
    let mut statement = conn.prepare(
        "SELECT f.id,f.request_id,f.source_id,f.source_revision,f.name,f.sha256,f.size,f.offset,f.state,
        f.revision,f.root,f.peer_root,f.file_identity FROM file_operations f JOIN records r ON r.sid=f.sid
        WHERE f.root=?1 AND f.peer_root=?2 AND f.state=4 AND r.role=1 AND r.state IN (2,3)
        AND r.expected=?3 AND r.peer=?4 AND (?5 IS NULL OR f.id>?5) ORDER BY f.id LIMIT 32",
    ).map_err(storage)?;
    let rows = statement
        .query_map(
            params![
                scope.binding.root.as_slice(),
                scope.binding.peer.as_slice(),
                peer.fingerprint().as_slice(),
                peer.as_bytes().as_slice(),
                after
            ],
            decode,
        )
        .map_err(storage)?;
    rows.map(|row| {
        let entry = row.map_err(storage)?;
        super::checked_file(directories, &entry, true, false)?;
        Ok(entry.operation)
    })
    .collect()
}

pub(super) fn write<T>(
    store: &mut Store,
    change: impl FnOnce(&Transaction<'_>, &crate::key::Spki, &[u8; 16]) -> Result<T>,
) -> Result<T> {
    store.ready()?;
    let tx = store
        .conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(storage)?;
    let value = match change(&tx, &store.local, &store.epoch) {
        Ok(value) => value,
        Err(error) => {
            if tx.rollback().is_err() {
                store.poisoned = true;
                return Err(Error::OutcomeUnknown);
            }
            return Err(error);
        }
    };
    if tx.commit().is_err() {
        store.poisoned = true;
        return Err(Error::OutcomeUnknown);
    }
    Ok(value)
}

pub(super) fn insert(
    store: &mut Store,
    sid: &[u8; 16],
    id: &str,
    upload: Upload,
    scope: &Scope,
    identity: &[u8; 24],
) -> Result<Entry> {
    let hash = crate::qr_base64::fixed::<32>(&upload.sha256).map_err(|_| Error::InvalidRequest)?;
    let size = i64::try_from(upload.size).map_err(|_| Error::InvalidRequest)?;
    write(store, |tx, _, _| {
        tx.execute("INSERT INTO file_operations(id,sid,request_id,source_id,source_revision,name,sha256,
            size,offset,revision,root,peer_root,file_identity,state) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,0,?9,?10,?11,?12,1)",
            params![id, sid.as_slice(), upload.request_id, upload.source_id, upload.source_revision,
                upload.name, hash.as_slice(), size, scope.revision, scope.binding.root.as_slice(),
                scope.binding.peer.as_slice(), identity.as_slice()]).map_err(storage)?;
        get(tx, sid, id)
    })
}

pub(super) fn advance(
    store: &mut Store,
    sid: &[u8; 16],
    entry: &mut Entry,
    offset: u64,
    state: OperationState,
) -> Result<()> {
    let next = i64::try_from(offset).map_err(|_| Error::InvalidRequest)?;
    let previous = i64::try_from(entry.operation.offset).map_err(|_| Error::OutcomeUnknown)?;
    write(store, |tx, _, _| {
        let changed = tx.execute("UPDATE file_operations SET offset=?1,state=?2 WHERE sid=?3 AND id=?4 AND offset=?5 AND state=?6",
            params![next, code(state), sid.as_slice(), entry.operation.id, previous,
                code(entry.operation.state)]).map_err(storage)?;
        if changed != 1 {
            return Err(Error::Conflict);
        }
        Ok(())
    })?;
    entry.operation.offset = offset;
    entry.operation.state = state;
    Ok(())
}

fn code(state: OperationState) -> i64 {
    match state {
        OperationState::Receiving => 1,
        OperationState::Validating => 2,
        OperationState::Publishing => 3,
        OperationState::Completed => 4,
    }
}

pub(super) fn storage(error: rusqlite::Error) -> Error {
    match error {
        rusqlite::Error::SqliteFailure(error, _) => match error.code {
            ErrorCode::DatabaseBusy | ErrorCode::DatabaseLocked => Error::AclBusy,
            ErrorCode::DiskFull | ErrorCode::PermissionDenied | ErrorCode::ReadOnly => {
                Error::AclUnavailable
            }
            _ => Error::OutcomeUnknown,
        },
        _ => Error::OutcomeUnknown,
    }
}
