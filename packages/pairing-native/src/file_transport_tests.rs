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

#[test]
fn channel_preserves_manifest_state_when_photo_status_interleaves_before_chunk_and_finalize() {
    use crate::file_protocol::{OperationState, Upload};
    use crate::file_sender_command::{Command, Task};
    use ring::digest::{digest, SHA256};
    use std::io::{Read, Seek, SeekFrom, Write};

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

    let mut transport = Managed::new(true).unwrap();
    let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).unwrap();
    let address = listener.local_addr().unwrap();
    let outgoing = TcpStream::connect(address).unwrap();
    let (incoming, _) = listener.accept().unwrap();
    let mut server = Some(Session::server(incoming, fixture.pc.key.clone(), 1, 0).unwrap());
    let record = Record {
        sid: fixture.sid,
        role: RecordRole::Phone,
        expected: fixture.pc.spki.fingerprint(),
        peer: Some(fixture.pc.spki.clone()),
        state: RecordState::Complete,
        hint: Some(LanHint {
            ip: address.ip(),
            port: address.port(),
        }),
    };

    let photo_bytes = b"photo-original-bytes";
    let photo_upload = Upload {
        rebackup_of: None,
        request_id: crate::qr_base64::encode(&[11; 16]),
        source_id: crate::qr_base64::encode(&[12; 16]),
        source_revision: "rev-photo".into(),
        name: "photo.jpg".into(),
        sha256: crate::qr_base64::encode(digest(&SHA256, photo_bytes).as_ref()),
        size: photo_bytes.len() as u64,
    };
    let manifest_path = directory.path().join("manifest.bin");
    let photo_sha256 = photo_upload.sha256.clone();
    let photo_size = photo_upload.size;

    let mut photo_file = std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create_new(true)
        .open(directory.path().join("photo.bin"))
        .unwrap();
    photo_file.write_all(photo_bytes).unwrap();
    photo_file.seek(SeekFrom::Start(0)).unwrap();

    let phone_key = fixture.phone.key.clone();
    let client_record = record.clone();
    let client = transport.runtime().spawn(async move {
        let mut channel =
            crate::file_sender::Channel::connect(outgoing, phone_key, &client_record, || Ok(()))
                .await
                .unwrap();
        let photo_created = channel
            .transfer(
                Task {
                    command: Command::Create {
                        upload: photo_upload,
                    },
                    file: None,
                },
                || Ok(()),
            )
            .await
            .unwrap()
            .operation
            .unwrap();
        let photo_chunk = photo_file.try_clone().unwrap();
        channel
            .transfer(
                Task {
                    command: Command::Chunk {
                        id: photo_created.id.clone(),
                        offset: 0,
                        length: photo_bytes.len(),
                    },
                    file: Some(photo_chunk),
                },
                || Ok(()),
            )
            .await
            .unwrap();
        channel
            .transfer(
                Task {
                    command: Command::Finalize {
                        id: photo_created.id.clone(),
                    },
                    file: None,
                },
                || Ok(()),
            )
            .await
            .unwrap();

        let manifest_json = serde_json::json!({
            "version": 1,
            "sourceDeviceId": "dev",
            "assetId": "a1",
            "revision": "1",
            "resources": [{
                "operationId": photo_created.id.clone(),
                "role": "original",
                "name": "photo.jpg",
                "mimeType": "image/jpeg",
                "sha256": photo_sha256,
                "size": photo_size.to_string(),
            }],
            "albums": [],
            "favorite": null,
        });
        let manifest_bytes = serde_json::to_vec(&manifest_json).unwrap();
        let manifest_hash = crate::qr_base64::encode(digest(&SHA256, &manifest_bytes).as_ref());
        let manifest_upload = Upload {
            rebackup_of: None,
            request_id: crate::qr_base64::encode(&[21; 16]),
            source_id: crate::qr_base64::encode(&[22; 16]),
            source_revision: manifest_hash.clone(),
            name: "kloda-photo-v1-dev-a1-1.json".into(),
            sha256: manifest_hash,
            size: manifest_bytes.len() as u64,
        };
        let mut manifest_file = std::fs::OpenOptions::new()
            .read(true)
            .write(true)
            .create_new(true)
            .open(&manifest_path)
            .unwrap();
        manifest_file.write_all(&manifest_bytes).unwrap();
        manifest_file.seek(SeekFrom::Start(0)).unwrap();

        let manifest_created = channel
            .transfer(
                Task {
                    command: Command::Create {
                        upload: manifest_upload,
                    },
                    file: None,
                },
                || Ok(()),
            )
            .await
            .unwrap()
            .operation
            .unwrap();

        // Interleave Status check for the prior photo before streaming manifest Chunk + Finalize.
        let photo_status = channel
            .transfer(
                Task {
                    command: Command::Status {
                        id: photo_created.id.clone(),
                    },
                    file: None,
                },
                || Ok(()),
            )
            .await
            .unwrap()
            .operation
            .unwrap();
        assert!(photo_status.state == OperationState::Completed);

        let manifest_chunk = manifest_file.try_clone().unwrap();
        channel
            .transfer(
                Task {
                    command: Command::Chunk {
                        id: manifest_created.id.clone(),
                        offset: 0,
                        length: manifest_bytes.len(),
                    },
                    file: Some(manifest_chunk),
                },
                || Ok(()),
            )
            .await
            .unwrap();
        let manifest_final = channel
            .transfer(
                Task {
                    command: Command::Finalize {
                        id: manifest_created.id,
                    },
                    file: None,
                },
                || Ok(()),
            )
            .await
            .unwrap()
            .operation
            .unwrap();
        assert!(manifest_final.state == OperationState::Completed);
        let scope_reply = channel
            .transfer(
                Task {
                    command: Command::Scope,
                    file: None,
                },
                || Ok(()),
            )
            .await
            .unwrap();
        assert_eq!(scope_reply.scope_state.as_deref(), Some("approved"));
        let mut check_buf = Vec::new();
        photo_file.seek(SeekFrom::Start(0)).unwrap();
        photo_file.read_to_end(&mut check_buf).unwrap();
    });

    let mut receiver = crate::file_receiver::Receiver::new();
    let start = Instant::now();
    while !client.is_finished() {
        assert!(
            start.elapsed() < Duration::from_secs(5),
            "interleaved Channel transfer deadline"
        );
        transport.poll();
        if let Some(session) = &mut server {
            session.pump(start.elapsed().as_millis() as u64).unwrap();
            if session.established() {
                let io = {
                    let _entered = transport.enter();
                    server.take().unwrap().into_file().unwrap()
                };
                transport.accept(io).unwrap();
            }
        }
        if let Some(command) = transport.next() {
            let result = receiver.execute(
                &mut store,
                &command.sid,
                &command.evidence.peer,
                command.request,
            );
            let _ = command.reply.send(result);
        }
        std::thread::sleep(Duration::from_millis(1));
    }
    transport.runtime().block_on(client).unwrap();
    transport.close();
}
