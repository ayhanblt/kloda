use super::*;
use crate::state::test_support::{hint, key, Directory};
use std::fs;
use std::time::Duration;

fn media(directory: &Directory) -> String {
    let path = directory.path().join("media");
    fs::create_dir(&path).unwrap();
    path.to_str().unwrap().to_owned()
}
fn pair(store: &mut Store, sid: &[u8; 16], peer: &crate::key::Spki) {
    store.pc_consume(sid, peer, None).unwrap();
    store.pc_complete(sid, peer).unwrap();
}

#[test]
fn trust_alone_never_grants_and_incomplete_or_phone_records_cannot_approve_files() {
    let directory = Directory::new();
    let folder = media(&directory);
    let mut store = directory.store(key("pc"));
    let peer = key("phone");
    assert!(matches!(
        store.approve_backup(&[1; 16], &folder, None),
        Err(PairingError::CandidateStale)
    ));
    store.pc_consume(&[1; 16], &peer, None).unwrap();
    assert!(store.backup_scope(&[1; 16]).unwrap().is_none());
    assert!(matches!(
        store.approve_backup(&[1; 16], &folder, None),
        Err(PairingError::CandidateStale)
    ));
    store
        .phone_pending(&[2; 16], &peer.fingerprint(), &hint(), None)
        .unwrap();
    store.phone_pin(&[2; 16], &peer).unwrap();
    store.phone_complete(&[2; 16], &peer).unwrap();
    assert!(matches!(
        store.approve_backup(&[2; 16], &folder, None),
        Err(PairingError::CandidateStale)
    ));
    assert!(fs::read_dir(folder).unwrap().next().is_none());
}

#[test]
fn explicit_grant_reopens_bound_to_distinct_native_peer_directories() {
    let directory = Directory::new();
    let folder = media(&directory);
    let mut store = directory.store(key("pc"));
    pair(&mut store, &[1; 16], &key("phone"));
    pair(&mut store, &[2; 16], &key("pc"));
    store.approve_backup(&[1; 16], &folder, None).unwrap();
    store.approve_backup(&[2; 16], &folder, None).unwrap();
    let first = store.backup_scope(&[1; 16]).unwrap().unwrap();
    let second = store.backup_scope(&[2; 16]).unwrap().unwrap();
    assert_eq!(first.binding.root, second.binding.root);
    assert_ne!(first.binding.peer, second.binding.peer);
    drop(store);
    let store = directory.store(key("pc"));
    let reopened = store.backup_scope(&[1; 16]).unwrap().unwrap();
    assert!(reopened.approved);
    assert_eq!(reopened.binding, first.binding);
    backup_root::verify(
        &reopened.folder,
        &key("phone").fingerprint(),
        reopened.binding,
    )
    .unwrap();
}

#[test]
fn file_revoke_preserves_trust_and_late_consent_cannot_regrant() {
    let directory = Directory::new();
    let folder = media(&directory);
    let peer = key("phone");
    let mut store = directory.store(key("pc"));
    pair(&mut store, &[1; 16], &peer);
    store.approve_backup(&[1; 16], &folder, None).unwrap();
    let revision = store.backup_scope(&[1; 16]).unwrap().unwrap().revision;
    store.revoke_backup(&[1; 16]).unwrap();
    assert_eq!(
        store.pc_recover(&[1; 16], &peer).unwrap().state,
        RecordState::Complete
    );
    assert!(!store.backup_scope(&[1; 16]).unwrap().unwrap().approved);
    assert!(matches!(
        store.approve_backup(&[1; 16], &folder, Some(revision)),
        Err(PairingError::CandidateStale)
    ));
    drop(store);
    let mut store = directory.store(key("pc"));
    let revoked = store.backup_scope(&[1; 16]).unwrap().unwrap();
    assert!(!revoked.approved);
    store
        .approve_backup(&[1; 16], &folder, Some(revoked.revision))
        .unwrap();
    assert!(store.backup_scope(&[1; 16]).unwrap().unwrap().approved);
}

#[test]
fn trust_revoke_atomically_revokes_scope_and_never_deletes_media() {
    let directory = Directory::new();
    let folder = media(&directory);
    let peer = key("phone");
    let mut store = directory.store(key("pc"));
    pair(&mut store, &[1; 16], &peer);
    store.approve_backup(&[1; 16], &folder, None).unwrap();
    let peer_folder =
        std::path::Path::new(&folder).join(crate::qr_base64::encode(&peer.fingerprint()));
    fs::write(peer_folder.join("preserved-photo"), b"existing photo bytes").unwrap();
    store.pc_revoke(&[1; 16]).unwrap();
    drop(store);
    let mut store = directory.store(key("pc"));
    assert!(!store.backup_scope(&[1; 16]).unwrap().unwrap().approved);
    assert!(matches!(
        store.approve_backup(&[1; 16], &folder, Some(2)),
        Err(PairingError::Revoked)
    ));
    assert_eq!(
        fs::read(peer_folder.join("preserved-photo")).unwrap(),
        b"existing photo bytes"
    );
}

