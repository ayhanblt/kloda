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
    pub(crate) fn foreground_action(&self, action: Action) -> Result<Action> {
        Ok(Action::Foreground {
            epoch: self.handle.foreground.capture()?,
            action: Box::new(action),
        })
    }
    #[cfg(any(target_os = "ios", all(test, feature = "ios-ffi")))]
    pub(crate) fn foreground_epoch(&self) -> Result<u64> {
        self.handle.foreground.capture()
    }
    #[cfg(any(target_os = "ios", all(test, feature = "ios-ffi")))]
    pub(crate) fn foreground_action_at(&self, action: Action, expected: u64) -> Result<Action> {
        let captured = self.foreground_action(action)?;
        if !matches!(&captured, Action::Foreground { epoch, .. } if *epoch == expected) {
            return Err(crate::error::PairingError::CandidateStale);
        }
        Ok(captured)
    }
    #[cfg(any(
        target_os = "android",
        target_os = "ios",
        all(test, feature = "ios-ffi")
    ))]
    pub(crate) fn set_foreground(&self, active: bool) -> Result<()> {
        self.handle.foreground.set_active(active)
    }
    #[cfg(not(target_os = "android"))]
    pub(crate) fn suspend_foreground(&self) -> Result<()> {
        self.handle.foreground.invalidate()
    }
    fn invoke_visible(&self, action: Action) -> Result<PairingSnapshot> {
        #[cfg(not(target_os = "android"))]
        let action = self.foreground_action(action)?;
        self.invoke(action)
    }
    pub fn status(&self) -> Result<PairingSnapshot> {
        self.invoke(Action::Status)
    }
    #[cfg(not(target_os = "android"))]
    pub fn suspend_pairing(&self) -> Result<PairingSnapshot> {
        self.suspend_foreground()?;
        self.invoke(Action::SuspendPairing)
    }
    #[cfg(not(target_os = "android"))]
    pub fn receiver_status(&self) -> Result<String> {
        serde_json::to_string(&self.handle.receiver_status()?)
            .map_err(|_| crate::error::PairingError::OutcomeUnknown)
    }
    #[cfg(not(target_os = "android"))]
    pub fn receiver_activity(&self, after: Option<String>) -> Result<String> {
        serde_json::to_string(&self.handle.receiver_activity(after)?)
            .map_err(|_| crate::error::PairingError::OutcomeUnknown)
    }
    #[cfg(not(target_os = "android"))]
    pub fn paired_devices(&self, after: Option<String>) -> Result<String> {
        serde_json::to_string(&self.handle.paired_devices(after)?)
            .map_err(|_| crate::error::PairingError::OutcomeUnknown)
    }
    #[cfg(not(target_os = "android"))]
    pub fn paired_device(&self, record: String) -> Result<String> {
        serde_json::to_string(&self.handle.paired_device(record)?)
            .map_err(|_| crate::error::PairingError::OutcomeUnknown)
    }
    #[cfg(not(target_os = "android"))]
    pub fn backup_versions(&self, after: Option<String>, trash: bool) -> Result<String> {
        self.handle.backup_versions(after, trash)
    }
    #[cfg(not(target_os = "android"))]
    pub(crate) fn backup_epoch(&self) -> Result<u64> {
        self.handle.foreground.capture()
    }
    #[cfg(not(target_os = "android"))]
    pub(crate) fn mutate_backups(&self, ids: String, restore: bool, epoch: u64) -> Result<String> {
        self.handle.mutate_backups(ids, restore, epoch)
    }
    #[cfg(not(target_os = "android"))]
    pub fn trash_backups(&self, ids: String) -> Result<String> {
        self.mutate_backups(ids, false, self.backup_epoch()?)
    }
    #[cfg(not(target_os = "android"))]
    pub fn restore_backups(&self, ids: String) -> Result<String> {
        self.mutate_backups(ids, true, self.backup_epoch()?)
    }
    pub fn create_invitation(&self) -> Result<PairingSnapshot> {
        self.invoke_visible(Action::CreateInvitation)
    }
    pub fn scan(&self, wire: String) -> Result<PairingSnapshot> {
        self.invoke(Action::Scan(Zeroizing::new(wire)))
    }
    pub fn approve(&self, operation: String, generation: String) -> Result<PairingSnapshot> {
        self.invoke_visible(Action::Approve {
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
        self.invoke_visible(Action::Resume { record })
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
    #[cfg(any(target_os = "ios", all(test, feature = "ios-ffi")))]
    pub(crate) fn transfer_foreground(
        &self,
        record: String,
        command: &str,
        descriptor: i32,
        epoch: u64,
    ) -> Result<String> {
        drop(self.handle.foreground.authorize(Some(epoch))?);
        let task = crate::file_sender_command::Task::parse(command, descriptor)?;
        self.handle.transfer_at(record, task, Some(epoch))
    }
    #[cfg(any(target_os = "ios", all(test, feature = "ios-ffi")))]
    pub(crate) fn begin_background(&self, record: &str) -> Result<String> {
        self.handle.begin_background(record)
    }
    #[cfg(any(target_os = "ios", all(test, feature = "ios-ffi")))]
    pub(crate) fn end_background(&self, lease: &str) -> Result<()> {
        self.handle.end_background(lease)
    }
    #[cfg(any(target_os = "ios", all(test, feature = "ios-ffi")))]
    pub(crate) fn transfer_background(
        &self,
        record: String,
        command: &str,
        descriptor: i32,
        lease: &str,
    ) -> Result<String> {
        let active = self.handle.background_guard(&record, lease)?;
        self.handle
            .foreground
            .check_transfer_cancel(None, Some(&active))?;
        let task = crate::file_sender_command::Task::parse_background(command, descriptor)?;
        self.handle
            .transfer_guarded(record, task, None, Some(active))
    }
    #[cfg(not(target_os = "android"))]
    pub fn approve_backup(
        &self,
        record: String,
        folder: String,
        revision: Option<String>,
    ) -> Result<PairingSnapshot> {
        self.invoke_visible(Action::ApproveBackup {
            record,
            folder,
            revision,
        })
    }
    #[cfg(not(target_os = "android"))]
    pub fn revoke_backup(&self, record: String) -> Result<PairingSnapshot> {
        self.invoke_visible(Action::RevokeBackup { record })
    }
    #[cfg(not(target_os = "android"))]
    pub fn remove_device(&self, record: String) -> Result<PairingSnapshot> {
        self.invoke_visible(Action::RemoveDevice { record })
    }
    pub fn close(&self) -> Result<()> {
        self.invoke(Action::Close).map(|_| ())
    }
}
