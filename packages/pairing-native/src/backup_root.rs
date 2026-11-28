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

#[cfg(test)]
pub(crate) fn prepare(folder: &str, fingerprint: &[u8; 32]) -> Result<Binding> {
    Ok(open(folder, fingerprint, true, None)?.0)
}

pub(crate) fn prepare_named(
    folder: &str,
    fingerprint: &[u8; 32],
    preferred_name: Option<&str>,
    reusable_peer_root: Option<[u8; 24]>,
) -> Result<(Binding, Option<String>)> {
    if folder.len() > 4096 || folder.contains('\0') || !Path::new(folder).is_absolute() {
        return Err(PairingError::BackupPathRejected);
    }
    let Some(base) = preferred_name.and_then(crate::device_name::sanitize_folder) else {
        return Ok((open(folder, fingerprint, true, None)?.0, None));
    };
    let root = Dir::open_ambient_dir(folder, ambient_authority()).map_err(target_error)?;
    let root_id = identity(&root)?;
    for index in 1..=99usize {
        let candidate = if index == 1 {
            base.clone()
        } else {
            format!("{base} ({index})")
        };
        match root.symlink_metadata(&candidate) {
            Ok(metadata) => {
                if !is_safe_dir(&metadata) {
                    continue;
                }
                if let Ok(peer) = root.open_dir(&candidate) {
                    if let (Some(expected), Ok(actual)) = (reusable_peer_root, identity(&peer)) {
                        if actual == expected {
                            return Ok((
                                Binding {
                                    root: root_id,
                                    peer: actual,
                                },
                                Some(candidate),
                            ));
                        }
                    }
                }
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                match root.create_dir(&candidate) {
                    Ok(()) => (),
                    Err(err) if err.kind() == io::ErrorKind::AlreadyExists => continue,
                    Err(err) => return Err(target_error(err)),
                }
                let metadata = root.symlink_metadata(&candidate).map_err(target_error)?;
                if !is_safe_dir(&metadata) {
                    return Err(PairingError::BackupPathRejected);
                }
                let peer = root.open_dir(&candidate).map_err(target_error)?;
                return Ok((
                    Binding {
                        root: root_id,
                        peer: identity(&peer)?,
                    },
                    Some(candidate),
                ));
            }
            Err(error) => return Err(target_error(error)),
        }
    }
    Ok((open(folder, fingerprint, true, None)?.0, None))
}

pub(crate) fn verify(
    folder: &str,
    fingerprint: &[u8; 32],
    binding: Binding,
    peer_folder: Option<&str>,
) -> Result<()> {
    if open(folder, fingerprint, false, peer_folder)?.0 != binding {
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
    pub(crate) fn staging(&self, create: bool) -> Result<Dir> {
        let kloda = open_subdir(&self.peer, ".kloda", create)?;
        if create {
            sync_dir(&self.peer)?;
        }
        let dir = open_subdir(&kloda, "staging", create)?;
        if create {
            sync_dir(&kloda)?;
        }
        Ok(dir)
    }
    pub(crate) fn objects(&self, create: bool) -> Result<Dir> {
        let kloda = open_subdir(&self.peer, ".kloda", create)?;
        if create {
            sync_dir(&self.peer)?;
        }
        let dir = open_subdir(&kloda, "objects", create)?;
        if create {
            sync_dir(&kloda)?;
        }
        Ok(dir)
    }
    pub(crate) fn visible_dir(&self, folder: &str, create: bool) -> Result<Dir> {
        if !matches!(folder, "Files" | "Photos") {
            return Err(PairingError::BackupPathRejected);
        }
        let dir = open_subdir(&self.peer, folder, create)?;
        if create {
            sync_dir(&self.peer)?;
        }
        Ok(dir)
    }
}

pub(crate) fn open_subdir(parent: &Dir, name: &str, create: bool) -> Result<Dir> {
    if !matches!(name, ".kloda" | "staging" | "objects" | "Files" | "Photos") {
        return Err(PairingError::BackupPathRejected);
    }
    if create {
        match parent.create_dir(name) {
            Ok(()) => (),
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => (),
            Err(error) => return Err(target_error(error)),
        }
    }
    let metadata = parent.symlink_metadata(name).map_err(target_error)?;
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
    parent.open_dir(name).map_err(target_error)
}

pub(crate) fn acquire(
    folder: &str,
    fingerprint: &[u8; 32],
    expected: Binding,
    peer_folder: Option<&str>,
) -> Result<Directories> {
    let (binding, directories) = open(folder, fingerprint, false, peer_folder)?;
    if binding != expected {
        return Err(PairingError::BackupScopeChanged);
    }
    Ok(directories)
}

fn is_safe_dir(metadata: &cap_std::fs::Metadata) -> bool {
    if !metadata.is_dir() || metadata.is_symlink() {
        return false;
    }
    #[cfg(windows)]
    {
        use cap_std::fs::MetadataExt;
        use windows_sys::Win32::Storage::FileSystem::FILE_ATTRIBUTE_REPARSE_POINT;
        if metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
            return false;
        }
    }
    true
}

fn open(
    folder: &str,
    fingerprint: &[u8; 32],
    create: bool,
    peer_folder: Option<&str>,
) -> Result<(Binding, Directories)> {
    if folder.len() > 4096 || folder.contains('\0') || !Path::new(folder).is_absolute() {
        return Err(PairingError::BackupPathRejected);
    }
    // Ambient authority is only for the PC-selected root, never a remote path.
    let root = Dir::open_ambient_dir(folder, ambient_authority()).map_err(target_error)?;
    let name = match peer_folder {
        Some(pf) => {
            if pf.is_empty()
                || pf.len() > 255
                || matches!(pf, "." | "..")
                || pf.contains(['/', '\\', '\0'])
            {
                return Err(PairingError::BackupPathRejected);
            }
            pf.to_owned()
        }
        None => crate::qr_base64::encode(fingerprint),
    };
    if create {
        match root.create_dir(&name) {
            Ok(()) => (),
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => (),
            Err(error) => return Err(target_error(error)),
        }
    }
    let metadata = root.symlink_metadata(&name).map_err(target_error)?;
    if !is_safe_dir(&metadata) {
        return Err(PairingError::BackupPathRejected);
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

pub(crate) fn open_visible_file(directory: &Dir, name: &str, writable: bool) -> Result<File> {
    if matches!(name, "." | "..") || !crate::file_schema::safe_name(name) {
        return Err(PairingError::BackupPathRejected);
    }
    regular(&directory.symlink_metadata(name).map_err(target_error)?)?;
    let mut options = OpenOptions::new();
    options.read(true).write(writable).create_new(false);
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
