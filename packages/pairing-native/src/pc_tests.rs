use super::*;
use crate::state::test_support::{hint, key, Directory};
use crate::store_rows::RecordState;

// These channels are abstract state-machine inputs, not evidence of a real TLS handshake.
fn channel(generation: u64, binding: u8) -> Channel {
    Channel::for_state_test(generation, key("phone"), [binding; 32])
}
fn invitation(store: &Store, channel: &Channel) -> (Pc, Frame) {
    let pc = Pc::create(store, hint(), 0).unwrap();
    let qr = qr::parse(pc.qr().unwrap()).unwrap();
    let tag = proof::tag(
        &qr.secret,
        &qr.sid,
        &qr.pc_fingerprint,
        &channel.peer().fingerprint(),
        channel.binding(),
    );
    (pc, Frame::Proof { sid: qr.sid, tag })
}

#[test]
fn invalid_contender_does_not_reserve_and_winner_is_immutable() {
    let directory = Directory::new();
    let store = directory.store(key("pc"));
    let winner = channel(1, 1);
    let (mut pc, valid) = invitation(&store, &winner);
    let invalid = Frame::Proof {
        sid: *pc.sid(),
        tag: [0; 32],
    };
    assert!(matches!(
        pc.reserve(&store, &winner, &invalid, 1),
        Err(PairingError::ProofRejected)
    ));
    assert_eq!(pc.phase(), Phase::Open);
    assert!(pc.qr().is_some());
    assert_eq!(
        pc.reserve(&store, &winner, &valid, 2).unwrap(),
        ReserveOutcome::Reserved
    );
    assert!(pc.qr().is_none());
    assert_eq!(
        pc.reserve(&store, &winner, &valid, 3).unwrap(),
        ReserveOutcome::Duplicate
    );
    assert!(matches!(
        pc.reserve(&store, &channel(2, 2), &valid, 4),
        Err(PairingError::CandidateStale)
    ));
    assert_eq!(pc.generation(), Some(1));
    assert!(store.record(pc.sid()).unwrap().is_none());
}

#[test]
fn stale_approval_is_noop_and_deadline_boundary_invalidates() {
    let directory = Directory::new();
    let mut store = directory.store(key("pc"));
    let winner = channel(1, 1);
    let (mut pc, proof) = invitation(&store, &winner);
    pc.reserve(&store, &winner, &proof, 1).unwrap();
    let sid = *pc.sid();
    assert!(matches!(
        pc.approve(&mut store, &sid, 2, &winner, 2),
        Err(PairingError::CandidateStale)
    ));
    assert_eq!(pc.phase(), Phase::Reserved);
    assert!(matches!(
        pc.approve(&mut store, &sid, 1, &winner, 120_000),
        Err(PairingError::InvitationExpired)
    ));
    assert_eq!(pc.phase(), Phase::Invalid);
    assert!(store.record(&sid).unwrap().is_none());
    assert!(matches!(
        pc.reserve(&store, &winner, &proof, 120_001),
        Err(PairingError::CandidateStale)
    ));
}

#[test]
fn authorized_before_deadline_is_not_undone_and_cancel_is_revoke() {
    let directory = Directory::new();
    let mut store = directory.store(key("pc"));
    let winner = channel(1, 1);
    let (mut pc, proof) = invitation(&store, &winner);
    pc.reserve(&store, &winner, &proof, 119_998).unwrap();
    let sid = *pc.sid();
    assert!(matches!(
        pc.approve(&mut store, &sid, 1, &winner, 119_999).unwrap(),
        Frame::Commit { .. }
    ));
    pc.expire(130_000).unwrap();
    assert_eq!(pc.phase(), Phase::ConsumedPendingAck);
    assert_eq!(
        store.record(&sid).unwrap().unwrap().state,
        RecordState::Consumed
    );
    pc.cancel(&mut store).unwrap();
    assert_eq!(
        store.record(&sid).unwrap().unwrap().state,
        RecordState::Revoked
    );
    assert!(matches!(
        pc.ack(&mut store, &winner, &Frame::Ack { sid }),
        Err(PairingError::Revoked)
    ));
    assert!(matches!(
        Pc::resume(&store, sid, &winner),
        Err(PairingError::Revoked)
    ));
}

#[test]
fn cancel_ordered_before_authorization_never_creates_trust() {
    let directory = Directory::new();
    let mut store = directory.store(key("pc"));
    let winner = channel(1, 1);
    let (mut pc, proof) = invitation(&store, &winner);
    pc.reserve(&store, &winner, &proof, 1).unwrap();
    let sid = *pc.sid();
    pc.cancel(&mut store).unwrap();
    assert!(matches!(
        pc.approve(&mut store, &sid, 1, &winner, 2),
        Err(PairingError::CandidateStale)
    ));
    assert!(store.record(&sid).unwrap().is_none());
}

