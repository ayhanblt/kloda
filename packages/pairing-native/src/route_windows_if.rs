use super::super::address::Prefix;
use super::query;
use crate::error::{PairingError, Result};
use std::{net::IpAddr, ptr};
use windows_sys::Win32::{
    NetworkManagement::{IpHelper::*, Ndis::*},
    Networking::WinSock::{IpDadStatePreferred, ADDRESS_FAMILY, AF_INET, AF_INET6, AF_UNSPEC},
};

#[derive(Clone, Copy, PartialEq, Eq)]
pub(super) struct Interface {
    pub(super) index: u32,
    pub(super) luid: u64,
    pub(super) prefix: Prefix,
    created: i64,
    permanent_mac: [u8; 6],
}

struct Addresses(*mut MIB_UNICASTIPADDRESS_TABLE);
impl Drop for Addresses {
    fn drop(&mut self) {
        // The table and its variable-length rows belong to IP Helper.
        unsafe { FreeMibTable(self.0.cast()) };
    }
}

struct IpInterfaces(*mut MIB_IPINTERFACE_TABLE);
impl Drop for IpInterfaces {
    fn drop(&mut self) {
        unsafe { FreeMibTable(self.0.cast()) };
    }
}

fn strong_host(family: ADDRESS_FAMILY) -> Result<()> {
    let mut table = ptr::null_mut();
    if unsafe { GetIpInterfaceTable(family, &mut table) } != 0 || table.is_null() {
        return Err(PairingError::LanUnavailable);
    }
    let table = IpInterfaces(table);
    let count = unsafe { (*table.0).NumEntries } as usize;
    if count == 0 || count > 65_536 {
        return Err(PairingError::LanUnavailable);
    }
    let rows: &[MIB_IPINTERFACE_ROW] =
        unsafe { std::slice::from_raw_parts(ptr::addr_of!((*table.0).Table).cast(), count) };
    // UNICAST_IF constrains only egress. Every family interface must be strong
    // host/nonforwarding, otherwise another adapter can receive our bound IP.
    if rows.iter().any(|row| {
        row.Family != family || row.WeakHostReceive || row.WeakHostSend || row.ForwardingEnabled
    }) {
        return Err(PairingError::LanUnavailable);
    }
    Ok(())
}

fn physical(row: &MIB_IF_ROW2) -> bool {
    let ethernet = row.Type == IF_TYPE_ETHERNET_CSMACD
        && row.MediaType == NdisMedium802_3
        && row.PhysicalMediumType == NdisPhysicalMedium802_3;
    let wifi = row.Type == IF_TYPE_IEEE80211
        && matches!(row.MediaType, NdisMedium802_3 | NdisMediumNative802_11)
        && matches!(
            row.PhysicalMediumType,
            NdisPhysicalMediumWirelessLan | NdisPhysicalMediumNative802_11
        );
    // SDK bit order: hardware, filter, connector, unauthenticated, disconnected,
    // paused, low-power, endpoint. Require affirmative physical evidence, not names.
    (ethernet || wifi)
        && row.InterfaceAndOperStatusFlags._bitfield & !0x04 == 0x01
        && row.TunnelType == TUNNEL_TYPE_NONE
        && row.AccessType == NET_IF_ACCESS_BROADCAST
        && row.DirectionType == NET_IF_DIRECTION_SENDRECEIVE
        && row.ConnectionType == NET_IF_CONNECTION_DEDICATED
        && row.AdminStatus == NET_IF_ADMIN_STATUS_UP
        && row.OperStatus == IfOperStatusUp
        && row.MediaConnectState == MediaConnectStateConnected
        && row.PhysicalAddressLength == 6
        && row.PermanentPhysicalAddress[..6]
            .iter()
            .any(|byte| *byte != 0)
        && row.PermanentPhysicalAddress[0] & 1 == 0
        && row.TransmitLinkSpeed != 0
        && row.ReceiveLinkSpeed != 0
}

fn classify(address: &MIB_UNICASTIPADDRESS_ROW) -> Result<Interface> {
    if address.InterfaceIndex == 0
        || address.InterfaceIndex > 0x00ff_ffff
        || address.SkipAsSource
        || address.DadState != IpDadStatePreferred
        || address.ValidLifetime == 0
        || address.PreferredLifetime == 0
    {
        return Err(PairingError::LanUnavailable);
    }
    let prefix = Prefix {
        local: query::ip(&address.Address)?,
        bits: address.OnLinkPrefixLength,
    };
    prefix.validate()?;
    let mut row = MIB_IF_ROW2 {
        InterfaceLuid: address.InterfaceLuid,
        ..Default::default()
    };
    // Both rows are initialized SDK values; output storage lives through the call.
    if unsafe { GetIfEntry2(&mut row) } != 0
        || row.InterfaceIndex != address.InterfaceIndex
        || !physical(&row)
    {
        return Err(PairingError::LanUnavailable);
    }
    let mut ip_row = MIB_IPINTERFACE_ROW {
        Family: unsafe { address.Address.si_family },
        InterfaceLuid: row.InterfaceLuid,
        ..Default::default()
    };
    if unsafe { GetIpInterfaceEntry(&mut ip_row) } != 0
        || !ip_row.Connected
        || ip_row.ForwardingEnabled
        || ip_row.WeakHostSend
        || ip_row.WeakHostReceive
        || ip_row.AdvertisingEnabled
        || ip_row.InterfaceIndex != row.InterfaceIndex
    {
        return Err(PairingError::LanUnavailable);
    }
    let mut permanent_mac = [0; 6];
    permanent_mac.copy_from_slice(&row.PermanentPhysicalAddress[..6]);
    Ok(Interface {
        index: row.InterfaceIndex,
        luid: unsafe { row.InterfaceLuid.Value },
        prefix,
        created: address.CreationTimeStamp,
        permanent_mac,
    })
}

