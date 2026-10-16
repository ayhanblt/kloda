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
