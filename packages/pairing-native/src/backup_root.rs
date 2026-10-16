use crate::error::{PairingError, Result};
use cap_std::{
    ambient_authority,
    fs::{Dir, File, OpenOptions},
};
use std::io;
use std::path::Path;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct Binding {
    pub(crate) root: [u8; 24],
    pub(crate) peer: [u8; 24],
}

pub(crate) fn prepare(folder: &str, fingerprint: &[u8; 32]) -> Result<Binding> {
    Ok(open(folder, fingerprint, true)?.0)
}

pub(crate) fn verify(folder: &str, fingerprint: &[u8; 32], binding: Binding) -> Result<()> {
    if open(folder, fingerprint, false)?.0 != binding {
        return Err(PairingError::BackupScopeChanged);
    }
    Ok(())
}

pub(crate) struct Directories {
    root: Dir,
    pub(crate) peer: Dir,
}

impl Directories {
    pub(crate) fn sync(&self) -> Result<()> {
        sync_dir(&self.peer)?;
        sync_dir(&self.root)
    }
}

pub(crate) fn acquire(
    folder: &str,
    fingerprint: &[u8; 32],
    expected: Binding,
) -> Result<Directories> {
    let (binding, directories) = open(folder, fingerprint, false)?;
    if binding != expected {
        return Err(PairingError::BackupScopeChanged);
    }
    Ok(directories)
}

fn open(folder: &str, fingerprint: &[u8; 32], create: bool) -> Result<(Binding, Directories)> {
    if folder.len() > 4096 || folder.contains('\0') || !Path::new(folder).is_absolute() {
        return Err(PairingError::BackupPathRejected);
    }
    // Ambient authority is only for the PC-selected root, never a remote path.
    let root = Dir::open_ambient_dir(folder, ambient_authority()).map_err(target_error)?;
    let name = crate::qr_base64::encode(fingerprint);
    if create {
        match root.create_dir(&name) {
            Ok(()) => (),
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => (),
            Err(error) => return Err(target_error(error)),
        }
    }
    let metadata = root.symlink_metadata(&name).map_err(target_error)?;
    if !metadata.is_dir() || metadata.is_symlink() {
        return Err(PairingError::BackupPathRejected);
    }
    #[cfg(windows)]
    {
        use cap_std::fs::MetadataExt;
        use windows_sys::Win32::Storage::FileSystem::FILE_ATTRIBUTE_REPARSE_POINT;
        if metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
            return Err(PairingError::BackupPathRejected);
        }
    }
    // Local filesystem writers are explicitly trusted; cap-std contains hostile peer paths.
    let peer = root.open_dir(&name).map_err(target_error)?;
    let binding = Binding {
        root: identity(&root)?,
        peer: identity(&peer)?,
    };
    Ok((binding, Directories { root, peer }))
}

#[cfg(unix)]
fn identity(directory: &Dir) -> Result<[u8; 24]> {
    use cap_std::fs::MetadataExt;
    let metadata = directory.dir_metadata().map_err(target_error)?;
    if metadata.ino() == 0 {
        return Err(PairingError::NativeUnsupported);
    }
    let mut bytes = [0; 24];
    bytes[..8].copy_from_slice(&metadata.dev().to_be_bytes());
    bytes[16..].copy_from_slice(&metadata.ino().to_be_bytes());
    Ok(bytes)
}

#[cfg(windows)]
fn identity(directory: &Dir) -> Result<[u8; 24]> {
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::Storage::FileSystem::{
        FileIdInfo, GetFileInformationByHandleEx, FILE_ID_INFO,
    };
    let mut information: FILE_ID_INFO = unsafe { std::mem::zeroed() };
    if unsafe {
        GetFileInformationByHandleEx(
            directory.as_raw_handle().cast(),
            FileIdInfo,
            (&mut information as *mut FILE_ID_INFO).cast(),
            std::mem::size_of::<FILE_ID_INFO>() as u32,
        )
    } == 0
    {
        return Err(target_error(io::Error::last_os_error()));
    }
    if information.FileId.Identifier == [0; 16] {
        return Err(PairingError::NativeUnsupported);
    }
    let mut bytes = [0; 24];
    bytes[..8].copy_from_slice(&information.VolumeSerialNumber.to_be_bytes());
    bytes[8..].copy_from_slice(&information.FileId.Identifier);
    Ok(bytes)
}

#[cfg(not(any(unix, windows)))]
fn identity(_: &Dir) -> Result<[u8; 24]> {
    Err(PairingError::NativeUnsupported)
}

pub(crate) fn sync_dir(directory: &Dir) -> Result<()> {
    directory
        .try_clone()
        .map_err(target_error)?
        .into_std_file()
        .sync_all()
        .map_err(target_error)
}

