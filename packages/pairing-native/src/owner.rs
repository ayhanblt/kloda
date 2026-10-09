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
    pub fn close(&self) -> Result<()> {
        self.invoke(Action::Close).map(|_| ())
    }
}
