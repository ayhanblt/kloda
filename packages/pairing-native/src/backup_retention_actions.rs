use super::*;

pub(super) fn change(store: &mut Store, id: &str, restore: bool, time: i64) -> Result<()> {
    let started = std::time::Instant::now();
    let items = load(store)?;
    let graph = photos::graph(store, &items)?;
    if graph.resources.contains(id) {
        return Err(Error::Denied);
    }
    let item = items.get(id).ok_or(Error::NotFound)?;
    if restore {
        let deletion = item.deleted.as_ref().ok_or(Error::Conflict)?;
        if deletion.phase == 4 {
            return files::verify_visible(store, item);
        }
        if deletion.phase == 6 || time >= deletion.expires {
            return Err(Error::NotFound);
        }
        if !matches!(deletion.phase, 2 | 3) {
            return Err(Error::OutcomeUnknown);
        }
        // Dependencies remain live throughout retention; never fabricate missing metadata/resources.
        for dependency in &deletion.dependencies {
            files::verify_visible(store, items.get(dependency).ok_or(Error::OutcomeUnknown)?)?;
        }
        files::can_restore(store, item)?;
        rows::write(store, |tx, _, _| {
            tx.execute("UPDATE backup_deletions SET phase=3 WHERE id=?1", [id])
                .map_err(rows::storage)?;
            Ok(())
        })?;
        files::restore(store, id)?;
        rows::write(store, |tx, _, _| {
            tx.execute("UPDATE backup_deletions SET phase=4 WHERE id=?1", [id])
                .map_err(rows::storage)?;
            Ok(())
        })
    } else {
        if let Some(deletion) = &item.deleted {
            if deletion.phase == 2 {
                return files::verify_visible(store, item);
            }
            if deletion.phase == 6 {
                return Err(Error::NotFound);
            }
            if deletion.phase == 3 || deletion.phase == 5 {
                return Err(Error::OutcomeUnknown);
            }
        }
        let dependencies = graph.dependencies.get(id).cloned().unwrap_or_default();
        let signature = graph.signatures.get(id);
        files::protect(store, id)?;
        for target in &dependencies {
            files::protect(store, target)?;
        }
        if item.deleted.as_ref().is_none_or(|d| d.phase == 4) {
            let expires = time
                .checked_add(RETENTION_MS)
                .ok_or(Error::OutcomeUnknown)?;
            let dependencies =
                serde_json::to_string(&dependencies).map_err(|_| Error::OutcomeUnknown)?;
            rows::write(store, |tx, _, _| {
                tx.execute("INSERT INTO backup_deletions(id,deleted_at,expires_at,phase,dependencies,photo_signature) VALUES(?1,?2,?3,1,?4,?5) ON CONFLICT(id) DO UPDATE SET deleted_at=excluded.deleted_at,expires_at=excluded.expires_at,phase=1,dependencies=excluded.dependencies,photo_signature=excluded.photo_signature",params![id,time,expires,dependencies,signature]).map_err(rows::storage)?;
                Ok(())
            })?;
        }
        finish_delete(store, id, time, started)
    }
}
fn finish_delete(
    store: &mut Store,
    id: &str,
    time: i64,
    started: std::time::Instant,
) -> Result<()> {
    let items = load(store)?;
    let item = items.get(id).ok_or(Error::NotFound)?;
    files::remove_live(store, item)?;
    let time = time
        .checked_add(
            i64::try_from(started.elapsed().as_millis()).map_err(|_| Error::OutcomeUnknown)?,
        )
        .ok_or(Error::OutcomeUnknown)?;
    rows::write(store, |tx, _, _| {
        tx.execute("UPDATE backup_deletions SET phase=2,deleted_at=?2,expires_at=?3 WHERE id=?1 AND phase=1", params![id,time,time.checked_add(RETENTION_MS).ok_or(Error::OutcomeUnknown)?])
            .map_err(rows::storage)?;
        tx.execute(
            "UPDATE backup_protections SET restore_identity=NULL WHERE id=?1",
            [id],
        )
        .map_err(rows::storage)?;
        Ok(())
    })
}
pub(super) fn maintain(store: &mut Store, time: i64) -> Result<()> {
    let started = std::time::Instant::now();
    let due:bool=store.conn.query_row("SELECT EXISTS(SELECT 1 FROM backup_deletions WHERE phase IN (1,3,5) OR (phase=2 AND expires_at<=?1))",[time],|r|r.get(0)).map_err(rows::storage)?;
    if !due {
        return Ok(());
    }
    let items = load(store)?;
    photos::graph(store, &items)?;
    for (id, item) in &items {
        match item.deleted.as_ref().map(|d| d.phase) {
            Some(1) => finish_delete(store, id, time, started)?,
            Some(3) => {
                for dependency in &item
                    .deleted
                    .as_ref()
                    .ok_or(Error::OutcomeUnknown)?
                    .dependencies
                {
                    files::verify_visible(
                        store,
                        items.get(dependency).ok_or(Error::OutcomeUnknown)?,
                    )?;
                }
                files::restore(store, id)?;
                rows::write(store, |tx, _, _| {
                    tx.execute("UPDATE backup_deletions SET phase=4 WHERE id=?1", [id])
                        .map_err(rows::storage)?;
                    Ok(())
                })?;
            }
            _ => (),
        }
    }
    let items = load(store)?;
    let graph = photos::graph(store, &items)?;
    for (id, item) in &items {
        let Some(deletion) = &item.deleted else {
            continue;
        };
        if !matches!(deletion.phase, 2 | 5) || time < deletion.expires {
            continue;
        }
        rows::write(store, |tx, _, _| {
            tx.execute("UPDATE backup_deletions SET phase=5 WHERE id=?1", [id])
                .map_err(rows::storage)?;
            Ok(())
        })?;
        files::purge(store, id, false)?;
    }
    let items = load(store)?;
    let protected: BTreeSet<String> = graph
        .dependencies
        .iter()
        .filter(|(id, _)| {
            items
                .get(*id)
                .is_some_and(|item| item.deleted.as_ref().is_none_or(|d| d.phase < 5))
        })
        .flat_map(|(_, deps)| deps.iter().cloned())
        .collect();
    for id in graph.resources.difference(&protected) {
        let item = items.get(id).ok_or(Error::OutcomeUnknown)?;
        if item.deleted.as_ref().is_some_and(|d| d.phase == 6) {
            continue;
        }
        // All references were validated before cleanup; retain a source tombstone after byte expiry.
        if item.saved.as_ref().is_none_or(|s| !s.ready) {
            return Err(Error::OutcomeUnknown);
        }
        rows::write(store, |tx, _, _| {
            tx.execute("INSERT INTO backup_deletions(id,deleted_at,expires_at,phase,dependencies) VALUES(?1,?2,?2,5,'[]') ON CONFLICT(id) DO UPDATE SET phase=5",params![id,time]).map_err(rows::storage)?;
            Ok(())
        })?;
        files::purge(store, id, true)?;
        rows::write(store, |tx, _, _| {
            tx.execute("UPDATE backup_deletions SET phase=6 WHERE id=?1", [id])
                .map_err(rows::storage)?;
            Ok(())
        })?;
    }
    for (id, item) in &items {
        if item.deleted.as_ref().is_some_and(|d| d.phase == 5) && !graph.resources.contains(id) {
            rows::write(store, |tx, _, _| {
                tx.execute("UPDATE backup_deletions SET phase=6 WHERE id=?1", [id])
                    .map_err(rows::storage)?;
                Ok(())
            })?;
        }
    }
    Ok(())
}
