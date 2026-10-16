use super::*;
use crate::file_protocol::{Operation, Upload};
use crate::state::test_support::{key, Directory};
use ring::digest::{digest, SHA256};
use std::fs;
use std::path::PathBuf;

fn setup() -> (Directory, Store, Receiver, String) {
    let directory = Directory::new();
    let mut store = directory.store(key("pc"));
    store.pc_consume(&[1; 16], &key("phone"), None).unwrap();
    store.pc_complete(&[1; 16], &key("phone")).unwrap();
    let folder = directory.path().join("media");
    fs::create_dir(&folder).unwrap();
    let folder = folder.to_str().unwrap().to_owned();
    store.approve_backup(&[1; 16], &folder, None).unwrap();
    (directory, store, Receiver::new(), folder)
}
fn run(receiver: &mut Receiver, store: &mut Store, request: Request) -> Result<Response> {
    receiver.execute(store, &[1; 16], &key("phone"), request)
}
fn operation(result: Result<Response>) -> Operation {
    match result.unwrap() {
        Response::Operation(operation) => operation,
        _ => panic!("expected operation"),
    }
}
fn upload(request: u8, bytes: &[u8]) -> Upload {
    Upload {
        request_id: crate::qr_base64::encode(&[request; 16]),
        source_id: crate::qr_base64::encode(&[3; 16]),
        source_revision: "revision-1".into(),
        name: "photo.jpg".into(),
        sha256: crate::qr_base64::encode(digest(&SHA256, bytes).as_ref()),
        size: bytes.len() as u64,
    }
}
fn peer_folder(folder: &str) -> PathBuf {
    PathBuf::from(folder).join(crate::qr_base64::encode(&key("phone").fingerprint()))
}
fn receive(receiver: &mut Receiver, store: &mut Store, request: u8, bytes: &[u8]) -> String {
    let created = operation(run(
        receiver,
        store,
        Request::Create(upload(request, bytes)),
    ));
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
    created.id
}

#[path = "file_receiver_listing_tests.rs"]
mod listing;
#[path = "file_receiver_publication_tests.rs"]
mod publication;
#[path = "file_receiver_regrant_tests.rs"]
mod regrant;
#[path = "file_receiver_repair_tests.rs"]
mod repair;
#[path = "file_receiver_resume_tests.rs"]
mod resume;
#[path = "file_receiver_revoke_tests.rs"]
mod revoke;
#[path = "file_receiver_safety_tests.rs"]
mod safety;
#[path = "file_receiver_scope_tests.rs"]
mod scope;
#[path = "file_receiver_storage_tests.rs"]
mod storage;
