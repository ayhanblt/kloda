//! Existing-only selected generation admission. Never bootstraps or adopts state.
use super::{handles, legacy_fence::LegacyFence, path, security, OwnerLock, OwnerPins};
use crate::error::{PairingError, Result};
use crate::installation_generation_chain::{self as chain, ChainHead, Entry, Inventory};
use crate::installation_generation_record::{self as record, NamespaceRole, Record};
use std::{fs::{self, File}, io::Read, os::windows::io::AsRawHandle, path::{Path, PathBuf}, sync::Arc};
use windows_sys::Win32::{Foundation::{GENERIC_READ, GENERIC_WRITE, HANDLE}, Storage::FileSystem::*};

pub(crate) struct Selected {
    pub(crate) directory: PathBuf,
    pub(crate) owner: OwnerLock,
    pub(crate) head: ChainHead,
    pub(crate) epoch: [u8; 16],
}
pub(super) struct Pins {
    _legacy: LegacyFence,
    _role: File,
    _records: Vec<File>,
    database: File,
    wal: File,
}
pub(super) fn generation_name(name: &str) -> bool {
    name.strip_prefix("generation-").is_some_and(|id| id.len() == 32 && id.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)))
}
fn generation_leaf(id: &[u8; 16]) -> String {
    let mut name = String::from("generation-");
    for byte in id { use std::fmt::Write; write!(name, "{byte:02x}").expect("String formatting"); }
    name
}
fn checked(file: &Path, access: u32, share: u32, sqlite: bool) -> Result<File> {
    let file = handles::open(file, access, share, OPEN_EXISTING, false, false)?.ok_or(PairingError::ContinuityLost)?;
    security::protected(file.as_raw_handle(), false, sqlite)?;
    Ok(file)
}
fn lock(file: &Path) -> Result<File> {
    // Data-read access participates in Windows sharing checks against another
    // updated owner. Metadata-only access with share-none is not mutual exclusion.
    let file = checked(file, GENERIC_READ | READ_CONTROL, FILE_SHARE_NONE, false)?;
    if file.metadata().map_err(super::super::storage)?.len() != 0 { return Err(PairingError::ContinuityLost); }
    Ok(file)
}
fn read<const N: usize>(file: &mut File) -> Result<[u8; N]> {
    if file.metadata().map_err(super::super::storage)?.len() != N as u64 { return Err(PairingError::ContinuityLost); }
    let mut bytes = [0; N];
    file.read_exact(&mut bytes).map_err(super::super::storage)?;
    Ok(bytes)
}
pub(crate) fn selected(legacy: &Path) -> Result<Selected> {
    if legacy != path::compiled_legacy()? { return Err(PairingError::StorageFailure); }
    let legacy = LegacyFence::acquire(legacy)?;
    let root = path::compiled_legacy()?.parent().ok_or(PairingError::StorageFailure)?.join("pairing-generations");
    let mut ancestors = path::directories(&root, false)?;
    let role_lock = lock(&root.join("owner.lock"))?;
    let mut records = Vec::new();
    let mut owned = Vec::new();
    let mut directories = Vec::new();
    let mut count = 0;
    for entry in fs::read_dir(&root).map_err(super::super::storage)? {
        count += 1;
        if count > chain::MAX_ACTIVATIONS * 3 + 1 { return Err(PairingError::ContinuityLost); }
        let entry = entry.map_err(super::super::storage)?;
        let name = entry.file_name().into_string().map_err(|_| PairingError::ContinuityLost)?;
        if name == "owner.lock" { continue; }
        if generation_name(&name) {
            directories.push(name);
            if directories.len() > chain::MAX_ACTIVATIONS { return Err(PairingError::ContinuityLost); }
            continue;
        }
        let (_, _, pending) = record::parse_leaf_name(&name)?;
        if pending || owned.len() >= chain::MAX_ACTIVATIONS * 2 { return Err(PairingError::ContinuityLost); }
        let mut file = checked(&entry.path(), GENERIC_READ | GENERIC_WRITE, FILE_SHARE_READ, false)?;
        let bytes = read::<{record::LEN}>(&mut file)?;
        owned.push((name, bytes));
        records.push(file);
    }
    let entries: Vec<_> = owned.iter().map(|(name, bytes)| Entry { name, bytes }).collect();
    let role = if cfg!(feature = "desktop-production") { NamespaceRole::Production } else { NamespaceRole::Development };
    let Inventory::Selected(head) = chain::validate_inventory(role, &entries)? else { return Err(PairingError::ContinuityLost); };
    let mut expected = Vec::new();
    for (_, bytes) in &owned {
        let name = generation_leaf(&Record::decode(bytes)?.generation());
        if !expected.contains(&name) { expected.push(name); }
    }
    directories.sort(); expected.sort();
    if directories != expected { return Err(PairingError::ContinuityLost); }
    let directory = root.join(generation_leaf(&head.generation));
    ancestors.extend(path::directories(&directory, false)?);
    let owner = lock(&directory.join("owner.lock"))?;
    let mut leaf_count = 0;
    for entry in fs::read_dir(&directory).map_err(super::super::storage)? {
        leaf_count += 1;
        if leaf_count > 7 { return Err(PairingError::ContinuityLost); }
        let entry = entry.map_err(super::super::storage)?;
        match entry.file_name().to_str() {
            Some("owner.lock" | "epoch" | "initialized" | "certificate.der" | "pairing.sqlite3" | "pairing.sqlite3-wal" | "listener-port") => (),
            _ => return Err(PairingError::ContinuityLost),
        }
    }
    let mut epoch_file = checked(&directory.join("epoch"), GENERIC_READ, FILE_SHARE_READ, false)?;
    let epoch = read::<16>(&mut epoch_file)?;
    let mut digest = ring::digest::Context::new(&ring::digest::SHA256);
    digest.update(b"Kloda.Windows.Generation.Epoch.v1\0"); digest.update(&epoch);
    if digest.finish().as_ref() != head.epoch_commitment { return Err(PairingError::ContinuityLost); }
    let mut initialized = checked(&directory.join("initialized"), GENERIC_READ, FILE_SHARE_READ, false)?;
    if read::<1>(&mut initialized)? != [1] { return Err(PairingError::ContinuityLost); }
    let certificate = checked(&directory.join("certificate.der"), GENERIC_READ, FILE_SHARE_READ, false)?;
    let length = certificate.metadata().map_err(super::super::storage)?.len();
    if length == 0 || length > 4096 { return Err(PairingError::ContinuityLost); }
    let database = checked(&directory.join("pairing.sqlite3"), FILE_READ_ATTRIBUTES | READ_CONTROL, FILE_SHARE_READ | FILE_SHARE_WRITE, true)?;
    let wal = checked(&directory.join("pairing.sqlite3-wal"), FILE_READ_ATTRIBUTES | READ_CONTROL, FILE_SHARE_READ | FILE_SHARE_WRITE, true)?;
    // Reflush complete immutable records before any positive startup acknowledgement.
    for file in &records { super::flush(file)?; }
    records.extend([epoch_file, initialized, certificate]);
    Ok(Selected { directory: directory.clone(), head, epoch, owner: OwnerLock {
        directory,
        _pins: Arc::new(OwnerPins { _owner: owner, _ancestors: ancestors, _generation: Some(Pins { _legacy: legacy, _role: role_lock, _records: records, database, wal }) }),
    } })
}

