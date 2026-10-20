use super::*;
use crate::receiver_activity::read;

#[test]
fn paging_is_bounded_stable_and_keeps_exact_large_byte_counts() {
    let (_directory, mut store, mut receiver, _) = setup();
    for request in 1..=35 {
        let mut upload = upload(request, b"");
        upload.size = 9_007_199_254_740_993;
        let id = operation(run(&mut receiver, &mut store, Request::Create(upload))).id;
        let mut entry = rows::get(&store.conn, &[1; 16], &id).unwrap();
        rows::advance(
            &mut store,
            &[1; 16],
            &mut entry,
            9_007_199_254_740_992,
            OperationState::Receiving,
        )
        .unwrap();
    }
    let first = read(&store, None).unwrap();
    assert_eq!(first.items.len(), 32);
    assert!(first.items.windows(2).all(|pair| pair[0].id < pair[1].id));
    assert_eq!(first.items[0].received_bytes, "9007199254740992");
    assert_eq!(first.items[0].total_bytes, "9007199254740993");
    let second = read(&store, first.next_cursor.as_deref()).unwrap();
    assert_eq!(second.items.len(), 3);
    assert!(second.next_cursor.is_none());
    assert!(first.items.last().unwrap().id < second.items[0].id);
    let json = serde_json::to_string(&first).unwrap();
    for forbidden in [
        "sourceId",
        "sourceRevision",
        "sha256",
        "root",
        "epoch",
        "timestamp",
    ] {
        assert!(!json.contains(forbidden));
    }
    for cursor in [
        "",
        "../secret",
        "' OR 1=1",
        "AAAAAAAAAAAAAAAAAAAAA=",
        "AAAAAAAAAAAAAAAAAAAAAB",
    ] {
        assert!(matches!(
            read(&store, Some(cursor)),
            Err(crate::PairingError::InvalidRequest)
        ));
    }
}

#[test]
fn revoked_history_is_read_only_and_never_new_authority() {
    let (_directory, mut store, mut receiver, _) = setup();
    let id = receive(&mut receiver, &mut store, 3, b"done");
    run(
        &mut receiver,
        &mut store,
        Request::Finalize { id: id.clone() },
    )
    .unwrap();
    store
        .revoke(&[1; 16], crate::store_rows::RecordRole::Pc)
        .unwrap();
    let before = store.conn.total_changes();
    let activity = read(&store, None).unwrap();
    assert_eq!(activity.items[0].state, "completed");
    assert_eq!(
        activity.items[0].device_fingerprint,
        crate::qr_base64::encode(&key("phone").fingerprint())
    );
    assert_eq!(store.conn.total_changes(), before);
    assert!(run(&mut receiver, &mut store, Request::Status { id }).is_err());
    store.poisoned = true;
    assert!(matches!(
        read(&store, None),
        Err(crate::PairingError::OutcomeUnknown)
    ));
}

#[test]
fn durable_activity_survives_true_process_restart_without_adopting_pending() {
    let (directory, mut store, mut receiver, _) = setup();
    let partial = operation(run(
        &mut receiver,
        &mut store,
        Request::Create(upload(1, b"abcdef")),
    ))
    .id;
    run(
        &mut receiver,
        &mut store,
        Request::Chunk {
            id: partial.clone(),
            offset: 0,
            bytes: b"abc".to_vec(),
        },
    )
    .unwrap();
    let done = receive(&mut receiver, &mut store, 2, b"done");
    run(&mut receiver, &mut store, Request::Finalize { id: done }).unwrap();
    let publishing = receive(&mut receiver, &mut store, 3, b"uncertain");
    let mut entry = rows::get(&store.conn, &[1; 16], &publishing).unwrap();
    rows::advance(
        &mut store,
        &[1; 16],
        &mut entry,
        9,
        OperationState::Validating,
    )
    .unwrap();
    rows::advance(
        &mut store,
        &[1; 16],
        &mut entry,
        9,
        OperationState::Publishing,
    )
    .unwrap();
    let before = serde_json::to_string(&read(&store, None).unwrap()).unwrap();
    drop(receiver);
    drop(store);
    let output = std::process::Command::new(std::env::current_exe().unwrap())
        .args([
            "--exact",
            "file_receiver::tests::activity::restart_child",
            "--nocapture",
        ])
        .env("KLODA_ACTIVITY_RESTART_FIXTURE", directory.path())
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stdout)
    );
    assert!(String::from_utf8_lossy(&output.stdout).contains("activity restart fixture read"));
    let mut store = directory.store(key("pc"));
    let after = serde_json::to_string(&read(&store, None).unwrap()).unwrap();
    assert_eq!(before, after);
    let mut receiver = Receiver::new();
    run(
        &mut receiver,
        &mut store,
        Request::Chunk {
            id: partial.clone(),
            offset: 3,
            bytes: b"def".to_vec(),
        },
    )
    .unwrap();
    let after_resume = read(&store, None).unwrap();
    let resumed = after_resume
        .items
        .iter()
        .find(|item| item.id == partial)
        .unwrap();
    assert_eq!(resumed.received_bytes, "6");
    assert_eq!(resumed.state, "receiving");
    run(
        &mut receiver,
        &mut store,
        Request::Finalize {
            id: partial.clone(),
        },
    )
    .unwrap();
    let after_finalize = read(&store, None).unwrap();
    assert_eq!(
        after_finalize
            .items
            .iter()
            .find(|item| item.id == partial)
            .unwrap()
            .state,
        "completed"
    );
    assert_eq!(
        after_finalize
            .items
            .iter()
            .filter(|item| item.state == "publishing")
            .count(),
        1
    );
    assert_eq!(
        after_finalize
            .items
            .iter()
            .filter(|item| item.state == "completed")
            .count(),
        2
    );
    println!(
        "KLODA_ACTIVITY_SNAPSHOTS:{}",
        serde_json::json!({
            "beforeRestart": serde_json::from_str::<serde_json::Value>(&before).unwrap(),
            "afterRestart": serde_json::from_str::<serde_json::Value>(&after).unwrap(),
            "childProcessReadOnly": true,
            "afterResume": after_resume,
            "afterFinalize": after_finalize
        })
    );
}

#[test]
fn restart_child() {
    let Some(directory) = std::env::var_os("KLODA_ACTIVITY_RESTART_FIXTURE") else {
        return;
    };
    let store = Store::open(std::path::Path::new(&directory), key("pc"), [7; 16]).unwrap();
    let changes = store.conn.total_changes();
    let activity = read(&store, None).unwrap();
    assert_eq!(activity.items.len(), 3);
    assert!(!activity.receiver_available);
    for state in ["receiving", "publishing", "completed"] {
        assert_eq!(
            activity
                .items
                .iter()
                .filter(|item| item.state == state)
                .count(),
            1
        );
    }
    let partial = activity
        .items
        .iter()
        .find(|item| item.state == "receiving")
        .unwrap();
    assert_eq!(partial.received_bytes, "3");
    assert_eq!(partial.total_bytes, "6");
    assert_eq!(store.conn.total_changes(), changes);
    println!("activity restart fixture read");
}
