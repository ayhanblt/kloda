use super::*;

fn snapshot(store: &Store) -> serde_json::Value {
    serde_json::json!({
        "devices": crate::paired_devices::read(store, None, |record| crate::paired_devices::backup_status(store, record, None)).unwrap(),
        "activity": crate::receiver_activity::read(store, None).unwrap()
    })
}

#[test]
fn offline_device_removal_fences_work_preserves_backups_and_requires_fresh_pair_and_grant() {
    let (directory, mut store, mut receiver, folder) = setup();
    let complete = receive(&mut receiver, &mut store, 1, b"kept");
    run(
        &mut receiver,
        &mut store,
        Request::Finalize {
            id: complete.clone(),
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
    let validating = receive(&mut receiver, &mut store, 3, &vec![7; CHUNK_LIMIT + 1]);
    assert!(matches!(
        run(
            &mut receiver,
            &mut store,
            Request::Finalize {
                id: validating.clone()
            }
        ),
        Ok(Response::Pending)
    ));
    let foreground = crate::foreground::Foreground::default();
    let epoch = foreground.capture().unwrap();
    foreground.invalidate().unwrap();
    assert!(matches!(
        store.remove_device_guarded(&[1; 16], || foreground.authorize(Some(epoch))),
        Err(crate::PairingError::CandidateStale)
    ));
    assert_eq!(
        store.record(&[1; 16]).unwrap().unwrap().state,
        RecordState::Complete
    );
    let epoch = foreground.capture().unwrap();
    let revoked = store
        .remove_device_guarded(&[1; 16], || foreground.authorize(Some(epoch)))
        .unwrap();
    assert_eq!(revoked.state, RecordState::Revoked);
    assert!(!store.backup_scope(&[1; 16]).unwrap().unwrap().approved);
    for request in [
        Request::Chunk {
            id: partial.clone(),
            offset: 3,
            bytes: b"def".to_vec(),
        },
        Request::Finalize {
            id: partial.clone(),
        },
        Request::Finalize {
            id: validating.clone(),
        },
        Request::Restore {
            id: complete.clone(),
            offset: 0,
        },
    ] {
        assert!(matches!(
            run(&mut receiver, &mut store, request),
            Err(Error::Denied)
        ));
    }
    assert_eq!(
        fs::read(peer_folder(&folder).join(final_name(&complete))).unwrap(),
        b"kept"
    );
    assert_eq!(
        fs::read(peer_folder(&folder).join(temp_name(&partial))).unwrap(),
        b"abc"
    );
    assert!(!peer_folder(&folder).join(final_name(&validating)).exists());
    let removed = snapshot(&store);
    assert_eq!(removed["devices"]["items"][0]["trust"], "revoked");
    assert_eq!(
        removed["devices"]["items"][0]["backupScope"]["state"],
        "revoked"
    );
    drop(receiver);
    drop(store);
    let child = std::process::Command::new(std::env::current_exe().unwrap())
        .args([
            "--exact",
            "file_receiver::tests::revoke::desktop_device_restart_child",
            "--nocapture",
        ])
        .env("KLODA_DEVICE_RESTART_FIXTURE", directory.path())
        .env("KLODA_DEVICE_RESTART_EXPECTED", removed.to_string())
        .output()
        .unwrap();
    assert!(
        child.status.success(),
        "{}",
        String::from_utf8_lossy(&child.stdout)
    );
    assert!(String::from_utf8_lossy(&child.stdout).contains("device restart fixture read"));
    let mut store = directory.store(key("pc"));
    assert_eq!(snapshot(&store), removed);
    let revision = store.backup_scope(&[1; 16]).unwrap().unwrap().revision;
    // A lost response can retry removal without changing the tombstone or ACL revision.
    store.remove_device_guarded(&[1; 16], || Ok(())).unwrap();
    assert_eq!(
        store.backup_scope(&[1; 16]).unwrap().unwrap().revision,
        revision
    );
    assert!(matches!(
        store.pc_complete(&[1; 16], &key("phone")),
        Err(crate::PairingError::Revoked)
    ));
    assert!(matches!(
        store.pc_consume(&[2; 16], &key("phone"), None),
        Err(crate::PairingError::Revoked)
    ));
    store
        .pc_consume(&[2; 16], &key("phone"), Some([1; 16]))
        .unwrap();
    store.pc_complete(&[2; 16], &key("phone")).unwrap();
    assert!(store.backup_scope(&[2; 16]).unwrap().is_none());
    let mut receiver = Receiver::new();
    assert!(matches!(
        receiver.execute(
            &mut store,
            &[2; 16],
            &key("phone"),
            Request::Create(upload(4, b"new"))
        ),
        Err(Error::Denied)
    ));
    store.approve_backup(&[2; 16], &folder, None).unwrap();
    assert!(matches!(
        run(
            &mut receiver,
            &mut store,
            Request::Create(upload(5, b"old"))
        ),
        Err(Error::Denied)
    ));
    assert!(receiver
        .execute(
            &mut store,
            &[2; 16],
            &key("phone"),
            Request::Create(upload(4, b"new"))
        )
        .is_ok());
    assert_eq!(
        fs::read(peer_folder(&folder).join(final_name(&complete))).unwrap(),
        b"kept"
    );
    println!("KLODA_REMOVAL_SNAPSHOT:{}", removed);
}

#[test]
fn removal_without_scope_and_consumed_record_is_idempotent_but_wrong_role_is_rejected() {
    let directory = Directory::new();
    let mut store = directory.store(key("pc"));
    store.pc_consume(&[1; 16], &key("phone"), None).unwrap();
    for _ in 0..2 {
        assert_eq!(
            store
                .remove_device_guarded(&[1; 16], || Ok(()))
                .unwrap()
                .state,
            RecordState::Revoked
        );
    }
    store
        .phone_pending(
            &[2; 16],
            &key("phone").fingerprint(),
            &crate::state::test_support::hint(),
            None,
        )
        .unwrap();
    assert!(matches!(
        store.remove_device_guarded(&[2; 16], || Ok(())),
        Err(crate::PairingError::CandidateStale)
    ));
    assert_eq!(
        store.record(&[2; 16]).unwrap().unwrap().state,
        RecordState::Pending
    );
}

#[test]
fn failed_removal_transaction_does_not_report_success_or_partially_revoke() {
    let (directory, mut store, _receiver, _folder) = setup();
    store.conn.execute_batch("CREATE TRIGGER remove_fault BEFORE UPDATE ON backup_scopes BEGIN SELECT RAISE(ABORT,'fault'); END;").unwrap();
    assert!(store.remove_device_guarded(&[1; 16], || Ok(())).is_err());
    drop(store);
    let store = directory.store(key("pc"));
    assert_eq!(
        store.record(&[1; 16]).unwrap().unwrap().state,
        RecordState::Complete
    );
    assert!(store.backup_scope(&[1; 16]).unwrap().unwrap().approved);
}
