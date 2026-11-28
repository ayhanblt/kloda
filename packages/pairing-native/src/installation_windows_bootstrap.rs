//! Fresh-only Generation #1 bootstrap on Windows. Never adopts, migrates, or resets existing state.
use super::{generation, handles, path, security};
use crate::certificate;
use crate::error::{PairingError, Result};
use crate::identity;
use crate::installation_generation_record::{self as record, Bindings, Kind, NamespaceRole, Record};
use crate::route;
use crate::startup_diagnostics::{self as diagnostic, Stage};
use ring::digest::{Context, SHA256};
use ring::rand::{SecureRandom, SystemRandom};
use rusqlite::{ffi, params, Connection, OpenFlags, TransactionBehavior};
use std::ffi::c_int;
use std::fs::File;
use std::io::Write;
use std::os::windows::io::AsRawHandle;
use std::path::Path;
use windows_sys::Win32::Foundation::{GENERIC_READ, GENERIC_WRITE};
use windows_sys::Win32::Storage::FileSystem::{
    CREATE_NEW, FILE_READ_ATTRIBUTES, FILE_SHARE_NONE, FILE_SHARE_READ, OPEN_EXISTING, READ_CONTROL,
};

fn write_protected_file(file_path: &Path, bytes: &[u8]) -> Result<File> {
    let mut file = handles::open(
        file_path,
        GENERIC_READ | GENERIC_WRITE,
        FILE_SHARE_NONE,
        CREATE_NEW,
        false,
        true,
    )?
    .ok_or(PairingError::StorageFailure)?;
    security::protected(file.as_raw_handle(), false, false)?;
    if !bytes.is_empty() {
        file.write_all(bytes).map_err(super::super::storage)?;
    }
    super::flush(&file)?;
    Ok(file)
}

fn sha256(domain: &[u8], payload: &[u8]) -> [u8; 32] {
    let mut ctx = Context::new(&SHA256);
    ctx.update(domain);
    ctx.update(payload);
    ctx.finish().as_ref().try_into().unwrap()
}

fn random_nonzero_16() -> Result<[u8; 16]> {
    let rng = SystemRandom::new();
    for _ in 0..8 {
        let mut bytes = [0u8; 16];
        rng.fill(&mut bytes)
            .map_err(|_| PairingError::NativeUnsupported)?;
        if bytes != [0u8; 16] {
            return Ok(bytes);
        }
    }
    Err(PairingError::NativeUnsupported)
}

fn seed_database(directory: &Path, spki: &crate::key::Spki, epoch: [u8; 16]) -> Result<()> {
    let db_path = directory.join("pairing.sqlite3");
    let mut conn = Connection::open_with_flags(
        &db_path,
        OpenFlags::SQLITE_OPEN_READ_WRITE
            | OpenFlags::SQLITE_OPEN_CREATE
            | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|_| PairingError::StorageFailure)?;
    let mode: String = conn
        .query_row("PRAGMA locking_mode=EXCLUSIVE", [], |r| r.get(0))
        .map_err(|_| PairingError::StorageFailure)?;
    if mode != "exclusive" {
        return Err(PairingError::StorageFailure);
    }
    let mut persist: c_int = 1;
    let rc = unsafe {
        ffi::sqlite3_file_control(
            conn.handle(),
            c"main".as_ptr(),
            ffi::SQLITE_FCNTL_PERSIST_WAL,
            (&mut persist as *mut c_int).cast(),
        )
    };
    if rc != ffi::SQLITE_OK || persist != 1 {
        return Err(PairingError::StorageFailure);
    }
    let wal: String = conn
        .query_row("PRAGMA journal_mode=WAL", [], |r| r.get(0))
        .map_err(|_| PairingError::StorageFailure)?;
    if wal != "wal" {
        return Err(PairingError::StorageFailure);
    }
    conn.execute_batch(
        "PRAGMA foreign_keys=ON; PRAGMA trusted_schema=OFF;
        PRAGMA synchronous=FULL; PRAGMA fullfsync=ON; PRAGMA checkpoint_fullfsync=ON;
        PRAGMA temp_store=MEMORY;",
    )
    .map_err(|_| PairingError::StorageFailure)?;

    let tx = conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|_| PairingError::StorageFailure)?;
    tx.execute_batch(crate::store_schema::SCHEMA)
        .map_err(|_| PairingError::StorageFailure)?;
    tx.execute(
        "INSERT INTO installation(id,version,local,epoch) VALUES(1,1,?1,?2)",
        params![spki.as_bytes().as_slice(), epoch.as_slice()],
    )
    .map_err(|_| PairingError::StorageFailure)?;
    tx.commit().map_err(|_| PairingError::OutcomeUnknown)?;

    let acl_tx = conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|_| PairingError::StorageFailure)?;
    acl_tx
        .execute_batch(crate::store_acl_schema::SCHEMA)
        .map_err(|_| PairingError::AclUnavailable)?;
    acl_tx.commit().map_err(|_| PairingError::OutcomeUnknown)?;

    crate::file_schema::migrate(&mut conn, 0)?;
    crate::backup_retention_schema::migrate(&mut conn, 0)?;
    crate::backup_layout_schema::migrate(&mut conn, 0)?;
    crate::device_metadata_schema::migrate(&mut conn, 0)?;

    let version: i64 = conn
        .pragma_query_value(None, "user_version", |r| r.get(0))
        .map_err(|_| PairingError::StorageFailure)?;
    if version != 6 {
        return Err(PairingError::ContinuityLost);
    }
    conn.close().map_err(|_| PairingError::StorageFailure)?;
    if !directory.join("pairing.sqlite3-wal").is_file()
        || directory.join("pairing.sqlite3-shm").exists()
    {
        return Err(PairingError::StorageFailure);
    }
    Ok(())
}

