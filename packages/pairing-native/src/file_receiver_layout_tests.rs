use super::*;
use crate::backup_layout;
use crate::file_schema;
use crate::store_rows;

fn complete_upload(
    receiver: &mut Receiver,
    store: &mut Store,
    request: u8,
    name: &str,
    bytes: &[u8],
) -> String {
    let mut item = upload(request, bytes);
    item.name = name.into();
    let created = operation(run(receiver, store, Request::Create(item)));
    for (index, chunk) in bytes.chunks(CHUNK_LIMIT).enumerate() {
        run(
            receiver,
            store,
            Request::Chunk {
                id: created.id.clone(),
                offset: (index * CHUNK_LIMIT) as u64,
                bytes: chunk.to_vec(),
            },
        )
        .unwrap();
    }
    loop {
        match run(
            receiver,
            store,
            Request::Finalize {
                id: created.id.clone(),
            },
        )
        .unwrap()
        {
            Response::Pending => (),
            Response::Operation(op) => {
                assert!(op.state == OperationState::Completed);
                break;
            }
            _ => panic!("unexpected finalize"),
        }
    }
    created.id
}

#[test]
fn unicode_filenames_publish_to_files_and_keep_peer_root_clean() {
    let (_directory, mut store, mut receiver, folder) = setup();
    let id1 = complete_upload(
        &mut receiver,
        &mut store,
        71,
        "tatil fotoğrafı.jpg",
        b"photo-bytes",
    );
    let id2 = complete_upload(
        &mut receiver,
        &mut store,
        72,
        "rapor 2026.pdf",
        b"pdf-bytes",
    );
    let peer = peer_folder(&folder);
    assert_eq!(
        fs::read(peer.join("Files").join("tatil fotoğrafı.jpg")).unwrap(),
        b"photo-bytes"
    );
    assert_eq!(
        fs::read(peer.join("Files").join("rapor 2026.pdf")).unwrap(),
        b"pdf-bytes"
    );
    assert!(!peer.join(format!("{id1}.media")).exists());
    assert!(!peer.join(format!("{id2}.media")).exists());
    assert!(final_path(&folder, &id1).exists());
    assert!(final_path(&folder, &id2).exists());
    let rec1 = backup_layout::lookup(&store.conn, &id1).unwrap().unwrap();
    assert_eq!(rec1.folder, "Files");
    assert_eq!(rec1.filename, "tatil fotoğrafı.jpg");
}

#[test]
fn collisions_and_long_255_byte_names_use_safe_numbered_suffixes_without_overwrite() {
    let (_directory, mut store, mut receiver, folder) = setup();
    let files_dir = peer_folder(&folder).join("Files");
    fs::create_dir_all(&files_dir).unwrap();
    fs::write(files_dir.join("photo.jpg"), b"manual-user-file").unwrap();

    let id1 = complete_upload(&mut receiver, &mut store, 73, "photo.jpg", b"backup-1");
    let id2 = complete_upload(&mut receiver, &mut store, 74, "photo.jpg", b"backup-2");

    assert_eq!(fs::read(files_dir.join("photo.jpg")).unwrap(), b"manual-user-file");
    assert_eq!(fs::read(files_dir.join("photo (2).jpg")).unwrap(), b"backup-1");
    assert_eq!(fs::read(files_dir.join("photo (3).jpg")).unwrap(), b"backup-2");
    assert_eq!(
        backup_layout::lookup(&store.conn, &id1).unwrap().unwrap().filename,
        "photo (2).jpg"
    );
    assert_eq!(
        backup_layout::lookup(&store.conn, &id2).unwrap().unwrap().filename,
        "photo (3).jpg"
    );

    let long_name = format!("{}.txt", "ğ".repeat(120));
    assert!(file_schema::safe_name(&long_name));
    let long_first = complete_upload(&mut receiver, &mut store, 75, &long_name, b"long-1");
    let long_second = complete_upload(&mut receiver, &mut store, 76, &long_name, b"long-2");
    let second_name = backup_layout::lookup(&store.conn, &long_second)
        .unwrap()
        .unwrap()
        .filename;
    assert_ne!(
        second_name,
        backup_layout::lookup(&store.conn, &long_first)
            .unwrap()
            .unwrap()
            .filename
    );
    assert!(second_name.ends_with(" (2).txt"));
    assert!(file_schema::safe_name(&second_name));
    assert_eq!(fs::read(files_dir.join(&second_name)).unwrap(), b"long-2");
}

