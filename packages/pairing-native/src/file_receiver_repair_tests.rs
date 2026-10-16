use super::*;

fn repaired(receiver: &mut Receiver, store: &mut Store, request: Request) -> Result<Response> {
    receiver.execute(store, &[2; 16], &key("phone"), request)
}

#[test]
fn same_peer_regrant_and_repair_read_only_committed_history_under_current_scope() {
    let (directory, mut store, mut receiver, folder) = setup();
    store.approve_backup(&[1; 16], &folder, Some(1)).unwrap();
    let completed = receive(&mut receiver, &mut store, 49, b"prior-pairing-original");
    run(
        &mut receiver,
        &mut store,
        Request::Finalize {
            id: completed.clone(),
        },
    )
    .unwrap();
    let bytes = vec![7; CHUNK_LIMIT + 1];
    let pending = receive(&mut receiver, &mut store, 50, &bytes);
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
    let binding = store.backup_scope(&[1; 16]).unwrap().unwrap().binding;
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
    store.approve_backup(&[1; 16], &folder, Some(3)).unwrap();
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
    assert!(matches!(
        run(
            &mut receiver,
            &mut store,
            Request::Finalize {
                id: pending.clone()
            }
        ),
        Err(Error::BackupScopeChanged)
    ));
    run(&mut receiver, &mut store, Request::RevokePair).unwrap();
    let peer = key("phone");
    store.pc_consume(&[2; 16], &peer, Some([1; 16])).unwrap();
    store.pc_complete(&[2; 16], &peer).unwrap();
    assert!(matches!(
        repaired(
            &mut receiver,
            &mut store,
            Request::Status {
                id: completed.clone()
            }
        ),
        Err(Error::Denied)
    ));
    store.approve_backup(&[2; 16], &folder, None).unwrap();
    assert_eq!(
        store.backup_scope(&[2; 16]).unwrap().unwrap().binding,
        binding
    );
    drop(store);
    let mut store = directory.store(key("pc"));
    let mut receiver = Receiver::new();
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
    let result = operation(repaired(
        &mut receiver,
        &mut store,
        Request::Status {
            id: completed.clone(),
        },
    ));
    assert_eq!(result.id, completed);
    assert!(result.state == OperationState::Completed);
    assert!(
        matches!(repaired(&mut receiver, &mut store, Request::Restore { id: completed.clone(), offset: 0 }),
        Ok(Response::Data { bytes, .. }) if bytes == b"prior-pairing-original")
    );
    match repaired(&mut receiver, &mut store, Request::List { after: None }).unwrap() {
        Response::List(photos) => {
            assert_eq!(photos.len(), 1);
            assert_eq!(photos[0].id, completed);
        }
        _ => panic!("expected own committed history"),
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
        Request::Finalize {
            id: completed.clone(),
        },
    ] {
        assert!(matches!(
            repaired(&mut receiver, &mut store, request),
            Err(Error::NotFound)
        ));
    }
    let created = operation(repaired(
        &mut receiver,
        &mut store,
        Request::Create(upload(49, b"prior-pairing-original")),
    ));
    assert_ne!(created.id, completed);
    assert!(created.state == OperationState::Receiving);
    assert_eq!(created.offset, 0);
    assert_eq!(
        operation(repaired(
            &mut receiver,
            &mut store,
            Request::Create(upload(49, b"prior-pairing-original"))
        ))
        .id,
        created.id
    );
    let sid: Vec<u8> = store
        .conn
        .query_row(
            "SELECT sid FROM file_operations WHERE id=?1",
            [&completed],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(sid, [1; 16]);
    let other = key("pc");
    store.pc_consume(&[3; 16], &other, None).unwrap();
    store.pc_complete(&[3; 16], &other).unwrap();
    store.approve_backup(&[3; 16], &folder, None).unwrap();
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
            receiver.execute(&mut store, &[3; 16], &other, request),
            Err(Error::NotFound)
        ));
    }
    assert!(
        matches!(receiver.execute(&mut store, &[3; 16], &other, Request::List { after: None }), Ok(Response::List(photos)) if photos.is_empty())
    );
    let selected = directory.path().join("different-media");
    fs::create_dir(&selected).unwrap();
    store
        .approve_backup(&[2; 16], selected.to_str().unwrap(), Some(1))
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
            repaired(&mut receiver, &mut store, request),
            Err(Error::BackupScopeChanged)
        ));
    }
    assert!(
        matches!(repaired(&mut receiver, &mut store, Request::List { after: None }), Ok(Response::List(photos)) if photos.is_empty())
    );
    assert_eq!(
        fs::read(peer_folder(&folder).join(final_name(&completed))).unwrap(),
        b"prior-pairing-original"
    );
    assert_eq!(
        fs::read(peer_folder(&folder).join(temp_name(&pending))).unwrap(),
        bytes
    );
}
