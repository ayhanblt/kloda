use super::*;

#[test]
fn same_peer_same_root_regrant_restores_completed_reads_but_not_pending_work() {
    let (directory, mut store, mut receiver, folder) = setup();
    let completed = receive(&mut receiver, &mut store, 46, b"committed-original");
    run(
        &mut receiver,
        &mut store,
        Request::Finalize {
            id: completed.clone(),
        },
    )
    .unwrap();
    let bytes = vec![7; CHUNK_LIMIT + 1];
    let pending = receive(&mut receiver, &mut store, 47, &bytes);
    assert!(matches!(
        run(
            &mut receiver,
            &mut store,
            Request::Finalize {
                id: pending.clone()
            }
        ),
        Ok(Response::Pending)
    ));
    store.revoke_backup(&[1; 16]).unwrap();
    assert!(matches!(
        run(
            &mut receiver,
            &mut store,
            Request::Status {
                id: completed.clone()
            }
        ),
        Err(Error::Denied)
    ));
    store.approve_backup(&[1; 16], &folder, Some(2)).unwrap();
    assert!(
        operation(run(
            &mut receiver,
            &mut store,
            Request::Status {
                id: completed.clone()
            }
        ))
        .state
            == OperationState::Completed
    );
    match run(
        &mut receiver,
        &mut store,
        Request::Restore {
            id: completed.clone(),
            offset: 0,
        },
    )
    .unwrap()
    {
        Response::Data { bytes, .. } => assert_eq!(bytes, b"committed-original"),
        _ => panic!("expected committed original"),
    }
    match run(&mut receiver, &mut store, Request::List { after: None }).unwrap() {
        Response::List(photos) => {
            assert_eq!(photos.len(), 1);
            assert_eq!(photos[0].id, completed);
        }
        _ => panic!("expected committed list"),
    }
    for request in [
        Request::Status {
            id: pending.clone(),
        },
        Request::Finalize {
            id: pending.clone(),
        },
        Request::Chunk {
            id: pending.clone(),
            offset: 0,
            bytes: bytes[..CHUNK_LIMIT].to_vec(),
        },
    ] {
        assert!(matches!(
            run(&mut receiver, &mut store, request),
            Err(Error::BackupScopeChanged)
        ));
    }
    assert_eq!(
        fs::read(peer_folder(&folder).join(temp_name(&pending))).unwrap(),
        bytes
    );
    drop(store);
    let mut store = directory.store(key("pc"));
    let mut receiver = Receiver::new();
    assert!(
        operation(run(
            &mut receiver,
            &mut store,
            Request::Status {
                id: completed.clone()
            }
        ))
        .state
            == OperationState::Completed
    );
    assert!(
        matches!(run(&mut receiver, &mut store, Request::Restore { id: completed, offset: 0 }),
        Ok(Response::Data { bytes, .. }) if bytes == b"committed-original")
    );
}

#[test]
fn reselecting_a_different_root_never_authorizes_reads_of_prior_completed_files() {
    let (directory, mut store, mut receiver, folder) = setup();
    let completed = receive(&mut receiver, &mut store, 48, b"old-root-original");
    run(
        &mut receiver,
        &mut store,
        Request::Finalize {
            id: completed.clone(),
        },
    )
    .unwrap();
    let selected = directory.path().join("new-media");
    fs::create_dir(&selected).unwrap();
    store
        .approve_backup(&[1; 16], selected.to_str().unwrap(), Some(1))
        .unwrap();
    for request in [
        Request::Status {
            id: completed.clone(),
        },
        Request::Restore {
            id: completed.clone(),
            offset: 0,
        },
    ] {
        assert!(matches!(
            run(&mut receiver, &mut store, request),
            Err(Error::BackupScopeChanged)
        ));
    }
    assert!(
        matches!(run(&mut receiver, &mut store, Request::List { after: None }), Ok(Response::List(photos)) if photos.is_empty())
    );
    assert_eq!(
        fs::read(peer_folder(&folder).join(final_name(&completed))).unwrap(),
        b"old-root-original"
    );
}
