use super::*;
#[test]
fn mismatched_hash_never_publishes_and_existing_same_hash_final_is_not_adopted() {
    let (_directory, mut store, mut receiver, folder) = setup();
    let id = operation(run(
        &mut receiver,
        &mut store,
        Request::Create(upload(6, b"right")),
    ))
    .id;
    run(
        &mut receiver,
        &mut store,
        Request::Chunk {
            id: id.clone(),
            offset: 0,
            bytes: b"wrong".to_vec(),
        },
    )
    .unwrap();
    assert!(matches!(
        run(
            &mut receiver,
            &mut store,
            Request::Finalize { id: id.clone() }
        ),
        Err(Error::HashMismatch)
    ));
    assert!(!peer_folder(&folder).join(final_name(&id)).exists());
    assert_eq!(
        fs::read(peer_folder(&folder).join(temp_name(&id))).unwrap(),
        b"wrong"
    );
    let id = receive(&mut receiver, &mut store, 7, b"original");
    let final_path = peer_folder(&folder).join(final_name(&id));
    fs::write(&final_path, b"original").unwrap();
    assert!(matches!(
        run(
            &mut receiver,
            &mut store,
            Request::Finalize { id: id.clone() }
        ),
        Err(Error::Conflict)
    ));
    assert!(matches!(
        run(&mut receiver, &mut store, Request::Status { id }),
        Err(Error::Conflict)
    ));
    assert_eq!(fs::read(final_path).unwrap(), b"original");
}
#[test]
fn publication_response_loss_recovers_only_the_durable_owned_file_and_restores_original_bytes() {
    let (directory, mut store, mut receiver, folder) = setup();
    let id = receive(&mut receiver, &mut store, 8, b"preserved-original");
    store
        .conn
        .execute_batch(
            "CREATE TRIGGER fault BEFORE UPDATE OF state ON file_operations
        WHEN NEW.state=4 BEGIN SELECT RAISE(ABORT,'fault'); END",
        )
        .unwrap();
    assert!(matches!(
        run(
            &mut receiver,
            &mut store,
            Request::Finalize { id: id.clone() }
        ),
        Err(Error::OutcomeUnknown)
    ));
    assert_eq!(
        fs::read(peer_folder(&folder).join(final_name(&id))).unwrap(),
        b"preserved-original"
    );
    drop(store);
    let mut store = directory.store(key("pc"));
    store.conn.execute_batch("DROP TRIGGER fault").unwrap();
    let mut receiver = Receiver::new();
    assert!(
        operation(run(
            &mut receiver,
            &mut store,
            Request::Status { id: id.clone() }
        ))
        .state
            == OperationState::Completed
    );
    match run(
        &mut receiver,
        &mut store,
        Request::Restore {
            id: id.clone(),
            offset: 4,
        },
    )
    .unwrap()
    {
        Response::Data {
            bytes,
            offset,
            size,
        } => {
            assert_eq!(bytes, b"erved-original");
            assert_eq!(offset, 4);
            assert_eq!(size, 18);
        }
        _ => panic!("expected original data"),
    }
    match run(&mut receiver, &mut store, Request::List { after: None }).unwrap() {
        Response::List(photos) => {
            assert_eq!(photos.len(), 1);
            assert_eq!(photos[0].id, id);
        }
        _ => panic!("expected own list"),
    }
}
