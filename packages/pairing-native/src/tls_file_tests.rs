use super::*;
#[test]
fn file_profile_is_pinned_pc_only_and_hands_off_without_qr_framing() {
    let pc = Identity::new(crate::certificate::Role::Pc);
    let phone = Identity::new(crate::certificate::Role::Phone);
    let mut pair = Loopback::configured(
        pc.key.clone(),
        phone.key.clone(),
        pc.spki.fingerprint(),
        1,
        ClientMode::Normal,
    );
    assert!(!pair.pc.is_file());
    let (config, verifier) =
        crate::tls_config::client_config(phone.key.clone(), pc.spki.fingerprint()).unwrap();
    assert_eq!(
        config.alpn_protocols,
        vec![crate::tls_config::FILE_ALPN.to_vec()]
    );
    let (server, _) = crate::tls_config::server_config(pc.key.clone()).unwrap();
    assert_eq!(server.alpn_protocols, config.alpn_protocols);
    pair.phone.connection = Some(Connection::Client(
        ClientConnection::new(
            config,
            ServerName::IpAddress(IpAddr::V4(Ipv4Addr::LOCALHOST).into()),
        )
        .unwrap(),
    ));
    pair.phone.verifier = verifier.clone();
    let start = Instant::now();
    loop {
        let now = pair.now();
        pair.phone.flush().unwrap();
        pair.pc.pump(now).unwrap();
        let client = pair.phone.connection.as_mut().unwrap();
        match client.read_tls(pair.phone.socket.as_mut().unwrap()) {
            Ok(0) => panic!("closed during file handshake"),
            Ok(_) => {
                client.process_new_packets().unwrap();
            }
            Err(error) if error.kind() == ErrorKind::WouldBlock => (),
            Err(error) => panic!("file handshake read: {error}"),
        }
        if pair.pc.established() && !client.is_handshaking() {
            break;
        }
        assert!(start.elapsed() < LIMIT, "file handshake deadline");
        std::thread::sleep(Duration::from_millis(1));
    }
    assert!(pair.pc.is_file());
    assert!(crate::tls_config::full_profile(
        pair.phone.connection.as_ref().unwrap(),
        crate::tls_config::FILE_ALPN,
    ));
    assert!(matches!(verifier.verified_key.lock(), Ok(peer) if peer.as_ref() == Some(&pc.spki)));
    let now = pair.now();
    assert!(matches!(
        pair.pc.next_frame(now),
        Err(PairingError::TlsRejected)
    ));
    assert!(matches!(
        pair.pc.send(&Frame::Recover { sid: [1; 16] }),
        Err(PairingError::TlsRejected)
    ));
    assert!(matches!(
        pair.phone.pump(now),
        Err(PairingError::TlsRejected)
    ));
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();
    let _entered = runtime.enter();
    assert!(pair.pc.into_file().is_ok());
}
