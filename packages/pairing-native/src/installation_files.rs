use crate::error::{PairingError, Result};
use ring::rand::{SecureRandom, SystemRandom};
#[cfg(unix)]
use std::os::unix::fs::OpenOptionsExt;
#[cfg(any(target_os = "macos", target_os = "android"))]
use std::os::unix::{fs::PermissionsExt, io::AsRawFd};
use std::{fs::File, io::Read, path::Path};
#[cfg(not(target_os = "windows"))]
use std::{
    fs::{self, OpenOptions},
    io::Write,
};

#[cfg(target_os = "windows")]
#[path = "installation_windows.rs"]
mod windows;
#[cfg(target_os = "windows")]
pub(super) use windows::{exists, prepare, replace, write_new, OwnerLock};
#[cfg(not(target_os = "windows"))]
pub(crate) type OwnerLock = File;

#[cfg(not(any(target_os = "macos", target_os = "android", target_os = "windows")))]
pub(super) fn prepare(_: &Path) -> Result<OwnerLock> {
    // No authority files may be created before native custody and storage are supported.
    Err(PairingError::NativeUnsupported)
}

#[cfg(any(target_os = "macos", target_os = "android"))]
pub(super) fn prepare(directory: &Path) -> Result<File> {
    fs::create_dir_all(directory).map_err(storage)?;
    let metadata = fs::symlink_metadata(directory).map_err(storage)?;
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return Err(PairingError::StorageFailure);
    }
    fs::set_permissions(directory, fs::Permissions::from_mode(0o700)).map_err(storage)?;
    #[cfg(target_os = "macos")]
    crate::apple_cf::exclude_directory_from_backup(directory)?;
    // Android directory is Kotlin application noBackupFilesDir, not a JS path.
    let lock = open_file(&directory.join("owner.lock"), true)?;
    if unsafe { libc::flock(lock.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } != 0 {
        return Err(PairingError::StorageFailure);
    }
    Ok(lock)
}

pub(super) fn epoch(directory: &Path) -> Result<([u8; 16], bool)> {
    let bound = ["initialized", "pairing.sqlite3", "certificate.der"]
        .iter()
        .try_fold(false, |found, name| {
            Ok::<_, PairingError>(found || exists(&directory.join(name))?)
        })?;
    let path = directory.join("epoch");
    if exists(&path)? {
        return Ok((read_exact(&path)?, !bound));
    }
    if bound {
        return Err(PairingError::ContinuityLost);
    }
    let mut epoch = [0; 16];
    SystemRandom::new()
        .fill(&mut epoch)
        .map_err(|_| PairingError::NativeUnsupported)?;
    write_new(&path, &epoch)?;
    Ok((epoch, true))
}

#[cfg(not(target_os = "windows"))]
pub(super) fn exists(path: &Path) -> Result<bool> {
    match fs::symlink_metadata(path) {
        Ok(m) => {
            if !m.is_file() || m.file_type().is_symlink() {
                Err(PairingError::StorageFailure)
            } else {
                Ok(true)
            }
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(_) => Err(PairingError::StorageFailure),
    }
}
pub(super) fn read_exact<const N: usize>(path: &Path) -> Result<[u8; N]> {
    let mut file = open_file(path, false)?;
    if file.metadata().map_err(storage)?.len() != N as u64 {
        return Err(PairingError::ContinuityLost);
    }
    let mut bytes = [0; N];
    file.read_exact(&mut bytes).map_err(storage)?;
    Ok(bytes)
}
pub(super) fn read_certificate(path: &Path) -> Result<Vec<u8>> {
    let mut file = open_file(path, false)?;
    let size = file.metadata().map_err(storage)?.len();
    if size == 0 || size > 4096 {
        return Err(PairingError::TlsRejected);
    }
    let mut bytes = vec![0; size as usize];
    file.read_exact(&mut bytes).map_err(storage)?;
    Ok(bytes)
}
#[cfg(not(target_os = "windows"))]
pub(super) fn write_new(path: &Path, bytes: &[u8]) -> Result<()> {
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    options.mode(0o600).custom_flags(libc::O_NOFOLLOW);
    let mut file = options.open(path).map_err(storage)?;
    file.write_all(bytes).map_err(storage)?;
    durable(&file)?;
    File::open(path.parent().ok_or(PairingError::StorageFailure)?)
        .map_err(storage)?
        .sync_all()
        .map_err(storage)
}
#[cfg(not(target_os = "windows"))]
pub(super) fn replace(path: &Path, bytes: &[u8]) -> Result<()> {
    let temporary = path.with_extension("pending");
    if exists(&temporary)? {
        fs::remove_file(&temporary).map_err(storage)?
    }
    write_new(&temporary, bytes)?;
    fs::rename(&temporary, path).map_err(storage)?;
    File::open(path.parent().ok_or(PairingError::StorageFailure)?)
        .map_err(storage)?
        .sync_all()
        .map_err(storage)
}
#[cfg(target_os = "windows")]
fn open_file(path: &Path, _: bool) -> Result<File> {
    windows::open_file(path)
}
#[cfg(not(target_os = "windows"))]
fn open_file(path: &Path, create: bool) -> Result<File> {
    let mut options = OpenOptions::new();
    options.read(true);
    if create {
        options.write(true).create(true);
    }
    #[cfg(unix)]
    options.mode(0o600).custom_flags(libc::O_NOFOLLOW);
    let file = options.open(path).map_err(storage)?;
    if !file.metadata().map_err(storage)?.is_file() {
        return Err(PairingError::StorageFailure);
    }
    Ok(file)
}
#[cfg(not(target_os = "windows"))]
fn durable(file: &File) -> Result<()> {
    file.sync_all().map_err(storage)?;
    #[cfg(target_os = "macos")]
    if unsafe { libc::fcntl(file.as_raw_fd(), libc::F_FULLFSYNC) } != 0 {
        return Err(PairingError::StorageFailure);
    }
    Ok(())
}
fn storage(error: std::io::Error) -> PairingError {
    #[cfg(target_os = "windows")]
    crate::startup_diagnostics::record(
        Some(crate::startup_diagnostics::Operation::Io),
        PairingError::StorageFailure,
        error.raw_os_error().map(|code| code as u32),
    );
    #[cfg(not(target_os = "windows"))]
    let _ = error;
    PairingError::StorageFailure
}

#[cfg(all(
    test,
    not(any(target_os = "macos", target_os = "android", target_os = "windows"))
))]
mod tests {
    use super::*;

    #[test]
    fn unsupported_owners_create_no_installation_state() {
        let mut nonce = [0; 16];
        SystemRandom::new().fill(&mut nonce).unwrap();
        let directory = std::env::temp_dir().join(format!(
            "kloda-unsupported-{:032x}",
            u128::from_be_bytes(nonce)
        ));
        assert!(!directory.exists());
        assert!(matches!(
            crate::PairingOwner::open_pc(directory.clone()),
            Err(PairingError::NativeUnsupported)
        ));
        assert!(matches!(
            crate::PairingOwner::open_phone(directory.clone()),
            Err(PairingError::NativeUnsupported)
        ));
        assert!(
            !directory.exists(),
            "unsupported custody must leave no files"
        );
    }
}
