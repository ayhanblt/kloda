// Synthetic software P256 loopback exercises the real native FILE TLS/HTTP stack only.
use super::{Command, Managed};
use crate::certificate::Role;
use crate::error::{PairingError, Result};
use crate::qr::LanHint;
use crate::store_rows::{Record, RecordRole, RecordState};
use crate::tls::Session;
use crate::tls_test_identity::Identity;
use std::net::{Ipv4Addr, TcpListener, TcpStream};
use std::time::{Duration, Instant};

pub(crate) struct Fixture {
    pub(crate) pc: Identity,
    pub(crate) phone: Identity,
    pub(crate) sid: [u8; 16],
}
impl Fixture {
    pub(crate) fn new() -> Self {
        Self {
            pc: Identity::new(Role::Pc),
            phone: Identity::new(Role::Phone),
            sid: [41; 16],
        }
    }
    /// Consumer supplies the sole-owner command execution, never TLS identity/headers.
    pub(crate) fn revoke(&self, mut consume: impl FnMut(Command)) -> Result<()> {
        let mut transport = Managed::new(true).unwrap();
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).unwrap();
        let address = listener.local_addr().unwrap();
        let outgoing = TcpStream::connect(address).unwrap();
        let (incoming, _) = listener.accept().unwrap();
        let mut server = Some(Session::server(incoming, self.pc.key.clone(), 1, 0).unwrap());
        let record = Record {
            sid: self.sid,
            role: RecordRole::Phone,
            expected: self.pc.spki.fingerprint(),
            peer: Some(self.pc.spki.clone()),
            state: RecordState::Complete,
            hint: Some(LanHint {
                ip: address.ip(),
                port: address.port(),
            }),
        };
        let phone = self.phone.key.clone();
        let client = transport.runtime().spawn(async move {
            crate::file_transport_client::revoke_loopback_fixture(outgoing, phone, &record).await
        });
        let start = Instant::now();
        while !client.is_finished() {
            assert!(
                start.elapsed() < Duration::from_secs(3),
                "native FILE TLS/HTTP deadline"
            );
            transport.poll();
            if let Some(session) = &mut server {
                session.pump(start.elapsed().as_millis() as u64).unwrap();
                if session.established() {
                    assert!(session.is_file());
                    let io = {
                        let _entered = transport.enter();
                        server.take().unwrap().into_file().unwrap()
                    };
                    transport.accept(io).unwrap();
                }
            }
            if let Some(command) = transport.next() {
                assert_eq!(command.sid, self.sid);
                assert!(command.evidence.peer == self.phone.spki);
                command.evidence.check_live().unwrap();
                consume(command);
            }
            std::thread::sleep(Duration::from_millis(1));
        }
        let result = transport.runtime().block_on(client).unwrap();
        transport.close();
        result
    }
}

#[test]
fn actual_native_mtls_http_ack_requires_durable_trust_and_acl_revoke() {
    let fixture = Fixture::new();
    let directory = crate::state::test_support::Directory::new();
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
    let mut receiver = crate::file_receiver::Receiver::new();
    fixture
        .revoke(|command| {
            let result = receiver.execute(
                &mut store,
                &command.sid,
                &command.evidence.peer,
                command.request,
            );
            command
                .reply
                .send(result)
                .unwrap_or_else(|_| panic!("owner reply closed"));
        })
        .unwrap();
    drop(store);
    let store = directory.store(fixture.pc.spki.clone());
    assert!(store.record(&fixture.sid).unwrap().unwrap().state == RecordState::Revoked);
    assert!(!store.backup_scope(&fixture.sid).unwrap().unwrap().approved);
}
#[test]
fn actual_native_mtls_unpaired_peer_cannot_confirm_revoke() {
    let fixture = Fixture::new();
    let directory = crate::state::test_support::Directory::new();
    let mut store = directory.store(fixture.pc.spki.clone());
    let mut receiver = crate::file_receiver::Receiver::new();
    assert_eq!(
        fixture.revoke(|command| {
            let result = receiver.execute(
                &mut store,
                &command.sid,
                &command.evidence.peer,
                command.request,
            );
            command
                .reply
                .send(result)
                .unwrap_or_else(|_| panic!("owner reply closed"));
        }),
        Err(PairingError::TlsRejected)
    );
    assert!(store.record(&fixture.sid).unwrap().is_none());
}

#[test]
fn actual_authenticated_peer_close_preserves_only_exact_ack_channel() {
    let fixture = Fixture::new();
    assert!(fixture
        .revoke(|command| {
            let mut manager = Managed::new(true).unwrap();
            manager.peers.push(command.evidence.clone());
            manager.close_peer(&command.evidence.peer, Some(&command.evidence));
            command.evidence.check_live().unwrap();
            manager.close_peer(&fixture.pc.spki, None);
            command.evidence.check_live().unwrap();
            manager.close_peer(&command.evidence.peer, None);
            assert_eq!(
                command.evidence.check_live(),
                Err(PairingError::ConnectionClosed)
            );
            drop(command.reply);
        })
        .is_err());
}
