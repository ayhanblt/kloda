//! Disposable store boundary regression, not native generation admission proof.
use crate::state::test_support::{key, Directory};

#[test]
fn fresh_store_does_not_inherit_old_trust_and_completed_qr_has_no_file_grant() {
    let old_directory = Directory::new();
    let new_directory = Directory::new();
    let peer = key("phone");
    let mut old = old_directory.store(key("pc"));
    old.pc_consume(&[1; 16], &peer, None).unwrap();
    old.pc_complete(&[1; 16], &peer).unwrap();
    let mut fresh = new_directory.store(key("pc"));
    assert!(fresh.records().unwrap().is_empty());
    assert!(fresh.pc_recover(&[1; 16], &peer).is_err());
    assert!(matches!(
        fresh.backup_scope(&[1; 16]),
        Err(crate::error::PairingError::CandidateStale)
    ));
    fresh.pc_consume(&[2; 16], &peer, None).unwrap();
    fresh.pc_complete(&[2; 16], &peer).unwrap();
    assert!(fresh.backup_scope(&[2; 16]).unwrap().is_none());
    drop(fresh);
    let fresh = new_directory.store(key("pc"));
    assert!(fresh.pc_recover(&[1; 16], &peer).is_err());
    assert!(fresh.pc_recover(&[2; 16], &peer).is_ok());
    assert!(fresh.backup_scope(&[2; 16]).unwrap().is_none());
    assert!(old.pc_recover(&[1; 16], &peer).is_ok());
    assert!(old.pc_recover(&[2; 16], &peer).is_err());
}
