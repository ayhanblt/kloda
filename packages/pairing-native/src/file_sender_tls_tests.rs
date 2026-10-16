// Synthetic software identities exercise the real FILE TLS/HTTP receiver, not platform custody.
use crate::certificate::Role;
use crate::file_protocol::{OperationState, Upload};
use crate::file_sender::Channel;
use crate::file_sender_command::{Command, Task};
use crate::file_transport::Managed;
use crate::store_rows::{Record, RecordRole, RecordState};
use crate::tls::Session;
use crate::tls_test_identity::Identity;
use std::net::{Ipv4Addr, TcpListener, TcpStream};
use std::time::{Duration, Instant};

#[test]
fn actual_authenticated_sender_resumes_and_restores_own_durable_receiver() {
    let pc = Identity::new(Role::Pc);
    let phone = Identity::new(Role::Phone);
    let sid = [71; 16];
    let directory = crate::state::test_support::Directory::new();
    let mut store = directory.store(pc.spki.clone());
    store.pc_consume(&sid, &phone.spki, None).unwrap();
    store.pc_complete(&sid, &phone.spki).unwrap();
    let folder = directory.path().join("media");
    std::fs::create_dir(&folder).unwrap();
    store
        .approve_backup(&sid, folder.to_str().unwrap(), None)
        .unwrap();
    let mut receiver = crate::file_receiver::Receiver::new();
    let mut transport = Managed::new(true).unwrap();
    let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).unwrap();
    let address = listener.local_addr().unwrap();
    let mut outgoing = Vec::new();
    let mut incoming = Vec::new();
    for generation in 1..=2 {
        outgoing.push(TcpStream::connect(address).unwrap());
        let (socket, _) = listener.accept().unwrap();
        incoming.push(Some(
            Session::server(socket, pc.key.clone(), generation, 0).unwrap(),
        ));
    }
    let record = Record {
        sid,
        role: RecordRole::Phone,
        expected: pc.spki.fingerprint(),
        peer: Some(pc.spki.clone()),
        state: RecordState::Complete,
        hint: Some(crate::qr::LanHint {
            ip: address.ip(),
            port: address.port(),
        }),
    };
    let content = vec![83u8; 65_543];
    let snapshot_path = directory.path().join("snapshot");
    std::fs::write(&snapshot_path, &content).unwrap();
    let snapshot = std::fs::File::open(&snapshot_path).unwrap();
    let restored_path = directory.path().join("restored");
    let restored = std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create_new(true)
        .open(&restored_path)
        .unwrap();
    let upload = Upload {
        request_id: crate::qr_base64::encode(&[72; 16]),
        source_id: crate::qr_base64::encode(&[73; 16]),
        source_revision: "immutable".into(),
        name: "photo.jpg".into(),
        size: content.len() as u64,
        sha256: crate::qr_base64::encode(
            ring::digest::digest(&ring::digest::SHA256, &content).as_ref(),
        ),
    };
    let phone_key = phone.key.clone();
    let client = transport.runtime().spawn(async move {
        let mut sockets = outgoing.into_iter();
        let mut channel =
            Channel::connect(sockets.next().unwrap(), phone_key.clone(), &record, || {
                Ok(())
            })
            .await
            .unwrap();
        assert!(channel.matches(&record));
        let mut different = record.clone();
        different.sid = [74; 16];
        assert!(!channel.matches(&different));
        different = record.clone();
        different.expected = [75; 32];
        assert!(!channel.matches(&different));
        different = record.clone();
        different.hint.as_mut().unwrap().port = 1;
        assert!(!channel.matches(&different));
        let created = channel
            .transfer(
                Task {
                    command: Command::Create { upload },
                    file: None,
                },
                || Ok(()),
            )
            .await
            .unwrap()
            .operation
            .unwrap();
        let id = created.id;
        let first = channel
            .transfer(
                Task {
                    command: Command::Chunk {
                        id: id.clone(),
                        offset: 0,
                        length: 32_768,
                    },
                    file: Some(snapshot.try_clone().unwrap()),
                },
                || Ok(()),
            )
            .await
            .unwrap()
            .operation
            .unwrap();
        assert_eq!(first.offset, 32_768);
        drop(channel);
        let mut channel = Channel::connect(sockets.next().unwrap(), phone_key, &record, || Ok(()))
            .await
            .unwrap();
        let resumed = channel
            .transfer(
                Task {
                    command: Command::Status { id: id.clone() },
                    file: None,
                },
                || Ok(()),
            )
            .await
            .unwrap()
            .operation
            .unwrap();
        assert_eq!(resumed.offset, first.offset);
        let last = channel
            .transfer(
                Task {
                    command: Command::Chunk {
                        id: id.clone(),
                        offset: resumed.offset,
                        length: 32_775,
                    },
                    file: Some(snapshot.try_clone().unwrap()),
                },
                || Ok(()),
            )
            .await
            .unwrap()
            .operation
            .unwrap();
        assert_eq!(last.offset, last.size);
        let complete = channel
            .transfer(
                Task {
                    command: Command::Finalize { id: id.clone() },
                    file: None,
                },
                || Ok(()),
            )
            .await
            .unwrap()
            .operation
            .unwrap();
        assert!(complete.state == OperationState::Completed);
        let photos = channel
            .transfer(
                Task {
                    command: Command::List { after: None },
                    file: None,
                },
                || Ok(()),
            )
            .await
            .unwrap()
            .photos
            .unwrap();
        assert_eq!(photos.len(), 1);
        assert_eq!(photos[0].id, id);
        let mut offset = 0;
        while offset < complete.size {
            let reply = channel
                .transfer(
                    Task {
                        command: Command::Restore {
                            id: id.clone(),
                            offset,
                        },
                        file: Some(restored.try_clone().unwrap()),
                    },
                    || Ok(()),
                )
                .await
                .unwrap();
            assert_eq!(reply.offset, Some(offset));
            offset += reply.bytes.unwrap();
        }
        assert_eq!(snapshot.metadata().unwrap().len(), complete.size);
        id
    });
    let start = Instant::now();
    while !client.is_finished() {
        assert!(
            start.elapsed() < Duration::from_secs(5),
            "native transfer fixture deadline"
        );
        transport.poll();
        for server in &mut incoming {
            if let Some(session) = server {
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
        }
        if let Some(command) = transport.next() {
            assert_eq!(command.sid, sid);
            assert!(command.evidence.peer == phone.spki);
            command.evidence.check_live().unwrap();
            let result = receiver.execute(
                &mut store,
                &command.sid,
                &command.evidence.peer,
                command.request,
            );
            command
                .reply
                .send(result)
                .unwrap_or_else(|_| panic!("sender reply dropped"));
        }
        std::thread::sleep(Duration::from_millis(1));
    }
    let id = transport.runtime().block_on(client).unwrap();
    transport.close();
    assert_eq!(std::fs::read(restored_path).unwrap(), content);
    drop(receiver);
    drop(store);
    let mut store = directory.store(pc.spki.clone());
    let mut receiver = crate::file_receiver::Receiver::new();
    let reply = receiver
        .execute(
            &mut store,
            &sid,
            &phone.spki,
            crate::file_protocol::Request::Status { id },
        )
        .unwrap();
    match reply {
        crate::file_protocol::Response::Operation(op) => {
            assert!(op.state == OperationState::Completed)
        }
        _ => panic!("missing completed journal"),
    }
}
