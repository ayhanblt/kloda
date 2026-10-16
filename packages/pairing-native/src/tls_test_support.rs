#![cfg(test)]

// PUBLIC SYNTHETIC TEST FIXTURES: disposable ring-generated software P-256 keys.
// These are not installation identities, hardware evidence, or production routes.
use crate::error::PairingError;
use crate::frame::Frame;
use crate::tls::{Channel, Session};
use crate::tls_verifier::Verifier;
use rustls::client::{ResolvesClientCert, Resumption};
use rustls::pki_types::ServerName;
use rustls::sign::CertifiedKey;
use rustls::{ClientConfig, ClientConnection, Connection, SignatureScheme};
use std::io::{ErrorKind, Write};
use std::net::{IpAddr, Ipv4Addr, TcpListener, TcpStream};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

const LIMIT: Duration = Duration::from_secs(3);
#[path = "tls_test_resolver.rs"]
mod resolver;
pub(super) use crate::tls_test_identity::Identity;
use resolver::Resolver;

#[derive(Clone, Copy)]
pub(super) enum ClientMode {
    Normal,
    MissingCertificate,
    WrongAlpn,
}
#[derive(Clone, Copy)]
pub(super) enum Side {
    Pc,
    Phone,
}

/// Single-threaded scheduler: no detached callbacks/threads to outlive a test.
/// Only this cfg(test) harness uses loopback; production Route is never bypassed.
pub(super) struct Loopback {
    pub pc: Session,
    pub phone: Session,
    started: Instant,
}
impl Loopback {
    pub fn new(pc: &Identity, phone: &Identity, generation: u64) -> Self {
        let mut pair = Self::configured(
            pc.key.clone(),
            phone.key.clone(),
            pc.spki.fingerprint(),
            generation,
            ClientMode::Normal,
        );
        pair.until(|p| p.pc.established() && p.phone.established());
        pair
    }
    pub fn configured(
        pc: Arc<CertifiedKey>,
        phone: Arc<CertifiedKey>,
        expected: [u8; 32],
        generation: u64,
        mode: ClientMode,
    ) -> Self {
        let ip = IpAddr::V4(Ipv4Addr::LOCALHOST);
        let listener = TcpListener::bind((ip, 0)).unwrap();
        listener.set_nonblocking(true).unwrap();
        let outgoing = TcpStream::connect_timeout(&listener.local_addr().unwrap(), LIMIT).unwrap();
        let start = Instant::now();
        let incoming = loop {
            match listener.accept() {
                Ok((socket, _)) => break socket,
                Err(e) if e.kind() == ErrorKind::WouldBlock => {
                    assert!(start.elapsed() < LIMIT, "loopback accept deadline");
                    std::thread::sleep(Duration::from_millis(1));
                }
                Err(e) => panic!("loopback accept: {e}"),
            }
        };
        incoming.set_nodelay(true).unwrap();
        outgoing.set_nodelay(true).unwrap();
        let pc = Session::server(incoming, pc, generation, 0).unwrap();
        let phone = match mode {
            ClientMode::Normal => {
                Session::client(outgoing, phone, generation, 0, expected, ip).unwrap()
            }
            mode => {
                let verifier = Arc::new(Verifier {
                    expected_pc: Some(expected),
                    verified_key: Mutex::new(None),
                });
                let mut provider = rustls::crypto::ring::default_provider();
                provider.cipher_suites =
                    vec![rustls::crypto::ring::cipher_suite::TLS13_AES_128_GCM_SHA256];
                provider.kx_groups = vec![rustls::crypto::ring::kx_group::SECP256R1];
                let builder = ClientConfig::builder_with_provider(Arc::new(provider))
                    .with_protocol_versions(&[&rustls::version::TLS13])
                    .unwrap()
                    .dangerous()
                    .with_custom_certificate_verifier(verifier.clone());
                let mut config = match mode {
                    ClientMode::MissingCertificate => builder.with_no_client_auth(),
                    _ => builder.with_client_cert_resolver(Arc::new(Resolver(phone))),
                };
                config.alpn_protocols = vec![match mode {
                    ClientMode::WrongAlpn => b"not-kloda/1".to_vec(),
                    _ => crate::tls_config::ALPN.to_vec(),
                }];
                config.resumption = Resumption::disabled();
                config.enable_early_data = false;
                config.enable_sni = false;
                let raw = ClientConnection::new(Arc::new(config), ServerName::IpAddress(ip.into()))
                    .unwrap();
                Session::new(
                    outgoing,
                    Connection::Client(raw),
                    verifier,
                    generation,
                    false,
                    0,
                )
                .unwrap()
            }
        };
        Self {
            pc,
            phone,
            started: Instant::now(),
        }
    }
    pub fn now(&self) -> u64 {
        self.started.elapsed().as_millis() as u64
    }
    pub fn step(&mut self) {
        let now = self.now();
        self.pc.pump(now).unwrap();
        self.phone.pump(now).unwrap();
    }
    pub fn until(&mut self, mut condition: impl FnMut(&mut Self) -> bool) {
        let start = Instant::now();
        loop {
            self.step();
            if condition(self) {
                return;
            }
            assert!(start.elapsed() < LIMIT, "TLS loopback progress deadline");
            std::thread::sleep(Duration::from_millis(1));
        }
    }
    pub fn channels(&self, sid: &[u8; 16], pc: &Identity, phone: &Identity) -> (Channel, Channel) {
        let a = self.pc.channel(sid, &pc.spki).unwrap();
        let b = self.phone.channel(sid, &phone.spki).unwrap();
        assert!(a.peer() == &phone.spki && b.peer() == &pc.spki);
        assert_eq!(
            a.binding(),
            b.binding(),
            "actual mutual TLS exporters must agree"
        );
        (a, b)
    }
    pub fn send(&mut self, side: Side, frame: &Frame) {
        let sender = match side {
            Side::Pc => &mut self.pc,
            Side::Phone => &mut self.phone,
        };
        sender.send(frame).unwrap();
        self.until(|p| match side {
            Side::Pc => p.pc.sent().unwrap(),
            Side::Phone => p.phone.sent().unwrap(),
        });
    }
    pub fn receive(&mut self, side: Side) -> Frame {
        let mut result = None;
        self.until(|p| {
            let now = p.now();
            result = match side {
                Side::Pc => p.pc.next_frame(now).unwrap(),
                Side::Phone => p.phone.next_frame(now).unwrap(),
            };
            result.is_some()
        });
        result.unwrap()
    }
    /// Close the real sender without consuming the receiver's buffered frames.
    pub fn close(&mut self, side: Side, notify: bool) {
        let sender = match side {
            Side::Pc => &mut self.pc,
            Side::Phone => &mut self.phone,
        };
        if notify {
            sender.connection.as_mut().unwrap().send_close_notify();
            sender.flush().unwrap();
        } else {
            sender
                .socket
                .as_ref()
                .unwrap()
                .shutdown(std::net::Shutdown::Write)
                .unwrap();
        }
    }
    pub fn close_observed(&mut self, side: Side, notify: bool) {
        self.close(side, notify);
        self.observe_closed(side);
    }
    pub fn observe_closed(&mut self, side: Side) {
        self.until(|p| {
            let receiver = match side {
                Side::Pc => &p.phone,
                Side::Phone => &p.pc,
            };
            matches!(
                receiver.authorize_live(),
                Err(PairingError::ConnectionClosed)
            )
        });
    }
    pub fn raw(&mut self, side: Side, bytes: &[u8]) {
        let session = match side {
            Side::Pc => &mut self.pc,
            Side::Phone => &mut self.phone,
        };
        session
            .connection
            .as_mut()
            .unwrap()
            .writer()
            .write_all(bytes)
            .unwrap();
        session.flush().unwrap();
        self.until(|p| {
            let (sender, receiver) = match side {
                Side::Pc => (&mut p.pc, &mut p.phone),
                Side::Phone => (&mut p.phone, &mut p.pc),
            };
            !sender.connection.as_ref().unwrap().wants_write()
                && receiver
                    .connection
                    .as_mut()
                    .unwrap()
                    .process_new_packets()
                    .unwrap()
                    .plaintext_bytes_to_read()
                    >= bytes.len()
        });
    }
    pub fn rejected(&mut self, side: Side) {
        let start = Instant::now();
        loop {
            let now = self.now();
            let a = self.pc.pump(now);
            let b = self.phone.pump(now);
            let (result, established) = match side {
                Side::Pc => (a, self.pc.established()),
                Side::Phone => (b, self.phone.established()),
            };
            if matches!(result, Err(PairingError::TlsRejected)) {
                assert!(
                    !established,
                    "rejected peer must not establish channel evidence"
                );
                return;
            }
            result.unwrap();
            assert!(
                start.elapsed() < LIMIT,
                "expected observable TLS peer rejection"
            );
            std::thread::sleep(Duration::from_millis(1));
        }
    }
}
#[path = "tls_file_tests.rs"]
mod file_profile;
