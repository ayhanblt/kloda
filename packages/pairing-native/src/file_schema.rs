use crate::error::{PairingError, Result};
use crate::qr_base64;
use rusqlite::{Connection, OptionalExtension};

pub(crate) const SCHEMA: &str = r#"
CREATE TABLE file_operations (
 id TEXT PRIMARY KEY CHECK(length(id)=22),
 sid BLOB NOT NULL REFERENCES records(sid),
 request_id TEXT NOT NULL CHECK(length(request_id)=22),
 source_id TEXT NOT NULL CHECK(length(source_id)=22),
 source_revision TEXT NOT NULL CHECK(length(source_revision) BETWEEN 1 AND 1024),
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 255),
 sha256 BLOB NOT NULL CHECK(typeof(sha256)='blob' AND length(sha256)=32),
 size INTEGER NOT NULL CHECK(size>=0),
 offset INTEGER NOT NULL CHECK(offset BETWEEN 0 AND size),
 revision INTEGER NOT NULL CHECK(revision>0),
 root BLOB NOT NULL CHECK(typeof(root)='blob' AND length(root)=24),
 peer_root BLOB NOT NULL CHECK(typeof(peer_root)='blob' AND length(peer_root)=24),
 file_identity BLOB NOT NULL CHECK(typeof(file_identity)='blob' AND length(file_identity)=24),
 state INTEGER NOT NULL CHECK(state IN (1,2,3,4)),
 CHECK(state=1 OR offset=size),
 UNIQUE(sid,request_id)
) STRICT;
CREATE TRIGGER bound_file_insert BEFORE INSERT ON file_operations
 WHEN NOT EXISTS(SELECT 1 FROM records r JOIN backup_scopes s ON r.sid=s.sid
 WHERE r.sid=NEW.sid AND r.role=1 AND r.state=2 AND s.state=1
 AND s.revision=NEW.revision AND s.root=NEW.root AND s.peer_root=NEW.peer_root)
 BEGIN SELECT RAISE(ABORT,'untrusted'); END;
CREATE TRIGGER bound_file_update BEFORE UPDATE ON file_operations
 WHEN NOT EXISTS(SELECT 1 FROM records r JOIN backup_scopes s ON r.sid=s.sid
 WHERE r.sid=NEW.sid AND r.role=1 AND r.state=2 AND s.state=1
 AND s.revision=NEW.revision AND s.root=NEW.root AND s.peer_root=NEW.peer_root)
 BEGIN SELECT RAISE(ABORT,'untrusted'); END;
CREATE TRIGGER immutable_file BEFORE UPDATE ON file_operations
 WHEN NEW.id IS NOT OLD.id OR NEW.sid IS NOT OLD.sid OR NEW.request_id IS NOT OLD.request_id
 OR NEW.source_id IS NOT OLD.source_id OR NEW.source_revision IS NOT OLD.source_revision
 OR NEW.name IS NOT OLD.name OR NEW.sha256 IS NOT OLD.sha256 OR NEW.size!=OLD.size
 OR NEW.revision!=OLD.revision OR NEW.root IS NOT OLD.root OR NEW.peer_root IS NOT OLD.peer_root
 OR NEW.file_identity IS NOT OLD.file_identity OR NEW.offset<OLD.offset
 OR (OLD.state!=1 AND NEW.offset!=OLD.offset)
 OR NEW.state<OLD.state OR NEW.state>OLD.state+1
 BEGIN SELECT RAISE(ABORT,'binding'); END;
CREATE TRIGGER retain_file BEFORE DELETE ON file_operations
 BEGIN SELECT RAISE(ABORT,'retained'); END;
PRAGMA user_version=3;
"#;

// Compare actual persisted definitions, not just empty row counts after a dropped trigger/table.
fn definitions(conn: &Connection, schema: &str) -> Result<()> {
    let expected = Connection::open_in_memory().map_err(|_| PairingError::StorageFailure)?;
    expected
        .execute_batch(crate::store_schema::SCHEMA)
        .map_err(|_| PairingError::StorageFailure)?;
    expected
        .execute_batch(schema)
        .map_err(|_| PairingError::StorageFailure)?;
    let mut statement = expected.prepare(
        "SELECT name,type,tbl_name,sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'",
    ).map_err(|_| PairingError::StorageFailure)?;
    let mut rows = statement
        .query([])
        .map_err(|_| PairingError::StorageFailure)?;
    while let Some(row) = rows.next().map_err(|_| PairingError::StorageFailure)? {
        let name: String = row.get(0).map_err(|_| PairingError::StorageFailure)?;
        let expected: (String, String, String) = (
            row.get(1).map_err(|_| PairingError::StorageFailure)?,
            row.get(2).map_err(|_| PairingError::StorageFailure)?,
            row.get(3).map_err(|_| PairingError::StorageFailure)?,
        );
        let actual = conn
            .query_row(
                "SELECT type,tbl_name,sql FROM sqlite_schema WHERE name=?1",
                [&name],
                |r| {
                    Ok((
                        r.get::<_, String>(0)?,
                        r.get::<_, String>(1)?,
                        r.get::<_, String>(2)?,
                    ))
                },
            )
            .optional()
            .map_err(|_| PairingError::StorageFailure)?;
        if actual.as_ref() != Some(&expected) {
            return Err(PairingError::StorageFailure);
        }
    }
    Ok(())
}