#[test]
fn winner_disconnect_and_backward_elapsed_reading_fail_closed() {
    let directory = Directory::new();
    let store = directory.store(key("pc"));
    let winner = channel(1, 1);
    let (mut pc, proof) = invitation(&store, &winner);
    pc.reserve(&store, &winner, &proof, 20).unwrap();
    pc.disconnect(2);
    assert_eq!(pc.phase(), Phase::Reserved);
    assert!(matches!(
        pc.expire(19),
        Err(PairingError::InvitationExpired)
    ));
    assert_eq!(pc.phase(), Phase::Invalid);
    let (mut other, proof) = invitation(&store, &winner);
    other.reserve(&store, &winner, &proof, 1).unwrap();
    other.disconnect(1);
    assert_eq!(other.phase(), Phase::Invalid);
}

#[test]
fn consume_failure_yields_no_commit_and_restart_has_no_partial_tuple() {
    let directory = Directory::new();
    let mut store = directory.store(key("pc"));
    let winner = channel(1, 1);
    let (mut pc, proof) = invitation(&store, &winner);
    pc.reserve(&store, &winner, &proof, 1).unwrap();
    let sid = *pc.sid();
    store
        .conn
        .execute_batch(
            "CREATE TRIGGER fault BEFORE INSERT ON records
        BEGIN SELECT RAISE(ABORT,'injected storage failure'); END;",
        )
        .unwrap();
    assert!(matches!(
        pc.approve(&mut store, &sid, 1, &winner, 2),
        Err(PairingError::StorageFailure)
    ));
    assert_eq!(pc.phase(), Phase::Invalid);
    drop(store);
    let store = directory.store(key("pc"));
    assert!(matches!(
        Pc::resume(&store, sid, &winner),
        Err(PairingError::TlsRejected)
    ));
}

#[test]
fn ack_requires_sent_commit_and_fresh_recovery_is_idempotent() {
    let directory = Directory::new();
    let mut store = directory.store(key("pc"));
    let winner = channel(1, 1);
    let (mut pc, proof) = invitation(&store, &winner);
    pc.reserve(&store, &winner, &proof, 1).unwrap();
    let sid = *pc.sid();
    pc.approve(&mut store, &sid, 1, &winner, 2).unwrap();
    assert!(matches!(
        pc.ack(&mut store, &winner, &Frame::Ack { sid }),
        Err(PairingError::TlsRejected)
    ));
    assert!(matches!(
        pc.recover(&store, &winner, &Frame::Recover { sid }),
        Err(PairingError::TlsRejected)
    ));
    drop(pc);
    drop(store);
    let mut store = directory.store(key("pc"));
    let recovery = channel(3, 3);
    let (mut pc, commit) = Pc::resume(&store, sid, &recovery).unwrap();
    assert!(matches!(commit, Frame::Commit { .. }));
    assert!(matches!(
        pc.recover(&store, &recovery, &Frame::Recover { sid })
            .unwrap(),
        Frame::Commit { .. }
    ));
    pc.commit_sent(&recovery).unwrap();
    assert!(matches!(
        pc.ack(&mut store, &recovery, &Frame::Ack { sid }).unwrap(),
        Frame::Complete { .. }
    ));
    assert!(matches!(
        pc.ack(&mut store, &recovery, &Frame::Ack { sid }).unwrap(),
        Frame::Complete { .. }
    ));
    assert!(matches!(
        pc.ack(&mut store, &winner, &Frame::Ack { sid }),
        Err(PairingError::CandidateStale)
    ));
    assert_eq!(store.records().unwrap().len(), 1);
}

#[test]
fn reserved_repair_metadata_and_approval_preserve_tombstone() {
    let directory = Directory::new();
    let mut store = directory.store(key("pc"));
    store.pc_consume(&[8; 16], &key("phone"), None).unwrap();
    store.pc_revoke(&[8; 16]).unwrap();
    let winner = channel(1, 1);
    let (mut pc, proof) = invitation(&store, &winner);
    pc.reserve(&store, &winner, &proof, 1).unwrap();
    assert!(pc.repair_required());
    let sid = *pc.sid();
    pc.approve(&mut store, &sid, 1, &winner, 2).unwrap();
    assert_eq!(
        store.record(&[8; 16]).unwrap().unwrap().state,
        RecordState::Revoked
    );
    assert_eq!(
        store.record(&sid).unwrap().unwrap().state,
        RecordState::Consumed
    );
}