#[test]
fn changed_root_is_not_automatically_adopted_and_missing_acl_is_not_recreated() {
    let directory = Directory::new();
    let folder = media(&directory);
    let peer = key("phone");
    let mut store = directory.store(key("pc"));
    pair(&mut store, &[1; 16], &peer);
    store.approve_backup(&[1; 16], &folder, None).unwrap();
    let scope = store.backup_scope(&[1; 16]).unwrap().unwrap();
    fs::rename(&folder, directory.path().join("old-media")).unwrap();
    fs::create_dir(&folder).unwrap();
    backup_root::prepare(&folder, &peer.fingerprint()).unwrap();
    assert_eq!(
        backup_root::verify(&folder, &peer.fingerprint(), scope.binding),
        Err(PairingError::BackupScopeChanged)
    );
    store
        .conn
        .execute_batch("DROP TABLE backup_scopes")
        .unwrap();
    assert!(matches!(
        store.approve_backup(&[1; 16], &folder, Some(scope.revision)),
        Err(PairingError::AclUnavailable)
    ));
    drop(store);
    assert!(matches!(
        Store::open(directory.path(), key("pc"), [7; 16]),
        Err(PairingError::AclUnavailable)
    ));
}

#[test]
fn bounded_real_busy_preserves_denial_and_allows_explicit_retry_without_store_reset() {
    let directory = Directory::new();
    let folder = media(&directory);
    let mut store = directory.store(key("pc"));
    pair(&mut store, &[1; 16], &key("phone"));
    store.conn.busy_timeout(Duration::from_millis(20)).unwrap();
    let competing = rusqlite::Connection::open(directory.path().join("pairing.sqlite3")).unwrap();
    competing.execute_batch("BEGIN IMMEDIATE").unwrap();
    assert_eq!(
        store.approve_backup(&[1; 16], &folder, None),
        Err(PairingError::AclBusy)
    );
    assert!(store.backup_scope(&[1; 16]).unwrap().is_none());
    competing.execute_batch("ROLLBACK").unwrap();
    store.approve_backup(&[1; 16], &folder, None).unwrap();
    assert!(store.backup_scope(&[1; 16]).unwrap().unwrap().approved);
}

#[cfg(unix)]
#[test]
fn existing_peer_symlink_cannot_redirect_consent_to_another_device() {
    let directory = Directory::new();
    let folder = media(&directory);
    let peer = key("phone");
    let other = key("pc");
    let mut store = directory.store(key("pc"));
    pair(&mut store, &[1; 16], &peer);
    let other_name = crate::qr_base64::encode(&other.fingerprint());
    fs::create_dir(std::path::Path::new(&folder).join(&other_name)).unwrap();
    let name = crate::qr_base64::encode(&peer.fingerprint());
    std::os::unix::fs::symlink(&other_name, std::path::Path::new(&folder).join(name)).unwrap();
    assert_eq!(
        store.approve_backup(&[1; 16], &folder, None),
        Err(PairingError::BackupPathRejected)
    );
    assert!(store.backup_scope(&[1; 16]).unwrap().is_none());
}

#[test]
fn legacy_pairing_database_migrates_without_creating_file_permissions() {
    let directory = Directory::new();
    let local = key("pc");
    let peer = key("phone");
    let connection = rusqlite::Connection::open(directory.path().join("pairing.sqlite3")).unwrap();
    connection
        .execute_batch(crate::store_schema::SCHEMA)
        .unwrap();
    connection
        .execute(
            "INSERT INTO installation VALUES(1,1,?1,?2)",
            params![local.as_bytes().as_slice(), [7u8; 16].as_slice()],
        )
        .unwrap();
    connection
        .execute(
            "INSERT INTO records VALUES(?1,1,1,?2,?3,?4,?5,2)",
            params![
                [1u8; 16].as_slice(),
                local.as_bytes().as_slice(),
                [7u8; 16].as_slice(),
                peer.fingerprint().as_slice(),
                peer.as_bytes().as_slice()
            ],
        )
        .unwrap();
    drop(connection);
    let store = directory.store(local);
    assert_eq!(
        store.pc_recover(&[1; 16], &peer).unwrap().state,
        RecordState::Complete
    );
    assert!(store.backup_scope(&[1; 16]).unwrap().is_none());
}

#[test]
fn scope_write_failure_cannot_split_durable_trust_and_acl_revocation() {
    let directory = Directory::new();
    let folder = media(&directory);
    let peer = key("phone");
    let mut store = directory.store(key("pc"));
    pair(&mut store, &[1; 16], &peer);
    store.approve_backup(&[1; 16], &folder, None).unwrap();
    store
        .conn
        .execute_batch(
            "CREATE TRIGGER fail_scope BEFORE UPDATE ON backup_scopes
        WHEN NEW.state=2 BEGIN SELECT RAISE(ABORT,'injected storage failure'); END;",
        )
        .unwrap();
    assert!(matches!(
        store.pc_revoke(&[1; 16]),
        Err(PairingError::StorageFailure)
    ));
    drop(store);
    let store = directory.store(key("pc"));
    assert_eq!(
        store.pc_recover(&[1; 16], &peer).unwrap().state,
        RecordState::Complete
    );
    assert!(store.backup_scope(&[1; 16]).unwrap().unwrap().approved);
}
