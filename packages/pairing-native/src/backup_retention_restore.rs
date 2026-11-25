use super::*;
use std::io::Write;

pub(crate) fn restore(store: &mut Store, id: &str) -> Result<()> {
    let items = load(store)?;
    let item = items.get(id).ok_or(Error::NotFound)?;
    let saved = item
        .saved
        .as_ref()
        .filter(|s| s.ready)
        .ok_or(Error::OutcomeUnknown)?;
    let dirs = directories(store, item)?;
    let path_record = crate::backup_layout::lookup(&store.conn, id)?;
    let modern = path_record.is_some();
    let objects = crate::backup_layout::objects_dir(&dirs, modern, modern)?;
    let staging = crate::backup_layout::staging_dir(&dirs, modern, modern)?;
    let mut original = checked(&objects, &keep(id), &saved.copy, &item.entry)?;
    // Existing targets can only be accepted if this very restore durably created their identity.
    for (dir, name) in [(&objects, final_name(id)), (&staging, part(id))] {
        match dir.symlink_metadata(&name) {
            Ok(_) => {
                let expected = saved.restore.ok_or(Error::Conflict)?;
                checked(dir, &name, &expected, &item.entry)?;
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => (),
            Err(e) => return Err(io(e)),
        }
    }
    let mut output = if let Some(identity) = saved.restore {
        let file = backup_root::open_file(&objects, &restored(id), false, true)?;
        if backup_root::file_identity(&file)? != identity {
            return Err(Error::Conflict);
        }
        file
    } else {
        let file = backup_root::open_file(&objects, &restored(id), true, true)?;
        let identity = backup_root::file_identity(&file)?;
        file.sync_all().map_err(io)?;
        backup_root::sync_dir(&objects)?;
        dirs.sync()?;
        rows::write(store, |tx, _, _| {
            tx.execute(
                "UPDATE backup_protections SET restore_identity=?1 WHERE id=?2",
                params![identity.as_slice(), id],
            )
            .map_err(rows::storage)?;
            Ok(())
        })?;
        file
    };
    let complete = checked(
        &objects,
        &restored(id),
        &backup_root::file_identity(&output)?,
        &item.entry,
    )
    .is_ok();
    if !complete {
        output.set_len(0).map_err(io)?;
        output.seek(SeekFrom::Start(0)).map_err(io)?;
        std::io::copy(&mut original, &mut output).map_err(io)?;
    }
    output.flush().map_err(io)?;
    output.sync_all().map_err(io)?;
    let identity = backup_root::file_identity(&output)?;
    if identity == saved.copy {
        return Err(Error::Conflict);
    }
    checked(&objects, &restored(id), &identity, &item.entry)?;
    for (dir, name) in [(&staging, part(id)), (&objects, final_name(id))] {
        match objects.hard_link(restored(id), dir, &name) {
            Ok(()) => (),
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
                checked(dir, &name, &identity, &item.entry)?;
            }
            Err(e) => return Err(io(e)),
        }
    }
    let mut restored_filename: Option<String> = None;
    if let Some(rec) = &path_record {
        if !rec.folder.is_empty() && !rec.filename.is_empty() {
            let vis_dir = dirs.visible_dir(&rec.folder, true)?;
            let chosen = match objects.hard_link(restored(id), &vis_dir, &rec.filename) {
                Ok(()) => rec.filename.clone(),
                Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
                    let reused =
                        backup_root::open_visible_file(&vis_dir, &rec.filename, false)
                            .and_then(|file| backup_root::file_identity(&file))
                            .is_ok_and(|found| found == identity);
                    if reused {
                        rec.filename.clone()
                    } else {
                        crate::backup_layout::link_visible(
                            &objects,
                            &restored(id),
                            &identity,
                            &vis_dir,
                            &item.entry.operation.name,
                            id,
                        )?
                    }
                }
                Err(e) => return Err(io(e)),
            };
            backup_root::sync_dir(&vis_dir)?;
            if chosen != rec.filename {
                restored_filename = Some(chosen);
            }
        }
    }
    backup_root::sync_dir(&objects)?;
    backup_root::sync_dir(&staging)?;
    dirs.sync()?;
    rows::write(store, |tx, _, _| {
        tx.execute(
            "UPDATE backup_protections SET live_identity=?1 WHERE id=?2",
            params![identity.as_slice(), id],
        )
        .map_err(rows::storage)?;
        if let Some(filename) = &restored_filename {
            tx.execute(
                "UPDATE backup_paths SET filename=?1 WHERE id=?2",
                params![filename, id],
            )
            .map_err(rows::storage)?;
        }
        Ok(())
    })
}