pub(crate) fn validate_acl(conn: &Connection) -> Result<()> {
    definitions(conn, crate::store_acl_schema::SCHEMA).map_err(|_| PairingError::AclUnavailable)?;
    crate::store_acl_schema::validate(conn)
}

pub(crate) fn migrate(conn: &mut Connection, version: i64) -> Result<()> {
    validate_acl(conn)?;
    if version != 3 {
        let existing: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM sqlite_schema WHERE name='file_operations' OR name IN
            ('bound_file_insert','bound_file_update','immutable_file','retain_file'))",
                [],
                |r| r.get(0),
            )
            .map_err(|_| PairingError::StorageFailure)?;
        if existing {
            return Err(PairingError::StorageFailure);
        }
        let tx = conn
            .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
            .map_err(|_| PairingError::StorageFailure)?;
        tx.execute_batch(SCHEMA)
            .map_err(|_| PairingError::StorageFailure)?;
        tx.commit().map_err(|_| PairingError::OutcomeUnknown)?;
    }
    validate(conn)
}

pub(crate) fn safe_name(name: &str) -> bool {
    if name.is_empty()
        || name.len() > 255
        || name.encode_utf16().count() > 255
        || name.ends_with(['.', ' '])
        || name
            .chars()
            .any(|c| c.is_control() || "<>:\"/\\|?*".contains(c))
    {
        return false;
    }
    let stem = name.split('.').next().unwrap_or("").trim_end_matches(' ');
    if ["CON", "PRN", "AUX", "NUL", "CLOCK$", "CONIN$", "CONOUT$"]
        .iter()
        .any(|s| stem.eq_ignore_ascii_case(s))
    {
        return false;
    }
    if stem.get(..3).is_some_and(|prefix| {
        prefix.eq_ignore_ascii_case("COM") || prefix.eq_ignore_ascii_case("LPT")
    }) {
        let number = &stem[3..];
        if matches!(
            number,
            "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "¹" | "²" | "³"
        ) {
            return false;
        }
    }
    true
}

pub(crate) fn validate(conn: &Connection) -> Result<()> {
    definitions(conn, SCHEMA)?;
    let invalid: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM file_operations f LEFT JOIN records r ON r.sid=f.sid
        LEFT JOIN backup_scopes s ON s.sid=f.sid WHERE r.sid IS NULL OR r.role!=1 OR s.sid IS NULL
        OR f.revision>s.revision OR f.offset<0 OR f.offset>f.size OR f.size<0 OR f.revision<=0
        OR f.state NOT IN (1,2,3,4) OR (f.state!=1 AND f.offset!=f.size)
        OR length(f.root)!=24 OR length(f.peer_root)!=24 OR length(f.file_identity)!=24
        OR f.file_identity=zeroblob(24) OR length(f.sha256)!=32)",
            [],
            |r| r.get(0),
        )
        .map_err(|_| PairingError::StorageFailure)?;
    if invalid {
        return Err(PairingError::StorageFailure);
    }
    let mut statement = conn
        .prepare("SELECT id,request_id,source_id,source_revision,name FROM file_operations")
        .map_err(|_| PairingError::StorageFailure)?;
    let mut rows = statement
        .query([])
        .map_err(|_| PairingError::StorageFailure)?;
    while let Some(row) = rows.next().map_err(|_| PairingError::StorageFailure)? {
        for index in 0..3 {
            let id: String = row.get(index).map_err(|_| PairingError::StorageFailure)?;
            qr_base64::fixed::<16>(&id).map_err(|_| PairingError::StorageFailure)?;
        }
        let revision: String = row.get(3).map_err(|_| PairingError::StorageFailure)?;
        let name: String = row.get(4).map_err(|_| PairingError::StorageFailure)?;
        if revision.is_empty() || revision.len() > 1024 || !safe_name(&name) {
            return Err(PairingError::StorageFailure);
        }
    }
    Ok(())
}

#[cfg(test)]
#[path = "file_schema_tests.rs"]
mod tests;
