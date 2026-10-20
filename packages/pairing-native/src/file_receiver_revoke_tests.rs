use super::*;
#[test]
fn bounded_finalize_yields_and_pin_matched_revoke_wins_before_publication() {
    let (directory, mut store, mut receiver, folder) = setup();
    let bytes = vec![9; CHUNK_LIMIT + 1];
    let id = receive(&mut receiver, &mut store, 9, &bytes);
    assert!(matches!(
        run(
            &mut receiver,
            &mut store,
            Request::Finalize { id: id.clone() }
        ),
        Ok(Response::Pending)
    ));
    assert!(matches!(
        run(&mut receiver, &mut store, Request::RevokePair),
        Ok(Response::PairRevoked)
    ));
    assert!(!store.backup_scope(&[1; 16]).unwrap().unwrap().approved);
    assert!(matches!(
        run(
            &mut receiver,
            &mut store,
            Request::Finalize { id: id.clone() }
        ),
        Err(Error::Denied)
    ));
    assert!(!peer_folder(&folder).join(final_name(&id)).exists());
    assert_eq!(
        fs::read(peer_folder(&folder).join(temp_name(&id))).unwrap(),
        bytes
    );
    drop(store);
    let mut store = directory.store(key("pc"));
    assert!(matches!(
        run(&mut receiver, &mut store, Request::RevokePair),
        Ok(Response::PairRevoked)
    ));
    assert!(matches!(
        receiver.execute(&mut store, &[1; 16], &key("pc"), Request::RevokePair),
        Err(Error::Denied)
    ));
}
#[test]
fn trust_only_pair_can_revoke_without_file_grant_and_failed_atomic_commit_never_acks() {
    let directory = Directory::new();
    let mut store = directory.store(key("pc"));
    store.pc_consume(&[1; 16], &key("phone"), None).unwrap();
    store.pc_complete(&[1; 16], &key("phone")).unwrap();
    let mut receiver = Receiver::new();
    assert!(matches!(
        run(&mut receiver, &mut store, Request::RevokePair),
        Ok(Response::PairRevoked)
    ));
    let (_directory, mut store, mut receiver, _folder) = setup();
    store
        .conn
        .execute_batch(
            "CREATE TRIGGER fault BEFORE UPDATE ON backup_scopes
        BEGIN SELECT RAISE(ABORT,'fault'); END",
        )
        .unwrap();
    assert!(matches!(
        run(&mut receiver, &mut store, Request::RevokePair),
        Err(Error::OutcomeUnknown)
    ));
    assert!(store.record(&[1; 16]).unwrap().unwrap().state == RecordState::Complete);
    assert!(store.backup_scope(&[1; 16]).unwrap().unwrap().approved);
}

