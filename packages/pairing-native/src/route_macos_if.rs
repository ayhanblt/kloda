use super::super::address::Prefix;
use crate::{
    apple_cf::{CFEqual, Owned, Ref as Cf},
    error::{PairingError, Result},
};
use std::{ffi::CStr, net::IpAddr, ptr};

#[link(name = "SystemConfiguration", kind = "framework")]
unsafe extern "C" {
    fn SCNetworkInterfaceCopyAll() -> Cf;
    fn SCNetworkInterfaceGetBSDName(interface: Cf) -> Cf;
    fn SCNetworkInterfaceGetInterfaceType(interface: Cf) -> Cf;
    fn SCNetworkInterfaceGetInterface(interface: Cf) -> Cf;
    static kSCNetworkInterfaceTypeEthernet: Cf;
    static kSCNetworkInterfaceTypeIEEE80211: Cf;
}
#[link(name = "CoreFoundation", kind = "framework")]
unsafe extern "C" {
    fn CFArrayGetCount(array: Cf) -> isize;
    fn CFArrayGetValueAtIndex(array: Cf, index: isize) -> Cf;
    fn CFStringGetCString(string: Cf, buffer: *mut libc::c_char, size: isize, encoding: u32) -> u8;
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub(super) struct Interface {
    pub(super) index: u32,
    pub(super) name: [u8; 16],
    pub(super) prefix: Prefix,
    class: u8,
}

struct Interfaces {
    addresses: *mut libc::ifaddrs,
    configuration: Owned,
}
impl Drop for Interfaces {
    fn drop(&mut self) {
        unsafe {
            libc::freeifaddrs(self.addresses);
        }
    }
}
impl Interfaces {
    fn open() -> Result<Self> {
        let configuration = unsafe { Owned::take(SCNetworkInterfaceCopyAll()) }
            .map_err(|_| PairingError::LanUnavailable)?;
        let mut addresses = ptr::null_mut();
        if unsafe { libc::getifaddrs(&mut addresses) } != 0 {
            return Err(PairingError::LanUnavailable);
        }
        Ok(Self {
            addresses,
            configuration,
        })
    }

    fn class(&self, name: &[u8; 16]) -> Option<u8> {
        // SDK SCNetworkConfiguration.h: exact physical Wi-Fi/Ethernet types, no layered VPN/bridge.
        let count = unsafe { CFArrayGetCount(self.configuration.0) };
        for i in 0..count {
            let interface = unsafe { CFArrayGetValueAtIndex(self.configuration.0, i) };
            if interface.is_null()
                || !unsafe { SCNetworkInterfaceGetInterface(interface) }.is_null()
            {
                continue;
            }
            let bsd = unsafe { SCNetworkInterfaceGetBSDName(interface) };
            let kind = unsafe { SCNetworkInterfaceGetInterfaceType(interface) };
            if bsd.is_null() || kind.is_null() {
                continue;
            }
            let mut actual = [0u8; 16];
            if unsafe { CFStringGetCString(bsd, actual.as_mut_ptr().cast(), 16, 0x08000100) } == 0
                || &actual != name
            {
                continue;
            }
            if unsafe { CFEqual(kind, kSCNetworkInterfaceTypeIEEE80211) } != 0 {
                return Some(1);
            }
            if unsafe { CFEqual(kind, kSCNetworkInterfaceTypeEthernet) } != 0 {
                return Some(2);
            }
        }
        None
    }

    fn read(&self, address: &libc::ifaddrs) -> Option<Interface> {
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
        let index = unsafe { libc::if_nametoindex(address.ifa_name) };
        if index == 0 {
            return None;
        }
        let class = self.class(&name)?;
        Some(Interface {
            index,
            name,
            prefix,
            class,
        })
    }
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

pub(super) fn select(peer: Option<IpAddr>) -> Result<Interface> {
    let interfaces = Interfaces::open()?;
    let mut next = interfaces.addresses;
    let mut selected = None;
    while !next.is_null() {
        let address = unsafe { &*next };
        next = address.ifa_next;
        let Some(interface) = interfaces.read(address) else {
            continue;
        };
        let target = match peer {
            Some(peer) if interface.prefix.accepts(peer) => peer,
            Some(_) => continue,
            None => interface.prefix.witness()?,
        };
        if super::query::direct(target, interface.index).is_err() {
            continue;
        }
        if peer.is_some() || interface.prefix.local.is_ipv4() {
            return Ok(interface);
        }
        if selected.is_none() {
            selected = Some(interface);
        }
    }
    selected.ok_or(PairingError::LanUnavailable)
}

pub(super) fn current(expected: Interface) -> Result<()> {
    let interfaces = Interfaces::open()?;
    let mut next = interfaces.addresses;
    while !next.is_null() {
        let address = unsafe { &*next };
        next = address.ifa_next;
        if interfaces.read(address) == Some(expected) {
            return Ok(());
        }
    }
    Err(PairingError::LanUnavailable)
}
