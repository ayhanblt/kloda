use super::*;
#[test]
fn journal_busy_returns_acl_busy_preserves_tail_and_allows_exact_retry() {
    let (directory, mut store, mut receiver, folder) = setup();
    let id = operation(run(
        &mut receiver,
        &mut store,
        Request::Create(upload(14, b"busy-bytes")),
    ))
    .id;
    store.conn.busy_timeout(std::time::Duration::ZERO).unwrap();
    let lock = rusqlite::Connection::open(directory.path().join("pairing.sqlite3")).unwrap();
    lock.execute_batch("BEGIN IMMEDIATE").unwrap();
    assert!(matches!(
        run(
            &mut receiver,
            &mut store,
            Request::Chunk {
                id: id.clone(),
                offset: 0,
                bytes: b"busy-bytes".to_vec()
            }
        ),
        Err(Error::AclBusy)
    ));
    assert_eq!(
        fs::read(peer_folder(&folder).join(temp_name(&id))).unwrap(),
        b"busy-bytes"
    );
    lock.execute_batch("ROLLBACK").unwrap();
    assert_eq!(
        operation(run(
            &mut receiver,
            &mut store,
            Request::Status { id: id.clone() }
        ))
        .offset,
        0
    );
    assert_eq!(
        operation(run(
            &mut receiver,
            &mut store,
            Request::Chunk {
                id,
                offset: 0,
                bytes: b"busy-bytes".to_vec()
            }
        ))
        .offset,
        10
    );
}
#[test]
fn empty_photo_finalize_and_own_completed_listing_have_bounded_cursor_pages() {
    let (_directory, mut store, mut receiver, _folder) = setup();
    for request in 20..54 {
        let id = receive(&mut receiver, &mut store, request, b"");
        assert!(
            operation(run(&mut receiver, &mut store, Request::Finalize { id })).state
                == OperationState::Completed
        );
    }
    let first = match run(&mut receiver, &mut store, Request::List { after: None }).unwrap() {
        Response::List(photos) => photos,
        _ => panic!("expected own list"),
    };
    assert_eq!(first.len(), 32);
    let last = first.last().unwrap().id.clone();
    let second = match run(
        &mut receiver,
        &mut store,
        Request::List { after: Some(last) },
    )
    .unwrap()
    {
        Response::List(photos) => photos,
        _ => panic!("expected own list"),
    };
    assert_eq!(second.len(), 2);
    assert!(!first
        .iter()
        .any(|old| second.iter().any(|new| old.id == new.id)));
    assert!(
        matches!(run(&mut receiver, &mut store, Request::Restore { id: second[0].id.clone(), offset: 0 }),
        Ok(Response::Data { bytes, offset: 0, size: 0 }) if bytes.is_empty())
    );
}
