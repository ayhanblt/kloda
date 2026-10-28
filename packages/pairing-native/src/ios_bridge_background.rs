use super::{response, text, PairingError, PairingOwner, Result, OWNERS};
use std::{ffi::c_char, sync::Arc};

fn owner(id: u64) -> Result<Arc<PairingOwner>> {
    OWNERS
        .lock()
        .map_err(|_| PairingError::OutcomeUnknown)?
        .get(&id)
        .cloned()
        .ok_or(PairingError::CandidateStale)
}

/// # Safety
/// Native BGTask callback only; record identifies `length` readable UTF-8 bytes.
/// This Files lease never activates the UI or authorizes pairing/list/restore.
#[no_mangle]
pub unsafe extern "C" fn kloda_ios_background_begin(
    id: u64,
    record: *const u8,
    length: usize,
) -> *mut c_char {
    response(|| {
        let record = unsafe { text(record, length, 22)? };
        crate::file_sender_command::validate_id(record)?;
        let lease = owner(id)?.begin_background(record)?;
        Ok(serde_json::json!({"lease":lease}))
    })
}

/// # Safety
/// Lease identifies `length` readable UTF-8 bytes. Invalidates synchronously,
/// without waiting for actor I/O; already-sent remote work may need reconciliation.
#[no_mangle]
pub unsafe extern "C" fn kloda_ios_background_end(
    id: u64,
    lease: *const u8,
    length: usize,
) -> *mut c_char {
    response(|| {
        let lease = unsafe { text(lease, length, 22)? };
        owner(id)?.end_background(lease)?;
        Ok(serde_json::Value::Null)
    })
}

/// # Safety
/// Native queue only: bounded readable record/command/lease, caller-owned verified
/// FD. Only upload/create/status/finalize are admitted, with current native trust.
#[no_mangle]
pub unsafe extern "C" fn kloda_ios_background_transfer(
    id: u64,
    record: *const u8,
    record_length: usize,
    command: *const u8,
    command_length: usize,
    descriptor: i32,
    lease: *const u8,
    lease_length: usize,
) -> *mut c_char {
    response(|| {
        let record = unsafe { text(record, record_length, 22)? };
        let command = unsafe { text(command, command_length, super::INPUT_LIMIT)? };
        let lease = unsafe { text(lease, lease_length, 22)? };
        crate::file_sender_command::validate_id(record)?;
        let reply =
            owner(id)?.transfer_background(record.to_owned(), command, descriptor, lease)?;
        serde_json::from_str(&reply).map_err(|_| PairingError::OutcomeUnknown)
    })
}
