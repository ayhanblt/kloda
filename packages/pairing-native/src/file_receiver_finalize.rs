use super::{admit, checked_file, final_name, io_error, rows, scope_matches, temp_name};
use crate::backup_root::Directories;
use crate::file_protocol::{Error, OperationState, Result, CHUNK_LIMIT};
use crate::key::Spki;
use crate::store::Store;
use cap_std::fs::File;
use ring::digest::{Context, SHA256};
use std::collections::HashMap;
use std::io::Read;

struct HashWork {
    sid: [u8; 16],
    file: File,
    digest: Context,
    offset: u64,
}
pub(super) struct Hashes(HashMap<[u8; 16], HashWork>);
impl Hashes {
    pub(super) fn new() -> Self {
        Self(HashMap::new())
    }
    pub(super) fn clear(&mut self) {
        self.0.clear();
    }
    pub(super) fn revoke(&mut self, sid: &[u8; 16]) {
        self.0.retain(|_, work| &work.sid != sid);
    }
}

pub(super) fn step(
    hashes: &mut Hashes,
    store: &mut Store,
    sid: &[u8; 16],
    peer: &Spki,
    directories: &Directories,
    entry: &mut rows::Entry,
) -> Result<bool> {
    if entry.operation.state == OperationState::Completed {
        checked_file(directories, entry, true, false)?;
        return Ok(false);
    }
    if entry.operation.state == OperationState::Publishing {
        publish(store, sid, peer, directories, entry)?;
        return Ok(false);
    }
    let size = entry.operation.size;
    if entry.operation.offset != entry.operation.size {
        return Err(Error::Conflict);
    }
    let file = checked_file(directories, entry, false, false)?;
    if file.metadata().map_err(io_error)?.len() != entry.operation.size {
        return Err(Error::Conflict);
    }
    if hashes.0.len() >= 16 && !hashes.0.contains_key(&entry.id) {
        return Err(Error::BackupBusy);
    }
    if entry.operation.state == OperationState::Receiving {
        rows::advance(store, sid, entry, size, OperationState::Validating)?;
    }
    let work = hashes.0.entry(entry.id).or_insert_with(|| HashWork {
        sid: *sid,
        file,
        digest: Context::new(&SHA256),
        offset: 0,
    });
    if crate::backup_root::file_identity(&work.file)? != entry.identity {
        return Err(Error::Conflict);
    }
    if work.file.metadata().map_err(io_error)?.len() != entry.operation.size {
        return Err(Error::Conflict);
    }
    let length = (entry.operation.size - work.offset).min(CHUNK_LIMIT as u64) as usize;
    let mut bytes = [0; CHUNK_LIMIT];
    if let Err(error) = work.file.read_exact(&mut bytes[..length]) {
        hashes.0.remove(&entry.id);
        return Err(io_error(error));
    }
    work.digest.update(&bytes[..length]);
    work.offset += length as u64;
    if work.offset != entry.operation.size {
        return Ok(true);
    }
    let work = hashes.0.remove(&entry.id).ok_or(Error::OutcomeUnknown)?;
    let hash = crate::qr_base64::fixed::<32>(&entry.operation.sha256)
        .map_err(|_| Error::OutcomeUnknown)?;
    if work.digest.finish().as_ref() != hash {
        return Err(Error::HashMismatch);
    }
    work.file.sync_all().map_err(io_error)?;
    let (scope, current) = admit(store, sid, peer)?;
    scope_matches(entry, &scope)?;
    checked_file(&current, entry, false, false)?;
    rows::advance(store, sid, entry, size, OperationState::Publishing)?;
    publish(store, sid, peer, &current, entry)?;
    Ok(false)
}

pub(super) fn publish(
    store: &mut Store,
    sid: &[u8; 16],
    peer: &Spki,
    _: &Directories,
    entry: &mut rows::Entry,
) -> Result<()> {
    if entry.operation.state != OperationState::Publishing {
        return Err(Error::Conflict);
    }
    let (scope, directories) = admit(store, sid, peer)?;
    scope_matches(entry, &scope)?;
    crate::backup_retention::validate_publication(store, sid, entry, &directories)?;
    let final_path = final_name(&entry.operation.id);
    match directories.peer.symlink_metadata(&final_path) {
        Ok(_) => {
            checked_file(&directories, entry, true, false)?;
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            let file = checked_file(&directories, entry, false, false)?;
            if file.metadata().map_err(io_error)?.len() != entry.operation.size {
                return Err(Error::OutcomeUnknown);
            }
            match directories.peer.hard_link(
                temp_name(&entry.operation.id),
                &directories.peer,
                &final_path,
            ) {
                Ok(()) => (),
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => (),
                Err(error) => return Err(io_error(error)),
            }
        }
        Err(error) => return Err(io_error(error)),
    }
    // The retained native temp link proves publication ownership; unknown final files are never adopted.
    let final_file = checked_file(&directories, entry, true, true)?;
    final_file.sync_all().map_err(io_error)?;
    directories.sync()?;
    let size = entry.operation.size;
    rows::advance(store, sid, entry, size, OperationState::Completed)
}
