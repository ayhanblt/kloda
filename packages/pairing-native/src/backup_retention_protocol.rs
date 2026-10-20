use super::*;

pub(crate) fn disposition(store: &Store, id: &str) -> Result<()> {
    if deleted(store, id)?.is_some_and(|d| d.phase != 4) {
        return Err(Error::OwnerDeleted);
    }
    Ok(())
}
pub(crate) fn live_identity(store: &Store, id: &str, fallback: [u8; 24]) -> Result<[u8; 24]> {
    disposition(store, id)?;
    Ok(saved(store, id)?.map_or(fallback, |s| s.live))
}
pub(crate) fn admit_create(
    store: &Store,
    peer: &crate::key::Spki,
    scope: &crate::store_acl::Scope,
    upload: &Upload,
) -> Result<()> {
    let mut stmt=store.conn.prepare("SELECT f.id,f.name,f.sha256,f.size,d.photo_signature FROM file_operations f JOIN records r ON r.sid=f.sid JOIN backup_deletions d ON d.id=f.id WHERE r.expected=?1 AND r.peer=?2 AND f.root=?3 AND f.peer_root=?4 AND d.phase!=4 AND f.source_id=?5 AND (f.source_revision=?6 OR (?7=1 AND f.name=?8))").map_err(rows::storage)?;
    let rows = stmt
        .query_map(
            params![
                peer.fingerprint().as_slice(),
                peer.as_bytes().as_slice(),
                scope.binding.root.as_slice(),
                scope.binding.peer.as_slice(),
                upload.source_id,
                upload.source_revision,
                upload.name.starts_with(photos::PREFIX),
                upload.name
            ],
            |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, Vec<u8>>(2)?,
                    r.get::<_, i64>(3)?,
                    r.get::<_, Option<String>>(4)?,
                ))
            },
        )
        .map_err(rows::storage)?;
    let mut matches = Vec::new();
    for row in rows {
        matches.push(row.map_err(rows::storage)?);
    }
    let Some(rebackup) = &upload.rebackup_of else {
        return if matches.is_empty() {
            Ok(())
        } else {
            Err(Error::OwnerDeleted)
        };
    };
    crate::qr_base64::fixed::<16>(rebackup).map_err(|_| Error::InvalidRequest)?;
    if matches.iter().any(|(id, name, hash, size, signature)| {
        id == rebackup
            && name == &upload.name
            && ((crate::qr_base64::encode(hash) == upload.sha256
                && u64::try_from(*size).ok() == Some(upload.size))
                || (upload.name.starts_with(photos::PREFIX)
                    && upload.size <= 65536
                    && signature
                        .as_ref()
                        .is_some_and(|s| crate::qr_base64::fixed::<32>(s).is_ok())))
    }) {
        Ok(())
    } else {
        Err(Error::Denied)
    }
}

pub(crate) fn live_identity_from_connection(
    conn: &rusqlite::Connection,
    id: &str,
    fallback: [u8; 24],
) -> Result<[u8; 24]> {
    let phase: Option<i64> = conn
        .query_row(
            "SELECT phase FROM backup_deletions WHERE id=?1",
            [id],
            |r| r.get(0),
        )
        .optional()
        .map_err(rows::storage)?;
    if phase.is_some_and(|p| p != 4) {
        return Err(Error::OwnerDeleted);
    }
    let identity: Option<Vec<u8>> = conn
        .query_row(
            "SELECT live_identity FROM backup_protections WHERE id=?1",
            [id],
            |r| r.get(0),
        )
        .optional()
        .map_err(rows::storage)?;
    identity
        .map(|v| v.try_into().map_err(|_| Error::OutcomeUnknown))
        .transpose()
        .map(|v| v.unwrap_or(fallback))
}
