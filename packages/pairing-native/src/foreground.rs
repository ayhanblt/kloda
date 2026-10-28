use crate::error::{PairingError, Result};
use std::sync::{Mutex, MutexGuard};

/// Orders UI suspension against durable trust/grant authorization.
#[derive(Default)]
pub(crate) struct Foreground(Mutex<State>);
pub(crate) struct State {
    epoch: u64,
    active: bool,
}
impl Default for State {
    fn default() -> Self {
        Self {
            epoch: 0,
            active: !cfg!(any(target_os = "android", target_os = "ios")),
        }
    }
}
impl Foreground {
    pub(crate) fn capture(&self) -> Result<u64> {
        let state = self.0.lock().map_err(|_| PairingError::OutcomeUnknown)?;
        if !state.active {
            return Err(PairingError::CandidateStale);
        }
        Ok(state.epoch)
    }
    pub(crate) fn invalidate(&self) -> Result<()> {
        let mut state = self.0.lock().map_err(|_| PairingError::OutcomeUnknown)?;
        state.epoch = state
            .epoch
            .checked_add(1)
            .ok_or(PairingError::OutcomeUnknown)?;
        Ok(())
    }
    #[cfg(any(target_os = "android", target_os = "ios", test))]
    pub(crate) fn set_active(&self, active: bool) -> Result<()> {
        let mut state = self.0.lock().map_err(|_| PairingError::OutcomeUnknown)?;
        if !active || state.active != active {
            state.active = false;
            state.epoch = state
                .epoch
                .checked_add(1)
                .ok_or(PairingError::OutcomeUnknown)?;
        }
        state.active = active;
        Ok(())
    }
    pub(crate) fn check_transfer(&self, expected: Option<u64>) -> Result<()> {
        if let Some(epoch) = expected {
            drop(self.authorize(Some(epoch))?);
        }
        Ok(())
    }
    pub(crate) fn check_transfer_cancel(
        &self,
        expected: Option<u64>,
        active: Option<&std::sync::atomic::AtomicBool>,
    ) -> Result<()> {
        if active.is_some_and(|active| !active.load(std::sync::atomic::Ordering::Acquire)) {
            return Err(PairingError::Cancelled);
        }
        self.check_transfer(expected)
    }
    pub(crate) fn authorize(&self, expected: Option<u64>) -> Result<MutexGuard<'_, State>> {
        let state = self.0.lock().map_err(|_| PairingError::OutcomeUnknown)?;
        if !state.active || expected.is_some_and(|expected| expected != state.epoch) {
            return Err(PairingError::CandidateStale);
        }
        Ok(state)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::test_support::{key, Directory};

    #[test]
    fn delayed_foreground_tasks_cannot_authorize_after_synchronous_suspend() {
        let foreground = std::sync::Arc::new(Foreground::default());
        foreground.set_active(true).unwrap();
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
        foreground.set_active(true).unwrap();
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
    #[test]
    fn optional_file_epoch_preserves_background_and_fences_stale_ui() {
        let state = Foreground::default();
        state.set_active(false).unwrap();
        assert!(state.check_transfer(None).is_ok());
        assert!(state.check_transfer(Some(0)).is_err());
        state.set_active(true).unwrap();
        let epoch = state.capture().unwrap();
        assert!(state.check_transfer(Some(epoch)).is_ok());
        state.set_active(false).unwrap();
        state.set_active(true).unwrap();
        assert!(state.check_transfer(Some(epoch)).is_err());
        assert!(state.check_transfer(None).is_ok());
    }
}

#[cfg(test)]
#[path = "foreground_phone_tests.rs"]
mod phone_tests;
