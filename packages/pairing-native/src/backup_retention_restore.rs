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
    let mut original = checked(&dirs.peer, &keep(id), &saved.copy, &item.entry)?;
    // Existing targets can only be accepted if this very restore durably created their identity.
    for name in [final_name(id), part(id)] {
        match dirs.peer.symlink_metadata(&name) {
            Ok(_) => {
                let expected = saved.restore.ok_or(Error::Conflict)?;
                checked(&dirs.peer, &name, &expected, &item.entry)?;
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => (),
            Err(e) => return Err(io(e)),
        }
    }
    let mut output = if let Some(identity) = saved.restore {
        let file = backup_root::open_file(&dirs.peer, &restored(id), false, true)?;
        if backup_root::file_identity(&file)? != identity {
            return Err(Error::Conflict);
        }
        file
    } else {
        let file = backup_root::open_file(&dirs.peer, &restored(id), true, true)?;
        let identity = backup_root::file_identity(&file)?;
        file.sync_all().map_err(io)?;
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
        &dirs.peer,
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
    checked(&dirs.peer, &restored(id), &identity, &item.entry)?;
    for name in [part(id), final_name(id)] {
        match dirs.peer.hard_link(restored(id), &dirs.peer, &name) {
            Ok(()) => (),
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
                checked(&dirs.peer, &name, &identity, &item.entry)?;
            }
            Err(e) => return Err(io(e)),
        }
    }
    dirs.sync()?;
    rows::write(store, |tx, _, _| {
        tx.execute(
            "UPDATE backup_protections SET live_identity=?1 WHERE id=?2",
            params![identity.as_slice(), id],
        )
        .map_err(rows::storage)?;
        Ok(())
    })
}