pub(crate) fn open_file(directory: &Dir, name: &str, create: bool, writable: bool) -> Result<File> {
    if name.is_empty()
        || !name
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"-_.".contains(&b))
        || matches!(name, "." | "..")
    {
        return Err(PairingError::BackupPathRejected);
    }
    if !create {
        regular(&directory.symlink_metadata(name).map_err(target_error)?)?;
    }
    let mut options = OpenOptions::new();
    options
        .read(true)
        .write(writable || create)
        .create_new(create);
    #[cfg(unix)]
    {
        use cap_std::fs::OpenOptionsExt;
        options.custom_flags(libc::O_NOFOLLOW | libc::O_NONBLOCK);
    }
    #[cfg(windows)]
    {
        use cap_std::fs::OpenOptionsExt;
        use windows_sys::Win32::Storage::FileSystem::FILE_FLAG_OPEN_REPARSE_POINT;
        options.custom_flags(FILE_FLAG_OPEN_REPARSE_POINT);
    }
    let file = directory.open_with(name, &options).map_err(target_error)?;
    regular(&file.metadata().map_err(target_error)?)?;
    Ok(file)
}

fn regular(metadata: &cap_std::fs::Metadata) -> Result<()> {
    if !metadata.is_file() || metadata.is_symlink() {
        return Err(PairingError::BackupPathRejected);
    }
    #[cfg(windows)]
    {
        use cap_std::fs::MetadataExt;
        use windows_sys::Win32::Storage::FileSystem::FILE_ATTRIBUTE_REPARSE_POINT;
        if metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
            return Err(PairingError::BackupPathRejected);
        }
    }
    Ok(())
}

#[cfg(unix)]
pub(crate) fn file_identity(file: &File) -> Result<[u8; 24]> {
    use cap_std::fs::MetadataExt;
    let metadata = file.metadata().map_err(target_error)?;
    regular(&metadata)?;
    if metadata.ino() == 0 {
        return Err(PairingError::NativeUnsupported);
    }
    let mut bytes = [0; 24];
    bytes[..8].copy_from_slice(&metadata.dev().to_be_bytes());
    bytes[16..].copy_from_slice(&metadata.ino().to_be_bytes());
    Ok(bytes)
}

#[cfg(windows)]
pub(crate) fn file_identity(file: &File) -> Result<[u8; 24]> {
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::Storage::FileSystem::{
        FileIdInfo, GetFileInformationByHandleEx, FILE_ID_INFO,
    };
    let mut information: FILE_ID_INFO = unsafe { std::mem::zeroed() };
    if unsafe {
        GetFileInformationByHandleEx(
            file.as_raw_handle().cast(),
            FileIdInfo,
            (&mut information as *mut FILE_ID_INFO).cast(),
            std::mem::size_of::<FILE_ID_INFO>() as u32,
        )
    } == 0
    {
        return Err(target_error(io::Error::last_os_error()));
    }
    if information.FileId.Identifier == [0; 16] {
        return Err(PairingError::NativeUnsupported);
    }
    let mut bytes = [0; 24];
    bytes[..8].copy_from_slice(&information.VolumeSerialNumber.to_be_bytes());
    bytes[8..].copy_from_slice(&information.FileId.Identifier);
    Ok(bytes)
}

#[cfg(not(any(unix, windows)))]
pub(crate) fn file_identity(_: &File) -> Result<[u8; 24]> {
    Err(PairingError::NativeUnsupported)
}

pub(crate) fn target_error(error: io::Error) -> PairingError {
    #[cfg(windows)]
    {
        use windows_sys::Win32::Foundation::{ERROR_LOCK_VIOLATION, ERROR_SHARING_VIOLATION};
        let code = error.raw_os_error();
        if code == Some(ERROR_SHARING_VIOLATION as i32) || code == Some(ERROR_LOCK_VIOLATION as i32)
        {
            return PairingError::BackupBusy;
        }
    }
    match error.kind() {
        io::ErrorKind::WouldBlock => PairingError::BackupBusy,
        io::ErrorKind::PermissionDenied => PairingError::BackupPermissionDenied,
        io::ErrorKind::StorageFull | io::ErrorKind::QuotaExceeded => PairingError::BackupFull,
        io::ErrorKind::InvalidInput | io::ErrorKind::NotADirectory => {
            PairingError::BackupPathRejected
        }
        _ => PairingError::BackupUnavailable,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn full_or_quota_exhausted_target_is_not_missing_or_permission_denied() {
        for kind in [io::ErrorKind::StorageFull, io::ErrorKind::QuotaExceeded] {
            assert_eq!(
                target_error(io::Error::from(kind)),
                PairingError::BackupFull
            );
        }
        assert_eq!(
            target_error(io::Error::from(io::ErrorKind::PermissionDenied)),
            PairingError::BackupPermissionDenied
        );
    }

    #[cfg(windows)]
    #[test]
    fn sharing_and_lock_violations_are_retryable_not_permanent_permissions() {
        for code in [32, 33] {
            assert_eq!(
                target_error(io::Error::from_raw_os_error(code)),
                PairingError::BackupBusy
            );
        }
        assert_eq!(
            target_error(io::Error::from_raw_os_error(5)),
            PairingError::BackupPermissionDenied
        );
    }
}