#[test]
fn photo_manifest_promotes_resource_from_files_to_photos_and_stays_hidden() {
    let (_directory, mut store, mut receiver, folder) = setup();
    let res_id = complete_upload(&mut receiver, &mut store, 77, "IMG_001.jpg", b"jpeg-data");
    let peer = peer_folder(&folder);
    assert_eq!(
        fs::read(peer.join("Files").join("IMG_001.jpg")).unwrap(),
        b"jpeg-data"
    );

    let manifest_bytes = |rev: &str| {
        serde_json::to_vec(&serde_json::json!({
            "version": 1,
            "sourceDeviceId": "source",
            "assetId": "asset",
            "revision": rev,
            "resources": [{
                "operationId": res_id,
                "role": "original",
                "name": "IMG_001.jpg",
                "mimeType": "image/jpeg",
                "sha256": crate::qr_base64::encode(digest(&SHA256, b"jpeg-data").as_ref()),
                "size": "9"
            }],
            "albums": [],
            "favorite": null
        }))
        .unwrap()
    };

    let m1 = complete_upload(
        &mut receiver,
        &mut store,
        78,
        "kloda-photo-v1-source-asset-1.json",
        &manifest_bytes("1"),
    );
    assert_eq!(
        fs::read(peer.join("Photos").join("IMG_001.jpg")).unwrap(),
        b"jpeg-data"
    );
    assert!(!peer.join("Files").join("IMG_001.jpg").exists());
    assert!(!peer
        .join("Photos")
        .join("kloda-photo-v1-source-asset-1.json")
        .exists());
    assert!(!peer
        .join("Files")
        .join("kloda-photo-v1-source-asset-1.json")
        .exists());
    let rec = backup_layout::lookup(&store.conn, &res_id).unwrap().unwrap();
    assert_eq!(rec.folder, "Photos");
    assert_eq!(rec.filename, "IMG_001.jpg");
    let mrec = backup_layout::lookup(&store.conn, &m1).unwrap().unwrap();
    assert_eq!(mrec.folder, "");
    assert_eq!(mrec.filename, "");

    let m2 = complete_upload(
        &mut receiver,
        &mut store,
        79,
        "kloda-photo-v1-source-asset-2.json",
        &manifest_bytes("2"),
    );
    assert_eq!(
        fs::read(peer.join("Photos").join("IMG_001.jpg")).unwrap(),
        b"jpeg-data"
    );
    assert_eq!(
        backup_layout::lookup(&store.conn, &m2).unwrap().unwrap().folder,
        ""
    );
}

#[test]
fn trash_and_restore_handle_foreign_file_without_overwrite() {
    let (_directory, mut store, mut receiver, folder) = setup();
    let id = complete_upload(&mut receiver, &mut store, 80, "one.txt", b"safe-bytes");
    let files_dir = peer_folder(&folder).join("Files");
    assert_eq!(fs::read(files_dir.join("one.txt")).unwrap(), b"safe-bytes");

    let ids = serde_json::to_string(&vec![id.clone()]).unwrap();
    let trash_res: serde_json::Value = serde_json::from_str(
        &crate::backup_retention::mutate(&mut store, &ids, false, || Ok(())).unwrap(),
    )
    .unwrap();
    assert_eq!(trash_res["items"][0]["success"], true);
    assert!(!files_dir.join("one.txt").exists());

    fs::write(files_dir.join("one.txt"), b"user-manual-file").unwrap();
    let restore_res: serde_json::Value = serde_json::from_str(
        &crate::backup_retention::mutate(&mut store, &ids, true, || Ok(())).unwrap(),
    )
    .unwrap();
    assert_eq!(restore_res["items"][0]["success"], true);
    assert_eq!(fs::read(files_dir.join("one.txt")).unwrap(), b"user-manual-file");
    assert_eq!(fs::read(files_dir.join("one (2).txt")).unwrap(), b"safe-bytes");
    assert_eq!(
        backup_layout::lookup(&store.conn, &id).unwrap().unwrap().filename,
        "one (2).txt"
    );

    crate::backup_retention::mutate(&mut store, &ids, false, || Ok(())).unwrap();
    assert_eq!(fs::read(files_dir.join("one.txt")).unwrap(), b"user-manual-file");
    assert!(!files_dir.join("one (2).txt").exists());
}

