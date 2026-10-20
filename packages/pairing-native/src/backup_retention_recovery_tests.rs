use super::*;

#[test]
fn partial_copy_delete_restore_and_purge_intents_retry_without_adopting_foreign_files() {
    let (directory, mut store, mut receiver, peer) = setup();
    let id = receive(
        &mut store,
        &mut receiver,
        upload(1, 3, "v1", "one.txt", b"safe"),
        b"safe",
    );
    files::protect(&mut store, &id).unwrap();
    let copy = saved(&store, &id).unwrap().unwrap();
    assert_ne!(copy.copy, copy.live);
    // A durably bound partial copy can be rewritten; a foreign file is never adopted.
    fs::write(peer.join(format!(".kloda-{id}.keep")), b"s").unwrap();
    store
        .conn
        .execute("UPDATE backup_protections SET ready=0 WHERE id=?1", [&id])
        .unwrap();
    drop(receiver);
    drop(store);
    let mut store = directory.store(key("pc"));
    files::protect(&mut store, &id).unwrap();
    assert_eq!(
        fs::read(peer.join(format!(".kloda-{id}.keep"))).unwrap(),
        b"safe"
    );
    store.conn.execute("INSERT INTO backup_deletions(id,deleted_at,expires_at,phase,dependencies) VALUES(?1,1000,?2,1,'[]')",params![id,1000+RETENTION_MS]).unwrap();
    fs::remove_file(peer.join(format!("{id}.media"))).unwrap();
    assert!(peer.join(format!(".kloda-{id}.part")).exists());
    drop(store);
    let mut store = directory.store(key("pc"));
    actions::maintain(&mut store, 2000).unwrap();
    assert_eq!(deleted(&store, &id).unwrap().unwrap().phase, 2);
    assert!(!peer.join(format!(".kloda-{id}.part")).exists());
    store
        .conn
        .execute("UPDATE backup_deletions SET phase=3 WHERE id=?1", [&id])
        .unwrap();
    files::restore(&mut store, &id).unwrap();
    fs::remove_file(peer.join(format!(".kloda-{id}.part"))).unwrap();
    drop(store);
    let mut store = directory.store(key("pc"));
    actions::maintain(&mut store, 2000).unwrap();
    assert_eq!(deleted(&store, &id).unwrap().unwrap().phase, 4);
    assert_eq!(fs::read(peer.join(format!("{id}.media"))).unwrap(), b"safe");
    assert_eq!(
        fs::read(peer.join(format!(".kloda-{id}.part"))).unwrap(),
        b"safe"
    );
    actions::change(&mut store, &id, false, 3000).unwrap();
    store
        .conn
        .execute("UPDATE backup_deletions SET phase=5 WHERE id=?1", [&id])
        .unwrap();
    fs::remove_file(peer.join(format!(".kloda-{id}.keep"))).unwrap();
    drop(store);
    let mut store = directory.store(key("pc"));
    actions::maintain(&mut store, 3000 + RETENTION_MS).unwrap();
    assert_eq!(deleted(&store, &id).unwrap().unwrap().phase, 6);
    assert!(matches!(
        protocol::disposition(&store, &id),
        Err(Error::OwnerDeleted)
    ));
}

#[test]
fn substituted_target_even_with_same_bytes_and_regrant_root_change_stop_before_deletion() {
    let (_directory, mut store, mut receiver, peer) = setup();
    let id = receive(
        &mut store,
        &mut receiver,
        upload(1, 3, "v1", "one.txt", b"safe"),
        b"safe",
    );
    let target = peer.join(format!("{id}.media"));
    let unknown = peer.join("manual-copy");
    fs::write(&unknown, b"safe").unwrap();
    fs::rename(&unknown, &target).unwrap();
    assert!(actions::change(&mut store, &id, false, 1000).is_err());
    assert_eq!(fs::read(&target).unwrap(), b"safe");
    assert!(deleted(&store, &id).unwrap().is_none());
    let second = receive(
        &mut store,
        &mut receiver,
        upload(2, 4, "v2", "two.txt", b"two"),
        b"two",
    );
    let root = peer.parent().unwrap().parent().unwrap().join("other-media");
    fs::create_dir(&root).unwrap();
    let revision = store.backup_scope(&[1; 16]).unwrap().unwrap().revision;
    store
        .approve_backup(&[1; 16], root.to_str().unwrap(), Some(revision))
        .unwrap();
    assert!(matches!(
        actions::change(&mut store, &second, false, 1000),
        Err(Error::BackupScopeChanged)
    ));
    assert_eq!(
        fs::read(peer.join(format!("{second}.media"))).unwrap(),
        b"two"
    );
}

#[test]
fn pending_photos_manifest_cannot_publish_after_its_resource_is_trashed_and_expired() {
    let (_directory, mut store, mut receiver, _peer) = setup();
    let resource = receive(
        &mut store,
        &mut receiver,
        upload(1, 3, "media1", "photo.jpg", b"image"),
        b"image",
    );
    let bytes = photo_tests::manifest(&resource, 1);
    let pending = operation(run(
        &mut receiver,
        &mut store,
        Request::Create(upload(
            2,
            8,
            "version1",
            "kloda-photo-v1-source-asset-1.json",
            &bytes,
        )),
    ))
    .id;
    run(
        &mut receiver,
        &mut store,
        Request::Chunk {
            id: pending.clone(),
            offset: 0,
            bytes,
        },
    )
    .unwrap();
    actions::change(&mut store, &resource, false, 1000).unwrap();
    assert!(run(
        &mut receiver,
        &mut store,
        Request::Finalize {
            id: pending.clone()
        }
    )
    .is_err());
    actions::maintain(&mut store, 1000 + RETENTION_MS).unwrap();
    assert!(run(&mut receiver, &mut store, Request::Finalize { id: pending }).is_err());
}

#[test]
fn delayed_delete_completion_receives_full_recovery_window_before_any_cleanup() {
    let (_directory, mut store, mut receiver, peer) = setup();
    let id = receive(
        &mut store,
        &mut receiver,
        upload(1, 3, "v1", "one.txt", b"safe"),
        b"safe",
    );
    files::protect(&mut store, &id).unwrap();
    store.conn.execute("INSERT INTO backup_deletions(id,deleted_at,expires_at,phase,dependencies) VALUES(?1,1000,?2,1,'[]')",params![id,1000+RETENTION_MS]).unwrap();
    let resumed = 1000 + 2 * RETENTION_MS;
    actions::maintain(&mut store, resumed).unwrap();
    let recovered = deleted(&store, &id).unwrap().unwrap();
    assert_eq!(recovered.phase, 2);
    assert!(recovered.at >= resumed && recovered.expires >= resumed + RETENTION_MS);
    actions::maintain(&mut store, recovered.expires - 1).unwrap();
    assert!(peer.join(format!(".kloda-{id}.keep")).exists());
    actions::maintain(&mut store, recovered.expires).unwrap();
    assert_eq!(deleted(&store, &id).unwrap().unwrap().phase, 6);
}
