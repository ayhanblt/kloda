use super::*;
use crate::file_protocol::{Operation, Request, Response};
use crate::file_receiver::Receiver;
use crate::state::test_support::{key, Directory};
use ring::digest::{digest, SHA256};
use std::fs;
use std::path::PathBuf;

fn setup() -> (Directory, Store, Receiver, PathBuf) {
    let directory = Directory::new();
    let mut store = directory.store(key("pc"));
    store.pc_consume(&[1; 16], &key("phone"), None).unwrap();
    store.pc_complete(&[1; 16], &key("phone")).unwrap();
    let folder = directory.path().join("media");
    fs::create_dir(&folder).unwrap();
    store
        .approve_backup(&[1; 16], folder.to_str().unwrap(), None)
        .unwrap();
    let peer = folder.join(crate::qr_base64::encode(&key("phone").fingerprint()));
    (directory, store, Receiver::new(), peer)
}
fn upload(request: u8, source: u8, revision: &str, name: &str, bytes: &[u8]) -> Upload {
    Upload {
        request_id: crate::qr_base64::encode(&[request; 16]),
        source_id: crate::qr_base64::encode(&[source; 16]),
        source_revision: revision.into(),
        name: name.into(),
        sha256: crate::qr_base64::encode(digest(&SHA256, bytes).as_ref()),
        size: bytes.len() as u64,
        rebackup_of: None,
    }
}
fn run(receiver: &mut Receiver, store: &mut Store, request: Request) -> Result<Response> {
    receiver.execute(store, &[1; 16], &key("phone"), request)
}
fn operation(result: Result<Response>) -> Operation {
    match result.unwrap() {
        Response::Operation(value) => value,
        _ => panic!("expected operation"),
    }
}
fn receive(store: &mut Store, receiver: &mut Receiver, request: Upload, bytes: &[u8]) -> String {
    let id = operation(run(receiver, store, Request::Create(request))).id;
    for (i, chunk) in bytes.chunks(65536).enumerate() {
        run(
            receiver,
            store,
            Request::Chunk {
                id: id.clone(),
                offset: (i * 65536) as u64,
                bytes: chunk.to_vec(),
            },
        )
        .unwrap();
    }
    loop {
        match run(receiver, store, Request::Finalize { id: id.clone() }).unwrap() {
            Response::Pending => (),
            Response::Operation(value) => {
                assert!(value.state == OperationState::Completed);
                break;
            }
            _ => panic!("unexpected finalize"),
        }
    }
    id
}
fn view(store: &Store, trash: bool) -> serde_json::Value {
    serde_json::from_str(&list(store, None, trash).unwrap()).unwrap()
}

#[test]
fn trash_restore_conflict_expiry_and_source_tombstone_are_exact_and_idempotent() {
    let (_directory, mut store, mut receiver, peer) = setup();
    let original = upload(1, 3, "v1", "one.txt", b"safe");
    let id = receive(&mut store, &mut receiver, original.clone(), b"safe");
    let unrelated = peer.join("manual.txt");
    fs::write(&unrelated, b"do not touch").unwrap();
    actions::change(&mut store, &id, false, 1000).unwrap();
    let deadline = deleted(&store, &id).unwrap().unwrap().expires;
    assert!(deadline >= 1000 + RETENTION_MS);
    actions::change(&mut store, &id, false, 2000).unwrap();
    assert_eq!(deleted(&store, &id).unwrap().unwrap().expires, deadline);
    assert!(!peer.join(format!("{id}.media")).exists());
    assert!(!peer.join(format!(".kloda-{id}.part")).exists());
    assert_eq!(view(&store, true)["items"][0]["state"], "trash");
    assert!(matches!(
        run(
            &mut receiver,
            &mut store,
            Request::Status { id: id.clone() }
        ),
        Err(Error::OwnerDeleted)
    ));
    assert!(matches!(
        run(
            &mut receiver,
            &mut store,
            Request::Restore {
                id: id.clone(),
                offset: 0
            }
        ),
        Err(Error::OwnerDeleted)
    ));
    let target = peer.join(format!("{id}.media"));
    fs::write(&target, b"user file").unwrap();
    assert!(actions::change(&mut store, &id, true, 2000).is_err());
    assert_eq!(fs::read(&target).unwrap(), b"user file");
    fs::remove_file(&target).unwrap();
    actions::change(&mut store, &id, true, 2000).unwrap();
    actions::change(&mut store, &id, true, 2000).unwrap();
    assert_eq!(fs::read(&target).unwrap(), b"safe");
    assert!(run(
        &mut receiver,
        &mut store,
        Request::Status { id: id.clone() }
    )
    .is_ok());
    actions::change(&mut store, &id, false, 3000).unwrap();
    let expires = deleted(&store, &id).unwrap().unwrap().expires;
    actions::maintain(&mut store, expires - 1).unwrap();
    assert!(peer.join(format!(".kloda-{id}.keep")).exists());
    actions::maintain(&mut store, expires).unwrap();
    actions::maintain(&mut store, expires + 1).unwrap();
    assert_eq!(deleted(&store, &id).unwrap().unwrap().phase, 6);
    assert!(!peer.join(format!(".kloda-{id}.keep")).exists());
    assert_eq!(fs::read(&unrelated).unwrap(), b"do not touch");
    let mut unchanged = original.clone();
    unchanged.request_id = crate::qr_base64::encode(&[2; 16]);
    assert!(matches!(
        run(
            &mut receiver,
            &mut store,
            Request::Create(unchanged.clone())
        ),
        Err(Error::OwnerDeleted)
    ));
    let mut other = unchanged.clone();
    other.source_id = crate::qr_base64::encode(&[9; 16]);
    assert!(run(&mut receiver, &mut store, Request::Create(other)).is_ok());
    let mut changed = unchanged.clone();
    changed.request_id = crate::qr_base64::encode(&[4; 16]);
    changed.source_revision = "v2".into();
    assert!(run(&mut receiver, &mut store, Request::Create(changed)).is_ok());
    unchanged.request_id = crate::qr_base64::encode(&[5; 16]);
    unchanged.rebackup_of = Some(id.clone());
    assert!(run(&mut receiver, &mut store, Request::Create(unchanged)).is_ok());
}

