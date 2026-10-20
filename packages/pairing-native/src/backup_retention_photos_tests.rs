use super::*;
pub(super) fn manifest(resource: &str, revision: u8) -> Vec<u8> {
    serde_json::to_vec(&serde_json::json!({"version":1,"sourceDeviceId":"source","assetId":"asset","revision":revision.to_string(),
        "resources":[{"operationId":resource,"role":"original","name":"photo.jpg","mimeType":"image/jpeg","sha256":crate::qr_base64::encode(digest(&SHA256,b"image").as_ref()),"size":"5"}],"albums":[],"favorite":null})).unwrap()
}
#[test]
fn photos_selected_version_and_unexpired_trash_preserve_shared_resource_until_last_expiry() {
    let (_directory, mut store, mut receiver, peer) = setup();
    let resource = receive(
        &mut store,
        &mut receiver,
        upload(1, 3, "media1", "photo.jpg", b"image"),
        b"image",
    );
    let bytes = manifest(&resource, 1);
    let first = receive(
        &mut store,
        &mut receiver,
        upload(
            2,
            8,
            "version1",
            "kloda-photo-v1-source-asset-1.json",
            &bytes,
        ),
        &bytes,
    );
    let bytes = manifest(&resource, 2);
    let second = receive(
        &mut store,
        &mut receiver,
        upload(
            3,
            8,
            "version2",
            "kloda-photo-v1-source-asset-2.json",
            &bytes,
        ),
        &bytes,
    );
    assert_eq!(view(&store, false)["items"].as_array().unwrap().len(), 2);
    assert!(matches!(
        actions::change(&mut store, &resource, false, 1000),
        Err(Error::Denied)
    ));
    actions::change(&mut store, &first, false, 1000).unwrap();
    assert_eq!(view(&store, false)["items"].as_array().unwrap().len(), 1);
    assert_eq!(view(&store, true)["items"].as_array().unwrap().len(), 1);
    let first_expiry = deleted(&store, &first).unwrap().unwrap().expires;
    actions::maintain(&mut store, first_expiry).unwrap();
    assert_eq!(
        fs::read(peer.join(format!("{resource}.media"))).unwrap(),
        b"image"
    );
    actions::change(&mut store, &second, false, 2000 + RETENTION_MS).unwrap();
    actions::maintain(&mut store, 2000 + 2 * RETENTION_MS - 1).unwrap();
    assert_eq!(
        fs::read(peer.join(format!("{resource}.media"))).unwrap(),
        b"image"
    );
    actions::change(&mut store, &second, true, 2000 + 2 * RETENTION_MS - 1).unwrap();
    actions::change(&mut store, &second, false, 3000 + 2 * RETENTION_MS).unwrap();
    let final_expiry = deleted(&store, &second).unwrap().unwrap().expires;
    actions::maintain(&mut store, final_expiry).unwrap();
    assert!(!peer.join(format!("{resource}.media")).exists());
    assert!(!peer.join(format!(".kloda-{resource}.part")).exists());
    assert!(!peer.join(format!(".kloda-{resource}.keep")).exists());
    assert!(matches!(
        protocol::disposition(&store, &resource),
        Err(Error::OwnerDeleted)
    ));
}
#[test]
fn invalid_photos_graph_prevents_even_bulk_partial_deletion() {
    let (_directory, mut store, mut receiver, peer) = setup();
    let id = receive(
        &mut store,
        &mut receiver,
        upload(1, 3, "v1", "one.txt", b"safe"),
        b"safe",
    );
    let bytes = b"{\"version\":1}";
    let malformed = receive(
        &mut store,
        &mut receiver,
        upload(2, 8, "bad", "legacy.bin", bytes),
        bytes,
    );
    // Simulate a malformed sidecar accepted by the prior opaque-file receiver.
    let trigger: String = store
        .conn
        .query_row(
            "SELECT sql FROM sqlite_schema WHERE name='immutable_file'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    store
        .conn
        .execute_batch("DROP TRIGGER immutable_file")
        .unwrap();
    store
        .conn
        .execute(
            "UPDATE file_operations SET name='kloda-photo-v1-source-asset-1.json' WHERE id=?1",
            [&malformed],
        )
        .unwrap();
    store.conn.execute_batch(&trigger).unwrap();
    assert!(actions::change(&mut store, &id, false, 1000).is_err());
    assert_eq!(fs::read(peer.join(format!("{id}.media"))).unwrap(), b"safe");
    assert!(deleted(&store, &id).unwrap().is_none());
}
