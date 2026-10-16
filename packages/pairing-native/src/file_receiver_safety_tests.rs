use super::*;
#[test]
fn completed_data_never_crosses_peer_or_remote_path_boundaries() {
    let (_directory, mut store, mut receiver, folder) = setup();
    let id = receive(&mut receiver, &mut store, 11, b"private");
    run(
        &mut receiver,
        &mut store,
        Request::Finalize { id: id.clone() },
    )
    .unwrap();
    store.pc_consume(&[2; 16], &key("pc"), None).unwrap();
    store.pc_complete(&[2; 16], &key("pc")).unwrap();
    store.approve_backup(&[2; 16], &folder, None).unwrap();
    for request in [
        Request::Status { id: id.clone() },
        Request::Restore { id, offset: 0 },
    ] {
        assert!(matches!(
            receiver.execute(&mut store, &[2; 16], &key("pc"), request),
            Err(Error::NotFound)
        ));
    }
    assert!(
        matches!(receiver.execute(&mut store, &[2; 16], &key("pc"), Request::List { after: None }), Ok(Response::List(photos)) if photos.is_empty())
    );
    for name in [
        "../outside",
        "C:\\outside",
        "NUL.jpg",
        "photo.",
        "a/b",
        "a\\b",
    ] {
        let mut invalid = upload(12, b"private");
        invalid.name = name.into();
        assert!(matches!(
            run(&mut receiver, &mut store, Request::Create(invalid)),
            Err(Error::InvalidRequest)
        ));
    }
    assert!(matches!(
        run(
            &mut receiver,
            &mut store,
            Request::Restore {
                id: "../../outside".into(),
                offset: 0
            }
        ),
        Err(Error::InvalidRequest)
    ));
}
#[cfg(unix)]
#[test]
fn substituted_symlink_never_reads_or_writes_an_outside_file() {
    let (directory, mut store, mut receiver, folder) = setup();
    let id = operation(run(
        &mut receiver,
        &mut store,
        Request::Create(upload(15, b"owned")),
    ))
    .id;
    let path = peer_folder(&folder).join(temp_name(&id));
    fs::rename(&path, path.with_extension("preserved")).unwrap();
    let outside = directory.path().join("outside");
    fs::write(&outside, b"outside-private").unwrap();
    std::os::unix::fs::symlink(&outside, &path).unwrap();
    assert!(matches!(
        run(
            &mut receiver,
            &mut store,
            Request::Chunk {
                id,
                offset: 0,
                bytes: b"owned".to_vec()
            }
        ),
        Err(Error::BackupPathRejected)
    ));
    assert_eq!(fs::read(outside).unwrap(), b"outside-private");
}

#[test]
fn completed_result_is_not_authority_after_current_file_grant_is_revoked() {
    let (_directory, mut store, mut receiver, folder) = setup();
    let id = receive(&mut receiver, &mut store, 16, b"retained-completed");
    run(
        &mut receiver,
        &mut store,
        Request::Finalize { id: id.clone() },
    )
    .unwrap();
    store.revoke_backup(&[1; 16]).unwrap();
    for request in [
        Request::Status { id: id.clone() },
        Request::Restore {
            id: id.clone(),
            offset: 0,
        },
        Request::List { after: None },
        Request::Finalize { id: id.clone() },
    ] {
        assert!(matches!(
            run(&mut receiver, &mut store, request),
            Err(Error::Denied)
        ));
    }
    assert!(store.record(&[1; 16]).unwrap().unwrap().state == RecordState::Complete);
    assert_eq!(
        fs::read(peer_folder(&folder).join(final_name(&id))).unwrap(),
        b"retained-completed"
    );
}
