use crate::error::{PairingError, Result};
use ring::rand::{SecureRandom, SystemRandom};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use zeroize::Zeroize;

/// One native BGTask callback owns one cancellable Files-only admission.
#[derive(Default)]
pub(crate) struct Leases(Mutex<Option<Lease>>);
struct Lease {
    id: [u8; 16],
    record: [u8; 16],
    active: Arc<AtomicBool>,
}
impl Drop for Lease {
    fn drop(&mut self) {
        self.active.store(false, Ordering::Release);
        self.id.zeroize();
    }
}
impl Leases {
    pub(crate) fn begin(&self, record: &str, closing: &AtomicBool) -> Result<String> {
        let record = reference(record)?;
        let mut saved = self.0.lock().map_err(|_| PairingError::OutcomeUnknown)?;
        if closing.load(Ordering::Acquire) || saved.is_some() {
            return Err(PairingError::CandidateStale);
        }
        let mut id = [0; 16];
        SystemRandom::new()
            .fill(&mut id)
            .map_err(|_| PairingError::NativeUnsupported)?;
        let encoded = crate::qr_base64::encode(&id);
        *saved = Some(Lease {
            id,
            record,
            active: Arc::new(AtomicBool::new(true)),
        });
        Ok(encoded)
    }

    pub(crate) fn guard(&self, record: &str, id: &str) -> Result<Arc<AtomicBool>> {
        let record = reference(record)?;
        let id = reference(id)?;
        let saved = self.0.lock().map_err(|_| PairingError::OutcomeUnknown)?;
        saved
            .as_ref()
            .filter(|lease| lease.id == id && lease.record == record)
            .filter(|lease| lease.active.load(Ordering::Acquire))
            .map(|lease| lease.active.clone())
            .ok_or(PairingError::CandidateStale)
    }

    pub(crate) fn end(&self, id: &str) -> Result<()> {
        let id = reference(id)?;
        let mut saved = self.0.lock().map_err(|_| PairingError::OutcomeUnknown)?;
        if !saved.as_ref().is_some_and(|lease| lease.id == id) {
            return Err(PairingError::CandidateStale);
        }
        *saved = None;
        Ok(())
    }

    pub(crate) fn cancel_all(&self) -> Result<()> {
        match self.0.lock() {
            Ok(mut saved) => {
                *saved = None;
                Ok(())
            }
            Err(poisoned) => {
                *poisoned.into_inner() = None;
                Err(PairingError::OutcomeUnknown)
            }
        }
    }
}

fn reference(text: &str) -> Result<[u8; 16]> {
    crate::qr_base64::fixed(text).map_err(|_| PairingError::InvalidRequest)
}

#[cfg(test)]
#[path = "ios_background_tests.rs"]
mod tests;
