use super::*;
use crate::state::test_support::{hint, key, Directory};

fn value(store: &Store, after: Option<&str>) -> serde_json::Value {
    serde_json::to_value(read(store, after, |record| backup_status(store, record, None)).unwrap())
        .unwrap()
}

#[test]
fn durable_devices_separate_trust_scope_and_exclude_phone_records() {
    let directory = Directory::new();
    let mut store = directory.store(key("pc"));
    store.pc_consume(&[1; 16], &key("phone"), None).unwrap();
    store.pc_complete(&[1; 16], &key("phone")).unwrap();
    store.pc_consume(&[2; 16], &key("pc"), None).unwrap();
    store
        .phone_pending(&[3; 16], &key("phone").fingerprint(), &hint(), None)
        .unwrap();
    let first = value(&store, None);
    assert_eq!(first["items"].as_array().unwrap().len(), 2);
    assert_eq!(first["items"][0]["trust"], "complete");
    assert_eq!(first["items"][0]["backupScope"]["state"], "not_approved");
    assert_eq!(first["items"][1]["trust"], "consumed_pending_ack");
    assert_eq!(
        first["items"][0]["peerFingerprint"],
        crate::qr_base64::encode(&key("phone").fingerprint())
    );
    let folder = directory.path().join("media");
    std::fs::create_dir(&folder).unwrap();
    store
        .approve_backup(&[1; 16], folder.to_str().unwrap(), None)
        .unwrap();
    let granted = value(&store, None);
    assert_eq!(granted["items"][0]["backupScope"]["state"], "approved");
    assert_eq!(
        granted["items"][0]["backupScope"]["folder"],
        folder.to_str().unwrap()
    );
    let changes = store.conn.total_changes();
    assert_eq!(value(&store, None), granted);
    assert_eq!(store.conn.total_changes(), changes);
    drop(store);
    let mut store = directory.store(key("pc"));
    assert_eq!(value(&store, None), granted);
    store.revoke_backup(&[1; 16]).unwrap();
    let revoked = value(&store, None);
    assert_eq!(revoked["items"][0]["trust"], "complete");
    assert_eq!(revoked["items"][0]["backupScope"]["state"], "revoked");
    store.revoke(&[1; 16], RecordRole::Pc).unwrap();
    assert_eq!(value(&store, None)["items"][0]["trust"], "revoked");
    let one = read_one(&store, &crate::qr_base64::encode(&[1; 16]), |record| {
        backup_status(&store, record, None)
    })
    .unwrap();
    assert_eq!(
        serde_json::to_value(one).unwrap(),
        value(&store, None)["items"][0]
    );
    for forbidden in [
        "online",
        "deviceName",
        "epoch",
        "private",
        "hint",
        "address",
    ] {
        assert!(!serde_json::to_string(&granted).unwrap().contains(forbidden));
    }
}

#[test]
fn query_failures_never_reuse_successful_scope_and_changed_folder_is_unavailable() {
    let directory = Directory::new();
    let mut store = directory.store(key("pc"));
    store.pc_consume(&[1; 16], &key("phone"), None).unwrap();
    store.pc_complete(&[1; 16], &key("phone")).unwrap();
    let folder = directory.path().join("media");
    std::fs::create_dir(&folder).unwrap();
    store
        .approve_backup(&[1; 16], folder.to_str().unwrap(), None)
        .unwrap();
    assert_eq!(
        value(&store, None)["items"][0]["backupScope"]["state"],
        "approved"
    );
    std::fs::rename(&folder, directory.path().join("old-media")).unwrap();
    let changed = value(&store, None);
    assert_eq!(changed["items"][0]["backupScope"]["state"], "unavailable");
    assert!(changed["items"][0]["backupScope"]["errorCode"].is_string());
    store
        .conn
        .execute_batch("DROP TABLE backup_scopes")
        .unwrap();
    let broken = value(&store, None);
    assert_eq!(broken["items"][0]["backupScope"]["state"], "unavailable");
    assert_eq!(
        broken["items"][0]["backupScope"]["errorCode"],
        "acl_unavailable"
    );
    assert!(broken["items"][0]["backupScope"].get("folder").is_none());
}

#[test]
fn device_paging_is_bounded_validated_and_native_ordered() {
    let directory = Directory::new();
    let mut store = directory.store(key("pc"));
    for index in 1..=35 {
        let consent = if index > 1 {
            store.revoke(&[index - 1; 16], RecordRole::Pc).unwrap();
            Some([1; 16])
        } else {
            None
        };
        store
            .pc_consume(&[index; 16], &key("phone"), consent)
            .unwrap();
        store.pc_complete(&[index; 16], &key("phone")).unwrap();
    }
    let first = value(&store, None);
    assert_eq!(first["items"].as_array().unwrap().len(), 32);
    let second = value(&store, first["nextCursor"].as_str());
    assert_eq!(second["items"].as_array().unwrap().len(), 3);
    assert!(second.get("nextCursor").is_none());
    for cursor in ["", "../bad", "AAAAAAAAAAAAAAAAAAAAAB"] {
        assert!(matches!(
            read(&store, Some(cursor), |record| backup_status(
                &store, record, None
            )),
            Err(PairingError::InvalidRequest)
        ));
        assert!(matches!(
            read_one(&store, cursor, |record| backup_status(&store, record, None)),
            Err(PairingError::InvalidRequest)
        ));
    }
}
