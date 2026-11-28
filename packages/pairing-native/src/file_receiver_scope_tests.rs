use super::*;
#[test]
fn resumed_hash_work_rechecks_scope_revision_and_cancel_does_not_remove_media() {
    let (_directory, mut store, mut receiver, folder) = setup();
    let bytes = vec![2; CHUNK_LIMIT + 1];
    let id = receive(&mut receiver, &mut store, 10, &bytes);
    assert!(matches!(
        run(
            &mut receiver,
            &mut store,
            Request::Finalize { id: id.clone() }
        ),
        Ok(Response::Pending)
    ));
    receiver.cancel_all();
    assert!(matches!(
        run(
            &mut receiver,
            &mut store,
            Request::Finalize { id: id.clone() }
        ),
        Ok(Response::Pending)
    ));
    store.approve_backup(&[1; 16], &folder, Some(1)).unwrap();
    assert!(matches!(
        run(
            &mut receiver,
            &mut store,
            Request::Finalize { id: id.clone() }
        ),
        Err(Error::BackupScopeChanged)
    ));
    assert_eq!(fs::read(temp_path(&folder, &id)).unwrap(), bytes);
    assert!(!final_path(&folder, &id).exists());
}
#[test]
fn changed_native_file_identity_and_replaced_root_are_not_adopted() {
    let (directory, mut store, mut receiver, folder) = setup();
    let id = receive(&mut receiver, &mut store, 13, b"original");
    let path = temp_path(&folder, &id);
    let old = path.with_extension("preserved");
    fs::rename(&path, &old).unwrap();
    fs::write(&path, b"original").unwrap();
    assert!(matches!(
        run(
            &mut receiver,
            &mut store,
            Request::Finalize { id: id.clone() }
        ),
        Err(Error::Conflict)
    ));
    fs::rename(&folder, directory.path().join("old-media")).unwrap();
    fs::create_dir(&folder).unwrap();
    backup_root::prepare(&folder, &key("phone").fingerprint()).unwrap();
    assert!(matches!(
        run(&mut receiver, &mut store, Request::Status { id }),
        Err(Error::BackupScopeChanged)
    ));
    assert_eq!(
        fs::read(
            directory
                .path()
                .join("old-media")
                .join(crate::qr_base64::encode(&key("phone").fingerprint()))
                .join(".kloda")
                .join("staging")
                .join(old.file_name().unwrap())
        )
        .unwrap(),
        b"original"
    );
}

#[test]
fn scope_probe_reports_not_approved_approved_and_revoked_without_admitting_files() {
    let directory = Directory::new();
    let mut store = directory.store(key("pc"));
    let phone = key("phone");
    store.pc_consume(&[9; 16], &phone, None).unwrap();
    store.pc_complete(&[9; 16], &phone).unwrap();
    let mut receiver = Receiver::new();

    match receiver.execute(&mut store, &[9; 16], &phone, Request::Scope).unwrap() {
        Response::Scope(probe) => assert_eq!(probe.scope_state, "not_approved"),
        _ => panic!("expected Scope response"),
    }

    let folder = directory.path().join("media");
    fs::create_dir(&folder).unwrap();
    store
        .approve_backup(&[9; 16], folder.to_str().unwrap(), None)
        .unwrap();
    match receiver.execute(&mut store, &[9; 16], &phone, Request::Scope).unwrap() {
        Response::Scope(probe) => assert_eq!(probe.scope_state, "approved"),
        _ => panic!("expected Scope response"),
    }

    store.revoke_backup(&[9; 16]).unwrap();
    match receiver.execute(&mut store, &[9; 16], &phone, Request::Scope).unwrap() {
        Response::Scope(probe) => assert_eq!(probe.scope_state, "revoked"),
        _ => panic!("expected Scope response"),
    }

    let wrong = key("pc");
    assert!(matches!(
        receiver.execute(&mut store, &[9; 16], &wrong, Request::Scope),
        Err(Error::Denied)
    ));
}
