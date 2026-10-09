use crate::error::{PairingError, Result};
use std::net::IpAddr;

/// Address syntax/range only. The native route owner must establish locality.
pub(crate) fn parse(source: &str) -> Result<IpAddr> {
    if source.len() > 39 || source.is_empty() {
        return Err(PairingError::InvalidQr);
    }
    if source.contains('.') {
        let mut octets = [0; 4];
        let mut parts = source.split('.');
        for octet in &mut octets {
            let part = parts.next().ok_or(PairingError::InvalidQr)?;
            if part.is_empty()
                || part.len() > 3
                || !part.bytes().all(|b| b.is_ascii_digit())
                || part.len() > 1 && part.starts_with('0')
            {
                return Err(PairingError::InvalidQr);
            }
            *octet = part.parse().map_err(|_| PairingError::InvalidQr)?;
        }
        if parts.next().is_some() {
            return Err(PairingError::InvalidQr);
        }
        let [a, b, _, _] = octets;
        if !(a == 10
            || a == 172 && (16..=31).contains(&b)
            || a == 192 && b == 168
            || a == 169 && b == 254)
        {
            return Err(PairingError::InvalidQr);
        }
        return Ok(IpAddr::from(octets));
    }
    if !source.bytes().all(|b| b.is_ascii_hexdigit() || b == b':') {
        return Err(PairingError::InvalidQr);
    }
    let address: std::net::Ipv6Addr = source.parse().map_err(|_| PairingError::InvalidQr)?;
    let first = address.segments()[0];
    if first & 0xfe00 != 0xfc00 && first & 0xe000 != 0x2000 {
        return Err(PairingError::InvalidQr);
    }
    Ok(IpAddr::V6(address))
}
