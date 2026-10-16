use super::*;

#[test]
fn full_mutual_tls_drives_durable_two_sided_completion() {
    let mut exchange = Exchange::reserved();
    let commit = exchange.consume();
    let ack = exchange.pin(&commit);
    let complete = exchange.acknowledge(&ack);
    exchange.finish(&complete);
    assert!(
        exchange
            .pc_store
            .record(&exchange.sid)
            .unwrap()
            .unwrap()
            .peer
            .as_ref()
            == Some(&exchange.phone_id.spki)
    );
    assert!(
        exchange
            .phone_store
            .record(&exchange.sid)
            .unwrap()
            .unwrap()
            .peer
            .as_ref()
            == Some(&exchange.pc_id.spki)
    );
}

#[test]
fn real_received_ack_and_complete_require_actual_writer_callbacks() {
    let mut e = Exchange::reserved();
    let commit = e.consume();
    e.pair.send(Side::Pc, &commit); // Actual write, deliberately delay the state callback.
    let received = e.pair.receive(Side::Phone);
    let ack = e
        .phone
        .commit(&mut e.phone_store, &e.phone_channel, &received)
        .unwrap();
    e.pair.send(Side::Phone, &ack);
    let received = e.pair.receive(Side::Pc);
    assert!(matches!(
        e.pc.ack(&mut e.pc_store, &e.pc_channel, &received),
        Err(PairingError::TlsRejected)
    ));
    durable(&e.pc_dir, &e.pc_id, &e.sid, RecordState::Consumed);
    e.pc.commit_sent(&e.pc_channel).unwrap();
    let complete = e.pc.ack(&mut e.pc_store, &e.pc_channel, &received).unwrap();
    e.pair.send(Side::Pc, &complete);
    let received = e.pair.receive(Side::Phone);
    assert!(matches!(
        e.phone
            .complete(&mut e.phone_store, &e.phone_channel, &received),
        Err(PairingError::TlsRejected)
    ));
    durable(
        &e.phone_dir,
        &e.phone_id,
        &e.sid,
        RecordState::PinnedPendingAck,
    );
    e.phone.ack_sent(&e.phone_channel).unwrap();
    e.phone
        .complete(&mut e.phone_store, &e.phone_channel, &received)
        .unwrap();
    durable(&e.phone_dir, &e.phone_id, &e.sid, RecordState::Complete);
}

#[test]
fn lost_commit_ack_and_complete_recover_after_store_reopen_with_same_pins() {
    for lost_reply in ["commit", "ack", "complete"] {
        let mut e = Exchange::reserved();
        let commit = e.consume();
        if lost_reply == "commit" {
            e.pair.send(Side::Pc, &commit);
            e.pc.commit_sent(&e.pc_channel).unwrap(); // Drop before phone application read/pin.
        } else {
            let ack = e.pin(&commit);
            if lost_reply == "complete" {
                let complete = e.acknowledge(&ack);
                e.pair.send(Side::Pc, &complete); // Drop before phone application read.
            } else {
                durable(&e.pc_dir, &e.pc_id, &e.sid, RecordState::Consumed);
                durable(
                    &e.phone_dir,
                    &e.phone_id,
                    &e.sid,
                    RecordState::PinnedPendingAck,
                );
            }
        }
        let (mut e, commit) = e.reconnect();
        e.pair.send(Side::Pc, &commit);
        e.pc.commit_sent(&e.pc_channel).unwrap();
        let received = e.pair.receive(Side::Phone);
        let ack = e
            .phone
            .commit(&mut e.phone_store, &e.phone_channel, &received)
            .unwrap();
        let complete = e.acknowledge(&ack);
        e.finish(&complete);
    }
}

#[test]
fn recovery_rejects_different_real_tls_keys_and_durable_revocations() {
    let mut e = Exchange::reserved();
    let _commit = e.consume();
    let attacker_phone = Identity::new(Role::Phone);
    let wrong = Loopback::new(&e.pc_id, &attacker_phone, 3);
    let (pc_channel, _) = wrong.channels(&e.sid, &e.pc_id, &attacker_phone);
    assert!(matches!(
        Pc::resume(&e.pc_store, e.sid, &pc_channel),
        Err(PairingError::TlsRejected)
    ));
    durable(&e.pc_dir, &e.pc_id, &e.sid, RecordState::Consumed);
    let attacker_pc = Identity::new(Role::Pc);
    let mut wrong = Loopback::configured(
        attacker_pc.key.clone(),
        e.phone_id.key.clone(),
        e.pc_id.spki.fingerprint(),
        4,
        ClientMode::Normal,
    );
    wrong.rejected(Side::Phone); // Expected stored PC hash is enforced during real TLS.
    e.pc.cancel(&mut e.pc_store).unwrap();
    e.phone.cancel(&mut e.phone_store).unwrap();
    durable(&e.pc_dir, &e.pc_id, &e.sid, RecordState::Revoked);
    durable(&e.phone_dir, &e.phone_id, &e.sid, RecordState::Revoked);
    let fresh = Loopback::new(&e.pc_id, &e.phone_id, 5);
    let (a, b) = fresh.channels(&e.sid, &e.pc_id, &e.phone_id);
    assert!(matches!(
        Pc::resume(&e.pc_store, e.sid, &a),
        Err(PairingError::Revoked)
    ));
    assert!(matches!(
        Phone::resume(&e.phone_store, e.sid, &b),
        Err(PairingError::Revoked)
    ));
}

