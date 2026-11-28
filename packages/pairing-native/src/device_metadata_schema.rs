use crate::error::{PairingError, Result};
use crate::store::{storage, Store};
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};

pub(crate) const SCHEMA: &str = r#"
CREATE TABLE peer_names (
 sid BLOB PRIMARY KEY REFERENCES records(sid),
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 256)
) STRICT;
CREATE TABLE scope_folders (
 sid BLOB PRIMARY KEY REFERENCES backup_scopes(sid),
 peer_folder TEXT NOT NULL CHECK(length(peer_folder) BETWEEN 1 AND 256)
) STRICT;
PRAGMA user_version=6;
"#;

pub(crate) fn migrate(conn: &mut Connection, version: i64) -> Result<()> {
    if version < 6 {
        let exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM sqlite_schema WHERE name IN ('peer_names','scope_folders'))",
                [],
                |r| r.get(0),
            )
            .map_err(|_| PairingError::StorageFailure)?;
        if exists {
            return Err(PairingError::StorageFailure);
        }
        let tx = conn
            .transaction_with_behavior(TransactionBehavior::Immediate)
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
        .execute_batch(crate::backup_layout_schema::SCHEMA)
        .map_err(|_| PairingError::StorageFailure)?;
    expected
        .execute_batch(SCHEMA)
        .map_err(|_| PairingError::StorageFailure)?;
    let mut stmt = expected
        .prepare("SELECT name,sql FROM sqlite_schema WHERE name IN ('peer_names','scope_folders')")
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
            "SELECT EXISTS(SELECT 1 FROM peer_names p LEFT JOIN records r ON r.sid=p.sid WHERE r.sid IS NULL OR length(p.name) NOT BETWEEN 1 AND 256)
             OR EXISTS(SELECT 1 FROM scope_folders s LEFT JOIN backup_scopes b ON b.sid=s.sid WHERE b.sid IS NULL OR length(s.peer_folder) NOT BETWEEN 1 AND 256)",
            [],
            |r| r.get(0),
        )
        .map_err(|_| PairingError::StorageFailure)?;
    if invalid {
        return Err(PairingError::StorageFailure);
    }
    Ok(())
}

impl Store {
    pub(crate) fn save_peer_name(&mut self, sid: &[u8; 16], name: &str) -> Result<()> {
        let Some(cleaned) = crate::device_name::sanitize_display(name) else {
            return Ok(());
        };
        self.write(|tx, _, _| {
            let exists: bool = tx
                .query_row(
                    "SELECT EXISTS(SELECT 1 FROM records WHERE sid=?1)",
                    [sid.as_slice()],
                    |r| r.get(0),
                )
                .map_err(storage)?;
            if !exists {
                return Ok(());
            }
            tx.execute(
                "INSERT INTO peer_names(sid,name) VALUES(?1,?2)
                ON CONFLICT(sid) DO UPDATE SET name=excluded.name",
                params![sid.as_slice(), cleaned],
            )
            .map_err(storage)?;
            Ok(())
        })
    }

    pub(crate) fn peer_name(&self, sid: &[u8; 16]) -> Result<Option<String>> {
        self.ready()?;
        self.conn
            .query_row(
                "SELECT name FROM peer_names WHERE sid=?1",
                [sid.as_slice()],
                |row| row.get(0),
            )
            .optional()
            .map_err(storage)
    }

    pub(crate) fn scope_folder(&self, sid: &[u8; 16]) -> Result<Option<String>> {
        self.ready()?;
        self.conn
            .query_row(
                "SELECT peer_folder FROM scope_folders WHERE sid=?1",
                [sid.as_slice()],
                |row| row.get(0),
            )
            .optional()
            .map_err(storage)
    }
}