pub(super) fn select(peer: Option<IpAddr>) -> Result<Interface> {
    if let Some(peer) = peer {
        let (route, source) = query::best(peer)?;
        let mut address = MIB_UNICASTIPADDRESS_ROW {
            Address: source,
            InterfaceLuid: route.InterfaceLuid,
            ..Default::default()
        };
        if unsafe { GetUnicastIpAddressEntry(&mut address) } != 0 {
            return Err(PairingError::LanUnavailable);
        }
        strong_host(unsafe { address.Address.si_family })?;
        let interface = classify(&address)?;
        query::direct(peer, interface)?;
        return Ok(interface);
    }
    let mut table = ptr::null_mut();
    if unsafe { GetUnicastIpAddressTable(AF_UNSPEC, &mut table) } != 0 || table.is_null() {
        return Err(PairingError::LanUnavailable);
    }
    let table = Addresses(table);
    let count = unsafe { (*table.0).NumEntries } as usize;
    if count > 65_536 {
        return Err(PairingError::LanUnavailable);
    }
    // Table is an SDK flexible-array allocation, not a Rust one-element array.
    let rows: &[MIB_UNICASTIPADDRESS_ROW] =
        unsafe { std::slice::from_raw_parts(ptr::addr_of!((*table.0).Table).cast(), count) };
    let ipv4 = strong_host(AF_INET).is_ok();
    let ipv6 = strong_host(AF_INET6).is_ok();
    let mut selected: Option<Interface> = None;
    for row in rows {
        let family = unsafe { row.Address.si_family };
        if !(family == AF_INET && ipv4 || family == AF_INET6 && ipv6) {
            continue;
        }
        let Ok(candidate) = classify(row) else {
            continue;
        };
        let witness = candidate.prefix.witness()?;
        if query::direct(witness, candidate).is_err() {
            continue;
        }
        let rank = |value: Interface| {
            (
                value.prefix.local.is_ipv6(),
                value.index,
                value.prefix.local,
            )
        };
        if selected.is_none_or(|previous| rank(candidate) < rank(previous)) {
            selected = Some(candidate);
        }
    }
    selected.ok_or(PairingError::LanUnavailable)
}

pub(super) fn current(interface: Interface) -> Result<()> {
    strong_host(if interface.prefix.local.is_ipv4() {
        AF_INET
    } else {
        AF_INET6
    })?;
    let mut address = MIB_UNICASTIPADDRESS_ROW {
        Address: query::sockaddr(interface.prefix.local),
        InterfaceLuid: NET_LUID_LH {
            Value: interface.luid,
        },
        ..Default::default()
    };
    if unsafe { GetUnicastIpAddressEntry(&mut address) } != 0 || classify(&address)? != interface {
        return Err(PairingError::LanUnavailable);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::super::super::address::Prefix;
    use std::net::IpAddr;

    #[test]
    fn lan_host_boundaries_and_witnesses() {
        for (local, bits, forbidden, allowed) in [
            ("192.168.1.2", 24, "192.168.1.255", "192.168.1.1"),
            ("169.254.2.1", 16, "169.254.0.0", "169.254.2.2"),
            ("fd12::2", 64, "fd12::", "fd12::1"),
        ] {
            let prefix = Prefix {
                local: local.parse().unwrap(),
                bits,
            };
            assert!(prefix.validate().is_ok());
            assert!(!prefix.accepts(forbidden.parse::<IpAddr>().unwrap()));
            assert!(!prefix.accepts(prefix.local));
            assert!(prefix.accepts(allowed.parse().unwrap()));
            assert!(prefix.accepts(prefix.witness().unwrap()));
        }
        for (local, bits) in [
            ("192.168.1.2", 31),
            ("fd12::2", 127),
            ("8.8.8.8", 24),
            ("fe80::2", 64),
        ] {
            assert!(Prefix {
                local: local.parse().unwrap(),
                bits
            }
            .validate()
            .is_err());
        }
    }
}
