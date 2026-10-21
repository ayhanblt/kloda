//! Fresh test roots only. No cleanup/adoption or existing owner namespace is used.
use super::super::{flush, handles, path, principal, security};
use crate::error::{PairingError, Result};
use crate::startup_diagnostics::{self as diagnostic, FixtureStep, Operation, Stage};
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
        diagnostic::run(Self::new_inner)
    }
    fn new_inner() -> Result<Self> {
        use FixtureStep::*;
        let base = diagnostic::at(Stage::Fixture(Base), path::fixture_base)?;
        let mut pins = Vec::new();
        for ancestor in base.ancestors().collect::<Vec<_>>().into_iter().rev() {
            if ancestor.as_os_str().is_empty() {
                continue;
            }
            let step = if pins.is_empty() {
                VolumeRootOpen
            } else if ancestor == base {
                BaseOpen
            } else {
                AncestorOpen
            };
            let file = diagnostic::at(Stage::Fixture(step), || {
                handles::open(
                    ancestor,
                    FILE_READ_DATA | FILE_READ_ATTRIBUTES | READ_CONTROL,
                    FILE_SHARE_READ,
                    OPEN_EXISTING,
                    true,
                    false,
                )?
                .ok_or(PairingError::StorageFailure)
            })?;
            if pins.is_empty() {
                diagnostic::at(Stage::Fixture(Volume), || {
                    handles::local_ntfs(&file, ancestor)
                })?;
            }
            if ancestor == base {
                diagnostic::at(Stage::Fixture(BaseSecurity), || {
                    security::user_directory(file.as_raw_handle())
                })?;
            }
            pins.push(file);
        }
        let mut nonce = [0u8; 16];
        diagnostic::at(Stage::Fixture(Nonce), || {
            SystemRandom::new()
                .fill(&mut nonce)
                .map_err(|_| PairingError::StorageFailure)
        })?;
        let root = base.join(format!(
            "Kloda.NativePublication.Test.{:032x}",
            u128::from_be_bytes(nonce)
        ));
        let directory = root.join("pairing");
        for (dir, create, open, secure) in [
            (&root, RootCreate, RootOpen, RootSecurity),
            (&directory, PairingCreate, PairingOpen, PairingSecurity),
        ] {
            diagnostic::at(Stage::Fixture(create), || {
                let wide = path::wide(dir)?;
                // Unlike production's directory helper, an existing root is never accepted.
                principal::with_attributes(true, |attributes| {
                    security::os_check(
                        unsafe { CreateDirectoryW(wide.as_ptr(), attributes) },
                        Operation::CreateDirectory,
                    )
                })
            })?;
            let file = diagnostic::at(Stage::Fixture(open), || {
                handles::open(
                    dir,
                    FILE_READ_DATA | FILE_READ_ATTRIBUTES | READ_CONTROL,
                    FILE_SHARE_READ,
                    OPEN_EXISTING,
                    true,
                    false,
                )?
                .ok_or(PairingError::StorageFailure)
            })?;
            diagnostic::at(Stage::Fixture(secure), || {
                security::protected(file.as_raw_handle(), true, false)
            })?;
            pins.push(file);
        }
        let owner = diagnostic::at(Stage::Fixture(OwnerCreate), || {
            handles::open(
                &directory.join("owner.lock"),
                GENERIC_READ | GENERIC_WRITE,
                FILE_SHARE_NONE,
                CREATE_NEW,
                false,
                true,
            )?
            .ok_or(PairingError::StorageFailure)
        })?;
        diagnostic::at(Stage::Fixture(OwnerSecurity), || {
            security::protected(owner.as_raw_handle(), false, false)
        })?;
        diagnostic::at(Stage::Fixture(OwnerFlush), || flush(&owner))?;
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
