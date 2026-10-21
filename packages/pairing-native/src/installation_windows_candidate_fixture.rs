//! Fresh test roots only. No cleanup/adoption or existing owner namespace is used.
use super::super::{flush, handles, path, principal, security};
use crate::error::{PairingError, Result};
use crate::startup_diagnostics::Operation;
use ring::rand::{SecureRandom, SystemRandom};
use std::{
    fs::File,
    os::windows::io::AsRawHandle,
    path::{Path, PathBuf},
    sync::Arc,
};
use windows_sys::Win32::{
    Foundation::{GENERIC_READ, GENERIC_WRITE},
    Storage::FileSystem::*,
};

pub(super) struct Fixture {
    directory: PathBuf,
    // Arc retains the actual original owner/ancestor handles if an unexpected I/O stays pending.
    pub(super) pins: Arc<Vec<File>>,
}
impl Fixture {
    pub(super) fn new() -> Result<Self> {
        let base = path::fixture_base()?;
        let mut pins = Vec::new();
        for ancestor in base.ancestors().collect::<Vec<_>>().into_iter().rev() {
            if ancestor.as_os_str().is_empty() {
                continue;
            }
            let file = handles::open(
                ancestor,
                FILE_READ_DATA | FILE_READ_ATTRIBUTES | READ_CONTROL,
                FILE_SHARE_READ,
                OPEN_EXISTING,
                true,
                false,
            )?
            .ok_or(PairingError::StorageFailure)?;
            if pins.is_empty() {
                handles::local_ntfs(&file, ancestor)?;
            }
            if ancestor == base {
                security::user_directory(file.as_raw_handle())?;
            }
            pins.push(file);
        }
        let mut nonce = [0u8; 16];
        SystemRandom::new()
            .fill(&mut nonce)
            .map_err(|_| PairingError::StorageFailure)?;
        let root = base.join(format!(
            "Kloda.NativePublication.Test.{:032x}",
            u128::from_be_bytes(nonce)
        ));
        let directory = root.join("pairing");
        for dir in [&root, &directory] {
            let wide = path::wide(dir)?;
            // Unlike production's directory helper, an existing root is never accepted.
            principal::with_attributes(true, |attributes| {
                security::os_check(
                    unsafe { CreateDirectoryW(wide.as_ptr(), attributes) },
                    Operation::CreateDirectory,
                )
            })?;
            let file = handles::open(
                dir,
                FILE_READ_DATA | FILE_READ_ATTRIBUTES | READ_CONTROL,
                FILE_SHARE_READ,
                OPEN_EXISTING,
                true,
                false,
            )?
            .ok_or(PairingError::StorageFailure)?;
            security::protected(file.as_raw_handle(), true, false)?;
            pins.push(file);
        }
        let owner = handles::open(
            &directory.join("owner.lock"),
            GENERIC_READ | GENERIC_WRITE,
            FILE_SHARE_NONE,
            CREATE_NEW,
            false,
            true,
        )?
        .ok_or(PairingError::StorageFailure)?;
        security::protected(owner.as_raw_handle(), false, false)?;
        flush(&owner)?;
        pins.push(owner);
        Ok(Self {
            directory,
            pins: Arc::new(pins),
        })
    }
    pub(super) fn directory(&self) -> &Path {
        &self.directory
    }
}
// Intentionally no recursive cleanup: disposable evidence is retained for review.
