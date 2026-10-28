//! Native Swift-only phone ABI. Callers own input storage for each call; replies
//! belong to Rust and must be returned exactly once to kloda_ios_reply_free.
use crate::{
    error::{PairingError, Result},
    owner::PairingOwner,
};
use std::{
    collections::HashMap,
    ffi::{c_char, CString},
    sync::{Arc, LazyLock, Mutex},
};
use zeroize::Zeroize;

#[path = "ios_bridge_background.rs"]
mod background;
#[path = "ios_bridge_command.rs"]
mod command;
#[path = "ios_bridge_registry.rs"]
mod registry;
#[cfg(test)]
use background::*;

static OWNERS: LazyLock<Mutex<HashMap<u64, Arc<PairingOwner>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
const INPUT_LIMIT: usize = 8192;

/// # Safety
/// Non-null `bytes` must identify `length` readable bytes for this synchronous call.
unsafe fn text<'a>(bytes: *const u8, length: usize, limit: usize) -> Result<&'a str> {
    if bytes.is_null() || length == 0 || length > limit {
        return Err(PairingError::InvalidRequest);
    }
    let bytes = unsafe { std::slice::from_raw_parts(bytes, length) };
    std::str::from_utf8(bytes).map_err(|_| PairingError::InvalidRequest)
}

fn response(action: impl FnOnce() -> Result<serde_json::Value>) -> *mut c_char {
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(action))
        .unwrap_or(Err(PairingError::OutcomeUnknown));
    let value = match result {
        Ok(value) => serde_json::json!({"ok":true,"value":value}),
        Err(error) => serde_json::json!({"ok":false,"errorCode":error.code()}),
    };
    // Serialized JSON escapes all interior NULs; never log this transient native reply.
    CString::new(value.to_string())
        .expect("serialized JSON contains no NUL")
        .into_raw()
}

/// # Safety
/// Input is a native Swift-resolved absolute application-data path, never a JS argument.
/// The pointer must remain readable for `length` bytes until this call returns.
#[no_mangle]
pub unsafe extern "C" fn kloda_ios_open(bytes: *const u8, length: usize) -> *mut c_char {
    response(|| {
        let path = unsafe { text(bytes, length, 4096)? };
        let path = std::path::PathBuf::from(path);
        if !path.is_absolute()
            || path.as_os_str().is_empty()
            || path.to_string_lossy().contains('\0')
        {
            return Err(PairingError::InvalidRequest);
        }
        registry::open(path)
    })
}

/// # Safety
/// `bytes` identifies `length` readable UTF-8 JSON bytes; this ABI accepts phone controls only.
#[no_mangle]
pub unsafe extern "C" fn kloda_ios_request(
    owner: u64,
    bytes: *const u8,
    length: usize,
    expected_epoch: u64,
) -> *mut c_char {
    response(|| {
        let raw = unsafe { text(bytes, length, INPUT_LIMIT)? };
        let command: command::PhoneCommand =
            serde_json::from_str(raw).map_err(|_| PairingError::InvalidRequest)?;
        registry::request(owner, command, expected_epoch)
    })
}

/// Invalidates queued foreground tickets synchronously; it does not wait for actor I/O.
#[no_mangle]
pub extern "C" fn kloda_ios_suspend(owner: u64) -> *mut c_char {
    response(|| registry::suspend(owner))
}

/// Native lifecycle only. Swift must derive activation from actual visible UI.
#[no_mangle]
pub extern "C" fn kloda_ios_set_foreground(owner: u64, active: u8) -> *mut c_char {
    response(|| match active {
        0 | 1 => registry::set_foreground(owner, active == 1),
        _ => Err(PairingError::InvalidRequest),
    })
}

/// # Safety
/// Inputs must remain readable for their bounded lengths. The caller retains the
/// verified native descriptor; Rust duplicates it for the existing sender task.
/// Swift's native queue must enforce current foreground state; never expose this to JS.
#[no_mangle]
pub unsafe extern "C" fn kloda_ios_transfer(
    owner: u64,
    record: *const u8,
    record_length: usize,
    command: *const u8,
    command_length: usize,
    descriptor: i32,
    expected_epoch: u64,
) -> *mut c_char {
    response(|| {
        let record = unsafe { text(record, record_length, 22)? };
        let command = unsafe { text(command, command_length, INPUT_LIMIT)? };
        registry::transfer(owner, record, command, descriptor, expected_epoch)
    })
}

/// # Safety
/// Reply must be null or the exact, not-yet-freed pointer returned by this ABI.
#[no_mangle]
pub unsafe extern "C" fn kloda_ios_reply_free(reply: *mut c_char) {
    if !reply.is_null() {
        let mut bytes = unsafe { CString::from_raw(reply) }.into_bytes_with_nul();
        bytes.zeroize();
    }
}

#[cfg(test)]
#[path = "ios_bridge_tests.rs"]
mod tests;
