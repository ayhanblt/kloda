use crate::error::{PairingError, Result};
use rusqlite::Connection;

pub(crate) const SCHEMA: &str = r#"
CREATE TABLE backup_paths (
 id TEXT PRIMARY KEY REFERENCES file_operations(id),
 folder TEXT NOT NULL CHECK(folder IN ('', 'Files', 'Photos')),
 filename TEXT NOT NULL CHECK(length(filename) <= 255),
 CHECK((folder = '' AND filename = '') OR (folder != '' AND length(filename) BETWEEN 1 AND 255))
) STRICT;
CREATE TRIGGER retain_backup_path BEFORE DELETE ON backup_paths
 BEGIN SELECT RAISE(ABORT,'retained'); END;
PRAGMA user_version=5;
"#;

pub(crate) fn migrate(conn: &mut Connection, version: i64) -> Result<()> {
    if version < 5 {
        let exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM sqlite_schema WHERE name IN ('backup_paths','retain_backup_path'))",
                [],
                |r| r.get(0),
            )
            .map_err(|_| PairingError::StorageFailure)?;
        if exists {
            return Err(PairingError::StorageFailure);
        }
        let tx = conn
            .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
            .map_err(|_| PairingError::StorageFailure)?;
        tx.execute_batch(SCHEMA)
            .map_err(|_| PairingError::StorageFailure)?;
        tx.commit().map_err(|_| PairingError::OutcomeUnknown)?;
    }
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
        .execute_batch(crate::backup_retention_schema::SCHEMA)
        .map_err(|_| PairingError::StorageFailure)?;
    expected
        .execute_batch(SCHEMA)
        .map_err(|_| PairingError::StorageFailure)?;
    let mut stmt = expected
        .prepare("SELECT name,sql FROM sqlite_schema WHERE name IN ('backup_paths','retain_backup_path')")
        .map_err(|_| PairingError::StorageFailure)?;
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
    let invalid: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM backup_paths p LEFT JOIN file_operations f ON f.id=p.id WHERE f.id IS NULL OR (p.folder!='' AND f.state!=4) OR p.folder NOT IN ('','Files','Photos') OR (p.folder='' AND p.filename!='') OR (p.folder!='' AND length(p.filename)=0))",
            [],
            |r| r.get(0),
        )
        .map_err(|_| PairingError::StorageFailure)?;
    if invalid {
        return Err(PairingError::StorageFailure);
    }
    let mut stmt = conn
        .prepare("SELECT filename FROM backup_paths WHERE folder!=''")
        .map_err(|_| PairingError::StorageFailure)?;
    let names = stmt
        .query_map([], |r| r.get::<_, String>(0))
        .map_err(|_| PairingError::StorageFailure)?;
    for row in names {
        let filename = row.map_err(|_| PairingError::StorageFailure)?;
        if !crate::file_schema::safe_name(&filename) {
            return Err(PairingError::StorageFailure);
        }
    }
    Ok(())
}
