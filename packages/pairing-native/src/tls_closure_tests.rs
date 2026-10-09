use super::*;

fn reject_closed_reservation(notify: bool) {
    let mut exchange = Exchange::reserved();
    assert!(exchange.pair.pc.authorize_live().is_ok());
    exchange.pair.close_observed(Side::Phone, notify);
    let now = exchange.pair.now();
    // This is the same native fence used by Actor before Pc::approve consumes.
    let approval = exchange
        .pair
        .pc
        .pump(now)
        .and_then(|()| exchange.pair.pc.authorize_live())
        .and_then(|()| {
            exchange.pc.approve(
                &mut exchange.pc_store,
                &exchange.sid,
                exchange.pc_channel.generation(),
                &exchange.pc_channel,
                now,
            )
        });
    assert!(matches!(approval, Err(PairingError::ConnectionClosed)));
    assert_eq!(exchange.pc.phase(), Phase::Reserved);
    assert!(exchange.pc_store.record(&exchange.sid).unwrap().is_none());
    exchange.pc.disconnect(exchange.pc_channel.generation());
    assert_eq!(exchange.pc.phase(), Phase::Invalid);
    assert!(exchange.pc.qr().is_none());
    let reopened = exchange.pc_dir.store(exchange.pc_id.spki.clone());
    assert!(reopened.record(&exchange.sid).unwrap().is_none());
    assert!(reopened.records().unwrap().is_empty());
    durable(
        &exchange.phone_dir,
        &exchange.phone_id,
        &exchange.sid,
        RecordState::Pending,
    );
    assert!(exchange
        .phone_store
        .record(&exchange.sid)
        .unwrap()
        .unwrap()
        .peer
        .is_none());
}

#[test]
fn observed_tcp_eof_cannot_consume_reserved_peer() {
    reject_closed_reservation(false);
}

#[test]
fn observed_tls_close_notify_cannot_consume_reserved_peer() {
    reject_closed_reservation(true);
}

fn drain_final_frames_after_closure(notify: bool) {
    let mut exchange = Exchange::reserved();
    let commit = exchange.consume();
    let ack = exchange.pin(&commit);
    exchange.pair.send(Side::Phone, &ack);
    exchange.phone.ack_sent(&exchange.phone_channel).unwrap();
    exchange.pair.close(Side::Phone, notify);
    let received = exchange.pair.receive(Side::Pc);
    assert!(received == ack);
    exchange.pair.observe_closed(Side::Phone);
    let complete = exchange
        .pc
        .ack(&mut exchange.pc_store, &exchange.pc_channel, &received)
        .unwrap();
    durable(
        &exchange.pc_dir,
        &exchange.pc_id,
        &exchange.sid,
        RecordState::Complete,
    );

    // A separate live exchange exercises the other final frame/direction.
    let mut exchange = Exchange::reserved();
    let commit = exchange.consume();
    let ack = exchange.pin(&commit);
    let final_frame = exchange.acknowledge(&ack);
    assert!(matches!(complete, Frame::Complete { .. }));
    exchange.pair.send(Side::Pc, &final_frame);
    exchange.pair.close(Side::Pc, notify);
    let received = exchange.pair.receive(Side::Phone);
    assert!(received == final_frame);
    exchange.pair.observe_closed(Side::Pc);
    exchange
        .phone
        .complete(
            &mut exchange.phone_store,
            &exchange.phone_channel,
            &received,
        )
        .unwrap();
    durable(
        &exchange.phone_dir,
        &exchange.phone_id,
        &exchange.sid,
        RecordState::Complete,
    );
}

#[test]
fn buffered_ack_and_complete_drain_after_tcp_eof() {
    drain_final_frames_after_closure(false);
}

#[test]
fn buffered_ack_and_complete_drain_after_tls_close_notify() {
    drain_final_frames_after_closure(true);
}
