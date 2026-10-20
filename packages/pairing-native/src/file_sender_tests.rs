use super::*;
use crate::file_protocol::OperationState;
use axum::http::Response;

fn upload() -> Upload {
    Upload {
        rebackup_of: None,
        request_id: crate::qr_base64::encode(&[1; 16]),
        source_id: crate::qr_base64::encode(&[2; 16]),
        source_revision: "immutable-1".into(),
        name: "photo.jpg".into(),
        sha256: crate::qr_base64::encode(&[3; 32]),
        size: 10,
    }
}
fn operation() -> Operation {
    let u = upload();
    Operation {
        id: crate::qr_base64::encode(&[4; 16]),
        request_id: u.request_id,
        source_id: u.source_id,
        source_revision: u.source_revision,
        name: u.name,
        sha256: u.sha256,
        size: u.size,
        offset: 0,
        state: OperationState::Receiving,
    }
}
fn ack(op: &Operation) -> Response<Vec<u8>> {
    Response::builder()
        .status(200)
        .header("content-type", "application/json")
        .body(serde_json::to_vec(op).unwrap())
        .unwrap()
}
#[test]
fn transfer_abi_rejects_unknown_fields_unbounded_chunks_and_metadata_fds() {
    for json in [
        r#"{"kind":"status","id":"not-an-id"}"#,
        r#"{"kind":"list","extra":1}"#,
        r#"{"kind":"chunk","id":"BAQEBAQEBAQEBAQEBAQEBA","offset":0,"length":65537}"#,
    ] {
        assert!(Task::parse(json, -1).is_err());
    }
    assert!(Task::parse(r#"{"kind":"list"}"#, 0).is_err());
    assert!(Task::parse(r#"{"kind":"list"}"#, -1).is_ok());
}
#[test]
fn create_ack_binds_exact_hash_size_source_and_request() {
    let task = Task {
        command: Command::Create { upload: upload() },
        file: None,
    };
    let op = operation();
    assert!(crate::file_sender_ack::decode(ack(&op), &task, None).is_ok());
    for mutate in [0, 1, 2, 3, 4] {
        let mut bad = op.clone();
        match mutate {
            0 => bad.sha256 = crate::qr_base64::encode(&[5; 32]),
            1 => bad.size += 1,
            2 => bad.request_id = crate::qr_base64::encode(&[5; 16]),
            3 => bad.offset = bad.size + 1,
            _ => bad.source_revision = "another version".into(),
        }
        assert!(matches!(
            crate::file_sender_ack::decode(ack(&bad), &task, None),
            Err(PairingError::OutcomeUnknown)
        ));
    }
}
#[test]
fn chunk_and_finalize_require_exact_durable_offset_and_completed_state() {
    let old = operation();
    let task = Task {
        command: Command::Chunk {
            id: old.id.clone(),
            offset: 0,
            length: 5,
        },
        file: None,
    };
    let mut op = old.clone();
    op.offset = 5;
    assert!(crate::file_sender_ack::decode(ack(&op), &task, Some(&old)).is_ok());
    op.offset = 6;
    assert!(crate::file_sender_ack::decode(ack(&op), &task, Some(&old)).is_err());
    let finalize = Task {
        command: Command::Finalize { id: old.id.clone() },
        file: None,
    };
    op.offset = op.size;
    assert!(crate::file_sender_ack::decode(ack(&op), &finalize, Some(&op)).is_err());
    op.state = OperationState::Completed;
    assert!(crate::file_sender_ack::decode(ack(&op), &finalize, Some(&op)).is_ok());
    assert!(crate::file_sender_ack::decode(ack(&op), &finalize, None).is_err());
}
#[test]
fn malformed_or_unknown_http_ack_never_becomes_success() {
    let task = Task {
        command: Command::Create { upload: upload() },
        file: None,
    };
    for (status, text) in [
        (200, "{}"),
        (200, r#"{"state":"completed"}"#),
        (403, r#"{"code":"new_error","retryable":false}"#),
        (200, r#"{"code":"denied","retryable":false}"#),
        (503, r#"{"code":"denied","retryable":false}"#),
    ] {
        let response = Response::builder()
            .status(status)
            .header("content-type", "application/json")
            .body(text.as_bytes().to_vec())
            .unwrap();
        assert!(matches!(
            crate::file_sender_ack::decode(response, &task, None),
            Err(PairingError::OutcomeUnknown)
        ));
    }
    let response = Response::builder()
        .status(403)
        .header("content-type", "application/json")
        .body(br#"{"code":"denied","retryable":false}"#.to_vec())
        .unwrap();
    let reply = crate::file_sender_ack::decode(response, &task, None).unwrap();
    assert_eq!(reply.status, 403);
    assert_eq!(reply.error_code.as_deref(), Some("denied"));
}
#[cfg(unix)]
#[test]
fn descriptor_is_duplicated_private_regular_and_never_consumed() {
    use std::os::fd::AsRawFd;
    use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
    let directory = crate::state::test_support::Directory::new();
    let path = directory.path().join("snapshot");
    let file = std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(&path)
        .unwrap();
    file.set_len(10).unwrap();
    let json = format!(
        r#"{{"kind":"chunk","id":"{}","offset":0,"length":10}}"#,
        operation().id
    );
    let task = Task::parse(&json, file.as_raw_fd()).unwrap();
    drop(task);
    assert_eq!(file.metadata().unwrap().len(), 10);
    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o644)).unwrap();
    assert!(matches!(
        Task::parse(&json, file.as_raw_fd()),
        Err(PairingError::BackupPathRejected)
    ));
}

#[test]
fn restore_rejects_wrong_offset_size_or_length_before_writing() {
    let mut op = operation();
    op.offset = op.size;
    op.state = OperationState::Completed;
    let task = Task {
        command: Command::Restore {
            id: op.id.clone(),
            offset: 0,
        },
        file: None,
    };
    for (offset, size, length) in [(1, 10, 9), (0, 11, 11), (0, 10, 9)] {
        let response = Response::builder()
            .status(200)
            .header("content-type", "application/octet-stream")
            .header("x-kloda-offset", offset.to_string())
            .header("x-kloda-size", size.to_string())
            .body(vec![0u8; length])
            .unwrap();
        assert!(matches!(
            crate::file_sender_ack::decode(response, &task, Some(&op)),
            Err(PairingError::OutcomeUnknown)
        ));
    }
}
