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
    assert_eq!(
        fs::read(peer_folder(&folder).join(temp_name(&id))).unwrap(),
        bytes
    );
    assert!(!peer_folder(&folder).join(final_name(&id)).exists());
}
#[test]
fn changed_native_file_identity_and_replaced_root_are_not_adopted() {
    let (directory, mut store, mut receiver, folder) = setup();
    let id = receive(&mut receiver, &mut store, 13, b"original");
    let path = peer_folder(&folder).join(temp_name(&id));
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
                .join(old.file_name().unwrap())
        )
        .unwrap(),
        b"original"
    );
}
