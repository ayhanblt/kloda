use crate::{
    error::{PairingError, Result},
    key::Spki,
};

const ORDER: [u8; 32] = [
    0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
    0xbc, 0xe6, 0xfa, 0xad, 0xa7, 0x17, 0x9e, 0x84, 0xf3, 0xb9, 0xca, 0xc2, 0xfc, 0x63, 0x25, 0x51,
];

pub(super) fn signature_der(raw: &[u8]) -> Result<Vec<u8>> {
    if raw.len() != 64 {
        return Err(PairingError::IdentityUnavailable);
    }
    let r = scalar(&raw[..32])?;
    let s = scalar(&raw[32..])?;
    let r_pad = usize::from(r[0] & 0x80 != 0);
    let s_pad = usize::from(s[0] & 0x80 != 0);
    let length = 4 + r.len() + r_pad + s.len() + s_pad;
    let mut der = Vec::with_capacity(length + 2);
    der.extend_from_slice(&[0x30, length as u8]);
    for (integer, padding) in [(r, r_pad), (s, s_pad)] {
        der.extend_from_slice(&[0x02, (integer.len() + padding) as u8]);
        if padding != 0 {
            der.push(0);
        }
        der.extend_from_slice(integer);
    }
    Ok(der)
}
fn scalar(bytes: &[u8]) -> Result<&[u8]> {
    if bytes >= ORDER.as_slice() {
        return Err(PairingError::IdentityUnavailable);
    }
    let first = bytes
        .iter()
        .position(|&byte| byte != 0)
        .ok_or(PairingError::IdentityUnavailable)?;
    Ok(&bytes[first..])
}

pub(super) fn public_spki(blob: &[u8]) -> Result<Spki> {
    // BCRYPT_ECCKEY_BLOB: native little-endian ULONG magic and cbKey, then
    // unsigned big-endian X/Y. ECS1 is ECDSA public P256, not ECDH/private/generic.
    if blob.len() != 72 || &blob[..4] != b"ECS1" || blob[4..8] != 32u32.to_le_bytes() {
        return Err(PairingError::IdentityUnavailable);
    }
    let mut encoded = [0u8; 91];
    encoded[..27].copy_from_slice(&[
        0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08,
        0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00, 0x04,
    ]);
    encoded[27..].copy_from_slice(&blob[8..]);
    // Existing common parser rejects out-of-field coordinates, infinity and off-curve points.
    Spki::parse(&encoded).map_err(|_| PairingError::IdentityUnavailable)
}

#[cfg(test)]
mod tests {
    use super::*;
    use ring::{
        agreement,
        rand::SystemRandom,
        signature::{self, KeyPair},
    };

    #[test]
    fn der_is_minimal_and_positive_for_trimmed_and_high_bit_scalars() {
        let mut raw = [0u8; 64];
        raw[31] = 0x80;
        raw[63] = 1;
        assert_eq!(
            signature_der(&raw).unwrap(),
            [0x30, 7, 2, 2, 0, 0x80, 2, 1, 1]
        );
        raw[..32].fill(0x80);
        raw[32..].fill(0x80);
        let der = signature_der(&raw).unwrap();
        assert_eq!(der.len(), 72);
        assert_eq!(&der[..5], &[0x30, 70, 2, 33, 0]);
        assert_eq!(&der[37..40], &[2, 33, 0]);
    }

    #[test]
    fn rejects_wrong_length_zero_and_out_of_order_scalars() {
        for size in [0, 63, 65] {
            assert!(signature_der(&vec![1; size]).is_err());
        }
        let mut raw = [1u8; 64];
        for start in [0, 32] {
            raw[start..start + 32].fill(0);
            assert!(signature_der(&raw).is_err());
            raw[start..start + 32].copy_from_slice(&ORDER);
            assert!(signature_der(&raw).is_err());
            raw[start..start + 32].fill(0xff);
            assert!(signature_der(&raw).is_err());
            raw[start..start + 32].fill(1);
        }
    }

    #[test]
    fn fixed_signature_converts_to_a_verifiable_der_signature() {
        // A real software signature is used only to exercise the pure encoding boundary,
        // never as a replacement for an SDK/hardware result or production signer.
        let rng = SystemRandom::new();
        let pkcs8 = signature::EcdsaKeyPair::generate_pkcs8(
            &signature::ECDSA_P256_SHA256_FIXED_SIGNING,
            &rng,
        )
        .unwrap();
        let key = signature::EcdsaKeyPair::from_pkcs8(
            &signature::ECDSA_P256_SHA256_FIXED_SIGNING,
            pkcs8.as_ref(),
            &rng,
        )
        .unwrap();
        let message = b"CNG fixed-field signature DER boundary";
        let fixed = key.sign(&rng, message).unwrap();
        let der = signature_der(fixed.as_ref()).unwrap();
        signature::UnparsedPublicKey::new(&signature::ECDSA_P256_SHA256_ASN1, key.public_key())
            .verify(message, &der)
            .unwrap();
    }

    #[test]
    fn rejects_hostile_public_blob_profiles_and_points() {
        let rng = SystemRandom::new();
        let key = agreement::EphemeralPrivateKey::generate(&agreement::ECDH_P256, &rng).unwrap();
        let point = key.compute_public_key().unwrap();
        let mut blob = [0u8; 72];
        blob[..4].copy_from_slice(b"ECS1");
        blob[4..8].copy_from_slice(&32u32.to_le_bytes());
        blob[8..].copy_from_slice(&point.as_ref()[1..]);
        let public = public_spki(&blob).unwrap();
        assert_eq!(&public.as_bytes()[26..], point.as_ref());
        for magic in [*b"ECK1", *b"ECS2", *b"ECS3", *b"ECS5", *b"ECSG"] {
            let mut hostile = blob;
            hostile[..4].copy_from_slice(&magic);
            assert!(public_spki(&hostile).is_err());
        }
        assert!(public_spki(&blob[..71]).is_err());
        let mut extended = blob.to_vec();
        extended.push(0);
        assert!(public_spki(&extended).is_err());
        let mut hostile = blob;
        hostile[4..8].copy_from_slice(&48u32.to_le_bytes());
        assert!(public_spki(&hostile).is_err());
        hostile = blob;
        hostile[8..].fill(0);
        assert!(public_spki(&hostile).is_err());
        hostile[8..40].fill(0xff);
        assert!(public_spki(&hostile).is_err());
        hostile[8..].fill(0);
        hostile[39] = 1;
        hostile[71] = 1;
        assert!(public_spki(&hostile).is_err());
    }
}
