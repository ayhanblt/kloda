use crate::error::{PairingError, Result};
use crate::startup_diagnostics::{self as diagnostic, Operation, Stage};
use std::{
    fs::{self, File},
    io::Write,
    os::windows::io::AsRawHandle,
    path::Path,
};
use windows_sys::Win32::{
    Foundation::{GENERIC_READ, GENERIC_WRITE},
    Storage::FileSystem::*,
};
#[path = "installation_windows_handles.rs"]
mod handles;
#[path = "installation_windows_path.rs"]
mod path;
#[path = "installation_windows_principal.rs"]
mod principal;
#[path = "installation_windows_security.rs"]
mod security;

pub(crate) struct OwnerLock {
    _owner: File,
    _ancestors: Vec<File>,
}

pub(crate) fn prepare(directory: &Path) -> Result<OwnerLock> {
    let ancestors = path::directories(directory, true)?;
    let owner = diagnostic::at(Stage::OwnerLock, || {
        let owner = handles::open(
            &directory.join("owner.lock"),
            GENERIC_READ | GENERIC_WRITE,
            FILE_SHARE_NONE,
            OPEN_ALWAYS,
            false,
            true,
        )?
        .ok_or(PairingError::StorageFailure)?;
        security::protected(owner.as_raw_handle(), false, false)?;
        if owner.metadata().map_err(super::storage)?.len() != 0 {
            return Err(PairingError::StorageFailure);
        }
        flush(&owner)?;
        Ok(owner)
    })?;
    for entry in fs::read_dir(directory).map_err(super::storage)? {
        let entry = entry.map_err(super::storage)?;
        let file = entry.path();
        path::leaf(&file)?;
        if entry.file_name() == "owner.lock" {
            continue;
        }
        if !exists_in(&file)? {
            return Err(PairingError::StorageFailure);
        }
    }
    Ok(OwnerLock {
        _owner: owner,
        _ancestors: ancestors,
    })
}

pub(crate) fn exists(file: &Path) -> Result<bool> {
    path::leaf(file)?;
    let _ancestors = path::directories(file.parent().ok_or(PairingError::StorageFailure)?, false)?;
    exists_in(file)
}
fn exists_in(file: &Path) -> Result<bool> {
    let share = FILE_SHARE_READ
        | if path::sqlite(file) {
            FILE_SHARE_WRITE
        } else {
            0
        };
    let Some(handle) = handles::open(
        file,
        FILE_READ_ATTRIBUTES | READ_CONTROL,
        share,
        OPEN_EXISTING,
        false,
        false,
    )?
    else {
        return Ok(false);
    };
    security::protected(handle.as_raw_handle(), false, path::sqlite(file))?;
    Ok(true)
}

pub(super) fn open_file(file: &Path) -> Result<File> {
    path::leaf(file)?;
    let _ancestors = path::directories(file.parent().ok_or(PairingError::StorageFailure)?, false)?;
    let handle = handles::open(
        file,
        GENERIC_READ,
        FILE_SHARE_READ,
        OPEN_EXISTING,
        false,
        false,
    )?
    .ok_or(PairingError::StorageFailure)?;
    security::protected(handle.as_raw_handle(), false, false)?;
    Ok(handle)
}

pub(crate) fn write_new(file: &Path, bytes: &[u8]) -> Result<()> {
    publish(file, bytes, false)
}
pub(crate) fn replace(file: &Path, bytes: &[u8]) -> Result<()> {
    // Certificate renewal may replace public DER; epoch/initialized/port are never reset.
    if file.file_name().and_then(|name| name.to_str()) != Some("certificate.der") {
        return Err(PairingError::StorageFailure);
    }
    publish(file, bytes, true)
}
fn publish(file: &Path, bytes: &[u8], replace: bool) -> Result<()> {
    path::leaf(file)?;
    let _ancestors = path::directories(file.parent().ok_or(PairingError::StorageFailure)?, false)?;
    let existing = handles::open(
        file,
        FILE_READ_ATTRIBUTES | READ_CONTROL,
        FILE_SHARE_READ | FILE_SHARE_DELETE,
        OPEN_EXISTING,
        false,
        false,
    )?;
    if let Some(existing) = &existing {
        security::protected(existing.as_raw_handle(), false, false)?;
        if !replace {
            return Err(PairingError::StorageFailure);
        }
    }
    let pending = file.with_extension("pending");
    // CREATE_NEW preserves an interrupted attempt; no stale state is deleted/adopted.
    let mut staged = handles::open(
        &pending,
        GENERIC_READ | GENERIC_WRITE,
        FILE_SHARE_READ | FILE_SHARE_DELETE,
        CREATE_NEW,
        false,
        true,
    )?
    .ok_or(PairingError::StorageFailure)?;
    security::protected(staged.as_raw_handle(), false, false)?;
    staged.write_all(bytes).map_err(super::storage)?;
    flush(&staged)?;
    let source = path::wide(&pending)?;
    let destination = path::wide(file)?;
    let flags = MOVEFILE_WRITE_THROUGH
        | if existing.is_some() {
            MOVEFILE_REPLACE_EXISTING
        } else {
            0
        };
    // Same-directory NTFS move only: no copy/delete, deferred reboot, or ignored errors.
    security::os_check(
        unsafe { MoveFileExW(source.as_ptr(), destination.as_ptr(), flags) },
        Operation::Publish,
    )?;
    // Flush the same write-through handle after its checked publication, not a directory.
    flush(&staged)?;
    handles::information(&staged, false)?;
    security::protected(staged.as_raw_handle(), false, false)
}
fn flush(file: &File) -> Result<()> {
    security::os_check(
        unsafe { FlushFileBuffers(file.as_raw_handle()) },
        Operation::Flush,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use ring::rand::{SecureRandom, SystemRandom};

    #[test]
    fn caller_selected_directory_creates_no_authority_state() {
        let mut nonce = [0; 16];
        SystemRandom::new().fill(&mut nonce).unwrap();
        let directory = std::env::temp_dir()
            .join(format!(
                "kloda-windows-untrusted-{:032x}",
                u128::from_be_bytes(nonce)
            ))
            .join("pairing");
        assert!(!directory.exists());
        assert!(matches!(
            prepare(&directory),
            Err(PairingError::StorageFailure)
        ));
        assert!(
            !directory.exists(),
            "caller paths must never create authority files"
        );
    }
}

#[cfg(test)]
#[path = "installation_windows_candidate.rs"]
mod candidate;