impl OwnerLock {
    pub(crate) fn sqlite_validate(&self, leaf: &str, actual: HANDLE) -> bool {
        let Some(pins) = &self._pins._generation else { return false; };
        let expected = match leaf { "pairing.sqlite3" => &pins.database, "pairing.sqlite3-wal" => &pins.wal, _ => return false };
        let mut original = BY_HANDLE_FILE_INFORMATION::default();
        let mut opened = BY_HANDLE_FILE_INFORMATION::default();
        let mut original_id = FILE_ID_INFO::default();
        let mut actual_id = FILE_ID_INFO::default();
        // Borrow only; SQLite remains the sole owner of its handle.
        use crate::startup_diagnostics::Operation;
        if security::os_check(unsafe { GetFileInformationByHandle(expected.as_raw_handle(), &mut original) }, Operation::FileInformation).is_err()
            || security::os_check(unsafe { GetFileInformationByHandle(actual, &mut opened) }, Operation::FileInformation).is_err() { return false; }
        if security::os_check(unsafe { GetFileInformationByHandleEx(expected.as_raw_handle(), FileIdInfo, (&mut original_id as *mut FILE_ID_INFO).cast(), std::mem::size_of::<FILE_ID_INFO>() as u32) }, Operation::FileInformation).is_err()
            || security::os_check(unsafe { GetFileInformationByHandleEx(actual, FileIdInfo, (&mut actual_id as *mut FILE_ID_INFO).cast(), std::mem::size_of::<FILE_ID_INFO>() as u32) }, Operation::FileInformation).is_err() { return false; }
        use std::os::windows::io::FromRawHandle;
        // ManuallyDrop borrows the SQLite handle without ever closing it.
        let borrowed = std::mem::ManuallyDrop::new(unsafe { File::from_raw_handle(actual) });
        security::protected(actual, false, true).is_ok()
            && handles::check_final_path(&borrowed, &self.directory.join(leaf)).is_ok()
            && original_id.VolumeSerialNumber == actual_id.VolumeSerialNumber
            && original_id.FileId.Identifier == actual_id.FileId.Identifier
            && opened.dwFileAttributes & (FILE_ATTRIBUTE_REPARSE_POINT | FILE_ATTRIBUTE_DIRECTORY | FILE_ATTRIBUTE_OFFLINE | FILE_ATTRIBUTE_RECALL_ON_OPEN | FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS) == 0
            && opened.nNumberOfLinks == 1
            && unsafe { GetFileType(actual) } == FILE_TYPE_DISK
            && (original.dwVolumeSerialNumber, original.nFileIndexHigh, original.nFileIndexLow) == (opened.dwVolumeSerialNumber, opened.nFileIndexHigh, opened.nFileIndexLow)
    }
}

#[cfg(test)]
#[path = "installation_windows_generation_native_tests.rs"]
mod native_tests;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generation_components_are_exact_and_cannot_select_paths() {
        assert!(generation_name(&generation_leaf(&[7; 16])));
        for value in ["generation-", "generation-ABCDEF0123456789abcdef0123456789", "generation-00000000000000000000000000000000.pending", "generation-00000000000000000000000000000000/epoch", "../generation-00000000000000000000000000000000"] {
            assert!(!generation_name(value));
        }
    }
}
