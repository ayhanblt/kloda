use super::*;
#[test]
fn resumed_offset_and_same_byte_retries_bind_the_whole_original_upload() {
    let (directory, mut store, mut receiver, _) = setup();
    let upload = upload(4, b"abcdef");
    let id = operation(run(
        &mut receiver,
        &mut store,
        Request::Create(upload.clone()),
    ))
    .id;
    let first = operation(run(
        &mut receiver,
        &mut store,
        Request::Chunk {
            id: id.clone(),
            offset: 0,
            bytes: b"abc".to_vec(),
        },
    ));
    assert_eq!(first.offset, 3);
    drop(store);
    let mut store = directory.store(key("pc"));
    let mut receiver = Receiver::new();
    assert_eq!(
        operation(run(
            &mut receiver,
            &mut store,
            Request::Status { id: id.clone() }
        ))
        .offset,
        3
    );
    assert_eq!(
        operation(run(
            &mut receiver,
            &mut store,
            Request::Create(upload.clone())
        ))
        .id,
        id
    );
    let mut conflicting = upload;
    conflicting.source_revision = "revision-2".into();
    assert!(matches!(
        run(&mut receiver, &mut store, Request::Create(conflicting)),
        Err(Error::Conflict)
    ));
    assert!(matches!(
        run(
            &mut receiver,
            &mut store,
            Request::Chunk {
                id: id.clone(),
                offset: 0,
                bytes: b"xyz".to_vec()
            }
        ),
        Err(Error::Conflict)
    ));
    run(
        &mut receiver,
        &mut store,
        Request::Chunk {
            id: id.clone(),
            offset: 0,
            bytes: b"abc".to_vec(),
        },
    )
    .unwrap();
    run(
        &mut receiver,
        &mut store,
        Request::Chunk {
            id: id.clone(),
            offset: 3,
            bytes: b"def".to_vec(),
        },
    )
    .unwrap();
    assert!(
        operation(run(
            &mut receiver,
            &mut store,
            Request::Finalize { id: id.clone() }
        ))
        .state
            == OperationState::Completed
    );
    assert!(
        operation(run(&mut receiver, &mut store, Request::Finalize { id })).state
            == OperationState::Completed
    );
}
#[test]
fn failed_offset_commit_keeps_crash_tail_and_only_identical_retry_adopts_it() {
    let (directory, mut store, mut receiver, folder) = setup();
    let id = operation(run(
        &mut receiver,
        &mut store,
        Request::Create(upload(5, b"abcdef")),
    ))
    .id;
    store
        .conn
        .execute_batch(
            "CREATE TRIGGER fault BEFORE UPDATE OF offset ON file_operations
        WHEN NEW.offset>OLD.offset BEGIN SELECT RAISE(ABORT,'fault'); END",
        )
        .unwrap();
    assert!(matches!(
        run(
            &mut receiver,
            &mut store,
            Request::Chunk {
                id: id.clone(),
                offset: 0,
                bytes: b"abc".to_vec()
            }
        ),
        Err(Error::OutcomeUnknown)
    ));
    let path = peer_folder(&folder).join(temp_name(&id));
    assert_eq!(fs::read(&path).unwrap(), b"abc");
    drop(store);
    let mut store = directory.store(key("pc"));
    store.conn.execute_batch("DROP TRIGGER fault").unwrap();
    let mut receiver = Receiver::new();
    assert_eq!(
        operation(run(
            &mut receiver,
            &mut store,
            Request::Status { id: id.clone() }
        ))
        .offset,
        0
    );
    assert!(matches!(
        run(
            &mut receiver,
            &mut store,
            Request::Chunk {
                id: id.clone(),
                offset: 0,
                bytes: b"xyz".to_vec()
            }
        ),
        Err(Error::Conflict)
    ));
    assert_eq!(fs::read(&path).unwrap(), b"abc");
    assert_eq!(
        operation(run(
            &mut receiver,
            &mut store,
            Request::Chunk {
                id: id.clone(),
                offset: 0,
                bytes: b"ab".to_vec()
            }
        ))
        .offset,
        2
    );
    assert_eq!(fs::read(&path).unwrap(), b"abc");
    run(
        &mut receiver,
        &mut store,
        Request::Chunk {
            id: id.clone(),
            offset: 2,
            bytes: b"cdef".to_vec(),
        },
    )
    .unwrap();
    assert!(
        operation(run(&mut receiver, &mut store, Request::Finalize { id })).state
            == OperationState::Completed
    );
}
