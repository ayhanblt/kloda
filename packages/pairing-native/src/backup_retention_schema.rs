use crate::error::{PairingError, Result};
use rusqlite::Connection;

pub(crate) const SCHEMA: &str = r#"
CREATE TABLE backup_protections (
 id TEXT PRIMARY KEY REFERENCES file_operations(id),
 folder TEXT NOT NULL CHECK(length(folder) BETWEEN 1 AND 4096),
 copy_identity BLOB NOT NULL CHECK(length(copy_identity)=24 AND copy_identity!=zeroblob(24)),
 live_identity BLOB NOT NULL CHECK(length(live_identity)=24 AND live_identity!=zeroblob(24)),
 restore_identity BLOB CHECK(restore_identity IS NULL OR (length(restore_identity)=24 AND restore_identity!=zeroblob(24))),
 ready INTEGER NOT NULL CHECK(ready IN (0,1))
) STRICT;
CREATE TABLE backup_deletions (
 id TEXT PRIMARY KEY REFERENCES file_operations(id),
 deleted_at INTEGER NOT NULL CHECK(deleted_at>=0),
 expires_at INTEGER NOT NULL CHECK(expires_at>=deleted_at),
 phase INTEGER NOT NULL CHECK(phase BETWEEN 1 AND 6),
 dependencies TEXT NOT NULL CHECK(length(dependencies)<=8192),
 photo_signature TEXT CHECK(photo_signature IS NULL OR length(photo_signature)=43)
) STRICT;
CREATE TABLE backup_rebackup_requests (
 id TEXT PRIMARY KEY REFERENCES file_operations(id),
 previous_id TEXT NOT NULL REFERENCES backup_deletions(id)
) STRICT;
CREATE TRIGGER immutable_rebackup_request BEFORE UPDATE ON backup_rebackup_requests
 BEGIN SELECT RAISE(ABORT,'immutable'); END;
CREATE TRIGGER retain_rebackup_request BEFORE DELETE ON backup_rebackup_requests
 BEGIN SELECT RAISE(ABORT,'retained'); END;
CREATE TRIGGER retain_backup_deletion BEFORE DELETE ON backup_deletions
 BEGIN SELECT RAISE(ABORT,'retained'); END;
PRAGMA user_version=4;
"#;

pub(crate) fn migrate(conn: &mut Connection, version: i64) -> Result<()> {
    if version < 4 {
        let exists: bool = conn.query_row("SELECT EXISTS(SELECT 1 FROM sqlite_schema WHERE name IN ('backup_protections','backup_deletions','retain_backup_deletion','backup_rebackup_requests','immutable_rebackup_request','retain_rebackup_request'))", [], |r| r.get(0)).map_err(|_| PairingError::StorageFailure)?;
        if exists {
            return Err(PairingError::StorageFailure);
        }
        let tx = conn
            .transaction()
            .map_err(|_| PairingError::StorageFailure)?;
        tx.execute_batch(SCHEMA)
            .map_err(|_| PairingError::StorageFailure)?;
        tx.commit().map_err(|_| PairingError::OutcomeUnknown)?;
    }
    // Reconstruct the complete expected schema; added tables never weaken original triggers.
    let expected = Connection::open_in_memory().map_err(|_| PairingError::StorageFailure)?;
    expected
        .execute_batch(crate::store_schema::SCHEMA)
        .map_err(|_| PairingError::StorageFailure)?;
    expected
        .execute_batch(crate::store_acl_schema::SCHEMA)
        .map_err(|_| PairingError::StorageFailure)?;
    expected
        .execute_batch(crate::file_schema::SCHEMA)
        .map_err(|_| PairingError::StorageFailure)?;
    expected
        .execute_batch(SCHEMA)
        .map_err(|_| PairingError::StorageFailure)?;
    let mut stmt = expected.prepare("SELECT name,sql FROM sqlite_schema WHERE name IN ('backup_protections','backup_deletions','retain_backup_deletion','backup_rebackup_requests','immutable_rebackup_request','retain_rebackup_request')").map_err(|_| PairingError::StorageFailure)?;
    let rows = stmt
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
        .map_err(|_| PairingError::StorageFailure)?;
    for row in rows {
        let (name, sql) = row.map_err(|_| PairingError::StorageFailure)?;
        let actual: String = conn
            .query_row("SELECT sql FROM sqlite_schema WHERE name=?1", [name], |r| {
                r.get(0)
            })
            .map_err(|_| PairingError::StorageFailure)?;
        if actual != sql {
            return Err(PairingError::StorageFailure);
        }
    }
    let invalid:bool=conn.query_row("SELECT EXISTS(SELECT 1 FROM backup_protections p LEFT JOIN file_operations f ON f.id=p.id WHERE f.id IS NULL OR f.state!=4 OR length(p.copy_identity)!=24 OR p.copy_identity=zeroblob(24) OR length(p.live_identity)!=24 OR p.live_identity=zeroblob(24)) OR EXISTS(SELECT 1 FROM backup_deletions d LEFT JOIN backup_protections p ON p.id=d.id LEFT JOIN file_operations f ON f.id=d.id WHERE f.id IS NULL OR f.state!=4 OR p.id IS NULL OR p.ready!=1 OR length(d.dependencies)>8192) OR EXISTS(SELECT 1 FROM backup_rebackup_requests q LEFT JOIN file_operations n ON n.id=q.id LEFT JOIN file_operations o ON o.id=q.previous_id LEFT JOIN backup_deletions d ON d.id=o.id LEFT JOIN records nr ON nr.sid=n.sid LEFT JOIN records pr ON pr.sid=o.sid WHERE n.id IS NULL OR o.id IS NULL OR d.id IS NULL OR n.source_id!=o.source_id OR n.name!=o.name OR n.root!=o.root OR n.peer_root!=o.peer_root OR nr.expected!=pr.expected OR nr.peer!=pr.peer OR (n.name NOT LIKE 'kloda-photo-v1-%' AND (n.source_revision!=o.source_revision OR n.sha256!=o.sha256 OR n.size!=o.size)) OR (n.name LIKE 'kloda-photo-v1-%' AND (d.photo_signature IS NULL OR n.size>65536)))",[],|r|r.get(0)).map_err(|_|PairingError::StorageFailure)?;
    if invalid {
        return Err(PairingError::StorageFailure);
    }
    Ok(())
}
