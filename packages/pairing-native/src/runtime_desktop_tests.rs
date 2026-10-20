use super::*;
use crate::frame::Frame;
use crate::state::test_support::{hint, key, Directory};
use crate::store_rows::RecordState;

fn candidate(store: &crate::store::Store) -> (Pc, Channel, Frame) {
    let pc = Pc::create(store, hint(), 0).unwrap();
    let qr = crate::qr::parse(pc.qr().unwrap()).unwrap();
    let channel = Channel::for_state_test(1, key("phone"), [1; 32]);
    let tag = crate::proof::tag(
        &qr.secret,
        &qr.sid,
        &qr.pc_fingerprint,
        &channel.peer().fingerprint(),
        channel.binding(),
    );
    (pc, channel, Frame::Proof { sid: qr.sid, tag })
}

#[test]
fn background_invalidates_preconsume_candidate_but_preserves_consumed_recovery() {
    let directory = Directory::new();
    let mut store = directory.store(key("pc"));
    let (mut open, _, _) = candidate(&store);
    assert!(suspend_invitation(Some(&mut open)).is_some());
    assert!(open.qr().is_none());
    let (mut pc, channel, proof) = candidate(&store);
    let sid = *pc.sid();
    pc.reserve(&store, &channel, &proof, 1).unwrap();
    assert_eq!(suspend_invitation(Some(&mut pc)), Some(sid));
    assert!(matches!(
        pc.approve(&mut store, &sid, 1, &channel, 2),
        Err(PairingError::CandidateStale)
    ));
    assert!(store.record(&sid).unwrap().is_none());

    let (mut consumed, channel, proof) = candidate(&store);
    consumed.reserve(&store, &channel, &proof, 1).unwrap();
    let sid = *consumed.sid();
    consumed.approve(&mut store, &sid, 1, &channel, 2).unwrap();
    assert!(suspend_invitation(Some(&mut consumed)).is_none());
    assert_eq!(consumed.phase(), Phase::ConsumedPendingAck);
    assert_eq!(
        store.record(&sid).unwrap().unwrap().state,
        RecordState::Consumed
    );
    consumed.commit_sent(&channel).unwrap();
}

#[test]
fn real_mtls_file_channel_continues_while_invitation_is_suspended() {
    let fixture = crate::file_transport::tests::Fixture::new();
    let directory = Directory::new();
    let mut store = directory.store(fixture.pc.spki.clone());
    store
        .pc_consume(&fixture.sid, &fixture.phone.spki, None)
        .unwrap();
    store
        .pc_complete(&fixture.sid, &fixture.phone.spki)
        .unwrap();
    let folder = directory.path().join("media");
    std::fs::create_dir(&folder).unwrap();
    store
        .approve_backup(&fixture.sid, folder.to_str().unwrap(), None)
        .unwrap();
    let mut invitation = Pc::create(&store, hint(), 0).unwrap();
    let mut receiver = crate::file_receiver::Receiver::new();
    fixture
        .revoke(|command| {
            assert!(suspend_invitation(Some(&mut invitation)).is_some());
            command.evidence.check_live().unwrap();
            let result = receiver.execute(
                &mut store,
                &command.sid,
                &command.evidence.peer,
                command.request,
            );
            assert!(result.is_ok());
            command
                .reply
                .send(result)
                .unwrap_or_else(|_| panic!("file reply closed"));
        })
        .unwrap();
}

#[test]
fn receiver_status_has_only_sanitized_observed_fields() {
    let status = ReceiverStatus {
        available: false,
        active_transfers: 2,
        error_code: Some("backup_full"),
    };
    assert_eq!(
        serde_json::to_value(status).unwrap(),
        serde_json::json!({
            "available": false, "activeTransfers": 2, "errorCode": "backup_full"
        })
    );
    assert_eq!(target_error(&crate::file_protocol::Error::Denied), None);
    assert_eq!(
        target_error(&crate::file_protocol::Error::BackupFull),
        Some(PairingError::BackupFull)
    );
}

#[test]
fn unrelated_peer_or_read_success_does_not_clear_failed_write() {
    use crate::file_protocol::{Error, Response};
    let mut errors = std::collections::BTreeMap::new();
    observe_file_result(&mut errors, [1; 16], 1, &Err(Error::BackupFull));
    observe_file_result(&mut errors, [2; 16], 1, &Ok(Response::Pending));
    observe_file_result(&mut errors, [1; 16], 3, &Ok(Response::Pending));
    assert_eq!(errors.len(), 1);
    observe_file_result(&mut errors, [1; 16], 1, &Ok(Response::Pending));
    assert!(errors.is_empty());
}
