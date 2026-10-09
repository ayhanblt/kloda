use super::{identity, windows_encoding, HardwareSigner, Identity};
use crate::error::{PairingError, Result};
use ring::digest::{digest, SHA256};
use std::{
    ptr,
    sync::{Arc, Mutex},
};
use windows_sys::{
    core::PCWSTR,
    Win32::{
        Foundation::{
            NTE_BAD_ALGID, NTE_BAD_KEYSET, NTE_DEVICE_NOT_FOUND, NTE_NOT_SUPPORTED,
            TBS_E_TPM_NOT_FOUND, TPM_20_E_ASYMMETRIC, TPM_20_E_CURVE, TPM_20_E_ECC_CURVE,
            TPM_20_E_SCHEME,
        },
        Security::Cryptography::*,
    },
};

// NCrypt handles are process-owned opaque integers, not COM/thread-affine pointers.
// The key and its provider remain owned together; field order frees key first.
// All post-publication key access is serialized; Arc drain precedes destruction.
struct Owned(NCRYPT_HANDLE);
impl Drop for Owned {
    fn drop(&mut self) {
        if self.0 != 0 {
            unsafe {
                NCryptFreeObject(self.0);
            }
        }
    }
}
struct Handles {
    key: Owned,
    _provider: Owned,
}
struct TpmKey(Mutex<Handles>);
impl HardwareSigner for TpmKey {
    fn sign_native(&self, message: &[u8]) -> Result<Vec<u8>> {
        let hash = digest(&SHA256, message);
        let handles = self
            .0
            .lock()
            .map_err(|_| PairingError::IdentityUnavailable)?;
        let mut raw = [0u8; 64];
        let mut written = 0;
        // CNG ECDSA signs the prehash with no padding, returning IEEE P1363 r||s.
        // Only certificate TBS and rustls CertificateVerify reach this native trait.
        status(unsafe {
            NCryptSignHash(
                handles.key.0,
                ptr::null(),
                hash.as_ref().as_ptr(),
                32,
                raw.as_mut_ptr(),
                64,
                &mut written,
                NCRYPT_SILENT_FLAG,
            )
        })?;
        if written != 64 {
            return Err(PairingError::IdentityUnavailable);
        }
        windows_encoding::signature_der(&raw)
    }
}

pub(super) fn open(tag: &str, create: bool) -> Result<Identity> {
    let mut provider = Owned(0);
    status(unsafe { NCryptOpenStorageProvider(&mut provider.0, MS_PLATFORM_CRYPTO_PROVIDER, 0) })?;
    require_handle(&provider)?;
    let implementation = dword(&provider, NCRYPT_IMPL_TYPE_PROPERTY)?;
    if implementation & NCRYPT_IMPL_HARDWARE_FLAG == 0
        || implementation & (NCRYPT_IMPL_SOFTWARE_FLAG | NCRYPT_IMPL_VIRTUAL_ISOLATION_FLAG) != 0
    {
        return Err(PairingError::NativeUnsupported);
    }
    // Internal ASCII alias is21 prefix bytes plus64 hex bytes; retain a NUL.
    let mut name = [0u16; 86];
    for (index, unit) in tag.encode_utf16().enumerate() {
        *name
            .get_mut(index)
            .filter(|_| index < 85)
            .ok_or(PairingError::IdentityUnavailable)? = unit;
    }
    let mut key = Owned(0);
    let opened =
        unsafe { NCryptOpenKey(provider.0, &mut key.0, name.as_ptr(), 0, NCRYPT_SILENT_FLAG) };
    if opened == NTE_BAD_KEYSET {
        if !create {
            return Err(PairingError::ContinuityLost);
        }
        // Release any partial failed-open handle before requesting a new one.
        drop(key);
        key = generate(&provider, &name)?;
    } else {
        status(opened)?;
    }
    require_handle(&key)?;
    validate(&key)?;
    let mut blob = [0u8; 72];
    let mut written = 0;
    // The only export is the ECC public blob; never request a private/opaque blob.
    status(unsafe {
        NCryptExportKey(
            key.0,
            0,
            BCRYPT_ECCPUBLIC_BLOB,
            ptr::null(),
            blob.as_mut_ptr(),
            72,
            &mut written,
            NCRYPT_SILENT_FLAG,
        )
    })?;
    if written != 72 {
        return Err(PairingError::IdentityUnavailable);
    }
    let public = windows_encoding::public_spki(&blob)?;
    Ok(identity(
        public,
        Arc::new(TpmKey(Mutex::new(Handles {
            key,
            _provider: provider,
        }))),
        "windows_tpm",
    ))
}