#[test]
fn bulk_removed_device_and_active_finalize_do_not_grant_authority_or_touch_unrelated_files() {
    let (_directory, mut store, mut receiver, peer) = setup();
    let first = receive(
        &mut store,
        &mut receiver,
        upload(1, 3, "v1", "one.txt", b"one"),
        b"one",
    );
    let second = receive(
        &mut store,
        &mut receiver,
        upload(2, 4, "v1", "two.txt", b"two"),
        b"two",
    );
    let pending = operation(run(
        &mut receiver,
        &mut store,
        Request::Create(upload(3, 5, "v1", "pending.txt", b"pending")),
    ))
    .id;
    let ids = serde_json::to_string(&vec![first.clone(), second.clone()]).unwrap();
    store.remove_device_guarded(&[1; 16], || Ok(())).unwrap();
    let result: serde_json::Value =
        serde_json::from_str(&mutate(&mut store, &ids, false, || Ok(())).unwrap()).unwrap();
    assert!(result["items"]
        .as_array()
        .unwrap()
        .iter()
        .all(|v| v["success"] == true));
    assert!(matches!(
        run(&mut receiver, &mut store, Request::Finalize { id: pending }),
        Err(Error::Denied)
    ));
    let result: serde_json::Value =
        serde_json::from_str(&mutate(&mut store, &ids, true, || Ok(())).unwrap()).unwrap();
    assert!(result["items"]
        .as_array()
        .unwrap()
        .iter()
        .all(|v| v["success"] == true));
    assert_eq!(
        fs::read(peer.join(format!("{first}.media"))).unwrap(),
        b"one"
    );
    assert!(matches!(
        run(&mut receiver, &mut store, Request::Status { id: first }),
        Err(Error::Denied)
    ));
}

#[test]
fn intent_and_restore_resume_in_real_child_process_without_overwrite_or_reset() {
    let (directory, mut store, mut receiver, _peer) = setup();
    let id = receive(
        &mut store,
        &mut receiver,
        upload(1, 3, "v1", "one.txt", b"safe"),
        b"safe",
    );
    actions::change(&mut store, &id, false, 1000).unwrap();
    store
        .conn
        .execute("UPDATE backup_deletions SET phase=1 WHERE id=?1", [&id])
        .unwrap();
    drop(receiver);
    drop(store);
    let output = std::process::Command::new(std::env::current_exe().unwrap())
        .args([
            "--exact",
            "backup_retention::tests::retention_restart_child",
            "--nocapture",
        ])
        .env("KLODA_RETENTION_FIXTURE", directory.path())
        .env("KLODA_RETENTION_ID", &id)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(String::from_utf8_lossy(&output.stdout).contains("retention child recovered"));
    let store = directory.store(key("pc"));
    assert!(protocol::disposition(&store, &id).is_ok());
    assert_eq!(deleted(&store, &id).unwrap().unwrap().phase, 4);
}
#[test]
fn retention_restart_child() {
    let Some(path) = std::env::var_os("KLODA_RETENTION_FIXTURE") else {
        return;
    };
    let id = std::env::var("KLODA_RETENTION_ID").unwrap();
    let mut store = Store::open(std::path::Path::new(&path), key("pc"), [7; 16]).unwrap();
    actions::maintain(&mut store, 2000).unwrap();
    assert_eq!(deleted(&store, &id).unwrap().unwrap().phase, 2);
    store
        .conn
        .execute("UPDATE backup_deletions SET phase=3 WHERE id=?1", [&id])
        .unwrap();
    drop(store);
    let mut store = Store::open(std::path::Path::new(&path), key("pc"), [7; 16]).unwrap();
    actions::maintain(&mut store, 2000).unwrap();
    assert_eq!(deleted(&store, &id).unwrap().unwrap().phase, 4);
    assert_eq!(view(&store, false)["items"][0]["state"], "active");
    println!("retention child recovered");
}

#[test]
fn unknown_identity_and_damaged_metadata_never_delete_or_claim_success() {
    let (_directory, mut store, mut receiver, peer) = setup();
    let id = receive(
        &mut store,
        &mut receiver,
        upload(1, 3, "v1", "one.txt", b"safe"),
        b"safe",
    );
    fs::write(peer.join(format!("{id}.media")), b"edit").unwrap();
    assert!(actions::change(&mut store, &id, false, 1000).is_err());
    assert_eq!(fs::read(peer.join(format!("{id}.media"))).unwrap(), b"edit");
    assert!(deleted(&store, &id).unwrap().is_none());
    let ids = serde_json::to_string(&vec![id]).unwrap();
    let result: serde_json::Value = serde_json::from_str(
        &mutate(&mut store, &ids, false, || {
            Err::<(), _>(crate::PairingError::CandidateStale)
        })
        .unwrap(),
    )
    .unwrap();
    assert_eq!(result["items"][0]["success"], false);
}

#[path = "backup_retention_photos_tests.rs"]
mod photo_tests;

#[path = "backup_retention_recovery_tests.rs"]
mod recovery_tests;

#[path = "backup_retention_pagination_tests.rs"]
mod pagination_tests;

#[path = "backup_retention_rebackup_tests.rs"]
mod rebackup_tests;

#[path = "backup_retention_latency_tests.rs"]
mod latency_tests;
