use super::*;

#[test]
fn photos_explicit_rebackup_accepts_new_resource_links_but_never_changed_metadata() {
    let (_directory, mut store, mut receiver, _peer) = setup();
    let media_upload = upload(1, 3, "media1", "photo.jpg", b"image");
    let media = receive(&mut store, &mut receiver, media_upload.clone(), b"image");
    let bytes = photo_tests::manifest(&media, 1);
    let original = upload(
        2,
        8,
        &crate::qr_base64::encode(digest(&SHA256, &bytes).as_ref()),
        "kloda-photo-v1-source-asset-1.json",
        &bytes,
    );
    let version = receive(&mut store, &mut receiver, original.clone(), &bytes);
    actions::change(&mut store, &version, false, 1000).unwrap();
    let expiry = deleted(&store, &version).unwrap().unwrap().expires;
    actions::maintain(&mut store, expiry).unwrap();
    assert!(matches!(
        protocol::disposition(&store, &media),
        Err(Error::OwnerDeleted)
    ));
    let mut next_media = media_upload;
    next_media.request_id = crate::qr_base64::encode(&[3; 16]);
    next_media.rebackup_of = Some(media.clone());
    let replacement = receive(&mut store, &mut receiver, next_media, b"image");
    assert_ne!(media, replacement);
    let next_bytes = photo_tests::manifest(&replacement, 1);
    assert_ne!(bytes, next_bytes);
    let mut next = upload(
        4,
        8,
        &crate::qr_base64::encode(digest(&SHA256, &next_bytes).as_ref()),
        &original.name,
        &next_bytes,
    );
    assert!(matches!(
        run(&mut receiver, &mut store, Request::Create(next.clone())),
        Err(Error::OwnerDeleted)
    ));
    next.rebackup_of = Some(version.clone());
    let new_version = receive(&mut store, &mut receiver, next.clone(), &next_bytes);
    // Exact lost-response retry returns only the same new operation, not the old tombstone.
    assert_eq!(
        operation(run(&mut receiver, &mut store, Request::Create(next))).id,
        new_version
    );
    let mut modified: serde_json::Value = serde_json::from_slice(&next_bytes).unwrap();
    modified["favorite"] = serde_json::json!(true);
    let modified = serde_json::to_vec(&modified).unwrap();
    let mut request = upload(
        5,
        8,
        &crate::qr_base64::encode(digest(&SHA256, &modified).as_ref()),
        &original.name,
        &modified,
    );
    request.rebackup_of = Some(version.clone());
    let invalid = operation(run(&mut receiver, &mut store, Request::Create(request)));
    run(
        &mut receiver,
        &mut store,
        Request::Chunk {
            id: invalid.id.clone(),
            offset: 0,
            bytes: modified,
        },
    )
    .unwrap();
    assert!(matches!(
        run(
            &mut receiver,
            &mut store,
            Request::Finalize { id: invalid.id }
        ),
        Err(Error::Conflict)
    ));
    assert!(matches!(
        protocol::disposition(&store, &version),
        Err(Error::OwnerDeleted)
    ));
    assert!(matches!(
        mutate(&mut store, &" ".repeat(1025), false, || Ok(())),
        Err(Error::InvalidRequest)
    ));
    let active = view(&store, false);
    assert_eq!(active["items"].as_array().unwrap().len(), 1);
    assert_eq!(active["items"][0]["id"], new_version);
}

#[test]
fn actual_native_backup_snapshots_for_isolated_renderer_smoke() {
    let (_directory, mut store, mut receiver, _peer) = setup();
    let id = receive(
        &mut store,
        &mut receiver,
        upload(1, 3, "v1", "one.txt", b"safe"),
        b"safe",
    );
    let active = view(&store, false);
    actions::change(&mut store, &id, false, 1000).unwrap();
    let trash = view(&store, true);
    actions::change(&mut store, &id, true, 2000).unwrap();
    let restored = view(&store, false);
    actions::change(&mut store, &id, false, 3000).unwrap();
    let expiry = deleted(&store, &id).unwrap().unwrap().expires;
    actions::maintain(&mut store, expiry).unwrap();
    let expired = view(&store, true);
    println!(
        "KLODA_BACKUP_SNAPSHOTS={}",
        serde_json::json!({"active":active,"trash":trash,"restored":restored,"expired":expired})
    );
}

#[test]
fn admitted_rebackup_create_retry_survives_owner_undo_of_previous_deletion() {
    let (_directory, mut store, mut receiver, _peer) = setup();
    let original = upload(1, 3, "v1", "one.txt", b"safe");
    let id = receive(&mut store, &mut receiver, original.clone(), b"safe");
    actions::change(&mut store, &id, false, 1000).unwrap();
    let mut next = original;
    next.request_id = crate::qr_base64::encode(&[2; 16]);
    next.rebackup_of = Some(id.clone());
    let admitted = operation(run(
        &mut receiver,
        &mut store,
        Request::Create(next.clone()),
    ));
    actions::change(&mut store, &id, true, 2000).unwrap();
    assert_eq!(
        operation(run(&mut receiver, &mut store, Request::Create(next))).id,
        admitted.id
    );
    assert_eq!(admitted.offset, 0);
}

#[test]
fn oversized_manifest_record_is_rejected_before_any_content_or_directory_read() {
    let (_directory, mut store, mut receiver, peer) = setup();
    let id = receive(
        &mut store,
        &mut receiver,
        upload(1, 3, "v1", "one.txt", b"safe"),
        b"safe",
    );
    let mut items = load(&store).unwrap();
    let item = items.get_mut(&id).unwrap();
    item.entry.operation.size = 65537;
    fs::remove_file(peer.join(format!("{id}.media"))).unwrap();
    assert!(matches!(
        files::content(&store, item),
        Err(Error::InvalidRequest)
    ));
}
