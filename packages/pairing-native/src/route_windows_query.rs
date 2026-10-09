use super::interfaces::Interface;
use crate::error::{PairingError, Result};
use socket2::Socket;
use std::{net::IpAddr, os::windows::io::AsRawSocket, ptr};
use windows_sys::Win32::{NetworkManagement::IpHelper::*, Networking::WinSock::*};

pub(super) fn sockaddr(ip: IpAddr) -> SOCKADDR_INET {
    match ip {
        IpAddr::V4(ip) => SOCKADDR_INET {
            Ipv4: SOCKADDR_IN {
                sin_family: AF_INET,
                sin_addr: IN_ADDR {
                    S_un: IN_ADDR_0 {
                        S_addr: u32::from_ne_bytes(ip.octets()),
                    },
                },
                ..Default::default()
            },
        },
        IpAddr::V6(ip) => SOCKADDR_INET {
            Ipv6: SOCKADDR_IN6 {
                sin6_family: AF_INET6,
                sin6_addr: IN6_ADDR {
                    u: IN6_ADDR_0 { Byte: ip.octets() },
                },
                // Frozen V1 permits only global/ULA IPv6: numeric native scope is zero.
                Anonymous: SOCKADDR_IN6_0 { sin6_scope_id: 0 },
                ..Default::default()
            },
        },
    }
}

pub(super) fn ip(address: &SOCKADDR_INET) -> Result<IpAddr> {
    // Read only the union arm indicated by the SDK address family.
    unsafe {
        match address.si_family {
            AF_INET => Ok(IpAddr::V4(
                address.Ipv4.sin_addr.S_un.S_addr.to_ne_bytes().into(),
            )),
            AF_INET6 if address.Ipv6.Anonymous.sin6_scope_id == 0 => {
                Ok(IpAddr::V6(address.Ipv6.sin6_addr.u.Byte.into()))
            }
            _ => Err(PairingError::LanUnavailable),
        }
    }
}

pub(super) fn best(peer: IpAddr) -> Result<(MIB_IPFORWARD_ROW2, SOCKADDR_INET)> {
    let destination = sockaddr(peer);
    let mut route = MIB_IPFORWARD_ROW2::default();
    let mut source = SOCKADDR_INET::default();
    // No interface/source constraint: a VPN or gateway winning globally must fail,
    // not be hidden by asking only about our selected physical interface.
    if unsafe {
        GetBestRoute2(
            ptr::null(),
            0,
            ptr::null(),
            &destination,
            0,
            &mut route,
            &mut source,
        )
    } != 0
    {
        return Err(PairingError::LanUnavailable);
    }
    Ok((route, source))
}

pub(super) fn direct(peer: IpAddr, interface: Interface) -> Result<()> {
    if !interface.prefix.accepts(peer) {
        return Err(PairingError::LanUnavailable);
    }
    let (route, source) = best(peer)?;
    let network = ip(&route.DestinationPrefix.Prefix)?;
    let hop = ip(&route.NextHop)?;
    let same_network = match (network, interface.prefix.local) {
        (IpAddr::V4(network), IpAddr::V4(local)) => {
            let mask = u32::MAX << (32 - interface.prefix.bits);
            u32::from(network) == u32::from(local) & mask
        }
        (IpAddr::V6(network), IpAddr::V6(local)) => {
            let mask = u128::MAX << (128 - interface.prefix.bits);
            u128::from(network) == u128::from(local) & mask
        }
        _ => false,
    };
    if route.InterfaceIndex != interface.index
        || unsafe { route.InterfaceLuid.Value } != interface.luid
        || ip(&source)? != interface.prefix.local
        || route.DestinationPrefix.PrefixLength != interface.prefix.bits
        || !same_network
        || route.Loopback
        || route.ValidLifetime == 0
        || !hop.is_unspecified()
        || hop.is_ipv4() != peer.is_ipv4()
    {
        return Err(PairingError::LanUnavailable);
    }
    Ok(())
}

pub(super) fn bind(socket: &Socket, interface: Interface) -> Result<()> {
    let ipv4 = interface.prefix.local.is_ipv4();
    let (level, option) = if ipv4 {
        (IPPROTO_IP, IP_UNICAST_IF)
    } else {
        (IPPROTO_IPV6, IPV6_UNICAST_IF)
    };
    // Microsoft documents IPv4 SET in network order but GET in host order;
    // IPv6 SET and GET both use host order. Zero means unrestricted, so reject it.
    let value = unicast_value(interface.index, ipv4)?;
    let mut actual = 0u32;
    let mut length = std::mem::size_of::<u32>() as i32;
    let raw = socket.as_raw_socket() as SOCKET;
    if unsafe { setsockopt(raw, level, option, ptr::from_ref(&value).cast(), length) } != 0
        || unsafe {
            getsockopt(
                raw,
                level,
                option,
                ptr::from_mut(&mut actual).cast(),
                &mut length,
            )
        } != 0
        || length != std::mem::size_of::<u32>() as i32
        || actual != interface.index
    {
        return Err(PairingError::LanUnavailable);
    }
    Ok(())
}

fn unicast_value(index: u32, ipv4: bool) -> Result<u32> {
    if index == 0 || ipv4 && index > 0x00ff_ffff {
        return Err(PairingError::LanUnavailable);
    }
    Ok(if ipv4 { index.to_be() } else { index })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn native_address_octets_and_scope_boundaries() {
        for value in ["192.168.31.42", "fd12:3456:789a::abcd", "2001:db8::1234"] {
            let expected: IpAddr = value.parse().unwrap();
            assert_eq!(ip(&sockaddr(expected)).unwrap(), expected);
        }
        let mut scoped = sockaddr("fd12::2".parse().unwrap());
        // Nonzero numeric scope must never get erased into an unscoped QR hint.
        unsafe {
            scoped.Ipv6.Anonymous.sin6_scope_id = 7;
        }
        assert!(ip(&scoped).is_err());
    }

    #[test]
    fn unicast_interface_endianness_and_index_bounds() {
        assert_eq!(
            unicast_value(0x123456, true).unwrap().to_ne_bytes(),
            [0, 0x12, 0x34, 0x56]
        );
        assert_eq!(unicast_value(0x123456, false).unwrap(), 0x123456);
        assert!(unicast_value(0, true).is_err());
        assert!(unicast_value(0, false).is_err());
        assert!(unicast_value(0x01000000, true).is_err());
        assert!(unicast_value(0x00ffffff, true).is_ok());
    }
}
