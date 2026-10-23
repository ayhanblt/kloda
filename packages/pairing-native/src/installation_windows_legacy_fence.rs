//! Existing legacy lock exclusion only; never grants access to legacy authority.
use super::{handles, path, security};
use crate::error::{PairingError, Result};
use crate::startup_diagnostics::{self as diagnostic, Stage};
use std::{fs::File, os::windows::io::AsRawHandle, path::Path};
use windows_sys::Win32::Storage::FileSystem::{
    FILE_READ_ATTRIBUTES, FILE_SHARE_NONE, OPEN_EXISTING, READ_CONTROL,
};

/// Retain alongside the future generation role owner for its entire lifetime.
/// Distinct from OwnerLock: this cannot publish or adopt legacy records.
pub(super) struct LegacyFence {
    _owner: File,
    _ancestors: Vec<File>,
}

impl LegacyFence {
    /// Only the exact existing native KnownFolder development/production root.
    /// Missing directories/lock, sharing conflicts or any guard failure refuse.
    pub(super) fn acquire(directory: &Path) -> Result<Self> {
        let ancestors = path::directories(directory, false)?;
        let owner = diagnostic::at(Stage::OwnerLock, || {
            let owner = handles::open(
                &directory.join("owner.lock"),
                FILE_READ_ATTRIBUTES | READ_CONTROL,
                FILE_SHARE_NONE,
                OPEN_EXISTING,
                false,
                false,
            )?
            .ok_or(PairingError::StorageFailure)?;
            security::protected(owner.as_raw_handle(), false, false)?;
            if owner.metadata().map_err(super::super::storage)?.len() != 0 {
                return Err(PairingError::StorageFailure);
            }
            Ok(owner)
        })?;
        // Original handles pin the checked paths; no reopen, writes or flush.
        Ok(Self {
            _owner: owner,
            _ancestors: ancestors,
        })
    }
}
