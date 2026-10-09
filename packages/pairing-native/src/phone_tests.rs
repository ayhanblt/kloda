use super::*;
use crate::pc::Pc;
use crate::qr::{self, QrPayload};
use crate::state::test_support::{hint, key, Directory};

// Abstract native channel fixtures test state boundaries only, never real TLS/profile claims.
fn channel(generation: u64) -> Channel {
    Channel::for_state_test(generation, key("pc"), [generation as u8; 32])
}
fn payload(sid: u8) -> QrPayload {
    QrPayload {
        sid: [sid; 16],
        pc_fingerprint: key("pc").fingerprint(),
        secret: zeroize::Zeroizing::new([3; 32]),
        hint: hint(),
    }
}

#[test]
fn pending_failure_returns_no_proof_and_reopen_has_no_binding() {
    let directory = Directory::new();
    let mut store = directory.store(key("phone"));
    store
        .conn
        .execute_batch(
            "CREATE TRIGGER fault BEFORE INSERT ON hints
        BEGIN SELECT RAISE(ABORT,'injected storage failure'); END;",
        )
        .unwrap();
    assert!(matches!(
        Phone::start(&mut store, payload(1), &channel(1)),
        Err(PairingError::StorageFailure)
    ));
    drop(store);
    let store = directory.store(key("phone"));
    assert!(store.record(&[1; 16]).unwrap().is_none());
}

#[test]
fn pin_failure_returns_no_ack_and_restart_is_pending_with_hint() {
    let directory = Directory::new();
    let mut store = directory.store(key("phone"));
    let live = channel(1);
    let (mut phone, _) = Phone::start(&mut store, payload(1), &live).unwrap();
    phone.request_sent(&live).unwrap();
    store
        .conn
        .execute_batch(
            "CREATE TRIGGER fault BEFORE UPDATE OF peer ON records
        BEGIN SELECT RAISE(ABORT,'injected storage failure'); END;",
        )
        .unwrap();
    assert!(matches!(
        phone.commit(&mut store, &live, &Frame::Commit { sid: [1; 16] }),
        Err(PairingError::StorageFailure)
    ));
    drop(store);
    let store = directory.store(key("phone"));
    let pending = store.phone_recover(&[1; 16], live.peer()).unwrap();
    assert_eq!(pending.state, RecordState::Pending);
    assert!(pending.peer.is_none());
    assert!(pending.hint.as_ref() == Some(&hint()));
}

#[test]
fn complete_requires_actual_ack_write_and_stale_callback_cannot_pin() {
    let directory = Directory::new();
    let mut store = directory.store(key("phone"));
    let live = channel(1);
    let (mut phone, _) = Phone::start(&mut store, payload(1), &live).unwrap();
    assert!(matches!(
        phone.commit(&mut store, &channel(2), &Frame::Commit { sid: [1; 16] }),
        Err(PairingError::CandidateStale)
    ));
    assert!(matches!(
        phone.commit(&mut store, &live, &Frame::Commit { sid: [1; 16] }),
        Err(PairingError::TlsRejected)
    ));
    phone.request_sent(&live).unwrap();
    phone
        .commit(&mut store, &live, &Frame::Commit { sid: [1; 16] })
        .unwrap();
    assert!(matches!(
        phone.complete(&mut store, &live, &Frame::Complete { sid: [1; 16] }),
        Err(PairingError::TlsRejected)
    ));
    phone.ack_sent(&live).unwrap();
    phone
        .complete(&mut store, &live, &Frame::Complete { sid: [1; 16] })
        .unwrap();
    phone
        .complete(&mut store, &live, &Frame::Complete { sid: [1; 16] })
        .unwrap();
    phone
        .commit(&mut store, &live, &Frame::Commit { sid: [1; 16] })
        .unwrap();
    assert_eq!(phone.phase(), Phase::Complete);
    assert_eq!(store.records().unwrap().len(), 1);
}

#[test]
fn durable_abandon_blocks_late_commit_and_wrong_key_resume() {
    let directory = Directory::new();
    let mut store = directory.store(key("phone"));
    let live = channel(1);
    let (mut phone, _) = Phone::start(&mut store, payload(1), &live).unwrap();
    let wrong = Channel::for_state_test(2, key("phone"), [2; 32]);
    assert!(matches!(
        Phone::resume(&store, [1; 16], &wrong),
        Err(PairingError::TlsRejected)
    ));
    phone.cancel(&mut store).unwrap();
    assert!(matches!(
        phone.commit(&mut store, &live, &Frame::Commit { sid: [1; 16] }),
        Err(PairingError::Revoked)
    ));
    drop(store);
    let store = directory.store(key("phone"));
    assert!(matches!(
        Phone::resume(&store, [1; 16], &live),
        Err(PairingError::Revoked)
    ));
}

