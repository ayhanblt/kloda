use crate::error::{PairingError, Result};
use std::sync::{Mutex, MutexGuard};

/// Orders Desktop UI suspension against durable trust/grant authorization.
#[derive(Default)]
pub(crate) struct Foreground(Mutex<u64>);
impl Foreground {
    pub(crate) fn capture(&self) -> Result<u64> {
        self.0
            .lock()
            .map(|epoch| *epoch)
            .map_err(|_| PairingError::OutcomeUnknown)
    }
    pub(crate) fn invalidate(&self) -> Result<()> {
        let mut epoch = self.0.lock().map_err(|_| PairingError::OutcomeUnknown)?;
        *epoch = epoch.checked_add(1).ok_or(PairingError::OutcomeUnknown)?;
        Ok(())
    }
    pub(crate) fn authorize(&self, expected: Option<u64>) -> Result<MutexGuard<'_, u64>> {
        let epoch = self.0.lock().map_err(|_| PairingError::OutcomeUnknown)?;
        if expected.is_some_and(|expected| expected != *epoch) {
            return Err(PairingError::CandidateStale);
        }
        Ok(epoch)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::test_support::{key, Directory};

    #[test]
    fn delayed_foreground_tasks_cannot_authorize_after_synchronous_suspend() {
        let foreground = std::sync::Arc::new(Foreground::default());
        let old_epoch = foreground.capture().unwrap();
        let (start, delayed) = std::sync::mpsc::channel();
        let worker_foreground = foreground.clone();
        let worker = std::thread::spawn(move || {
            delayed.recv().unwrap();
            // Same fence used for delayed create, QR approval and backup approval.
            for _ in 0..3 {
                assert!(matches!(
                    worker_foreground.authorize(Some(old_epoch)),
                    Err(PairingError::CandidateStale)
                ));
            }
        });
        foreground.invalidate().unwrap();
        start.send(()).unwrap();
        worker.join().unwrap();
        let current = foreground.capture().unwrap();
        assert!(foreground.authorize(Some(current)).is_ok());
    }

    #[test]
    fn suspend_during_folder_validation_cannot_commit_backup_grant() {
        let foreground = Foreground::default();
        let epoch = foreground.capture().unwrap();
        let directory = Directory::new();
        let mut store = directory.store(key("pc"));
        let sid = [1; 16];
        store.pc_consume(&sid, &key("phone"), None).unwrap();
        store.pc_complete(&sid, &key("phone")).unwrap();
        let folder = directory.path().join("media");
        std::fs::create_dir(&folder).unwrap();
        let result = store.approve_backup_guarded(&sid, folder.to_str().unwrap(), None, || {
            foreground.invalidate()?;
            foreground.authorize(Some(epoch))
        });
        assert_eq!(result, Err(PairingError::CandidateStale));
        assert!(store.backup_scope(&sid).unwrap().is_none());
        let current = foreground.capture().unwrap();
        store
            .approve_backup_guarded(&sid, folder.to_str().unwrap(), None, || {
                foreground.authorize(Some(current))
            })
            .unwrap();
        assert!(store.backup_scope(&sid).unwrap().unwrap().approved);
    }
}
