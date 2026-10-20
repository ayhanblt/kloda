use crate::error::{PairingError, Result};
use crate::status::PairingStatus;
use std::path::PathBuf;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    mpsc::{self, Receiver, SyncSender},
    Mutex,
};
use std::thread::{self, JoinHandle};
use zeroize::Zeroizing;

#[derive(Clone, Copy, Eq, PartialEq)]
pub(crate) enum OwnerRole {
    #[cfg(not(target_os = "android"))]
    Pc,
    Phone,
}
pub(crate) struct NativeContext {
    pub(crate) directory: PathBuf,
    pub(crate) role: OwnerRole,
    #[cfg(target_os = "android")]
    pub(crate) platform: crate::android_context::AndroidContext,
}
pub(crate) enum Action {
    #[cfg(not(target_os = "android"))]
    Foreground {
        epoch: u64,
        action: Box<Action>,
    },
    Status,
    #[cfg(not(target_os = "android"))]
    SuspendPairing,
    CreateInvitation,
    Scan(Zeroizing<String>),
    Approve {
        operation: String,
        generation: String,
    },
    Deny {
        operation: String,
        generation: String,
    },
    Cancel {
        operation: String,
    },
    Resume {
        record: String,
    },
    RemovePairing {
        record: String,
        online: bool,
    },
    #[cfg(not(target_os = "android"))]
    ApproveBackup {
        record: String,
        folder: String,
        revision: Option<String>,
    },
    #[cfg(not(target_os = "android"))]
    RevokeBackup {
        record: String,
    },
    #[cfg(not(target_os = "android"))]
    RemoveDevice {
        record: String,
    },
    Close,
}
pub(crate) enum Command {
    #[cfg(not(target_os = "android"))]
    BackupVersions {
        after: Option<String>,
        trash: bool,
        reply: SyncSender<Result<String>>,
    },
    #[cfg(not(target_os = "android"))]
    BackupMutation {
        ids: String,
        restore: bool,
        epoch: u64,
        reply: SyncSender<Result<String>>,
    },
    #[cfg(not(target_os = "android"))]
    PairedDevice {
        record: String,
        reply: SyncSender<Result<crate::paired_devices::Device>>,
    },
    #[cfg(not(target_os = "android"))]
    PairedDevices {
        after: Option<String>,
        reply: SyncSender<Result<crate::paired_devices::Devices>>,
    },
    #[cfg(not(target_os = "android"))]
    ReceiverActivity {
        after: Option<String>,
        reply: SyncSender<Result<crate::receiver_activity::Activity>>,
    },
    #[cfg(not(target_os = "android"))]
    ReceiverStatus {
        reply: SyncSender<Result<crate::status::ReceiverStatus>>,
    },
    Pairing {
        action: Action,
        reply: SyncSender<Result<PairingStatus>>,
    },
    Transfer {
        record: String,
        task: crate::file_sender_command::Task,
        reply: SyncSender<Result<String>>,
    },
}
pub(crate) struct Handle {
    sender: Mutex<SyncSender<Command>>,
    worker: Mutex<Option<JoinHandle<()>>>,
    closing: AtomicBool,
    #[cfg(not(target_os = "android"))]
    pub(crate) foreground: std::sync::Arc<crate::foreground::Foreground>,
}
impl Handle {
    pub(crate) fn open(context: NativeContext) -> Result<Self> {
        let (sender, receiver): (SyncSender<Command>, Receiver<Command>) = mpsc::sync_channel(32);
        let (ready, ready_receiver) = mpsc::sync_channel(1);
        #[cfg(not(target_os = "android"))]
        let foreground = std::sync::Arc::new(crate::foreground::Foreground::default());
        #[cfg(not(target_os = "android"))]
        let worker_foreground = foreground.clone();
        let worker = thread::Builder::new()
            .name("kloda-pairing".into())
            .spawn(move || {
                crate::runtime::run(
                    context,
                    receiver,
                    ready,
                    #[cfg(not(target_os = "android"))]
                    worker_foreground,
                )
            })
            .map_err(|_| PairingError::NativeUnsupported)?;
        match ready_receiver.recv() {
            Ok(Ok(())) => Ok(Self {
                sender: Mutex::new(sender),
                worker: Mutex::new(Some(worker)),
                closing: AtomicBool::new(false),
                #[cfg(not(target_os = "android"))]
                foreground,
            }),
            failed => {
                let joined = worker.join();
                #[cfg(target_os = "windows")]
                crate::route::cleanup_check()?;
                match failed {
                    Ok(Err(error)) if joined.is_ok() => Err(error),
                    _ => Err(PairingError::OutcomeUnknown),
                }
            }
        }
    }
    pub(crate) fn request(&self, action: Action) -> Result<PairingStatus> {
        if matches!(action, Action::Close) {
            return self.close();
        }
        if self.closing.load(Ordering::Acquire) {
            return Err(PairingError::Cancelled);
        }
        self.enqueue(action)
    }
    fn enqueue(&self, action: Action) -> Result<PairingStatus> {
        let (reply, receiver) = mpsc::sync_channel(1);
        self.sender
            .lock()
            .map_err(|_| PairingError::OutcomeUnknown)?
            .send(Command::Pairing { action, reply })
            .map_err(|_| PairingError::ConnectionClosed)?;
        receiver.recv().map_err(|_| PairingError::OutcomeUnknown)?
    }
    #[cfg(not(target_os = "android"))]
    pub(crate) fn receiver_status(&self) -> Result<crate::status::ReceiverStatus> {
        if self.closing.load(Ordering::Acquire) {
            return Err(PairingError::Cancelled);
        }
        let (reply, receiver) = mpsc::sync_channel(1);
        self.sender
            .lock()
            .map_err(|_| PairingError::OutcomeUnknown)?
            .send(Command::ReceiverStatus { reply })
            .map_err(|_| PairingError::ConnectionClosed)?;
        receiver.recv().map_err(|_| PairingError::OutcomeUnknown)?
    }
    #[cfg(not(target_os = "android"))]
    pub(crate) fn receiver_activity(
        &self,
        after: Option<String>,
    ) -> Result<crate::receiver_activity::Activity> {
        if self.closing.load(Ordering::Acquire) {
            return Err(PairingError::Cancelled);
        }
        let (reply, receiver) = mpsc::sync_channel(1);
        self.sender
            .lock()
            .map_err(|_| PairingError::OutcomeUnknown)?
            .send(Command::ReceiverActivity { after, reply })
            .map_err(|_| PairingError::ConnectionClosed)?;
        receiver.recv().map_err(|_| PairingError::OutcomeUnknown)?
    }
    #[cfg(not(target_os = "android"))]
    pub(crate) fn paired_devices(
        &self,
        after: Option<String>,
    ) -> Result<crate::paired_devices::Devices> {
        if self.closing.load(Ordering::Acquire) {
            return Err(PairingError::Cancelled);
        }
        let (reply, receiver) = mpsc::sync_channel(1);
        self.sender
            .lock()
            .map_err(|_| PairingError::OutcomeUnknown)?
            .send(Command::PairedDevices { after, reply })
            .map_err(|_| PairingError::ConnectionClosed)?;
        receiver.recv().map_err(|_| PairingError::OutcomeUnknown)?
    }
    #[cfg(not(target_os = "android"))]
    pub(crate) fn paired_device(&self, record: String) -> Result<crate::paired_devices::Device> {
        if self.closing.load(Ordering::Acquire) {
            return Err(PairingError::Cancelled);
        }
        let (reply, receiver) = mpsc::sync_channel(1);
        self.sender
            .lock()
            .map_err(|_| PairingError::OutcomeUnknown)?
            .send(Command::PairedDevice { record, reply })
            .map_err(|_| PairingError::ConnectionClosed)?;
        receiver.recv().map_err(|_| PairingError::OutcomeUnknown)?
    }
    pub(crate) fn transfer(
        &self,
        record: String,
        task: crate::file_sender_command::Task,
    ) -> Result<String> {
        if self.closing.load(Ordering::Acquire) {
            return Err(PairingError::Cancelled);
        }
        let (reply, receiver) = mpsc::sync_channel(1);
        self.sender
            .lock()
            .map_err(|_| PairingError::OutcomeUnknown)?
            .send(Command::Transfer {
                record,
                task,
                reply,
            })
            .map_err(|_| PairingError::ConnectionClosed)?;
        receiver.recv().map_err(|_| PairingError::OutcomeUnknown)?
    }
    fn close(&self) -> Result<PairingStatus> {
        // The join lock spans close and join: concurrent close cannot resolve early.
        let mut worker = self
            .worker
            .lock()
            .map_err(|_| PairingError::OutcomeUnknown)?;
        let Some(join) = worker.take() else {
            #[cfg(target_os = "windows")]
            crate::route::cleanup_check()?;
            return Ok(PairingStatus::default());
        };
        self.closing.store(true, Ordering::Release);
        let result = self.enqueue(Action::Close);
        if join.join().is_err() {
            return Err(PairingError::OutcomeUnknown);
        }
        #[cfg(target_os = "windows")]
        crate::route::cleanup_check()?;
        result
    }
}
impl Drop for Handle {
    fn drop(&mut self) {
        let _ = self.close();
    }
}

#[cfg(not(target_os = "android"))]
#[path = "handle_retention.rs"]
mod retention;
