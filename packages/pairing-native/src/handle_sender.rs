use super::*;
use std::sync::Arc;

impl Handle {
    pub(crate) fn transfer(
        &self,
        record: String,
        task: crate::file_sender_command::Task,
    ) -> Result<String> {
        self.transfer_at(record, task, None)
    }
    pub(crate) fn transfer_at(
        &self,
        record: String,
        task: crate::file_sender_command::Task,
        foreground_epoch: Option<u64>,
    ) -> Result<String> {
        self.transfer_guarded(record, task, foreground_epoch, None)
    }
    pub(crate) fn transfer_guarded(
        &self,
        record: String,
        task: crate::file_sender_command::Task,
        foreground_epoch: Option<u64>,
        background_active: Option<Arc<AtomicBool>>,
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
                foreground_epoch,
                background_active,
                reply,
            })
            .map_err(|_| PairingError::ConnectionClosed)?;
        receiver.recv().map_err(|_| PairingError::OutcomeUnknown)?
    }

    #[cfg(any(target_os = "ios", all(test, feature = "ios-ffi")))]
    pub(crate) fn begin_background(&self, record: &str) -> Result<String> {
        self.background.begin(record, &self.closing)
    }
    #[cfg(any(target_os = "ios", all(test, feature = "ios-ffi")))]
    pub(crate) fn end_background(&self, lease: &str) -> Result<()> {
        self.background.end(lease)
    }
    #[cfg(any(target_os = "ios", all(test, feature = "ios-ffi")))]
    pub(crate) fn background_guard(&self, record: &str, lease: &str) -> Result<Arc<AtomicBool>> {
        self.background.guard(record, lease)
    }
}
