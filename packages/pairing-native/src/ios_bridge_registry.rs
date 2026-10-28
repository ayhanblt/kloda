use super::{command::PhoneCommand, PairingError, Result, OWNERS};
use crate::handle::Action;
#[cfg(target_os = "ios")]
use crate::PairingOwner;
use std::path::PathBuf;
#[cfg(target_os = "ios")]
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc,
};

#[cfg(target_os = "ios")]
static NEXT: AtomicU64 = AtomicU64::new(1);

pub(super) fn open(path: PathBuf) -> Result<serde_json::Value> {
    // Host ABI tests must never open a real Mac authority or hardware key.
    #[cfg(not(target_os = "ios"))]
    {
        let _ = path;
        Err(PairingError::NativeUnsupported)
    }
    #[cfg(target_os = "ios")]
    {
        let owner = Arc::new(PairingOwner::open_phone(path)?);
        let id = allocate_id()?;
        OWNERS
            .lock()
            .map_err(|_| PairingError::OutcomeUnknown)?
            .insert(id, owner);
        Ok(serde_json::json!({"owner":id.to_string()}))
    }
}

pub(super) fn request(
    id: u64,
    command: PhoneCommand,
    expected_epoch: u64,
) -> Result<serde_json::Value> {
    let owner = OWNERS
        .lock()
        .map_err(|_| PairingError::OutcomeUnknown)?
        .get(&id)
        .cloned()
        .ok_or(PairingError::CandidateStale)?;
    let action = command.action()?;
    if matches!(action, Action::Close) {
        owner.close()?;
        OWNERS
            .lock()
            .map_err(|_| PairingError::OutcomeUnknown)?
            .remove(&id);
        return Ok(serde_json::Value::Null);
    }
    // Never reauthorize stale Swift work with a newer UI incarnation's native epoch.
    let action = match action {
        Action::Scan(_)
        | Action::Approve { .. }
        | Action::Resume { .. }
        | Action::RemovePairing { .. } => owner.foreground_action_at(action, expected_epoch)?,
        other => other,
    };
    let status = owner.invoke(action)?.json()?;
    serde_json::from_str(status.as_str()).map_err(|_| PairingError::OutcomeUnknown)
}

#[cfg(target_os = "ios")]
fn allocate_id() -> Result<u64> {
    let mut id = NEXT.load(Ordering::Acquire);
    loop {
        let next = id.checked_add(1).ok_or(PairingError::NativeUnsupported)?;
        match NEXT.compare_exchange_weak(id, next, Ordering::AcqRel, Ordering::Acquire) {
            Ok(_) => return Ok(id),
            Err(current) => id = current,
        }
    }
}

pub(super) fn suspend(id: u64) -> Result<serde_json::Value> {
    set_foreground(id, false)
}

pub(super) fn set_foreground(id: u64, active: bool) -> Result<serde_json::Value> {
    let owner = OWNERS
        .lock()
        .map_err(|_| PairingError::OutcomeUnknown)?
        .get(&id)
        .cloned()
        .ok_or(PairingError::CandidateStale)?;
    owner.set_foreground(active)?;
    if active {
        Ok(serde_json::json!({"epoch": owner.foreground_epoch()?.to_string()}))
    } else {
        Ok(serde_json::Value::Null)
    }
}

pub(super) fn transfer(
    id: u64,
    record: &str,
    command: &str,
    descriptor: i32,
    expected_epoch: u64,
) -> Result<serde_json::Value> {
    crate::file_sender_command::validate_id(record)?;
    let owner = OWNERS
        .lock()
        .map_err(|_| PairingError::OutcomeUnknown)?
        .get(&id)
        .cloned()
        .ok_or(PairingError::CandidateStale)?;
    let reply =
        owner.transfer_foreground(record.to_owned(), command, descriptor, expected_epoch)?;
    serde_json::from_str(&reply).map_err(|_| PairingError::OutcomeUnknown)
}
