use super::{super::address::Prefix, query::Witness};
use crate::error::{PairingError, Result};
use std::{ffi::CStr, net::IpAddr, ptr};

#[derive(Clone, Copy, PartialEq, Eq)]
pub(super) struct Interface {
    pub(super) index: u32,
    pub(super) name: [u8; 16],
    pub(super) prefix: Prefix,
    class: u8,
}

struct Addresses(*mut libc::ifaddrs);
impl Addresses {
    fn open() -> Result<Self> {
        let mut addresses = ptr::null_mut();
        if unsafe { libc::getifaddrs(&mut addresses) } != 0 {
            return Err(PairingError::LanUnavailable);
        }
        Ok(Self(addresses))
    }
}
impl Drop for Addresses {
    fn drop(&mut self) {
        unsafe { libc::freeifaddrs(self.0) };
    }
}

fn read(address: &libc::ifaddrs, witness: &Witness) -> Option<Interface> {
    if address.ifa_name.is_null()
        || address.ifa_addr.is_null()
        || address.ifa_netmask.is_null()
        || address.ifa_flags & (libc::IFF_UP | libc::IFF_RUNNING) as u32
            != (libc::IFF_UP | libc::IFF_RUNNING) as u32
        || address.ifa_flags & (libc::IFF_LOOPBACK | libc::IFF_POINTOPOINT) as u32 != 0
    {
        return None;
    }
    let source = unsafe { CStr::from_ptr(address.ifa_name) }.to_bytes_with_nul();
    if source.len() > 16 {
        return None;
    }
    let mut name = [0; 16];
    name[..source.len()].copy_from_slice(source);
    let index = unsafe { libc::if_nametoindex(address.ifa_name) };
    if index == 0 {
        return None;
    }
    let class = witness.class(&name, index)?;
    let local = unsafe { ip(address.ifa_addr) }?;
    let mask = unsafe { ip(address.ifa_netmask) }?;
    let bits = match (local, mask) {
        (IpAddr::V4(_), IpAddr::V4(mask)) => {
            let mask = u32::from(mask);
            let bits = mask.leading_ones();
            if bits == 0 || bits >= 31 || mask != u32::MAX << (32 - bits) {
                return None;
            }
            bits as u8
        }
        (IpAddr::V6(_), IpAddr::V6(mask)) => {
            let mask = u128::from(mask);
            let bits = mask.leading_ones();
            if bits == 0 || bits >= 127 || mask != u128::MAX << (128 - bits) {
                return None;
            }
            bits as u8
        }
        _ => return None,
    };
    let prefix = Prefix { local, bits };
    prefix.validate().ok()?;
    Some(Interface {
        index,
        name,
        prefix,
        class,
    })
}

unsafe fn ip(address: *const libc::sockaddr) -> Option<IpAddr> {
    let family = unsafe { (*address).sa_family } as libc::c_int;
    let length = unsafe { (*address).sa_len } as usize;
    match family {
        libc::AF_INET if length >= std::mem::size_of::<libc::sockaddr_in>() => {
            let address = unsafe { &*address.cast::<libc::sockaddr_in>() };
            Some(IpAddr::V4(address.sin_addr.s_addr.to_ne_bytes().into()))
        }
        libc::AF_INET6 if length >= std::mem::size_of::<libc::sockaddr_in6>() => {
            let address = unsafe { &*address.cast::<libc::sockaddr_in6>() };
            if address.sin6_scope_id != 0 {
                return None;
            }
            Some(IpAddr::V6(address.sin6_addr.s6_addr.into()))
        }
        _ => None,
    }
}

fn choose(selected: Option<Interface>, candidate: Interface) -> Result<Option<Interface>> {
    if selected.is_some_and(|previous| previous != candidate) {
        return Err(PairingError::LanUnavailable);
    }
    Ok(Some(candidate))
}

pub(super) fn select(peer: IpAddr, witness: &Witness) -> Result<Interface> {
    let addresses = Addresses::open()?;
    let mut next = addresses.0;
    let mut selected = None;
    while !next.is_null() {
        let address = unsafe { &*next };
        next = address.ifa_next;
        if let Some(interface) = read(address, witness).filter(|i| i.prefix.accepts(peer)) {
            // Multiple native candidates are ambiguous; never guess an interface or source IP.
            selected = choose(selected, interface)?;
        }
    }
    selected.ok_or(PairingError::LanUnavailable)
}

pub(super) fn current(expected: Interface, witness: &Witness) -> Result<()> {
    let addresses = Addresses::open()?;
    let mut next = addresses.0;
    while !next.is_null() {
        let address = unsafe { &*next };
        next = address.ifa_next;
        if read(address, witness) == Some(expected) {
            return Ok(());
        }
    }
    Err(PairingError::LanUnavailable)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn candidate(index: u32, address: [u8; 4]) -> Interface {
        Interface {
            index,
            name: [0; 16],
            prefix: Prefix {
                local: address.into(),
                bits: 24,
            },
            class: 1,
        }
    }

    #[test]
    fn distinct_interfaces_or_source_addresses_are_not_guessed() {
        let first = candidate(3, [192, 168, 7, 2]);
        assert!(choose(None, first).unwrap() == Some(first));
        assert!(choose(Some(first), first).unwrap() == Some(first));
        assert!(choose(Some(first), candidate(4, [192, 168, 7, 2])).is_err());
        assert!(choose(Some(first), candidate(3, [192, 168, 7, 3])).is_err());
    }

    #[test]
    fn peer_must_be_another_supported_host_on_the_selected_prefix() {
        let selected = candidate(3, [192, 168, 7, 2]);
        assert!(selected.prefix.accepts([192, 168, 7, 3].into()));
        for peer in [
            [192, 168, 7, 0],
            [192, 168, 7, 2],
            [192, 168, 7, 255],
            [192, 168, 8, 3],
            [127, 0, 0, 1],
        ] {
            assert!(!selected.prefix.accepts(peer.into()));
        }
    }
}
