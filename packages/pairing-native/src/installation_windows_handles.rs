use super::{path::wide, principal, security};
use crate::error::{PairingError, Result};
use std::{
    fs::File,
    os::windows::io::{AsRawHandle, FromRawHandle},
    path::Path,
    ptr::null_mut,
};
use windows_sys::Win32::{
    Foundation::{GetLastError, ERROR_FILE_NOT_FOUND, ERROR_PATH_NOT_FOUND, INVALID_HANDLE_VALUE},
    Storage::FileSystem::*,
    System::{SystemServices::FILE_PERSISTENT_ACLS, WindowsProgramming::DRIVE_FIXED},
};

pub(super) fn open(
    path: &Path,
    access: u32,
    share: u32,
    disposition: u32,
    directory: bool,
    create: bool,
) -> Result<Option<File>> {
    let name = wide(path)?;
    let flags = FILE_FLAG_OPEN_REPARSE_POINT
        | if directory {
            FILE_FLAG_BACKUP_SEMANTICS
        } else {
            FILE_FLAG_WRITE_THROUGH
        };
    let operation = |attributes: *const windows_sys::Win32::Security::SECURITY_ATTRIBUTES| {
        let handle = unsafe {
            CreateFileW(
                name.as_ptr(),
                access,
                share,
                attributes,
                disposition,
                flags,
                null_mut(),
            )
        };
        if handle == INVALID_HANDLE_VALUE {
            let error = unsafe { GetLastError() };
            if disposition == OPEN_EXISTING
                && matches!(error, ERROR_FILE_NOT_FOUND | ERROR_PATH_NOT_FOUND)
            {
                return Ok(None);
            }
            return Err(PairingError::StorageFailure);
        }
        let file = unsafe { File::from_raw_handle(handle) };
        information(&file, directory)?;
        final_path(&file, &name)?;
        Ok(Some(file))
    };
    if create {
        principal::with_attributes(directory, |attributes| operation(attributes))
    } else {
        operation(std::ptr::null())
    }
}
fn final_path(file: &File, expected: &[u16]) -> Result<()> {
    let mut actual = vec![0u16; expected.len() + 1];
    let length = unsafe {
        GetFinalPathNameByHandleW(
            file.as_raw_handle(),
            actual.as_mut_ptr(),
            actual.len() as u32,
            FILE_NAME_NORMALIZED | VOLUME_NAME_DOS,
        )
    } as usize;
    if length == 0 || length >= actual.len() || actual[..length] != expected[..expected.len() - 1] {
        return Err(PairingError::StorageFailure);
    }
    Ok(())
}
pub(super) fn information(file: &File, directory: bool) -> Result<()> {
    let mut information = BY_HANDLE_FILE_INFORMATION::default();
    security::check(unsafe { GetFileInformationByHandle(file.as_raw_handle(), &mut information) })?;
    let unsafe_attributes = FILE_ATTRIBUTE_REPARSE_POINT
        | FILE_ATTRIBUTE_OFFLINE
        | FILE_ATTRIBUTE_RECALL_ON_OPEN
        | FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS;
    if unsafe { GetFileType(file.as_raw_handle()) } != FILE_TYPE_DISK
        || information.dwFileAttributes & unsafe_attributes != 0
        || (information.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY != 0) != directory
        || (!directory && information.nNumberOfLinks != 1)
    {
        return Err(PairingError::StorageFailure);
    }
    Ok(())
}
pub(super) fn local_ntfs(file: &File, root: &Path) -> Result<()> {
    let mut name = [0u16; 16];
    let mut flags = 0;
    security::check(unsafe {
        GetVolumeInformationByHandleW(
            file.as_raw_handle(),
            null_mut(),
            0,
            null_mut(),
            null_mut(),
            &mut flags,
            name.as_mut_ptr(),
            name.len() as u32,
        )
    })?;
    let root = wide(root)?;
    if unsafe { GetDriveTypeW(root.as_ptr()) } != DRIVE_FIXED
        || flags & FILE_PERSISTENT_ACLS == 0
        || name[..5] != [b'N' as u16, b'T' as u16, b'F' as u16, b'S' as u16, 0]
    {
        return Err(PairingError::StorageFailure);
    }
    Ok(())
}
