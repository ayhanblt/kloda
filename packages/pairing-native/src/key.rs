use crate::error::{PairingError, Result};
use ring::{agreement, digest, rand::SystemRandom, signature};

const PREFIX: [u8; 27] = [
    0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a,
    0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00, 0x04,
];
const FIELD: [u8; 32] = [
    0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
];
#[derive(Clone, PartialEq, Eq)]
pub(crate) struct Spki([u8; 91]);
impl Spki {
    fn canonical(bytes: &[u8]) -> Result<Self> {
        if bytes.len() != 91
            || bytes[..27] != PREFIX
            || bytes[27..59] >= FIELD[..]
            || bytes[59..91] >= FIELD[..]
        {
            return Err(PairingError::TlsRejected);
        }
        let mut out = [0; 91];
        out.copy_from_slice(bytes);
        Ok(Self(out))
    }
    pub(crate) fn parse(bytes: &[u8]) -> Result<Self> {
        let spki = Self::canonical(bytes)?;
        // ring has no standalone public point validator. A discarded ephemeral
        // P-256 agreement performs its on-curve, field and infinity checks.
        let ephemeral =
            agreement::EphemeralPrivateKey::generate(&agreement::ECDH_P256, &SystemRandom::new())
                .map_err(|_| PairingError::IdentityUnavailable)?;
        let public = agreement::UnparsedPublicKey::new(&agreement::ECDH_P256, &spki.0[26..]);
        agreement::agree_ephemeral(ephemeral, &public, |_| ())
            .map_err(|_| PairingError::TlsRejected)?;
        Ok(spki)
    }
    /// Only this actual signature verification path bypasses the additional ECDH check.
    pub(crate) fn from_signed_certificate(
        bytes: &[u8],
        tbs: &[u8],
        signature_bytes: &[u8],
    ) -> Result<Self> {
        let spki = Self::canonical(bytes)?;
        signature::UnparsedPublicKey::new(&signature::ECDSA_P256_SHA256_ASN1, &spki.0[26..])
            .verify(tbs, signature_bytes)
            .map_err(|_| PairingError::TlsRejected)?;
        Ok(spki)
    }
    pub(crate) fn as_bytes(&self) -> &[u8; 91] {
        &self.0
    }
    pub(crate) fn fingerprint(&self) -> [u8; 32] {
        let hash = digest::digest(&digest::SHA256, &self.0);
        let mut out = [0; 32];
        out.copy_from_slice(hash.as_ref());
        out
    }
}
#[cfg(test)]
#[path = "key_tests.rs"]
mod tests;
