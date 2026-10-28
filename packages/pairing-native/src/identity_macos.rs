use super::{identity, HardwareSigner, Identity};
use crate::{
    apple_cf::{self as cf, Owned, Ref},
    error::{PairingError, Result},
    key::Spki,
};
use std::{
    ptr,
    sync::{Arc, Mutex},
};
#[link(name = "Security", kind = "framework")]
unsafe extern "C" {
    fn SecItemCopyMatching(query: Ref, result: *mut Ref) -> i32;
    fn SecKeyCreateRandomKey(parameters: Ref, error: *mut Ref) -> Ref;
    fn SecKeyCopyAttributes(key: Ref) -> Ref;
    fn SecKeyCopyPublicKey(key: Ref) -> Ref;
    fn SecKeyCopyExternalRepresentation(key: Ref, error: *mut Ref) -> Ref;
    fn SecKeyCreateSignature(key: Ref, algorithm: Ref, message: Ref, error: *mut Ref) -> Ref;
    fn SecKeyIsAlgorithmSupported(key: Ref, operation: isize, algorithm: Ref) -> u8;
    fn SecAccessControlCreateWithFlags(
        allocator: Ref,
        protection: Ref,
        flags: usize,
        error: *mut Ref,
    ) -> Ref;
    fn SecKeyGetTypeID() -> usize;
    static kSecClass: Ref;
    static kSecClassKey: Ref;
    static kSecAttrKeyType: Ref;
    static kSecAttrKeyTypeECSECPrimeRandom: Ref;
    static kSecAttrKeyClass: Ref;
    static kSecAttrKeyClassPrivate: Ref;
    static kSecAttrKeySizeInBits: Ref;
    static kSecAttrApplicationTag: Ref;
    static kSecAttrTokenID: Ref;
    static kSecAttrTokenIDSecureEnclave: Ref;
    static kSecAttrIsPermanent: Ref;
    static kSecAttrSynchronizable: Ref;
    static kSecAttrAccessControl: Ref;
    static kSecAttrAccessibleWhenUnlockedThisDeviceOnly: Ref;
    static kSecPrivateKeyAttrs: Ref;
    static kSecUseDataProtectionKeychain: Ref;
    static kSecUseAuthenticationUI: Ref;
    static kSecUseAuthenticationUIFail: Ref;
    static kSecReturnRef: Ref;
    static kSecMatchLimit: Ref;
    static kSecMatchLimitOne: Ref;
    static kSecKeyAlgorithmECDSASignatureMessageX962SHA256: Ref;
}
const SIGN_OPERATION: isize = 0;
// SecKey is retained, immutable Security CFType. Security key operations are thread-safe;
// the mutex additionally serializes every access/signature and destruction follows Arc drain.
// No other CF objects cross threads. The pointer is never exposed beyond this module.
struct EnclaveHandle(Owned);
unsafe impl Send for EnclaveHandle {}
struct EnclaveKey(Mutex<EnclaveHandle>);
impl HardwareSigner for EnclaveKey {
    fn sign_native(&self, message: &[u8]) -> Result<Vec<u8>> {
        let key = self
            .0
            .lock()
            .map_err(|_| PairingError::IdentityUnavailable)?;
        let data = Owned::data(message)?;
        unsafe {
            let mut error = ptr::null();
            let signature = SecKeyCreateSignature(
                key.0 .0,
                kSecKeyAlgorithmECDSASignatureMessageX962SHA256,
                data.0,
                &mut error,
            );
            if !error.is_null() {
                cf::CFRelease(error);
            }
            Owned::take(signature)?.bytes(80)
        }
    }
}
pub(super) fn open(tag: &str, create: bool) -> Result<Identity> {
    unsafe {
        let tag = Owned::data(tag.as_bytes())?;
        let query = Owned::dictionary(&[
            (kSecClass, kSecClassKey),
            (kSecAttrKeyClass, kSecAttrKeyClassPrivate),
            (kSecAttrApplicationTag, tag.0),
            (kSecAttrKeyType, kSecAttrKeyTypeECSECPrimeRandom),
            (kSecAttrTokenID, kSecAttrTokenIDSecureEnclave),
            (kSecUseDataProtectionKeychain, cf::kCFBooleanTrue),
            (kSecAttrSynchronizable, cf::kCFBooleanFalse),
            (kSecUseAuthenticationUI, kSecUseAuthenticationUIFail),
            (kSecReturnRef, cf::kCFBooleanTrue),
            (kSecMatchLimit, kSecMatchLimitOne),
        ])?;
        let mut key = ptr::null();
        let status = SecItemCopyMatching(query.0, &mut key);
        let key = match status {
            0 => Owned::take(key)?,
            -25300 if create => generate(&tag)?,
            -25300 => return Err(PairingError::ContinuityLost),
            -4 | -25291 => return Err(PairingError::NativeUnsupported),
            _ => return Err(PairingError::IdentityUnavailable),
        };
        if cf::CFGetTypeID(key.0) != SecKeyGetTypeID() {
            return Err(PairingError::IdentityUnavailable);
        }
        validate(&key)?;
        let public = Owned::take(SecKeyCopyPublicKey(key.0))?;
        let mut error = ptr::null();
        // Only the public SecKey is exportable; private key representation is never requested.
        let encoded = SecKeyCopyExternalRepresentation(public.0, &mut error);
        if !error.is_null() {
            cf::CFRelease(error);
        }
        let point = Owned::take(encoded)?.bytes(65)?;
        if point.len() != 65 || point[0] != 4 {
            return Err(PairingError::IdentityUnavailable);
        }
        let mut spki = [0u8; 91];
        spki[..26].copy_from_slice(&[
            0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06,
            0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00,
        ]);
        spki[26..].copy_from_slice(&point);
        Ok(identity(
            Spki::parse(&spki)?,
            Arc::new(EnclaveKey(Mutex::new(EnclaveHandle(key)))),
            "secure_enclave",
        ))
    }
}
unsafe fn generate(tag: &Owned) -> Result<Owned> {
    let size = Owned::number(256)?;
    let mut error = ptr::null();
    // privateKeyUsage=1<<30; intentionally no userPresence/biometric flags.
    let access = unsafe {
        SecAccessControlCreateWithFlags(
            ptr::null(),
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            1 << 30,
            &mut error,
        )
    };
    if !error.is_null() {
        unsafe { cf::CFRelease(error) };
    }
    let access = unsafe { Owned::take(access)? };
    let private = unsafe {
        Owned::dictionary(&[
            (kSecAttrIsPermanent, cf::kCFBooleanTrue),
            (kSecAttrApplicationTag, tag.0),
            (kSecAttrAccessControl, access.0),
            // The omitted synchronizable attribute defaults to false; retain
            // Secure Enclave and ThisDeviceOnly protection without usage hints.
        ])?
    };
    let parameters = unsafe {
        Owned::dictionary(&[
            (kSecAttrKeyType, kSecAttrKeyTypeECSECPrimeRandom),
            (kSecAttrKeySizeInBits, size.0),
            (kSecAttrTokenID, kSecAttrTokenIDSecureEnclave),
            (kSecPrivateKeyAttrs, private.0),
            (kSecUseDataProtectionKeychain, cf::kCFBooleanTrue),
        ])?
    };
    error = ptr::null();
    let key = unsafe { SecKeyCreateRandomKey(parameters.0, &mut error) };
    let code = if error.is_null() {
        0
    } else {
        unsafe { cf::CFErrorGetCode(error) }
    };
    if !error.is_null() {
        unsafe { cf::CFRelease(error) };
    }
    if key.is_null() && matches!(code, -4 | -25291) {
        return Err(PairingError::NativeUnsupported);
    }
    unsafe { Owned::take(key) }
}
unsafe fn validate(key: &Owned) -> Result<()> {
    let attributes = unsafe { Owned::take(SecKeyCopyAttributes(key.0))? };
    if unsafe { cf::CFGetTypeID(attributes.0) != cf::CFDictionaryGetTypeID() } {
        return Err(PairingError::IdentityUnavailable);
    }
    for (name, expected) in unsafe {
        [
            (kSecAttrKeyType, kSecAttrKeyTypeECSECPrimeRandom),
            (kSecAttrKeyClass, kSecAttrKeyClassPrivate),
            (kSecAttrTokenID, kSecAttrTokenIDSecureEnclave),
        ]
    } {
        let value = unsafe { cf::CFDictionaryGetValue(attributes.0, name) };
        if value.is_null() || unsafe { cf::CFEqual(value, expected) == 0 } {
            return Err(PairingError::NativeUnsupported);
        }
    }
    let size = unsafe { cf::CFDictionaryGetValue(attributes.0, kSecAttrKeySizeInBits) };
    let mut bits = 0i32;
    if size.is_null()
        || unsafe {
            cf::CFGetTypeID(size) != cf::CFNumberGetTypeID()
                || cf::CFNumberGetValue(size, 3, (&mut bits as *mut i32).cast()) == 0
        }
        || bits != 256
        // Reopened keys can encode CanSign as CFNumber; check the actual signing operation.
        || unsafe {
            SecKeyIsAlgorithmSupported(
                key.0,
                SIGN_OPERATION,
                kSecKeyAlgorithmECDSASignatureMessageX962SHA256,
            ) == 0
        }
    {
        return Err(PairingError::NativeUnsupported);
    }
    Ok(())
}

#[cfg(test)]
#[path = "identity_macos_tests.rs"]
mod tests;
