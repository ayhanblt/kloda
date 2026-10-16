pub(crate) const SCHEMA: &str = r#"
CREATE TABLE backup_scopes (
 sid BLOB PRIMARY KEY REFERENCES records(sid),
 folder TEXT NOT NULL CHECK(length(folder) BETWEEN 1 AND 4096),
 root BLOB NOT NULL CHECK(typeof(root)='blob' AND length(root)=24),
 peer_root BLOB NOT NULL CHECK(typeof(peer_root)='blob' AND length(peer_root)=24),
 permissions INTEGER NOT NULL CHECK(permissions=31),
 revision INTEGER NOT NULL CHECK(revision>0),
 state INTEGER NOT NULL CHECK(state IN (1,2))
) STRICT;
CREATE TRIGGER bound_scope_insert BEFORE INSERT ON backup_scopes
 WHEN NOT EXISTS(SELECT 1 FROM records WHERE sid=NEW.sid AND role=1 AND state=2)
 BEGIN SELECT RAISE(ABORT,'untrusted'); END;
CREATE TRIGGER bound_scope_update BEFORE UPDATE ON backup_scopes
 WHEN NEW.state=1 AND NOT EXISTS(SELECT 1 FROM records WHERE sid=NEW.sid AND role=1 AND state=2)
 BEGIN SELECT RAISE(ABORT,'untrusted'); END;
CREATE TRIGGER immutable_scope BEFORE UPDATE ON backup_scopes
 WHEN NEW.sid IS NOT OLD.sid OR NEW.revision!=OLD.revision+1 OR NEW.permissions!=OLD.permissions
 BEGIN SELECT RAISE(ABORT,'binding'); END;
CREATE TRIGGER retain_scope BEFORE DELETE ON backup_scopes
 BEGIN SELECT RAISE(ABORT,'retained'); END;
CREATE TRIGGER revoke_scope AFTER UPDATE OF state ON records
 WHEN NEW.state=3
 BEGIN UPDATE backup_scopes SET state=2,revision=revision+1 WHERE sid=NEW.sid AND state=1; END;
PRAGMA user_version=2;
"#;

pub(crate) fn validate(conn: &rusqlite::Connection) -> crate::error::Result<()> {
    use crate::error::PairingError;
    let invalid: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM backup_scopes s LEFT JOIN records r ON r.sid=s.sid
        WHERE r.sid IS NULL OR r.role!=1 OR (s.state=1 AND r.state!=2)
        OR typeof(s.folder)!='text' OR length(s.folder) NOT BETWEEN 1 AND 4096
        OR typeof(s.root)!='blob' OR length(s.root)!=24
        OR typeof(s.peer_root)!='blob' OR length(s.peer_root)!=24
        OR s.permissions!=31 OR s.revision<=0 OR s.state NOT IN (1,2)",
            [],
            |row| row.get(0),
        )
        .map_err(|_| PairingError::AclUnavailable)?;
    if invalid != 0 {
        return Err(PairingError::AclUnavailable);
    }
    Ok(())
}
