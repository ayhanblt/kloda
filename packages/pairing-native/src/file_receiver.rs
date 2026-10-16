use crate::backup_root::{self, Directories};
use crate::file_protocol::{Error, OperationState, Request, Response, Result, CHUNK_LIMIT};
use crate::key::Spki;
use crate::store::Store;
use crate::store_acl::Scope;
use crate::store_rows::{RecordRole, RecordState};
use cap_std::fs::File;
use std::io::{Read, Seek, SeekFrom};

#[path = "file_receiver_commands.rs"]
mod commands;
#[path = "file_receiver_finalize.rs"]
mod finalize;
#[path = "file_receiver_rows.rs"]
mod rows;
use rows::Entry;

pub(crate) struct Receiver {
    hashes: finalize::Hashes,
}

impl Receiver {
    pub(crate) fn new() -> Self {
        Self {
            hashes: finalize::Hashes::new(),
        }
    }
    pub(crate) fn cancel_all(&mut self) {
        self.hashes.clear();
    }

    pub(crate) fn execute(
        &mut self,
        store: &mut Store,
        sid: &[u8; 16],
        peer: &Spki,
        request: Request,
    ) -> Result<Response> {
        if matches!(request, Request::RevokePair) {
            return self.revoke(store, sid, peer);
        }
        let (scope, directories) = admit(store, sid, peer)?;
        match request {
            Request::Create(upload) => self.create(store, sid, peer, &scope, &directories, upload),
            Request::Chunk { id, offset, bytes } => {
                let mut entry = own(store, sid, &scope, &id)?;
                self.chunk(store, sid, &directories, &mut entry, offset, &bytes)?;
                Ok(Response::Operation(entry.operation))
            }
            Request::Finalize { id } => {
                let mut entry = own(store, sid, &scope, &id)?;
                if finalize::step(&mut self.hashes, store, sid, peer, &directories, &mut entry)? {
                    Ok(Response::Pending)
                } else {
                    Ok(Response::Operation(entry.operation))
                }
            }
            Request::Status { id } => {
                let mut entry = readable(store, sid, peer, &scope, &id)?;
                if entry.operation.state == OperationState::Publishing {
                    finalize::publish(store, sid, peer, &directories, &mut entry)?;
                }
                checked_file(
                    &directories,
                    &entry,
                    entry.operation.state == OperationState::Completed,
                    false,
                )?;
                Ok(Response::Operation(entry.operation))
            }
            Request::List { after } => Ok(Response::List(rows::list(
                &store.conn,
                peer,
                &scope,
                &directories,
                after.as_deref(),
            )?)),
            Request::Restore { id, offset } => {
                let entry = readable(store, sid, peer, &scope, &id)?;
                if entry.operation.state != OperationState::Completed {
                    return Err(Error::Conflict);
                }
                if offset > entry.operation.size {
                    return Err(Error::InvalidRequest);
                }
                let mut file = checked_file(&directories, &entry, true, false)?;
                let length = (entry.operation.size - offset).min(CHUNK_LIMIT as u64) as usize;
                let mut bytes = vec![0; length];
                file.seek(SeekFrom::Start(offset)).map_err(io_error)?;
                file.read_exact(&mut bytes).map_err(io_error)?;
                Ok(Response::Data {
                    bytes,
                    offset,
                    size: entry.operation.size,
                })
            }
            Request::RevokePair => unreachable!(),
        }
    }
}

pub(super) fn admit(store: &Store, sid: &[u8; 16], peer: &Spki) -> Result<(Scope, Directories)> {
    let record = store.record(sid)?.ok_or(Error::Denied)?;
    if record.role != RecordRole::Pc
        || record.state != RecordState::Complete
        || record.expected != peer.fingerprint()
        || record.peer.as_ref() != Some(peer)
    {
        return Err(Error::Denied);
    }
    let scope = store.backup_scope(sid)?.ok_or(Error::Denied)?;
    if !scope.approved {
        return Err(Error::Denied);
    }
    let directories = backup_root::acquire(&scope.folder, &record.expected, scope.binding)?;
    Ok((scope, directories))
}

fn own(store: &Store, sid: &[u8; 16], scope: &Scope, id: &str) -> Result<Entry> {
    let entry = rows::get(&store.conn, sid, id)?;
    scope_matches(&entry, scope)?;
    Ok(entry)
}

fn readable(store: &Store, sid: &[u8; 16], peer: &Spki, scope: &Scope, id: &str) -> Result<Entry> {
    let entry = rows::readable(&store.conn, sid, peer, id)?;
    scope_matches(&entry, scope)?;
    Ok(entry)
}

fn scope_matches(entry: &Entry, scope: &Scope) -> Result<()> {
    // A fresh matching grant authorizes completed reads; pending work cannot cross a grant revision.
    if entry.binding != scope.binding
        || (entry.operation.state != OperationState::Completed && entry.revision != scope.revision)
    {
        return Err(Error::BackupScopeChanged);
    }
    Ok(())
}

pub(super) fn temp_name(id: &str) -> String {
    format!(".kloda-{id}.part")
}
pub(super) fn final_name(id: &str) -> String {
    format!("{id}.media")
}

fn checked_file(
    directories: &Directories,
    entry: &Entry,
    final_file: bool,
    writable: bool,
) -> Result<File> {
    let name = if final_file {
        final_name(&entry.operation.id)
    } else {
        temp_name(&entry.operation.id)
    };
    let file = backup_root::open_file(&directories.peer, &name, false, writable)?;
    if backup_root::file_identity(&file)? != entry.identity {
        return Err(Error::Conflict);
    }
    let length = file.metadata().map_err(io_error)?.len();
    if length < entry.operation.offset
        || length > entry.operation.size
        || ((final_file || entry.operation.state != OperationState::Receiving)
            && length != entry.operation.size)
    {
        return Err(Error::OutcomeUnknown);
    }
    Ok(file)
}

pub(super) fn io_error(error: std::io::Error) -> Error {
    backup_root::target_error(error).into()
}

#[cfg(test)]
#[path = "file_receiver_tests.rs"]
mod tests;
