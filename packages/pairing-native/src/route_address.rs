use crate::error::{PairingError, Result};
use std::net::IpAddr;

pub(super) fn supported(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => {
            let [a, b, _, _] = ip.octets();
            a == 10
                || a == 172 && (16..=31).contains(&b)
                || a == 192 && b == 168
                || a == 169 && b == 254
        }
        IpAddr::V6(ip) => {
            let first = ip.segments()[0];
            first & 0xfe00 == 0xfc00 || first & 0xe000 == 0x2000
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub(super) struct Prefix {
    pub(super) local: IpAddr,
    pub(super) bits: u8,
}

impl Prefix {
    pub(super) fn validate(self) -> Result<()> {
        if !supported(self.local) || !self.contains_host(self.local) {
            return Err(PairingError::LanUnavailable);
        }
        self.witness().map(|_| ())
    }

    pub(super) fn contains_host(self, ip: IpAddr) -> bool {
        match (self.local, ip) {
            (IpAddr::V4(local), IpAddr::V4(ip)) if self.bits > 0 && self.bits < 31 => {
                let mask = u32::MAX << (32 - self.bits);
                let local = u32::from(local);
                let ip = u32::from(ip);
                ip & mask == local & mask && ip & !mask != 0 && ip & !mask != !mask
            }
            (IpAddr::V6(local), IpAddr::V6(ip)) if self.bits > 0 && self.bits < 127 => {
                let mask = u128::MAX << (128 - self.bits);
                let local = u128::from(local);
                let ip = u128::from(ip);
                // IPv6 has no broadcast; the subnet-router anycast/network endpoint is excluded.
                ip & mask == local & mask && ip & !mask != 0
            }
            _ => false,
        }
    }

    pub(super) fn accepts(self, ip: IpAddr) -> bool {
        supported(ip) && ip != self.local && self.contains_host(ip)
    }

    /// Only a routing-table lookup target: never opens a connection or probes a peer.
    pub(super) fn witness(self) -> Result<IpAddr> {
        let candidate = match self.local {
            IpAddr::V4(local) if self.bits > 0 && self.bits < 31 => {
                let mask = u32::MAX << (32 - self.bits);
                let network = u32::from(local) & mask;
                IpAddr::V4((network | if u32::from(local) & !mask == 1 { 2 } else { 1 }).into())
            }
            IpAddr::V6(local) if self.bits > 0 && self.bits < 127 => {
                let mask = u128::MAX << (128 - self.bits);
                let network = u128::from(local) & mask;
                IpAddr::V6((network | if u128::from(local) & !mask == 1 { 2 } else { 1 }).into())
            }
            _ => return Err(PairingError::LanUnavailable),
        };
        if self.accepts(candidate) {
            Ok(candidate)
        } else {
            Err(PairingError::LanUnavailable)
        }
    }
}
