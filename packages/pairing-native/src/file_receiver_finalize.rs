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
        checked_file(&store.conn, directories, entry, true, false)?;
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
    let file = checked_file(&store.conn, directories, entry, false, false)?;
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
    checked_file(&store.conn, &current, entry, false, false)?;
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
    let photo_resources =
        crate::backup_retention::validate_publication(store, sid, entry, &directories)?;
    let path_record = crate::backup_layout::lookup(&store.conn, &entry.operation.id)?;
    let modern = path_record.is_some();
    let staging = crate::backup_layout::staging_dir(&directories, modern, false)?;
    let objects = crate::backup_layout::objects_dir(&directories, modern, modern)?;
    let final_path = final_name(&entry.operation.id);
    match objects.symlink_metadata(&final_path) {
        Ok(_) => {
            checked_file(&store.conn, &directories, entry, true, false)?;
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            let file = checked_file(&store.conn, &directories, entry, false, false)?;
            if file.metadata().map_err(io_error)?.len() != entry.operation.size {
                return Err(Error::OutcomeUnknown);
            }
            match staging.hard_link(temp_name(&entry.operation.id), &objects, &final_path) {
                Ok(()) => (),
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => (),
                Err(error) => return Err(io_error(error)),
            }
        }
        Err(error) => return Err(io_error(error)),
    }
    // The retained native temp link proves publication ownership; unknown final files are never adopted.
    let final_file = checked_file(&store.conn, &directories, entry, true, true)?;
    final_file.sync_all().map_err(io_error)?;
    crate::backup_root::sync_dir(&objects)?;
    directories.sync()?;

    let mut visible_update: Option<(&'static str, String)> = None;
    let mut promotions: Vec<(String, String, String, [u8; 24])> = Vec::new();
    if modern {
        if let Some(resource_ids) = &photo_resources {
            let photos_dir = directories.visible_dir("Photos", true)?;
            for res_id in resource_ids {
                let Some(res_rec) = crate::backup_layout::lookup(&store.conn, res_id)? else {
                    continue;
                };
                if res_rec.folder != "Files" {
                    continue;
                }
                let (res_name, res_identity_bytes): (String, Vec<u8>) = store
                    .conn
                    .query_row(
                        "SELECT name, file_identity FROM file_operations WHERE id=?1",
                        [res_id],
                        |r| Ok((r.get(0)?, r.get(1)?)),
                    )
                    .map_err(rows::storage)?;
                let base_identity: [u8; 24] = res_identity_bytes
                    .try_into()
                    .map_err(|_| Error::OutcomeUnknown)?;
                let res_identity =
                    crate::backup_retention::live_identity(store, res_id, base_identity)?;
                let new_name = crate::backup_layout::link_visible(
                    &objects,
                    &final_name(res_id),
                    &res_identity,
                    &photos_dir,
                    &res_name,
                    res_id,
                )?;
                promotions.push((res_id.clone(), res_rec.filename, new_name, res_identity));
            }
            crate::backup_root::sync_dir(&photos_dir)?;
        } else {
            let files_dir = directories.visible_dir("Files", true)?;
            let chosen = crate::backup_layout::link_visible(
                &objects,
                &final_path,
                &entry.identity,
                &files_dir,
                &entry.operation.name,
                &entry.operation.id,
            )?;
            crate::backup_root::sync_dir(&files_dir)?;
            visible_update = Some(("Files", chosen));
        }
    }

    let size = entry.operation.size;
    let next = i64::try_from(size).map_err(|_| Error::InvalidRequest)?;
    let previous = i64::try_from(entry.operation.offset).map_err(|_| Error::OutcomeUnknown)?;
    rows::write(store, |tx, _, _| {
        let changed = tx
            .execute(
                "UPDATE file_operations SET offset=?1,state=4 WHERE sid=?2 AND id=?3 AND offset=?4 AND state=3",
                rusqlite::params![next, sid.as_slice(), entry.operation.id, previous],
            )
            .map_err(rows::storage)?;
        if changed != 1 {
            return Err(Error::Conflict);
        }
        if let Some((folder, filename)) = &visible_update {
            tx.execute(
                "UPDATE backup_paths SET folder=?1, filename=?2 WHERE id=?3",
                rusqlite::params![folder, filename, entry.operation.id],
            )
            .map_err(rows::storage)?;
        }
        for (res_id, _, new_name, _) in &promotions {
            tx.execute(
                "UPDATE backup_paths SET folder='Photos', filename=?1 WHERE id=?2",
                rusqlite::params![new_name, res_id],
            )
            .map_err(rows::storage)?;
        }
        Ok(())
    })?;
    for (_, old_filename, _, res_identity) in &promotions {
        crate::backup_layout::remove_visible_after_promotion(
            &directories,
            old_filename,
            res_identity,
        )?;
    }
    entry.operation.offset = size;
    entry.operation.state = OperationState::Completed;
    Ok(())
}