pub(crate) fn bootstrap_if_fresh(legacy: &Path) -> Result<()> {
    if legacy != path::compiled_legacy()? {
        return Err(PairingError::StorageFailure);
    }
    let profile = legacy.parent().ok_or(PairingError::StorageFailure)?;
    let role_root = profile.join("pairing-generations");
    let _profile_pins = path::directories_profile()?;

    let existing_legacy = handles::open(
        legacy,
        FILE_READ_ATTRIBUTES | READ_CONTROL,
        FILE_SHARE_READ,
        OPEN_EXISTING,
        true,
        false,
    )?;
    let existing_role = handles::open(
        &role_root,
        FILE_READ_ATTRIBUTES | READ_CONTROL,
        FILE_SHARE_READ,
        OPEN_EXISTING,
        true,
        false,
    )?;
    if existing_legacy.is_some() || existing_role.is_some() {
        return Ok(());
    }

    path::create_directory(legacy)?;
    let _legacy_lock = write_protected_file(&legacy.join("owner.lock"), &[])?;
    path::create_directory(&role_root)?;
    let _role_lock = write_protected_file(&role_root.join("owner.lock"), &[])?;

    let generation_id = random_nonzero_16()?;
    let epoch = random_nonzero_16()?;
    let epoch_commitment = sha256(b"Kloda.Windows.Generation.Epoch.v1\0", &epoch);
    let role = if cfg!(feature = "desktop-production") {
        NamespaceRole::Production
    } else {
        NamespaceRole::Development
    };
    let predecessor = record::genesis(role);

    let intent = Record::new(
        Kind::Intent,
        role,
        1,
        Bindings {
            generation: generation_id,
            epoch_commitment,
            predecessor_digest: predecessor,
        },
        [0; 32],
        [0; 32],
    )?;
    drop(write_protected_file(
        &role_root.join(record::leaf_name(Kind::Intent, 1, false)?),
        &intent.encode(),
    )?);

    let gen_dir = role_root.join(generation::generation_leaf(&generation_id));
    path::create_directory(&gen_dir)?;
    let _gen_lock = write_protected_file(&gen_dir.join("owner.lock"), &[])?;
    drop(write_protected_file(&gen_dir.join("epoch"), &epoch)?);

    let identity = diagnostic::at(Stage::Identity, || identity::open(&gen_dir, epoch, true))?;
    diagnostic::at(Stage::Certificate, || {
        let now = route::unix_seconds()?;
        let after = now
            .checked_add(365 * 86_400)
            .ok_or(PairingError::TlsRejected)?;
        let der = certificate::create_named(
            certificate::Role::Pc,
            identity.spki(),
            now,
            after,
            identity.certificate_signer(),
            crate::device_name::local_name().as_deref(),
        )?;
        drop(write_protected_file(&gen_dir.join("certificate.der"), &der)?);
        Ok(())
    })?;

    diagnostic::at(Stage::Database, || seed_database(&gen_dir, identity.spki(), epoch))?;
    drop(write_protected_file(&gen_dir.join("initialized"), &[1])?);

    let spki_commitment = sha256(
        b"Kloda.Windows.Generation.Spki.v1\0",
        identity.spki().as_bytes(),
    );
    let activation = Record::new(
        Kind::Activation,
        role,
        1,
        Bindings {
            generation: generation_id,
            epoch_commitment,
            predecessor_digest: predecessor,
        },
        intent.digest(),
        spki_commitment,
    )?;
    drop(write_protected_file(
        &role_root.join(record::leaf_name(Kind::Activation, 1, false)?),
        &activation.encode(),
    )?);

    Ok(())
}
