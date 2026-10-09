use super::{handles, principal, security};
use crate::error::{PairingError, Result};
use std::{
    ffi::OsString,
    fs::File,
    os::windows::{
        ffi::{OsStrExt, OsStringExt},
        io::AsRawHandle,
    },
    path::{Component, Path, PathBuf, Prefix},
    ptr::null_mut,
    sync::LazyLock,
};
use windows_sys::{
    core::GUID,
    Win32::{
        Foundation::{GetLastError, ERROR_ALREADY_EXISTS},
        Storage::FileSystem::*,
        System::Com::CoTaskMemFree,
        UI::Shell::{FOLDERID_LocalAppData, FOLDERID_RoamingAppData, SHGetKnownFolderPath},
    },
};

struct Folders {
    local: PathBuf,
    development: PathBuf,
    production: PathBuf,
}
static FOLDERS: LazyLock<Result<Folders>> = LazyLock::new(|| {
    let local = known_folder(&FOLDERID_LocalAppData)?;
    local_syntax(&local)?;
    let roaming = known_folder(&FOLDERID_RoamingAppData)?
        .to_string_lossy()
        .to_lowercase();
    let normalized = local.to_string_lossy().to_lowercase();
    // LocalAppData redirection into the actual roaming KnownFolder is never adopted.
    if normalized == roaming || normalized.starts_with(&(roaming + "\\")) {
        return Err(PairingError::StorageFailure);
    }
    Ok(Folders {
        development: local.join("com.kloda.desktop.dev").join("pairing"),
        production: local.join("com.kloda.desktop").join("pairing"),
        local,
    })
});
fn known_folder(id: &GUID) -> Result<PathBuf> {
    let mut pointer = null_mut();
    let status = unsafe { SHGetKnownFolderPath(id, 0, null_mut(), &mut pointer) };
    let result = if status < 0 || pointer.is_null() {
        Err(PairingError::StorageFailure)
    } else {
        let mut length = 0;
        // Windows returns an allocated NUL-terminated KnownFolder string.
        while unsafe { *pointer.add(length) } != 0 {
            length += 1;
        }
        Ok(PathBuf::from(OsString::from_wide(unsafe {
            std::slice::from_raw_parts(pointer, length)
        })))
    };
    unsafe {
        CoTaskMemFree(pointer.cast());
    }
    result
}
pub(super) fn wide(path: &Path) -> Result<Vec<u16>> {
    // Extended local syntax avoids MAX_PATH truncation; caller paths never use device/UNC syntax.
    let mut value = Vec::with_capacity(path.as_os_str().len() + 5);
    value.extend("\\\\?\\".encode_utf16());
    value.extend(path.as_os_str().encode_wide());
    if value.len() >= 32764 || value[4..].contains(&0) {
        return Err(PairingError::StorageFailure);
    }
    value.push(0);
    Ok(value)
}
fn local_syntax(path: &Path) -> Result<()> {
    let mut components = path.components();
    if !matches!(components.next(), Some(Component::Prefix(prefix)) if matches!(prefix.kind(), Prefix::Disk(_)))
        || !matches!(components.next(), Some(Component::RootDir))
    {
        return Err(PairingError::StorageFailure);
    }
    for component in components {
        let Component::Normal(value) = component else {
            return Err(PairingError::StorageFailure);
        };
        let mut last = None;
        for unit in value.encode_wide() {
            if unit == 0 || unit == b':' as u16 {
                return Err(PairingError::StorageFailure);
            }
            last = Some(unit);
        }
        if matches!(last, None | Some(32 | 46)) {
            return Err(PairingError::StorageFailure);
        }
    }
    Ok(())
}
fn selection(directory: &Path) -> Result<&'static Folders> {
    let folders = FOLDERS.as_ref().map_err(|error| *error)?;
    local_syntax(directory)?;
    if directory.as_os_str() != folders.development.as_os_str()
        && directory.as_os_str() != folders.production.as_os_str()
    {
        return Err(PairingError::StorageFailure);
    }
    Ok(folders)
}

fn create_directory(path: &Path) -> Result<()> {
    let name = wide(path)?;
    principal::with_attributes(true, |attributes| {
        if unsafe { CreateDirectoryW(name.as_ptr(), attributes) } == 0
            && unsafe { GetLastError() } != ERROR_ALREADY_EXISTS
        {
            return Err(PairingError::StorageFailure);
        }
        Ok(())
    })
}

pub(super) fn directories(directory: &Path, create: bool) -> Result<Vec<File>> {
    let folders = selection(directory)?;
    let profile = directory.parent().ok_or(PairingError::StorageFailure)?;
    let mut handles = Vec::with_capacity(directory.components().count());
    let ancestors: Vec<_> = directory.ancestors().collect();
    for ancestor in ancestors.into_iter().rev() {
        if ancestor.as_os_str().is_empty() {
            continue;
        }
        let mut file = handles::open(
            ancestor,
            FILE_READ_DATA | FILE_READ_ATTRIBUTES | READ_CONTROL,
            FILE_SHARE_READ,
            OPEN_EXISTING,
            true,
            false,
        )?;
        if file.is_none() && create && (ancestor == profile || ancestor == directory) {
            create_directory(ancestor)?;
            file = handles::open(
                ancestor,
                FILE_READ_DATA | FILE_READ_ATTRIBUTES | READ_CONTROL,
                FILE_SHARE_READ,
                OPEN_EXISTING,
                true,
                false,
            )?;
        }
        let file = file.ok_or(PairingError::StorageFailure)?;
        if handles.is_empty() {
            handles::local_ntfs(&file, ancestor)?;
        }
        if ancestor == folders.local || ancestor == profile {
            security::user_directory(file.as_raw_handle())?;
        }
        if ancestor == directory {
            security::protected(file.as_raw_handle(), true, false)?;
        }
        // Denying WRITE/DELETE sharing pins every checked ancestor for the owner lifetime.
        handles.push(file);
    }
    Ok(handles)
}

pub(super) fn sqlite(path: &Path) -> bool {
    matches!(
        path.file_name().and_then(|name| name.to_str()),
        Some(
            "pairing.sqlite3"
                | "pairing.sqlite3-wal"
                | "pairing.sqlite3-shm"
                | "pairing.sqlite3-journal"
        )
    )
}
pub(super) fn leaf(path: &Path) -> Result<()> {
    if matches!(
        path.file_name().and_then(|name| name.to_str()),
        Some("epoch" | "initialized" | "owner.lock" | "listener-port" | "certificate.der")
    ) || sqlite(path)
    {
        Ok(())
    } else {
        Err(PairingError::StorageFailure)
    }
}
