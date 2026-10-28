use super::*;

fn ephemeral_software_key() -> Owned {
    // In-memory negative fixture only: no permanent key, application tag or Keychain write.
    unsafe {
        let size = Owned::number(256).unwrap();
        let parameters = Owned::dictionary(&[
            (kSecAttrKeyType, kSecAttrKeyTypeECSECPrimeRandom),
            (kSecAttrKeySizeInBits, size.0),
        ])
        .unwrap();
        let mut error = ptr::null();
        let key = SecKeyCreateRandomKey(parameters.0, &mut error);
        if !error.is_null() {
            cf::CFRelease(error);
        }
        Owned::take(key).unwrap()
    }
}

#[test]
fn signing_operation_support_distinguishes_private_and_public_keys() {
    let private = ephemeral_software_key();
    unsafe {
        let public = Owned::take(SecKeyCopyPublicKey(private.0)).unwrap();
        assert_ne!(
            SecKeyIsAlgorithmSupported(
                private.0,
                SIGN_OPERATION,
                kSecKeyAlgorithmECDSASignatureMessageX962SHA256
            ),
            0
        );
        assert_eq!(
            SecKeyIsAlgorithmSupported(
                public.0,
                SIGN_OPERATION,
                kSecKeyAlgorithmECDSASignatureMessageX962SHA256
            ),
            0
        );
    }
}

#[test]
fn algorithm_support_does_not_admit_a_software_identity() {
    let key = ephemeral_software_key();
    unsafe {
        assert_eq!(validate(&key), Err(PairingError::NativeUnsupported));
        let public = Owned::take(SecKeyCopyPublicKey(key.0)).unwrap();
        assert_eq!(validate(&public), Err(PairingError::NativeUnsupported));
    }
}
