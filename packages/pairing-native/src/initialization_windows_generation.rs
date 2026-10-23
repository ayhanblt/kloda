//! Reopen an already committed generation; never bootstrap, migrate or fallback.
use super::*;
use crate::store_windows_vfs::{self, Admission, Object};
use std::{
    ffi::{CStr, CString},
    sync::atomic::{AtomicBool, Ordering},
};
use windows_sys::Win32::Foundation::HANDLE;

struct DatabaseAdmission {
    owner: files::OwnerLock,
    main: CString,
    wal: CString,
    claimed: AtomicBool,
}
impl Admission for DatabaseAdmission {
    fn claim_connection(&self) -> bool {
        !self.claimed.swap(true, Ordering::AcqRel)
    }
    fn path(&self, object: Object) -> &CStr {
        match object {
            Object::Main => &self.main,
            Object::Wal => &self.wal,
        }
    }
    fn validate(&self, object: Object, handle: HANDLE) -> bool {
        let leaf = match object {
            Object::Main => "pairing.sqlite3",
            Object::Wal => "pairing.sqlite3-wal",
        };
        self.owner.sqlite_validate(leaf, handle)
    }
}
fn sqlite_name(directory: &std::path::Path, leaf: &str) -> Result<CString> {
    CString::new(
        directory
            .join(leaf)
            .to_str()
            .ok_or(PairingError::StorageFailure)?,
    )
    .map_err(|_| PairingError::StorageFailure)
}
pub(super) fn open(context: &NativeContext) -> Result<Installation> {
    if context.role != OwnerRole::Pc {
        return Err(PairingError::NativeUnsupported);
    }
    let selected = diagnostic::at(Stage::Storage, || files::select_generation(&context.directory))?;
    let identity = diagnostic::at(Stage::Identity, || {
        identity::open(&selected.directory, selected.epoch, false)
    })?;
    let mut digest = ring::digest::Context::new(&ring::digest::SHA256);
    digest.update(b"Kloda.Windows.Generation.Spki.v1\0");
    digest.update(identity.spki().as_bytes());
    if digest.finish().as_ref() != selected.head.spki_commitment {
        return Err(PairingError::ContinuityLost);
    }
    let der = diagnostic::at(Stage::Certificate, || {
        certificate_for(
            &selected.directory,
            &identity,
            Role::Pc,
            route::unix_seconds()?,
            &selected.owner,
        )
    })?;
    let admission = Arc::new(DatabaseAdmission {
        main: sqlite_name(&selected.directory, "pairing.sqlite3")?,
        wal: sqlite_name(&selected.directory, "pairing.sqlite3-wal")?,
        owner: selected.owner.clone(),
        claimed: AtomicBool::new(false),
    });
    let store = diagnostic::at(Stage::Database, || {
        Store::open_generation(
            store_windows_vfs::open(admission)?,
            identity.spki().clone(),
            selected.epoch,
        )
    })?;
    Ok(Installation {
        store,
        certified_key: Arc::new(CertifiedKey::new(
            vec![CertificateDer::from(der)],
            identity.signing_key(),
        )),
        identity,
        directory: selected.directory,
        epoch: selected.epoch,
        _owner_lock: selected.owner,
    })
}
