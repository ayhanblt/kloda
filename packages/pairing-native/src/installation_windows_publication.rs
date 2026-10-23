//! Same-handle, no-replace publication under retained local-NTFS ancestor guards.
use super::{flush, handles, rename_buffer::RenameBuffer, security};
use crate::error::{PairingError, Result};
use crate::startup_diagnostics::{self as diagnostic, Operation};
use crate::windows_publication_name::Target;
use std::{
    fs::File,
    io::{Read, Seek, SeekFrom, Write},
    os::windows::io::AsRawHandle,
    path::Path,
};
use windows_sys::{
    Wdk::Storage::FileSystem::{FileRenameInformation, NtSetInformationFile},
    Win32::{
        Foundation::{GENERIC_READ, GENERIC_WRITE},
        Storage::FileSystem::*,
        System::IO::IO_STATUS_BLOCK,
    },
};

const PENDING: i32 = 0x103;

pub(super) fn publish(
    file: &Path,
    bytes: &[u8],
    ancestors: Vec<File>,
    owner: super::OwnerLock,
) -> Result<()> {
    let target = Target::from_name(
        file.file_name()
            .and_then(|name| name.to_str())
            .ok_or(PairingError::StorageFailure)?,
    )?;
    // Never open/adopt/delete a prior staged attempt, and never replace a final object.
    let mut staged = handles::open(
        &file.with_file_name(target.pending_name()),
        GENERIC_READ | GENERIC_WRITE | DELETE,
        FILE_SHARE_READ,
        CREATE_NEW,
        false,
        true,
    )?
    .ok_or(PairingError::StorageFailure)?;
    security::protected(staged.as_raw_handle(), false, false)?;
    let original = identity(&staged)?;
    staged.write_all(bytes).map_err(super::super::storage)?;
    flush(&staged)?;
    let request = RenameBuffer::new(target)?;
    // Both address-bearing allocations are stable before issuing the native request.
    let mut io = Box::new(IO_STATUS_BLOCK::default());
    io.Anonymous.Status = PENDING;
    let status = unsafe {
        NtSetInformationFile(
            staged.as_raw_handle(),
            &mut *io,
            request.pointer(),
            request.length(),
            FileRenameInformation,
        )
    };
    if status == PENDING {
        // Do not inspect an IOSB potentially being updated by an outstanding request.
        std::mem::forget((request, io, staged, ancestors, owner));
        diagnostic::native_publish(status, None);
        return unknown();
    }
    let io_status = unsafe { io.Anonymous.Status };
    if io_status == PENDING {
        // A contradictory/unresolved completion must retain the original request pins.
        std::mem::forget((request, io, staged, ancestors, owner));
        diagnostic::native_publish(status, Some(io_status));
        return unknown();
    }
    if !confirmed(status, io_status) {
        // NTSTATUS is not a Win32 error code; do not label it as one in diagnostics.
        diagnostic::native_publish(status, Some(io_status));
        // Refuse a second owner until process exit after an unconfirmed native result.
        std::mem::forget((staged, ancestors, owner));
        return unknown();
    }
    let verified = (|| {
        // MS-FSA NTFS flush semantics include required directory structure. This is
        // a documented-contract inference, not physical crash/power-loss acceptance.
        flush(&staged)?;
        security::protected(staged.as_raw_handle(), false, false)?;
        handles::check_final_path(&staged, file)?;
        diagnostic::validation(
            Operation::FileValidation,
            if identity(&staged)? == original
                && staged.metadata().map_err(super::super::storage)?.len() == bytes.len() as u64
            {
                Ok(())
            } else {
                Err(PairingError::StorageFailure)
            },
        )?;
        exact_contents(&mut staged, bytes)
    })();
    if let Err(error) = verified {
        // os_check/storage retain their original first error and actual Win32 code.
        diagnostic::record(Some(Operation::FileValidation), error, None);
        std::mem::forget((staged, ancestors, owner));
        return unknown();
    }
    // Explicit lifetime: deny-delete ancestor handles survive all publication checks.
    drop(ancestors);
    Ok(())
}

fn unknown<T>() -> Result<T> {
    diagnostic::record(Some(Operation::Publish), PairingError::OutcomeUnknown, None);
    Err(PairingError::OutcomeUnknown)
}

fn confirmed(status: i32, io_status: i32) -> bool {
    status == 0 && io_status == 0
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

fn exact_contents(file: &mut (impl Read + Seek), expected: &[u8]) -> Result<()> {
    file.seek(SeekFrom::Start(0))
        .map_err(super::super::storage)?;
    let mut buffer = [0u8; 4096];
    for chunk in expected.chunks(buffer.len()) {
        file.read_exact(&mut buffer[..chunk.len()])
            .map_err(super::super::storage)?;
        diagnostic::validation(
            Operation::FileValidation,
            if buffer[..chunk.len()] == *chunk {
                Ok(())
            } else {
                Err(PairingError::StorageFailure)
            },
        )?;
    }
    // Also reject growth, including an originally empty expected value.
    let length = file
        .read(&mut buffer[..1])
        .map_err(super::super::storage)?;
    diagnostic::validation(
        Operation::FileValidation,
        if length == 0 {
            Ok(())
        } else {
            Err(PairingError::StorageFailure)
        },
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exact_content_check_rejects_truncation_growth_and_changed_bytes() {
        use std::io::Cursor;
        for size in [0, 1, 4095, 4096, 4097, 8193] {
            let expected = vec![7; size];
            let mut source = Cursor::new(expected.clone());
            source.set_position(size as u64);
            assert_eq!(exact_contents(&mut source, &expected), Ok(()));
            let mut grown = expected.clone();
            grown.push(7);
            assert!(exact_contents(&mut Cursor::new(grown), &expected).is_err());
            if size > 0 {
                assert!(exact_contents(&mut Cursor::new(&expected[..size - 1]), &expected).is_err());
                let mut changed = expected.clone();
                changed[size - 1] = 8;
                assert!(exact_contents(&mut Cursor::new(changed), &expected).is_err());
            }
        }
    }

    #[test]
    fn only_exact_native_success_is_confirmed() {
        assert!(confirmed(0, 0));
        for status in [PENDING, 1, -1, i32::MIN] {
            assert!(!confirmed(status, 0));
            assert!(!confirmed(0, status));
            assert!(!confirmed(status, status));
        }
    }
}
