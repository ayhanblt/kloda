use super::*;
use crate::state::test_support::{hint, key, Directory};
use crate::store_rows::{RecordRole, RecordState};

#[test]
fn durable_pc_tuple_reopens_and_sid_cannot_change_peer() {
    let directory = Directory::new();
    let local = key("pc");
    let peer = key("phone");
    let mut store = directory.store(local.clone());
    store.pc_consume(&[1; 16], &peer, None).unwrap();
    assert!(matches!(
        store.pc_consume(&[1; 16], &local, None),
        Err(PairingError::TlsRejected)
    ));
    drop(store);
    let store = directory.store(local);
    let record = store.pc_recover(&[1; 16], &peer).unwrap();
    assert_eq!(record.state, RecordState::Consumed);
    assert!(record.peer.as_ref() == Some(&peer));
    assert_eq!(store.records().unwrap().len(), 1);
}

#[test]
fn different_local_key_or_epoch_cannot_adopt_database() {
    let directory = Directory::new();
    let mut store = directory.store(key("pc"));
    store.pc_consume(&[1; 16], &key("phone"), None).unwrap();
    drop(store);
    assert!(matches!(
        Store::open(directory.path(), key("phone"), [7; 16]),
        Err(PairingError::ContinuityLost)
    ));
    assert!(matches!(
        Store::open(directory.path(), key("pc"), [8; 16]),
        Err(PairingError::ContinuityLost)
    ));
}

#[test]
fn revoke_survives_restart_and_exact_consent_keeps_old_tombstone() {
    let directory = Directory::new();
    let peer = key("phone");
    let mut store = directory.store(key("pc"));
    store.pc_consume(&[1; 16], &peer, None).unwrap();
    assert!(matches!(
        store.pc_consume(&[2; 16], &peer, None),
        Err(PairingError::AlreadyPaired)
    ));
    store.pc_revoke(&[1; 16]).unwrap();
    drop(store);
    let mut store = directory.store(key("pc"));
    assert!(matches!(
        store.pc_complete(&[1; 16], &peer),
        Err(PairingError::Revoked)
    ));
    assert!(matches!(
        store.pc_consume(&[2; 16], &peer, None),
        Err(PairingError::Revoked)
    ));
    assert!(matches!(
        store.pc_consume(&[2; 16], &peer, Some([9; 16])),
        Err(PairingError::Revoked)
    ));
    assert_eq!(
        store
            .repair_required(RecordRole::Pc, &peer.fingerprint())
            .unwrap(),
        Some([1; 16])
    );
    store.pc_consume(&[2; 16], &peer, Some([1; 16])).unwrap();
    assert_eq!(
        store.record(&[1; 16]).unwrap().unwrap().state,
        RecordState::Revoked
    );
    assert_eq!(store.records().unwrap().len(), 2);
}

#[test]
fn phone_binding_and_hint_are_one_transaction_on_failure() {
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
        store.phone_pending(&[2; 16], &key("pc").fingerprint(), &hint(), None),
        Err(PairingError::StorageFailure)
    ));
    assert!(matches!(
        store.record(&[2; 16]),
        Err(PairingError::OutcomeUnknown)
    ));
    drop(store);
    let store = directory.store(key("phone"));
    assert!(store.record(&[2; 16]).unwrap().is_none());
}

#[test]
fn complete_failure_preserves_consumed_for_explicit_recovery() {
    let directory = Directory::new();
    let peer = key("phone");
    let mut store = directory.store(key("pc"));
    store.pc_consume(&[1; 16], &peer, None).unwrap();
    store
        .conn
        .execute_batch(
            "CREATE TRIGGER fault BEFORE UPDATE ON records
        WHEN NEW.state=2 BEGIN SELECT RAISE(ABORT,'injected storage failure'); END;",
        )
        .unwrap();
    assert!(matches!(
        store.pc_complete(&[1; 16], &peer),
        Err(PairingError::StorageFailure)
    ));
    drop(store);
    let store = directory.store(key("pc"));
    assert_eq!(
        store.pc_recover(&[1; 16], &peer).unwrap().state,
        RecordState::Consumed
    );
}

#[test]
fn corrupt_cached_binding_fails_closed_without_repairing_row() {
    let directory = Directory::new();
    let mut store = directory.store(key("pc"));
    store.pc_consume(&[1; 16], &key("phone"), None).unwrap();
    store
        .conn
        .execute_batch("DROP TRIGGER immutable_record;")
        .unwrap();
    store
        .conn
        .execute("UPDATE records SET expected=?1", [[9u8; 32].as_slice()])
        .unwrap();
    drop(store);
    assert!(matches!(
        Store::open(directory.path(), key("pc"), [7; 16]),
        Err(PairingError::StorageFailure)
    ));
}

#[test]
fn phone_pending_pin_and_complete_are_durable_and_never_downgrade() {
    let directory = Directory::new();
    let pc = key("pc");
    let mut store = directory.store(key("phone"));
    store
        .phone_pending(&[3; 16], &pc.fingerprint(), &hint(), None)
        .unwrap();
    drop(store);
    let mut store = directory.store(key("phone"));
    let pending = store.phone_recover(&[3; 16], &pc).unwrap();
    assert_eq!(pending.state, RecordState::Pending);
    assert!(pending.peer.is_none());
    assert!(pending.hint.as_ref() == Some(&hint()));
    assert!(matches!(
        store.phone_pin(&[3; 16], &key("phone")),
        Err(PairingError::TlsRejected)
    ));
    store.phone_pin(&[3; 16], &pc).unwrap();
    drop(store);
    let mut store = directory.store(key("phone"));
    assert_eq!(
        store.phone_recover(&[3; 16], &pc).unwrap().state,
        RecordState::PinnedPendingAck
    );
    store.phone_complete(&[3; 16], &pc).unwrap();
    assert_eq!(
        store.phone_pin(&[3; 16], &pc).unwrap().state,
        RecordState::Complete
    );
    store.phone_revoke(&[3; 16]).unwrap();
    assert!(matches!(
        store.phone_pin(&[3; 16], &pc),
        Err(PairingError::Revoked)
    ));
}