#[test]
fn desktop_acl_revoke_during_partial_transfer_preserves_trust_history_and_finals() {
    let (directory, mut store, mut receiver, folder) = setup();
    let completed = receive(&mut receiver, &mut store, 1, b"done");
    run(
        &mut receiver,
        &mut store,
        Request::Finalize {
            id: completed.clone(),
        },
    )
    .unwrap();
    let partial = operation(run(
        &mut receiver,
        &mut store,
        Request::Create(upload(2, b"abcdef")),
    ))
    .id;
    run(
        &mut receiver,
        &mut store,
        Request::Chunk {
            id: partial.clone(),
            offset: 0,
            bytes: b"abc".to_vec(),
        },
    )
    .unwrap();
    let before = management_snapshot(&store);
    let foreground = crate::foreground::Foreground::default();
    let epoch = foreground.capture().unwrap();
    foreground.invalidate().unwrap();
    assert_eq!(
        store.revoke_backup_guarded(&[1; 16], || foreground.authorize(Some(epoch))),
        Err(crate::PairingError::CandidateStale)
    );
    assert!(store.backup_scope(&[1; 16]).unwrap().unwrap().approved);
    let epoch = foreground.capture().unwrap();
    store
        .revoke_backup_guarded(&[1; 16], || foreground.authorize(Some(epoch)))
        .unwrap();
    for request in [
        Request::Chunk {
            id: partial.clone(),
            offset: 3,
            bytes: b"def".to_vec(),
        },
        Request::Finalize {
            id: partial.clone(),
        },
    ] {
        assert!(matches!(
            run(&mut receiver, &mut store, request),
            Err(Error::Denied)
        ));
    }
    assert_eq!(
        store.record(&[1; 16]).unwrap().unwrap().state,
        RecordState::Complete
    );
    assert_eq!(
        fs::read(peer_folder(&folder).join(temp_name(&partial))).unwrap(),
        b"abc"
    );
    assert_eq!(
        fs::read(peer_folder(&folder).join(final_name(&completed))).unwrap(),
        b"done"
    );
    let after_revoke = management_snapshot(&store);
    drop(receiver);
    drop(store);
    let child = std::process::Command::new(std::env::current_exe().unwrap())
        .args([
            "--exact",
            "file_receiver::tests::revoke::desktop_device_restart_child",
            "--nocapture",
        ])
        .env("KLODA_DEVICE_RESTART_FIXTURE", directory.path())
        .env("KLODA_DEVICE_RESTART_EXPECTED", after_revoke.to_string())
        .output()
        .unwrap();
    assert!(
        child.status.success(),
        "{}",
        String::from_utf8_lossy(&child.stdout)
    );
    assert!(String::from_utf8_lossy(&child.stdout).contains("device restart fixture read"));
    let mut store = directory.store(key("pc"));
    let after_restart = management_snapshot(&store);
    assert_eq!(after_revoke, after_restart);
    let snapshot = serde_json::to_value(
        crate::paired_devices::read(&store, None, |record| {
            crate::paired_devices::backup_status(&store, record, None)
        })
        .unwrap(),
    )
    .unwrap();
    assert_eq!(snapshot["items"][0]["trust"], "complete");
    assert_eq!(snapshot["items"][0]["backupScope"]["state"], "revoked");
    let mut receiver = Receiver::new();
    assert!(matches!(
        run(
            &mut receiver,
            &mut store,
            Request::Finalize {
                id: partial.clone()
            }
        ),
        Err(Error::Denied)
    ));
    let history = crate::receiver_activity::read(&store, None).unwrap();
    assert_eq!(
        history
            .items
            .iter()
            .find(|row| row.id == partial)
            .unwrap()
            .received_bytes,
        "3"
    );
    assert_eq!(
        history
            .items
            .iter()
            .find(|row| row.id == partial)
            .unwrap()
            .state,
        "receiving"
    );
    assert_eq!(
        history
            .items
            .iter()
            .find(|row| row.id == completed)
            .unwrap()
            .state,
        "completed"
    );
    println!(
        "KLODA_DEVICE_SNAPSHOTS:{}",
        serde_json::json!({
            "beforeRevoke": before, "afterRevoke": after_revoke,
            "afterRestart": after_restart, "childProcessReadOnly": true
        })
    );
}

fn management_snapshot(store: &Store) -> serde_json::Value {
    serde_json::json!({
        "devices": crate::paired_devices::read(store, None, |record| crate::paired_devices::backup_status(store, record, None)).unwrap(),
        "activity": crate::receiver_activity::read(store, None).unwrap()
    })
}

#[test]
fn desktop_device_restart_child() {
    let Some(directory) = std::env::var_os("KLODA_DEVICE_RESTART_FIXTURE") else {
        return;
    };
    let expected: serde_json::Value =
        serde_json::from_str(&std::env::var("KLODA_DEVICE_RESTART_EXPECTED").unwrap()).unwrap();
    let store = Store::open(std::path::Path::new(&directory), key("pc"), [7; 16]).unwrap();
    let changes = store.conn.total_changes();
    assert_eq!(management_snapshot(&store), expected);
    assert_eq!(store.conn.total_changes(), changes);
    println!("device restart fixture read");
}
