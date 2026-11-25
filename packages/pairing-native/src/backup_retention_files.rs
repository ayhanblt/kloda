use super::*;
use cap_std::fs::{Dir, File};
use ring::digest::{Context, SHA256};
use std::io::{Read, Seek, SeekFrom};
#[path = "backup_retention_restore.rs"]
mod restore;
pub(super) use restore::restore;

fn keep(id: &str) -> String {
    format!(".kloda-{id}.keep")
}
fn restored(id: &str) -> String {
    format!(".kloda-{id}.restore")
}
fn final_name(id: &str) -> String {
    format!("{id}.media")
}
fn part(id: &str) -> String {
    format!(".kloda-{id}.part")
}
fn io(error: std::io::Error) -> Error {
    backup_root::target_error(error).into()
}
fn checked_identity(dir: &Dir, name: &str, identity: &[u8; 24], entry: &Entry) -> Result<File> {
    let file = backup_root::open_file(dir, name, false, false)?;
    if backup_root::file_identity(&file)? != *identity
        || file.metadata().map_err(io)?.len() != entry.operation.size
    {
        return Err(Error::Conflict);
    }
    Ok(file)
}
fn checked(dir: &Dir, name: &str, identity: &[u8; 24], entry: &Entry) -> Result<File> {
    let mut file = checked_identity(dir, name, identity, entry)?;
    let mut digest = Context::new(&SHA256);
    let mut bytes = [0; 65536];
    loop {
        let len = file.read(&mut bytes).map_err(io)?;
        if len == 0 {
            break;
        }
        digest.update(&bytes[..len]);
    }
    if crate::qr_base64::encode(digest.finish().as_ref()) != entry.operation.sha256 {
        return Err(Error::HashMismatch);
    }
    file.seek(SeekFrom::Start(0)).map_err(io)?;
    Ok(file)
}
pub(super) fn verify_reference(store: &Store, item: &Item) -> Result<()> {
    let dirs = directories(store, item)?;
    let modern = crate::backup_layout::lookup(&store.conn, &item.entry.operation.id)?.is_some();
    let objects = crate::backup_layout::objects_dir(&dirs, modern, false)?;
    if active(item) {
        checked_identity(
            &objects,
            &final_name(&item.entry.operation.id),
            &item.saved.as_ref().map_or(item.entry.identity, |s| s.live),
            &item.entry,
        )?;
    } else {
        let saved = item
            .saved
            .as_ref()
            .filter(|s| s.ready)
            .ok_or(Error::OutcomeUnknown)?;
        checked_identity(
            &objects,
            &keep(&item.entry.operation.id),
            &saved.copy,
            &item.entry,
        )?;
    }
    Ok(())
}
pub(super) fn verify_visible(store: &Store, item: &Item) -> Result<()> {
    let dirs = directories(store, item)?;
    let modern = crate::backup_layout::lookup(&store.conn, &item.entry.operation.id)?.is_some();
    let objects = crate::backup_layout::objects_dir(&dirs, modern, false)?;
    if active(item) {
        checked(
            &objects,
            &final_name(&item.entry.operation.id),
            &item.saved.as_ref().map_or(item.entry.identity, |s| s.live),
            &item.entry,
        )?;
    } else {
        let saved = item
            .saved
            .as_ref()
            .filter(|s| s.ready)
            .ok_or(Error::OutcomeUnknown)?;
        checked(
            &objects,
            &keep(&item.entry.operation.id),
            &saved.copy,
            &item.entry,
        )?;
    }
    Ok(())
}
pub(super) fn content(store: &Store, item: &Item) -> Result<Vec<u8>> {
    if item.entry.operation.size > 65536 {
        return Err(Error::InvalidRequest);
    }
    let dirs = directories(store, item)?;
    let modern = crate::backup_layout::lookup(&store.conn, &item.entry.operation.id)?.is_some();
    let objects = crate::backup_layout::objects_dir(&dirs, modern, false)?;
    let (name, identity) = if active(item) {
        (
            final_name(&item.entry.operation.id),
            item.saved.as_ref().map_or(item.entry.identity, |s| s.live),
        )
    } else {
        (
            keep(&item.entry.operation.id),
            item.saved
                .as_ref()
                .filter(|s| s.ready)
                .ok_or(Error::OutcomeUnknown)?
                .copy,
        )
    };
    let file = checked_identity(&objects, &name, &identity, &item.entry)?;
    let mut bytes = Vec::with_capacity(item.entry.operation.size as usize);
    file.take(65537).read_to_end(&mut bytes).map_err(io)?;
    if bytes.len() as u64 != item.entry.operation.size {
        return Err(Error::Conflict);
    }
    if crate::qr_base64::encode(ring::digest::digest(&SHA256, &bytes).as_ref())
        != item.entry.operation.sha256
    {
        return Err(Error::HashMismatch);
    }
    Ok(bytes)
}
pub(super) fn protect(store: &mut Store, id: &str) -> Result<()> {
    let items = load(store)?;
    let item = items.get(id).ok_or(Error::NotFound)?;
    let dirs = directories(store, item)?;
    let modern = crate::backup_layout::lookup(&store.conn, id)?.is_some();
    let objects = crate::backup_layout::objects_dir(&dirs, modern, false)?;
    let current = item.saved.as_ref().map_or(item.entry.identity, |s| s.live);
    let mut original = checked(&objects, &final_name(id), &current, &item.entry)?;
    let mut copy = if let Some(saved) = &item.saved {
        if saved.ready {
            checked(&objects, &keep(id), &saved.copy, &item.entry)?;
            return Ok(());
        }
        let file = backup_root::open_file(&objects, &keep(id), false, true)?;
        if backup_root::file_identity(&file)? != saved.copy {
            return Err(Error::Conflict);
        }
        file
    } else {
        let file = backup_root::open_file(&objects, &keep(id), true, true)?;
        let identity = backup_root::file_identity(&file)?;
        file.sync_all().map_err(io)?;
        backup_root::sync_dir(&objects)?;
        dirs.sync()?;
        let folder = folder(store, item)?;
        rows::write(store, |tx, _, _| {
            tx.execute("INSERT INTO backup_protections(id,folder,copy_identity,live_identity,restore_identity,ready) VALUES(?1,?2,?3,?4,NULL,0)",params![id,folder,identity.as_slice(),current.as_slice()]).map_err(rows::storage)?;
            Ok(())
        })?;
        file
    };
    // Copy bytes to a distinct inode; retained .part/.media hardlinks are not protection.
    copy.set_len(0).map_err(io)?;
    std::io::copy(&mut original, &mut copy).map_err(io)?;
    copy.sync_all().map_err(io)?;
    backup_root::sync_dir(&objects)?;
    dirs.sync()?;
    let identity = backup_root::file_identity(&copy)?;
    if identity == current {
        return Err(Error::Conflict);
    }
    checked(&objects, &keep(id), &identity, &item.entry)?;
    rows::write(store, |tx, _, _| {
        tx.execute("UPDATE backup_protections SET ready=1 WHERE id=?1", [id])
            .map_err(rows::storage)?;
        Ok(())
    })
}
fn remove_matching(dir: &Dir, name: &str, identity: &[u8; 24], entry: &Entry) -> Result<()> {
    match dir.symlink_metadata(name) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(io(error)),
        Ok(_) => {
            checked(dir, name, identity, entry)?;
            dir.remove_file(name).map_err(io)
        }
    }
}
pub(super) fn remove_live(store: &Store, item: &Item) -> Result<()> {
    let dirs = directories(store, item)?;
    let path_record = crate::backup_layout::lookup(&store.conn, &item.entry.operation.id)?;
    let modern = path_record.is_some();
    let objects = crate::backup_layout::objects_dir(&dirs, modern, false)?;
    let staging = crate::backup_layout::staging_dir(&dirs, modern, false)?;
    let saved = item
        .saved
        .as_ref()
        .filter(|s| s.ready)
        .ok_or(Error::OutcomeUnknown)?;
    checked(
        &objects,
        &keep(&item.entry.operation.id),
        &saved.copy,
        &item.entry,
    )?;
    remove_matching(
        &objects,
        &final_name(&item.entry.operation.id),
        &saved.live,
        &item.entry,
    )?;
    remove_matching(
        &staging,
        &part(&item.entry.operation.id),
        &saved.live,
        &item.entry,
    )?;
    if let Some(identity) = saved.restore {
        remove_matching(
            &objects,
            &restored(&item.entry.operation.id),
            &identity,
            &item.entry,
        )?;
    }
    if let Some(rec) = &path_record {
        crate::backup_layout::remove_visible_if_owned(
            &dirs,
            rec,
            &saved.live,
            item.entry.operation.size,
            &item.entry.operation.sha256,
        )?;
    }
    backup_root::sync_dir(&objects)?;
    backup_root::sync_dir(&staging)?;
    dirs.sync()?;
    Ok(())
}
pub(super) fn can_restore(store: &Store, item: &Item) -> Result<()> {
    let saved = item
        .saved
        .as_ref()
        .filter(|s| s.ready)
        .ok_or(Error::OutcomeUnknown)?;
    let dirs = directories(store, item)?;
    let id = &item.entry.operation.id;
    let modern = crate::backup_layout::lookup(&store.conn, id)?.is_some();
    let objects = crate::backup_layout::objects_dir(&dirs, modern, false)?;
    let staging = crate::backup_layout::staging_dir(&dirs, modern, false)?;
    checked(&objects, &keep(id), &saved.copy, &item.entry)?;
    for (dir, name) in [(&objects, final_name(id)), (&staging, part(id))] {
        match dir.symlink_metadata(&name) {
            Ok(_) => {
                checked(
                    dir,
                    &name,
                    &saved.restore.ok_or(Error::Conflict)?,
                    &item.entry,
                )?;
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => (),
            Err(e) => return Err(io(e)),
        }
    }
    if objects.symlink_metadata(restored(id)).is_ok() {
        let file = backup_root::open_file(&objects, &restored(id), false, false)?;
        if Some(backup_root::file_identity(&file)?) != saved.restore {
            return Err(Error::Conflict);
        }
    }
    Ok(())
}
pub(super) fn purge(store: &mut Store, id: &str, live: bool) -> Result<()> {
    let items = load(store)?;
    let item = items.get(id).ok_or(Error::NotFound)?;
    let dirs = directories(store, item)?;
    let path_record = crate::backup_layout::lookup(&store.conn, id)?;
    let modern = path_record.is_some();
    let objects = crate::backup_layout::objects_dir(&dirs, modern, false)?;
    let staging = crate::backup_layout::staging_dir(&dirs, modern, false)?;
    let saved = item
        .saved
        .as_ref()
        .filter(|s| s.ready)
        .ok_or(Error::OutcomeUnknown)?;
    if live {
        remove_matching(&objects, &final_name(id), &saved.live, &item.entry)?;
        remove_matching(&staging, &part(id), &saved.live, &item.entry)?;
        if let Some(rec) = &path_record {
            crate::backup_layout::remove_visible_if_owned(
                &dirs,
                rec,
                &saved.live,
                item.entry.operation.size,
                &item.entry.operation.sha256,
            )?;
        }
    }
    // Each unlink is exact, hash-checked and retryable; no directory scanning or recursive removal.
    remove_matching(&objects, &keep(id), &saved.copy, &item.entry)?;
    if let Some(identity) = saved.restore {
        remove_matching(&objects, &restored(id), &identity, &item.entry)?;
    }
    backup_root::sync_dir(&objects)?;
    backup_root::sync_dir(&staging)?;
    dirs.sync()?;
    Ok(())
}
