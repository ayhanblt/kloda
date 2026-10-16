use super::*;
use crate::state::test_support::{key, Directory};
use crate::store::Store;

fn old_schema(directory: &Directory, version: i64) {
    let store = directory.store(key("pc"));
    store
        .conn
        .execute_batch("DROP TABLE file_operations; PRAGMA user_version=2;")
        .unwrap();
    if version == 1 {
        store
            .conn
            .execute_batch(
                "DROP TABLE backup_scopes; DROP TRIGGER revoke_scope; PRAGMA user_version=1;",
            )
            .unwrap();
    }
}
fn version(directory: &Directory) -> i64 {
    Connection::open(directory.path().join("pairing.sqlite3"))
        .unwrap()
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .unwrap()
}

#[test]
fn valid_older_installations_upgrade_but_wrong_installation_never_changes_version() {
    for old in [1, 2] {
        let directory = Directory::new();
        old_schema(&directory, old);
        assert!(matches!(
            Store::open(directory.path(), key("pc"), [8; 16]),
            Err(PairingError::ContinuityLost)
        ));
        assert_eq!(version(&directory), old);
        let store = directory.store(key("pc"));
        validate(&store.conn).unwrap();
        assert_eq!(version(&directory), 3);
    }
}

#[test]
fn missing_acl_trigger_blocks_upgrade_and_existing_transfer_schema_is_never_recreated() {
    let directory = Directory::new();
    old_schema(&directory, 2);
    let conn = Connection::open(directory.path().join("pairing.sqlite3")).unwrap();
    conn.execute_batch("DROP TRIGGER revoke_scope").unwrap();
    drop(conn);
    assert!(matches!(
        Store::open(directory.path(), key("pc"), [7; 16]),
        Err(PairingError::AclUnavailable)
    ));
    assert_eq!(version(&directory), 2);
    let directory = Directory::new();
    let store = directory.store(key("pc"));
    store
        .conn
        .execute_batch("DROP TABLE file_operations")
        .unwrap();
    drop(store);
    assert!(matches!(
        Store::open(directory.path(), key("pc"), [7; 16]),
        Err(PairingError::StorageFailure)
    ));
    let conn = Connection::open(directory.path().join("pairing.sqlite3")).unwrap();
    let exists: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_schema WHERE name='file_operations')",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert!(!exists);
}

#[test]
fn unversioned_existing_transfer_table_is_not_silently_reset_or_adopted() {
    let directory = Directory::new();
    let store = directory.store(key("pc"));
    store.conn.execute_batch("PRAGMA user_version=2").unwrap();
    drop(store);
    assert!(matches!(
        Store::open(directory.path(), key("pc"), [7; 16]),
        Err(PairingError::StorageFailure)
    ));
    assert_eq!(version(&directory), 2);
}
