use crate::error::{PairingError, Result};
use ring::hmac;

pub(crate) const EXPORTER_LABEL: &[u8] = b"EXPORTER-KLODA-QR-PAIR-V1";
pub(crate) fn context(sid: &[u8; 16], pc: &[u8; 32], phone: &[u8; 32]) -> [u8; 98] {
    let mut out = [0; 98];
    out[..16].copy_from_slice(b"KLODA-QR-PAIR-V1");
    out[17] = 1;
    out[18..34].copy_from_slice(sid);
    out[34..66].copy_from_slice(pc);
    out[66..].copy_from_slice(phone);
    out
}
pub(crate) fn transcript(
    sid: &[u8; 16],
    pc: &[u8; 32],
    phone: &[u8; 32],
    cb: &[u8; 32],
) -> [u8; 138] {
    let mut out = [0; 138];
    out[..22].copy_from_slice(b"KLODA-QR-PAIR-V1-PROOF");
    out[23..26].fill(1);
    out[26..42].copy_from_slice(sid);
    out[42..74].copy_from_slice(pc);
    out[74..106].copy_from_slice(phone);
    out[106..].copy_from_slice(cb);
    out
}
pub(crate) fn tag(
    secret: &[u8; 32],
    sid: &[u8; 16],
    pc: &[u8; 32],
    phone: &[u8; 32],
    cb: &[u8; 32],
) -> [u8; 32] {
    let key = hmac::Key::new(hmac::HMAC_SHA256, secret);
    let result = hmac::sign(&key, &transcript(sid, pc, phone, cb));
    let mut out = [0; 32];
    out.copy_from_slice(result.as_ref());
    out
}
pub(crate) fn verify(
    secret: &[u8; 32],
    sid: &[u8; 16],
    pc: &[u8; 32],
    phone: &[u8; 32],
    cb: &[u8; 32],
    received: &[u8],
) -> Result<()> {
    if received.len() != 32 {
        return Err(PairingError::ProofRejected);
    }
    let key = hmac::Key::new(hmac::HMAC_SHA256, secret);
    hmac::verify(&key, &transcript(sid, pc, phone, cb), received)
        .map_err(|_| PairingError::ProofRejected)
}
#[cfg(test)]
#[path = "proof_tests.rs"]
mod tests;
