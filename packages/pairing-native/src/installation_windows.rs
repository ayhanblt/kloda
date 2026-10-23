use crate::error::{PairingError, Result};
use crate::startup_diagnostics::{self as diagnostic, Operation, Stage};
use std::{
    fs::{self, File},
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
#[path = "installation_windows_candidate_buffer.rs"]
mod rename_buffer;
#[path = "installation_windows_publication.rs"]
mod publication;
// Reopen-only D3 admission; no legacy bootstrap or fallback from production startup.
#[path = "installation_windows_legacy_fence.rs"]
mod legacy_fence;
#[path = "installation_windows_generation.rs"]
mod generation;
pub(crate) use generation::{selected, Selected};

struct OwnerPins {
    _owner: File,
    _ancestors: Vec<File>,
    _generation: Option<generation::Pins>,
}
#[derive(Clone)]
pub(crate) struct OwnerLock {
    _pins: std::sync::Arc<OwnerPins>,
    directory: std::path::PathBuf,
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
        _pins: std::sync::Arc::new(OwnerPins {
            _owner: owner,
            _ancestors: ancestors,
            _generation: None,
        }),
        directory: directory.to_path_buf(),
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

pub(crate) fn write_new(file: &Path, bytes: &[u8], owner: &OwnerLock) -> Result<()> {
    path::leaf(file)?;
    if file.parent() != Some(owner.directory.as_path()) {
        return Err(PairingError::StorageFailure);
    }
    let ancestors = path::directories(file.parent().ok_or(PairingError::StorageFailure)?, false)?;
    publication::publish(file, bytes, ancestors, owner.clone())
}
pub(crate) fn replace(file: &Path, bytes: &[u8], owner: &OwnerLock) -> Result<()> {
    // Windows replacement is deliberately unsupported; initial DER is create-only.
    if file.file_name().and_then(|name| name.to_str()) != Some("certificate.der") {
        return Err(PairingError::StorageFailure);
    }
    if exists(file)? {
        return Err(PairingError::NativeUnsupported);
    }
    write_new(file, bytes, owner)
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
