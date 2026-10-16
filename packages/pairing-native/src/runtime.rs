use crate::error::{PairingError, Result};
use crate::handle::{Action, Command, NativeContext, OwnerRole};
use crate::initialization::Installation;
use crate::pc::Pc;
use crate::phone::Phone;
use crate::qr::{LanHint, QrPayload};
use crate::route::Route;
use crate::state::Phase;
use crate::status::PairingStatus;
use crate::store_rows::Record;
use crate::tls::{Channel, Session};
use std::net::TcpListener;
use std::sync::mpsc::{Receiver, RecvTimeoutError, SyncSender, TryRecvError};
use std::time::Duration;

#[path = "runtime_actions.rs"]
mod actions;
#[path = "runtime_actor.rs"]
mod actor;
#[cfg(not(target_os = "android"))]
#[path = "runtime_backup.rs"]
mod backup;
#[path = "runtime_file.rs"]
mod file;
#[path = "runtime_phone.rs"]
mod phone;
#[path = "runtime_phone_progress.rs"]
mod phone_progress;
#[path = "runtime_progress.rs"]
mod progress;
#[path = "runtime_sender.rs"]
mod sender;
#[path = "runtime_session.rs"]
mod session;
#[path = "runtime_status.rs"]
mod status;

const MAX_PEERS: usize = 16;
const COMMAND_BATCH: usize = 32;

struct Listener {
    route: Route,
    socket: TcpListener,
    hint: LanHint,
}
struct Actor {
    context: NativeContext,
    installation: Installation,
    listener: Option<Listener>,
    pc: Option<Pc>,
    peers: Vec<PcPeer>,
    cursor: usize,
    phone: Option<PhoneWork>,
    retained: Option<Record>,
    terminal: Option<([u8; 16], Phase)>,
    generation: u64,
    last_now: u64,
    error: Option<PairingError>,
    fatal: Option<PairingError>,
    file_transport: crate::file_transport::Managed,
    file_sender: Option<(Route, crate::file_sender::Channel)>,
    #[cfg(not(target_os = "android"))]
    file_receiver: crate::file_receiver::Receiver,
    unpair_result: Option<crate::status::UnpairResult>,
}
struct PcPeer {
    io: Io,
    recovery: Option<Pc>,
}
struct Io {
    tls: Session,
    channel: Option<Channel>,
    sid: Option<[u8; 16]>,
    pump_next: bool,
    handshake_deadline: u64,
    handshake_observed: bool,
    ack_seen: bool,
    outgoing: Option<Outbound>,
    inflight: Option<Sent>,
}
struct Outbound {
    frame: crate::frame::Frame,
    sent: Sent,
}
#[derive(Clone, Copy)]
struct Sent {
    kind: SentKind,
    advances: bool,
}
#[derive(Clone, Copy)]
enum SentKind {
    Commit,
    Complete,
    Request,
    Ack,
}
enum PhoneSource {
    Scan(QrPayload),
    Resume,
}
struct PhoneWork {
    sid: [u8; 16],
    hint: LanHint,
    expected: [u8; 32],
    source: Option<PhoneSource>,
    route: Option<Route>,
    io: Option<Io>,
    engine: Option<Phone>,
    repair: Option<[u8; 16]>,
    approval_wait: bool,
    initial: bool,
    commit_seen: bool,
    complete_seen: bool,
}

/// A single serialization domain owns SQLite, secret buffers, sockets and hardware callbacks.
/// The bridge bounds the command queue to 32; sessions are capped at 16, each retaining at
/// most one application frame plus TLS's bounded buffers. No network/signing task outlives
/// this worker. A blocking hardware callback delays cancellation, never completes it early.
pub(crate) fn run(
    context: NativeContext,
    receiver: Receiver<Command>,
    ready: SyncSender<Result<()>>,
) {
    // Declared before the actor so panic unwinding drops every TLS/hardware owner
    // before the last JNI reference performs platform cleanup.
    #[cfg(target_os = "android")]
    let platform = context.platform.clone();
    let mut owner = match Actor::open(context) {
        Ok(owner) => owner,
        Err(error) => {
            #[cfg(target_os = "android")]
            let error = platform.close().err().unwrap_or(error);
            let _ = ready.send(Err(error));
            return;
        }
    };
    if ready.send(Ok(())).is_err() {
        owner.shutdown();
        drop(owner);
        #[cfg(target_os = "android")]
        let _ = platform.close();
        return;
    }
    let mut pending = None;
    let close_reply = 'worker: loop {
        let mut drained = 0;
        while drained < COMMAND_BATCH {
            let command = match pending.take() {
                Some(command) => command,
                None => match receiver.try_recv() {
                    Ok(command) => command,
                    Err(TryRecvError::Empty) => break,
                    Err(TryRecvError::Disconnected) => break 'worker None,
                },
            };
            match command {
                Command::Pairing {
                    action: Action::Close,
                    reply,
                } => break 'worker Some(reply),
                Command::Pairing { action, reply } => {
                    let _ = reply.send(owner.action(action));
                }
                Command::Transfer {
                    record,
                    task,
                    reply,
                } => {
                    let result = owner.transfer(&record, task);
                    let _ = reply.send(crate::file_sender_command::json(result));
                }
            }
            drained += 1;
        }
        // Commands ordered behind consume authorization get a chance to revoke before
        // its queued COMMIT reaches the writer. Saturation never bypasses a queued cancel.
        if drained == COMMAND_BATCH {
            continue;
        }
        owner.tick();
        match receiver.recv_timeout(owner.wait_duration()) {
            Ok(command) => pending = Some(command),
            Err(RecvTimeoutError::Timeout) => (),
            Err(RecvTimeoutError::Disconnected) => break None,
        }
    };
    owner.shutdown();
    drop(owner); // Includes all sockets, transient secrets, native key handles and SQLite.
    #[cfg(target_os = "android")]
    let closed = platform.close().map(|()| PairingStatus::default());
    #[cfg(not(target_os = "android"))]
    let closed = Ok(PairingStatus::default());
    if let Some(reply) = close_reply {
        let _ = reply.send(closed);
    }
}