#[cfg(unix)]
#[test]
fn symlink_in_files_and_symlinked_files_dir_are_rejected_without_touching_outside() {
    let (directory, mut store, mut receiver, folder) = setup();
    let peer = peer_folder(&folder);
    let files_dir = peer.join("Files");
    fs::create_dir_all(&files_dir).unwrap();
    let outside = directory.path().join("outside-secret.txt");
    fs::write(&outside, b"do-not-clobber").unwrap();
    std::os::unix::fs::symlink(&outside, files_dir.join("target.txt")).unwrap();

    let id = complete_upload(&mut receiver, &mut store, 81, "target.txt", b"backed-up");
    assert_eq!(fs::read(&outside).unwrap(), b"do-not-clobber");
    assert_eq!(
        backup_layout::lookup(&store.conn, &id).unwrap().unwrap().filename,
        "target (2).txt"
    );
    assert_eq!(fs::read(files_dir.join("target (2).txt")).unwrap(), b"backed-up");

    let mut store2 = directory.store(key("pc"));
    store2.pc_consume(&[2; 16], &key("pc"), None).unwrap();
    store2.pc_complete(&[2; 16], &key("pc")).unwrap();
    let folder2 = directory.path().join("media2");
    fs::create_dir(&folder2).unwrap();
    store2
        .approve_backup(&[2; 16], folder2.to_str().unwrap(), None)
        .unwrap();
    let peer2 = folder2.join(crate::qr_base64::encode(&key("pc").fingerprint()));
    let outside_dir = directory.path().join("outside-dir");
    fs::create_dir(&outside_dir).unwrap();
    std::os::unix::fs::symlink(&outside_dir, peer2.join("Files")).unwrap();
    let mut item = upload(82, b"payload");
    item.name = "doc.txt".into();
    let created = match receiver
        .execute(&mut store2, &[2; 16], &key("pc"), Request::Create(item))
        .unwrap()
    {
        Response::Operation(op) => op,
        _ => panic!("expected operation"),
    };
    receiver
        .execute(
            &mut store2,
            &[2; 16],
            &key("pc"),
            Request::Chunk {
                id: created.id.clone(),
                offset: 0,
                bytes: b"payload".to_vec(),
            },
        )
        .unwrap();
    assert!(matches!(
        receiver.execute(
            &mut store2,
            &[2; 16],
            &key("pc"),
            Request::Finalize { id: created.id },
        ),
        Err(Error::BackupPathRejected)
    ));
    assert!(!outside_dir.join("doc.txt").exists());
}

#[test]
fn legacy_v4_flat_media_files_continue_working_after_upgrade_to_v5() {
    let (directory, mut store, mut receiver, folder) = setup();
    let id = complete_upload(&mut receiver, &mut store, 83, "legacy.txt", b"legacy-data");
    let peer = peer_folder(&folder);
    // Simulate a pre-V1-4 flat layout entry & database at user_version = 4.
    fs::rename(part_path_from_peer(&peer, &id), peer.join(temp_name(&id))).unwrap();
    fs::rename(
        peer.join(".kloda").join("objects").join(final_name(&id)),
        peer.join(final_name(&id)),
    )
    .unwrap();
    fs::remove_file(peer.join("Files").join("legacy.txt")).unwrap();
    store
        .conn
        .execute_batch(
            "DROP TABLE scope_folders; DROP TABLE peer_names; DROP TRIGGER retain_backup_path; DROP TABLE backup_paths; PRAGMA user_version=4;",
        )
        .unwrap();
    drop(receiver);
    drop(store);

    let mut store = directory.store(key("pc"));
    let version: i64 = store
        .conn
        .pragma_query_value(None, "user_version", |r| r.get(0))
        .unwrap();
    assert_eq!(version, 6);
    let mut receiver = Receiver::new();
    assert!(
        operation(run(&mut receiver, &mut store, Request::Status { id: id.clone() })).state
            == OperationState::Completed
    );
    match run(
        &mut receiver,
        &mut store,
        Request::Restore {
            id: id.clone(),
            offset: 0,
        },
    )
    .unwrap()
    {
        Response::Data { bytes, .. } => assert_eq!(bytes, b"legacy-data"),
        _ => panic!("expected restore data"),
    }
    let ids = serde_json::to_string(&vec![id.clone()]).unwrap();
    let trash_res: serde_json::Value = serde_json::from_str(
        &crate::backup_retention::mutate(&mut store, &ids, false, || Ok(())).unwrap(),
    )
    .unwrap();
    assert_eq!(trash_res["items"][0]["success"], true);
    assert!(!peer.join(final_name(&id)).exists());
    let restore_res: serde_json::Value = serde_json::from_str(
        &crate::backup_retention::mutate(&mut store, &ids, true, || Ok(())).unwrap(),
    )
    .unwrap();
    assert_eq!(restore_res["items"][0]["success"], true);
    assert_eq!(fs::read(peer.join(final_name(&id))).unwrap(), b"legacy-data");
    assert_eq!(
        store_rows::load(&store.conn, &[1; 16], store.local(), store.epoch())
            .unwrap()
            .unwrap()
            .sid,
        [1; 16]
    );
}

fn part_path_from_peer(peer: &std::path::Path, id: &str) -> PathBuf {
    peer.join(".kloda").join("staging").join(temp_name(id))
}