fn generate(provider: &Owned, name: &[u16]) -> Result<Owned> {
    let mut key = Owned(0);
    // Named current-user key. No OVERWRITE, MACHINE, software or VBS flags.
    // No PIN, migration password, archiving policy or user-presence UI is set.
    status(unsafe {
        NCryptCreatePersistedKey(
            provider.0,
            &mut key.0,
            BCRYPT_ECDSA_P256_ALGORITHM,
            name.as_ptr(),
            0,
            0,
        )
    })?;
    require_handle(&key)?;
    set_dword(&key, NCRYPT_KEY_USAGE_PROPERTY, NCRYPT_ALLOW_SIGNING_FLAG)?;
    set_dword(
        &key,
        NCRYPT_PCP_KEY_USAGE_POLICY_PROPERTY,
        NCRYPT_PCP_SIGNATURE_KEY,
    )?;
    // PCP only permits setting an archiving export policy; leaving that unset
    // creates a non-exportable key. Read and reject any nonzero policy below.
    status(unsafe { NCryptFinalizeKey(key.0, NCRYPT_SILENT_FLAG) })?;
    Ok(key)
}

fn validate(key: &Owned) -> Result<()> {
    let mut algorithm = [0u8; 22];
    get_exact(key, NCRYPT_ALGORITHM_PROPERTY, &mut algorithm)?;
    let expected = "ECDSA_P256".encode_utf16().chain(Some(0));
    if !algorithm
        .chunks_exact(2)
        .map(|b| u16::from_le_bytes([b[0], b[1]]))
        .eq(expected)
        || dword(key, NCRYPT_LENGTH_PROPERTY)? != 256
        || dword(key, NCRYPT_KEY_TYPE_PROPERTY)? != 0
        || dword(key, NCRYPT_KEY_USAGE_PROPERTY)? != NCRYPT_ALLOW_SIGNING_FLAG
        || dword(key, NCRYPT_PCP_KEY_USAGE_POLICY_PROPERTY)? != NCRYPT_PCP_SIGNATURE_KEY
        || dword(key, NCRYPT_EXPORT_POLICY_PROPERTY)? != 0
    {
        return Err(PairingError::NativeUnsupported);
    }
    // PCP BOOLEAN properties are one byte (not Win32 BOOL/DWORD). ExportAllowed
    // also marks imported keys whose private material previously existed outside TPM.
    for property in [
        NCRYPT_PCP_EXPORT_ALLOWED_PROPERTY,
        NCRYPT_PCP_PASSWORD_REQUIRED_PROPERTY,
    ] {
        let mut flag = [0u8; 1];
        get_exact(key, property, &mut flag)?;
        if flag[0] != 0 {
            return Err(PairingError::NativeUnsupported);
        }
    }
    // ECDSA_P256 fixes the curve; the public blob must also have its P256 magic.
    Ok(())
}

fn get_exact(object: &Owned, property: PCWSTR, out: &mut [u8]) -> Result<()> {
    let mut written = 0;
    status(unsafe {
        NCryptGetProperty(
            object.0,
            property,
            out.as_mut_ptr(),
            out.len() as u32,
            &mut written,
            NCRYPT_SILENT_FLAG,
        )
    })?;
    if written as usize != out.len() {
        return Err(PairingError::IdentityUnavailable);
    }
    Ok(())
}
fn dword(object: &Owned, property: PCWSTR) -> Result<u32> {
    let mut bytes = [0u8; 4];
    get_exact(object, property, &mut bytes)?;
    Ok(u32::from_le_bytes(bytes))
}
fn set_dword(key: &Owned, property: PCWSTR, value: u32) -> Result<()> {
    status(unsafe {
        NCryptSetProperty(
            key.0,
            property,
            value.to_le_bytes().as_ptr(),
            4,
            NCRYPT_SILENT_FLAG,
        )
    })
}
fn require_handle(object: &Owned) -> Result<()> {
    if object.0 == 0 {
        Err(PairingError::IdentityUnavailable)
    } else {
        Ok(())
    }
}
fn status(code: i32) -> Result<()> {
    match code {
        0 => Ok(()),
        NTE_NOT_SUPPORTED | NTE_BAD_ALGID | NTE_DEVICE_NOT_FOUND | TBS_E_TPM_NOT_FOUND
        | TPM_20_E_ASYMMETRIC | TPM_20_E_CURVE | TPM_20_E_ECC_CURVE | TPM_20_E_SCHEME => {
            Err(PairingError::NativeUnsupported)
        }
        // Access, lockout, device-not-ready, silent-context and transient TPM errors
        // never trigger creation, reset or a different provider.
        _ => Err(PairingError::IdentityUnavailable),
    }
}
