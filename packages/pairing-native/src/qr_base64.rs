use crate::error::{PairingError, Result};
const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

pub(crate) fn encode(bytes: &[u8]) -> String {
    let mut out = String::with_capacity((bytes.len() * 8).div_ceil(6));
    let mut bits = 0u32;
    let mut count = 0;
    for &byte in bytes {
        bits = (bits << 8) | u32::from(byte);
        count += 8;
        while count >= 6 {
            count -= 6;
            out.push(ALPHABET[((bits >> count) & 63) as usize] as char);
        }
    }
    if count != 0 {
        out.push(ALPHABET[((bits << (6 - count)) & 63) as usize] as char);
    }
    out
}

pub(crate) fn decode_into(source: &str, out: &mut [u8]) -> Result<usize> {
    let invalid = PairingError::InvalidQr;
    if source.len() % 4 == 1 || source.len() / 4 * 3 + source.len() % 4 * 6 / 8 > out.len() {
        return Err(invalid);
    }
    let mut bits = 0u32;
    let mut count = 0;
    let mut written = 0;
    for byte in source.bytes() {
        let value = match byte {
            b'A'..=b'Z' => byte - b'A',
            b'a'..=b'z' => byte - b'a' + 26,
            b'0'..=b'9' => byte - b'0' + 52,
            b'-' => 62,
            b'_' => 63,
            _ => return Err(PairingError::InvalidQr),
        };
        bits = (bits << 6) | u32::from(value);
        count += 6;
        if count >= 8 {
            count -= 8;
            out[written] = (bits >> count) as u8;
            written += 1;
        }
    }
    if count != 0 && bits & ((1 << count) - 1) != 0 {
        return Err(PairingError::InvalidQr);
    }
    // Alphabet, length and zero spare bits enforce exact decode/re-encode equality.
    Ok(written)
}

pub(crate) fn fixed<const N: usize>(source: &str) -> Result<[u8; N]> {
    if source.len() != (N * 8).div_ceil(6) {
        return Err(PairingError::InvalidQr);
    }
    let mut out = [0; N];
    if decode_into(source, &mut out)? != N {
        return Err(PairingError::InvalidQr);
    }
    Ok(out)
}
