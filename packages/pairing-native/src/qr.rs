use crate::{
    error::{PairingError, Result},
    qr_base64, qr_ip, qr_json,
};
use std::net::IpAddr;
use zeroize::Zeroizing;

#[derive(Clone, PartialEq, Eq)]
pub(crate) struct LanHint {
    pub(crate) ip: IpAddr,
    pub(crate) port: u16,
}
pub(crate) struct QrPayload {
    pub(crate) sid: [u8; 16],
    pub(crate) pc_fingerprint: [u8; 32],
    pub(crate) secret: Zeroizing<[u8; 32]>,
    pub(crate) hint: LanHint,
}

pub(crate) fn parse(wire: &str) -> Result<QrPayload> {
    if wire.len() > 512 || !wire.is_ascii() {
        return Err(PairingError::InvalidQr);
    }
    let encoded = wire
        .strip_prefix("KLODA-PAIR:")
        .ok_or(PairingError::InvalidQr)?;
    let mut buffer = Zeroizing::new([0u8; 375]);
    let length = qr_base64::decode_into(encoded, &mut *buffer)?;
    let source = std::str::from_utf8(&buffer[..length]).map_err(|_| PairingError::InvalidQr)?;
    qr_json::parse(source)
}

pub(crate) fn encode(payload: &QrPayload) -> Result<String> {
    if payload.hint.port == 0 {
        return Err(PairingError::InvalidQr);
    }
    let ip = payload.hint.ip.to_string();
    qr_ip::parse(&ip)?;
    let secret = Zeroizing::new(qr_base64::encode(payload.secret.as_ref()));
    let json = Zeroizing::new(format!(
        "{{\"v\":1,\"sid\":\"{}\",\"pc_spki_sha256\":\"{}\",\"secret\":\"{}\",\"lan\":{{\"ip\":\"{}\",\"port\":{}}}}}",
        qr_base64::encode(&payload.sid), qr_base64::encode(&payload.pc_fingerprint), secret.as_str(), ip, payload.hint.port,
    ));
    if json.len() > 375 {
        return Err(PairingError::InvalidQr);
    }
    let encoded = Zeroizing::new(qr_base64::encode(json.as_bytes()));
    Ok(format!("KLODA-PAIR:{}", encoded.as_str()))
}

#[cfg(test)]
#[path = "qr_tests.rs"]
mod tests;