#[test]
fn duplicate_scan_never_opens_a_second_pending_session() {
    let directory = Directory::new();
    let mut store = directory.store(key("phone"));
    let (phone, _) = Phone::start(&mut store, payload(1), &channel(1)).unwrap();
    assert!(matches!(
        Phone::start(&mut store, payload(1), &channel(2)),
        Err(PairingError::AlreadyPaired)
    ));
    assert_eq!(phone.generation(), Some(1));
    assert_eq!(store.records().unwrap().len(), 1);
}

#[test]
fn explicit_phone_repair_has_new_sid_and_keeps_old_deny() {
    let directory = Directory::new();
    let mut store = directory.store(key("phone"));
    let live = channel(1);
    let (mut old, _) = Phone::start(&mut store, payload(1), &live).unwrap();
    old.cancel(&mut store).unwrap();
    assert!(matches!(
        Phone::start(&mut store, payload(2), &live),
        Err(PairingError::Revoked)
    ));
    let required = Phone::repair_required(&store, &payload(2), &live)
        .unwrap()
        .unwrap();
    Phone::start_repair(&mut store, payload(2), &live, required).unwrap();
    assert_eq!(
        store.record(&[1; 16]).unwrap().unwrap().state,
        RecordState::Revoked
    );
    assert_eq!(
        store.record(&[2; 16]).unwrap().unwrap().state,
        RecordState::Pending
    );
}

#[test]
fn lost_commit_and_final_reply_recover_end_to_end_without_qr_secret() {
    let pc_directory = Directory::new();
    let phone_directory = Directory::new();
    let mut pc_store = pc_directory.store(key("pc"));
    let mut phone_store = phone_directory.store(key("phone"));
    let pc_channel = Channel::for_state_test(1, key("phone"), [1; 32]);
    let phone_channel = channel(1);
    let mut pc = Pc::create(&pc_store, hint(), 0).unwrap();
    let scanned = qr::parse(pc.qr().unwrap()).unwrap();
    let sid = scanned.sid;
    let (mut phone, proof) = Phone::start(&mut phone_store, scanned, &phone_channel).unwrap();
    phone.request_sent(&phone_channel).unwrap();
    pc.reserve(&pc_store, &pc_channel, &proof, 1).unwrap();
    pc.approve(&mut pc_store, &sid, 1, &pc_channel, 2).unwrap();
    // Crash before commit arrives: PC consumed, phone PENDING+hint, no restored secret.
    drop(pc);
    drop(phone);
    drop(pc_store);
    drop(phone_store);
    let mut pc_store = pc_directory.store(key("pc"));
    let mut phone_store = phone_directory.store(key("phone"));
    let pc_channel = Channel::for_state_test(2, key("phone"), [2; 32]);
    let phone_channel = channel(2);
    let (mut phone, recover) = Phone::resume(&phone_store, sid, &phone_channel).unwrap();
    assert!(matches!(recover, Frame::Recover { .. }));
    phone.request_sent(&phone_channel).unwrap();
    let (mut pc, commit) = Pc::resume(&pc_store, sid, &pc_channel).unwrap();
    pc.commit_sent(&pc_channel).unwrap();
    let ack = phone
        .commit(&mut phone_store, &phone_channel, &commit)
        .unwrap();
    phone.ack_sent(&phone_channel).unwrap();
    pc.ack(&mut pc_store, &pc_channel, &ack).unwrap();
    // Lose the final reply: durable PC COMPLETE, phone pin still pending ACK.
    drop(pc);
    drop(phone);
    drop(pc_store);
    drop(phone_store);
    let mut pc_store = pc_directory.store(key("pc"));
    let mut phone_store = phone_directory.store(key("phone"));
    let pc_channel = Channel::for_state_test(3, key("phone"), [3; 32]);
    let phone_channel = channel(3);
    let (mut phone, _) = Phone::resume(&phone_store, sid, &phone_channel).unwrap();
    phone.request_sent(&phone_channel).unwrap();
    let (mut pc, commit) = Pc::resume(&pc_store, sid, &pc_channel).unwrap();
    pc.commit_sent(&pc_channel).unwrap();
    let ack = phone
        .commit(&mut phone_store, &phone_channel, &commit)
        .unwrap();
    phone.ack_sent(&phone_channel).unwrap();
    let complete = pc.ack(&mut pc_store, &pc_channel, &ack).unwrap();
    phone
        .complete(&mut phone_store, &phone_channel, &complete)
        .unwrap();
    assert_eq!(phone.phase(), Phase::Complete);
    assert_eq!(pc.phase(), Phase::Complete);
    assert_eq!(pc_store.records().unwrap().len(), 1);
    assert_eq!(phone_store.records().unwrap().len(), 1);
}
