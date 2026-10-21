//! D1 test-only native candidate. Never called by production initialization/publication.
use super::{flush, handles, path, security};
use crate::error::{PairingError, Result};
use crate::startup_diagnostics::Operation;
use crate::windows_publication_contract::{completion, Observation, Target};
use std::{fs::File, io::Write, os::windows::io::AsRawHandle};
use windows_sys::{
    Wdk::Storage::FileSystem::{FileRenameInformation, NtSetInformationFile},
    Win32::{
        Foundation::{GENERIC_READ, GENERIC_WRITE},
        Storage::FileSystem::*,
        System::IO::IO_STATUS_BLOCK,
    },
};
#[path = "installation_windows_candidate_buffer.rs"]
mod buffer;
#[path = "installation_windows_candidate_context.rs"]
mod context;
#[path = "installation_windows_candidate_fixture.rs"]
mod fixture;
#[path = "installation_windows_candidate_tests.rs"]
mod tests;
use buffer::RenameBuffer;
use fixture::Fixture;

#[derive(Clone, Copy, Debug, PartialEq)]
enum Cut {
    None,
    Created,
    Written,
    PreFlushed,
    Renamed,
    PostFlushed,
    Verified,
}
#[derive(Debug)]
enum Failure {
    Storage(PairingError),
    Native { status: i32, io_status: Option<i32> },
    UncertainAfterRename(PairingError),
    Interrupted(Cut),
}
impl std::fmt::Display for Failure {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Storage(error) => write!(f, "candidate_storage {}", error.code()),
            Self::Native { status, io_status } => write!(
                f,
                "candidate_unconfirmed ntstatus={status} io={io_status:?}"
            ),
            Self::UncertainAfterRename(error) => {
                write!(f, "candidate_after_rename_unknown {}", error.code())
            }
            Self::Interrupted(cut) => write!(f, "candidate_interrupted {cut:?}"),
        }
    }
}
impl From<PairingError> for Failure {
    fn from(error: PairingError) -> Self {
        Self::Storage(error)
    }
}
fn cut_at(cut: Cut, current: Cut) -> std::result::Result<(), Failure> {
    if cut == current {
        Err(Failure::Interrupted(current))
    } else {
        Ok(())
    }
}
fn identity(file: &File) -> Result<(u32, u32, u32)> {
    handles::information(file, false)?;
    let mut info = BY_HANDLE_FILE_INFORMATION::default();
    security::os_check(
        unsafe { GetFileInformationByHandle(file.as_raw_handle(), &mut info) },
        Operation::FileInformation,
    )?;
    Ok((
        info.dwVolumeSerialNumber,
        info.nFileIndexHigh,
        info.nFileIndexLow,
    ))
}

fn publish(
    fixture: &Fixture,
    target: Target,
    bytes: &[u8],
    cut: Cut,
) -> std::result::Result<Observation, Failure> {
    publish_before_rename(fixture, target, bytes, cut, || Ok(()))
}

fn publish_before_rename(
    fixture: &Fixture,
    target: Target,
    bytes: &[u8],
    cut: Cut,
    before_rename: impl FnOnce() -> Result<()>,
) -> std::result::Result<Observation, Failure> {
    let destination = fixture.directory().join(target.name());
    // Validate the same production final-name predicate, without changing its allowlist.
    path::leaf(&destination)?;
    let mut staged = handles::open(
        &fixture.directory().join(target.pending_name()),
        GENERIC_READ | GENERIC_WRITE | DELETE,
        FILE_SHARE_READ,
        CREATE_NEW,
        false,
        true,
    )?
    .ok_or(PairingError::StorageFailure)?;
    security::protected(staged.as_raw_handle(), false, false)?;
    let original = identity(&staged)?;
    cut_at(cut, Cut::Created)?;
    staged.write_all(bytes).map_err(super::super::storage)?;
    cut_at(cut, Cut::Written)?;
    flush(&staged)?;
    cut_at(cut, Cut::PreFlushed)?;
    before_rename()?;
    let request = RenameBuffer::new(target)?;
    // Boxed from before the call: the kernel must never retain a pointer into a moved stack value.
    let mut io = Box::new(IO_STATUS_BLOCK::default());
    io.Anonymous.Status = 0x103;
    let status = unsafe {
        NtSetInformationFile(
            staged.as_raw_handle(),
            &mut *io,
            request.pointer(),
            request.length(),
            FileRenameInformation,
        )
    };
    if status == 0x103 {
        // Unexpected on this synchronous handle. Retain all I/O memory and original pins
        // until process exit; no read of a concurrently updated status block or async retry.
        std::mem::forget((request, io, staged, fixture.pins.clone()));
        return Err(Failure::Native {
            status,
            io_status: None,
        });
    }
    let io_status = unsafe { io.Anonymous.Status };
    if status >= 0 && io_status == 0x103 {
        std::mem::forget((request, io, staged, fixture.pins.clone()));
        return Err(Failure::Native {
            status,
            io_status: Some(io_status),
        });
    }
    if status != 0 || io_status != 0 {
        return Err(Failure::Native {
            status,
            io_status: Some(io_status),
        });
    }
    cut_at(cut, Cut::Renamed)?;
    flush(&staged).map_err(Failure::UncertainAfterRename)?;
    cut_at(cut, Cut::PostFlushed)?;
    let verify = || -> Result<()> {
        security::protected(staged.as_raw_handle(), false, false)?;
        handles::check_final_path(&staged, &destination)?;
        if identity(&staged)? != original
            || staged.metadata().map_err(super::super::storage)?.len() != bytes.len() as u64
        {
            return Err(PairingError::StorageFailure);
        }
        Ok(())
    };
    // A final-path match on this still delete/write-exclusive original handle binds the target.
    verify().map_err(Failure::UncertainAfterRename)?;
    cut_at(cut, Cut::Verified)?;
    Ok(completion(status, io_status, true))
}
