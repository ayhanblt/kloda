pub(crate) const SCHEMA: &str = r#"
CREATE TABLE installation (
 id INTEGER PRIMARY KEY CHECK(id=1),
 version INTEGER NOT NULL CHECK(version=1),
 local BLOB NOT NULL CHECK(typeof(local)='blob' AND length(local)=91),
 epoch BLOB NOT NULL CHECK(typeof(epoch)='blob' AND length(epoch)=16)
) STRICT;
CREATE TABLE records (
 sid BLOB PRIMARY KEY CHECK(typeof(sid)='blob' AND length(sid)=16),
 version INTEGER NOT NULL CHECK(version=1),
 role INTEGER NOT NULL CHECK(role IN (1,2)),
 local BLOB NOT NULL CHECK(typeof(local)='blob' AND length(local)=91),
 epoch BLOB NOT NULL CHECK(typeof(epoch)='blob' AND length(epoch)=16),
 expected BLOB NOT NULL CHECK(typeof(expected)='blob' AND length(expected)=32),
 peer BLOB CHECK(peer IS NULL OR (typeof(peer)='blob' AND length(peer)=91)),
 state INTEGER NOT NULL CHECK(state IN (1,2,3,4,5)),
 CHECK((role=1 AND peer IS NOT NULL AND state IN (1,2,3)) OR
       (role=2 AND state IN (2,3,4,5) AND (state IN (3,4) OR peer IS NOT NULL))),
 CHECK(state!=4 OR peer IS NULL)
) STRICT;
CREATE TABLE hints (
 sid BLOB PRIMARY KEY REFERENCES records(sid),
 ip TEXT NOT NULL CHECK(length(ip) BETWEEN 7 AND 39),
 port INTEGER NOT NULL CHECK(port BETWEEN 1 AND 65535)
) STRICT;
CREATE INDEX records_peer ON records(role,expected,state);
CREATE TRIGGER immutable_installation_update BEFORE UPDATE ON installation
 BEGIN SELECT RAISE(ABORT,'immutable'); END;
CREATE TRIGGER immutable_installation_delete BEFORE DELETE ON installation
 BEGIN SELECT RAISE(ABORT,'immutable'); END;
CREATE TRIGGER bound_record BEFORE INSERT ON records
 WHEN NOT EXISTS(SELECT 1 FROM installation WHERE id=1 AND local=NEW.local AND epoch=NEW.epoch)
 BEGIN SELECT RAISE(ABORT,'binding'); END;
CREATE TRIGGER immutable_record BEFORE UPDATE ON records
 WHEN NEW.sid IS NOT OLD.sid OR NEW.version!=OLD.version OR NEW.role!=OLD.role
 OR NEW.local IS NOT OLD.local OR NEW.epoch IS NOT OLD.epoch OR NEW.expected IS NOT OLD.expected
 OR (OLD.peer IS NOT NULL AND NEW.peer IS NOT OLD.peer)
 OR (OLD.state=3 AND NEW.state!=3)
 OR (OLD.state=2 AND NEW.state NOT IN (2,3))
 OR (OLD.state=1 AND NEW.state NOT IN (1,2,3))
 OR (OLD.state=5 AND NEW.state NOT IN (5,2,3))
 OR (OLD.state=4 AND NEW.state NOT IN (4,5,3))
 BEGIN SELECT RAISE(ABORT,'immutable'); END;
CREATE TRIGGER retain_record BEFORE DELETE ON records
 BEGIN SELECT RAISE(ABORT,'retained'); END;
CREATE TRIGGER phone_hint BEFORE INSERT ON hints
 WHEN NOT EXISTS(SELECT 1 FROM records WHERE sid=NEW.sid AND role=2)
 BEGIN SELECT RAISE(ABORT,'role'); END;
CREATE TRIGGER immutable_hint BEFORE UPDATE ON hints
 BEGIN SELECT RAISE(ABORT,'immutable'); END;
CREATE TRIGGER retain_hint BEFORE DELETE ON hints
 BEGIN SELECT RAISE(ABORT,'retained'); END;
PRAGMA user_version=1;
"#;
