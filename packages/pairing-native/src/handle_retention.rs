use super::*;
impl Handle {
    #[cfg(not(target_os = "android"))]
    pub(crate) fn backup_versions(&self, after: Option<String>, trash: bool) -> Result<String> {
        if self.closing.load(Ordering::Acquire) {
            return Err(PairingError::Cancelled);
        }
        let (reply, receiver) = mpsc::sync_channel(1);
        self.sender
            .lock()
            .map_err(|_| PairingError::OutcomeUnknown)?
            .send(Command::BackupVersions {
                after,
                trash,
                reply,
            })
            .map_err(|_| PairingError::ConnectionClosed)?;
        receiver.recv().map_err(|_| PairingError::OutcomeUnknown)?
    }
    #[cfg(not(target_os = "android"))]
    pub(crate) fn mutate_backups(&self, ids: String, restore: bool, epoch: u64) -> Result<String> {
        if self.closing.load(Ordering::Acquire) {
            return Err(PairingError::Cancelled);
        }
        let (reply, receiver) = mpsc::sync_channel(1);
        self.sender
            .lock()
            .map_err(|_| PairingError::OutcomeUnknown)?
            .send(Command::BackupMutation {
                ids,
                restore,
                epoch,
                reply,
            })
            .map_err(|_| PairingError::ConnectionClosed)?;
        receiver.recv().map_err(|_| PairingError::OutcomeUnknown)?
    }
}