#[test]
fn real_exporter_proof_cannot_transfer_to_fresh_tls_even_with_same_generation() {
    let pc_id = Identity::new(Role::Pc);
    let phone_id = Identity::new(Role::Phone);
    let pc_dir = Directory::new();
    let phone_dir = Directory::new();
    let pc_store = pc_dir.store(pc_id.spki.clone());
    let mut phone_store = phone_dir.store(phone_id.spki.clone());
    let mut pc = Pc::create(&pc_store, hint(), 0).unwrap();
    let sid = *pc.sid();
    let mut original = Loopback::new(&pc_id, &phone_id, 1);
    let (a, b) = original.channels(&sid, &pc_id, &phone_id);
    let (_phone, proof) =
        Phone::start(&mut phone_store, qr::parse(pc.qr().unwrap()).unwrap(), &b).unwrap();
    let mut fresh = Loopback::new(&pc_id, &phone_id, 1);
    let (new_a, _) = fresh.channels(&sid, &pc_id, &phone_id);
    assert_ne!(a.binding(), new_a.binding());
    fresh.send(Side::Phone, &proof);
    let replay = fresh.receive(Side::Pc);
    assert!(matches!(
        pc.reserve(&pc_store, &new_a, &replay, 1),
        Err(PairingError::ProofRejected)
    ));
    assert_eq!(pc.phase(), Phase::Open);
    assert!(pc_store.record(&sid).unwrap().is_none());
    original.send(Side::Phone, &proof);
    let actual = original.receive(Side::Pc);
    assert_eq!(
        pc.reserve(&pc_store, &a, &actual, 2).unwrap(),
        ReserveOutcome::Reserved
    );
    let other_sid = [0x42; 16];
    assert_ne!(
        original
            .pc
            .channel(&other_sid, &pc_id.spki)
            .unwrap()
            .binding(),
        a.binding()
    );
}

#[test]
fn mutual_auth_profile_pin_and_certificate_verify_fail_closed_on_real_peers() {
    let pc = Identity::new(Role::Pc);
    let phone = Identity::new(Role::Phone);
    for mode in [ClientMode::MissingCertificate, ClientMode::WrongAlpn] {
        let mut pair = Loopback::configured(
            pc.key.clone(),
            phone.key.clone(),
            pc.spki.fingerprint(),
            1,
            mode,
        );
        pair.rejected(Side::Pc);
    }
    let mut bad_self_signature = pc.key.cert[0].as_ref().to_vec();
    *bad_self_signature.last_mut().unwrap() ^= 1;
    let bad_self_signature = Arc::new(CertifiedKey::new(
        vec![bad_self_signature.into()],
        pc.key.key.clone(),
    ));
    let wrong_signer = Identity::new(Role::Pc);
    let bad_certificate_verify = Arc::new(CertifiedKey::new(
        pc.key.cert.clone(),
        wrong_signer.key.key.clone(),
    ));
    for certificate in [
        pc.certificate(Role::Phone, false),
        pc.certificate(Role::Pc, true),
        bad_self_signature,
        bad_certificate_verify,
    ] {
        let mut pair = Loopback::configured(
            certificate,
            phone.key.clone(),
            pc.spki.fingerprint(),
            1,
            ClientMode::Normal,
        );
        pair.rejected(Side::Phone);
        assert!(pair.phone.channel(&[1; 16], &phone.spki).is_err());
    }
    let wrong_phone_signer = Identity::new(Role::Phone);
    let bad_phone_certificate_verify = Arc::new(CertifiedKey::new(
        phone.key.cert.clone(),
        wrong_phone_signer.key.key.clone(),
    ));
    for certificate in [
        phone.certificate(Role::Pc, false),
        bad_phone_certificate_verify,
    ] {
        let mut pair = Loopback::configured(
            pc.key.clone(),
            certificate,
            pc.spki.fingerprint(),
            1,
            ClientMode::Normal,
        );
        pair.rejected(Side::Pc);
        assert!(pair.pc.channel(&[1; 16], &pc.spki).is_err());
    }
    let mut pair = Loopback::configured(
        pc.key.clone(),
        phone.key.clone(),
        [0; 32],
        1,
        ClientMode::Normal,
    );
    pair.rejected(Side::Phone);
}

#[test]
fn fragmented_and_coalesced_plaintext_frames_decode_through_actual_tls_reads() {
    let pc = Identity::new(Role::Pc);
    let phone = Identity::new(Role::Phone);
    let mut pair = Loopback::new(&pc, &phone, 1);
    let frame = Frame::Recover { sid: [0x53; 16] };
    let mut bytes = [0; 52];
    let count = frame.encode(&mut bytes);
    for range in [0..1, 1..3, 3..9] {
        pair.raw(Side::Phone, &bytes[range]);
        // Drain the actual TLS reader until each incomplete fragment reaches the decoder.
        pair.until(|p| {
            let now = p.now();
            assert!(p.pc.next_frame(now).unwrap().is_none());
            p.pc.decoder.is_partial()
        });
    }
    pair.raw(Side::Phone, &bytes[9..count]);
    assert!(pair.receive(Side::Pc) == frame);
    let other = Frame::Recover { sid: [0x54; 16] };
    let mut second = [0; 52];
    let length = other.encode(&mut second);
    let mut combined = Vec::from(&bytes[..count]);
    combined.extend_from_slice(&second[..length]);
    pair.raw(Side::Phone, &combined);
    assert!(pair.receive(Side::Pc) == frame);
    assert!(pair.receive(Side::Pc) == other);
    let now = pair.now();
    assert!(pair.pc.next_frame(now).unwrap().is_none());
    assert!(!pair.pc.decoder.is_partial());
}
