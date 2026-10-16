#[cfg(not(target_os = "android"))]
use crate::handle::OwnerRole;
use crate::{
    error::Result,
    handle::{Action, Handle, NativeContext},
    status::PairingStatus,
};
#[cfg(not(target_os = "android"))]
use std::path::PathBuf;
use zeroize::Zeroizing;

/// An owned native endpoint. No keys, signer handles or writable pin store are exposed.
pub struct PairingOwner {
    handle: Handle,
}
/// Transient observed UI state. JSON can contain an active PC QR; never persist or log it.
pub struct PairingSnapshot(PairingStatus);
impl PairingSnapshot {
    pub fn json(&self) -> Result<Zeroizing<String>> {
        self.0.json()
    }
}
impl PairingOwner {
    #[cfg(not(target_os = "android"))]
    pub fn open_pc(directory: PathBuf) -> Result<Self> {
        Self::open(NativeContext {
            directory,
            role: OwnerRole::Pc,
        })
    }
    #[cfg(not(target_os = "android"))]
    pub fn open_phone(directory: PathBuf) -> Result<Self> {
        Self::open(NativeContext {
            directory,
            role: OwnerRole::Phone,
        })
    }
    pub(crate) fn open(context: NativeContext) -> Result<Self> {
        Handle::open(context).map(|handle| Self { handle })
    }
    pub(crate) fn invoke(&self, action: Action) -> Result<PairingSnapshot> {
        self.handle.request(action).map(PairingSnapshot)
    }
    pub fn status(&self) -> Result<PairingSnapshot> {
        self.invoke(Action::Status)
    }
    pub fn create_invitation(&self) -> Result<PairingSnapshot> {
        self.invoke(Action::CreateInvitation)
    }
    pub fn scan(&self, wire: String) -> Result<PairingSnapshot> {
        self.invoke(Action::Scan(Zeroizing::new(wire)))
    }
    pub fn approve(&self, operation: String, generation: String) -> Result<PairingSnapshot> {
        self.invoke(Action::Approve {
            operation,
            generation,
        })
    }
    pub fn deny(&self, operation: String, generation: String) -> Result<PairingSnapshot> {
        self.invoke(Action::Deny {
            operation,
            generation,
        })
    }
    pub fn cancel(&self, operation: String) -> Result<PairingSnapshot> {
        self.invoke(Action::Cancel { operation })
    }
    pub fn resume(&self, record: String) -> Result<PairingSnapshot> {
        self.invoke(Action::Resume { record })
    }
    pub fn remove_pairing(&self, record: &str, online: bool) -> Result<PairingSnapshot> {
        self.invoke(Action::RemovePairing {
            record: record.to_owned(),
            online,
        })
    }
    /// Metadata-only internal mobile ABI. The descriptor remains owned by the caller.
    pub fn transfer(&self, record: String, command: &str, descriptor: i32) -> Result<String> {
        let result = crate::file_sender_command::Task::parse(command, descriptor)
            .and_then(|task| self.handle.transfer(record, task));
        match result {
            Ok(json) => Ok(json),
            Err(error) => crate::file_sender_command::json(Err(error)),
        }
    }
    #[cfg(not(target_os = "android"))]
    pub fn approve_backup(
        &self,
        record: String,
        folder: String,
        revision: Option<String>,
    ) -> Result<PairingSnapshot> {
        self.invoke(Action::ApproveBackup {
            record,
            folder,
            revision,
        })
    }
    #[cfg(not(target_os = "android"))]
    pub fn revoke_backup(&self, record: String) -> Result<PairingSnapshot> {
        self.invoke(Action::RevokeBackup { record })
    }
    pub fn close(&self) -> Result<()> {
        self.invoke(Action::Close).map(|_| ())
    }
}
