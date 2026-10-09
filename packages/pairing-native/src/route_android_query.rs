use super::super::elapsed_ms;
use crate::error::{PairingError, Result};
use socket2::{Domain, Protocol, Socket, Type};
use std::{
    mem,
    net::IpAddr,
    os::fd::AsRawFd,
    sync::{
        atomic::{AtomicU32, Ordering},
        Mutex,
    },
};

// ABI: NDK linux/netlink.h + linux/rtnetlink.h (4-byte header/attribute alignment).
// Primary lookup implementations consume RTA_SRC/RTA_MARK/RTA_UID, then return RTN_* and OIF:
// https://github.com/torvalds/linux/blob/v5.15/net/ipv4/route.c (inet_rtm_getroute)
// https://github.com/torvalds/linux/blob/v5.15/net/ipv6/route.c (inet6_rtm_getroute)
const HEADER: usize = 16;
const ROUTE: usize = 12;
const GET_ROUTE: u16 = 26;
const NEW_ROUTE: u16 = 24;
const UID: u16 = 25;

pub(super) struct Lookup {
    socket: Mutex<Socket>,
    sequence: AtomicU32,
    mark: u32,
}

impl Lookup {
    pub(super) fn open(bound: &Socket, local: IpAddr, peer: IpAddr, index: u32) -> Result<Self> {
        let mut mark = 0u32;
        let mut size = mem::size_of::<u32>() as libc::socklen_t;
        if unsafe {
            libc::getsockopt(
                bound.as_raw_fd(),
                libc::SOL_SOCKET,
                libc::SO_MARK,
                (&mut mark as *mut u32).cast(),
                &mut size,
            )
        } != 0
            || size != 4
            || mark == 0
        {
            return Err(PairingError::NativeUnsupported);
        }
        let socket = Socket::new(
            Domain::from(libc::AF_NETLINK),
            Type::RAW,
            Some(Protocol::from(libc::NETLINK_ROUTE)),
        )
        .map_err(|_| PairingError::NativeUnsupported)?;
        socket
            .set_nonblocking(true)
            .map_err(|_| PairingError::NativeUnsupported)?;
        let mut address: libc::sockaddr_nl = unsafe { mem::zeroed() };
        address.nl_family = libc::AF_NETLINK as u16;
        if unsafe {
            libc::bind(
                socket.as_raw_fd(),
                (&address as *const libc::sockaddr_nl).cast(),
                mem::size_of_val(&address) as libc::socklen_t,
            )
        } != 0
        {
            return Err(PairingError::NativeUnsupported);
        }
        let lookup = Self {
            socket: Mutex::new(socket),
            sequence: AtomicU32::new(0),
            mark,
        };
        lookup.direct(local, peer, index)?;
        // Prove UID is recognized, not silently ignored by an old kernel: a one-byte UID
        // must fail its NLA_U32 policy while the identical valid request above succeeds.
        lookup.query(local, peer, index, true)?;
        Ok(lookup)
    }

    pub(super) fn direct(&self, local: IpAddr, peer: IpAddr, index: u32) -> Result<()> {
        self.query(local, peer, index, false)
    }

    fn query(&self, local: IpAddr, peer: IpAddr, index: u32, probe: bool) -> Result<()> {
        let socket = self
            .socket
            .lock()
            .map_err(|_| PairingError::NativeUnsupported)?;
        let sequence = self
            .sequence
            .fetch_add(1, Ordering::Relaxed)
            .checked_add(1)
            .ok_or(PairingError::NativeUnsupported)?;
        let mut bytes = [0u8; 2_048];
        let (family, source, destination, width) = match (local, peer) {
            (IpAddr::V4(local), IpAddr::V4(peer)) => {
                let mut source = [0; 16];
                let mut destination = [0; 16];
                source[..4].copy_from_slice(&local.octets());
                destination[..4].copy_from_slice(&peer.octets());
                (libc::AF_INET as u8, source, destination, 4)
            }
            (IpAddr::V6(local), IpAddr::V6(peer)) => {
                (libc::AF_INET6 as u8, local.octets(), peer.octets(), 16)
            }
            _ => return Err(PairingError::LanUnavailable),
        };
        bytes[4..6].copy_from_slice(&GET_ROUTE.to_ne_bytes());
        bytes[6..8].copy_from_slice(&1u16.to_ne_bytes()); // NLM_F_REQUEST, no table dump.
        bytes[8..12].copy_from_slice(&sequence.to_ne_bytes());
        bytes[16] = family;
        bytes[17] = (width * 8) as u8;
        bytes[18] = (width * 8) as u8;
        let mut length = HEADER + ROUTE;
        attribute(
            &mut bytes,
            &mut length,
            libc::RTA_DST,
            &destination[..width],
        );
        attribute(&mut bytes, &mut length, libc::RTA_SRC, &source[..width]);
        attribute(
            &mut bytes,
            &mut length,
            libc::RTA_MARK,
            &self.mark.to_ne_bytes(),
        );
        let uid = unsafe { libc::getuid() }.to_ne_bytes();
        attribute(
            &mut bytes,
            &mut length,
            UID,
            &uid[..if probe { 1 } else { 4 }],
        );
        bytes[..4].copy_from_slice(&(length as u32).to_ne_bytes());
        let mut kernel: libc::sockaddr_nl = unsafe { mem::zeroed() };
        kernel.nl_family = libc::AF_NETLINK as u16;
        let fd = socket.as_raw_fd();
        let start = elapsed_ms()?;
        if unsafe {
            libc::sendto(
                fd,
                bytes.as_ptr().cast(),
                length,
                0,
                (&kernel as *const libc::sockaddr_nl).cast(),
                mem::size_of_val(&kernel) as libc::socklen_t,
            )
        } != length as isize
        {
            return Err(PairingError::NativeUnsupported);
        }
        for _ in 0..64 {
            let spent = elapsed_ms()?
                .checked_sub(start)
                .ok_or(PairingError::NativeUnsupported)?;
            if spent >= 100 {
                break;
            }
            let mut poll = libc::pollfd {
                fd,
                events: libc::POLLIN,
                revents: 0,
            };
            let ready = unsafe { libc::poll(&mut poll, 1, (100 - spent).min(25) as i32) };
            if ready < 0 {
                if std::io::Error::last_os_error().kind() == std::io::ErrorKind::Interrupted {
                    continue;
                }
                break;
            }
            if ready == 0 {
                continue;
            }
            let mut sender: libc::sockaddr_nl = unsafe { mem::zeroed() };
            let mut sender_size = mem::size_of_val(&sender) as libc::socklen_t;
            let count = unsafe {
                libc::recvfrom(
                    fd,
                    bytes.as_mut_ptr().cast(),
                    bytes.len(),
                    libc::MSG_TRUNC,
                    (&mut sender as *mut libc::sockaddr_nl).cast(),
                    &mut sender_size,
                )
            };
            if count < HEADER as isize
                || count as usize > bytes.len()
                || sender.nl_pid != 0
                || sender.nl_family != libc::AF_NETLINK as u16
            {
                return Err(PairingError::NativeUnsupported);
            }
            let length = u32::from_ne_bytes(bytes[..4].try_into().unwrap()) as usize;
            if length != count as usize
                || u32::from_ne_bytes(bytes[8..12].try_into().unwrap()) != sequence
            {
                return Err(PairingError::NativeUnsupported);
            }
            let kind = u16::from_ne_bytes(bytes[4..6].try_into().unwrap());
            if kind == 2 {
                // NLMSG_ERROR; negative Linux errno, never a positive trust result.
                if length < HEADER + 4 {
                    return Err(PairingError::NativeUnsupported);
                }
                let error = i32::from_ne_bytes(bytes[16..20].try_into().unwrap());
                if probe
                    && matches!(error, value if value == -libc::EINVAL || value == -libc::ERANGE)
                {
                    return Ok(());
                }
                return Err(
                    if error == -libc::ENETUNREACH || error == -libc::EHOSTUNREACH {
                        PairingError::LanUnavailable
                    } else {
                        PairingError::NativeUnsupported
                    },
                );
            }
            if probe
                || kind != NEW_ROUTE
                || length < HEADER + ROUTE
                || u16::from_ne_bytes(bytes[6..8].try_into().unwrap()) & 2 != 0
            {
                return Err(PairingError::NativeUnsupported);
            }
            return response(
                &bytes[..length],
                family,
                index,
                &destination[..width],
                self.mark,
            );
        }
        Err(PairingError::NativeUnsupported)
    }
}

fn attribute(bytes: &mut [u8], offset: &mut usize, kind: u16, value: &[u8]) {
    let length = value.len() + 4;
    bytes[*offset..*offset + 2].copy_from_slice(&(length as u16).to_ne_bytes());
    bytes[*offset + 2..*offset + 4].copy_from_slice(&kind.to_ne_bytes());
    bytes[*offset + 4..*offset + length].copy_from_slice(value);
    *offset += (length + 3) & !3;
}

fn response(bytes: &[u8], family: u8, index: u32, destination: &[u8], mark: u32) -> Result<()> {
    let flags = u32::from_ne_bytes(bytes[24..28].try_into().unwrap());
    if bytes[16] != family
        || bytes[23] != 1
        || !matches!(bytes[22], 0 | 253)
        || bytes[21] == 1
        || flags & 17 != 0
    {
        // Reject redirect and nexthop DEAD/LINKDOWN.
        return Err(PairingError::LanUnavailable);
    }
    let mut offset = HEADER + ROUTE;
    let mut actual_interface = None;
    let mut actual_destination = false;
    while offset < bytes.len() {
        if offset + 4 > bytes.len() {
            return Err(PairingError::NativeUnsupported);
        }
        let length = u16::from_ne_bytes(bytes[offset..offset + 2].try_into().unwrap()) as usize;
        let kind = u16::from_ne_bytes(bytes[offset + 2..offset + 4].try_into().unwrap());
        let padded = (length + 3) & !3;
        if length < 4 || offset + padded > bytes.len() {
            return Err(PairingError::NativeUnsupported);
        }
        let value = &bytes[offset + 4..offset + length];
        match kind {
            libc::RTA_OIF if value.len() == 4 && actual_interface.is_none() => {
                actual_interface = Some(u32::from_ne_bytes(value.try_into().unwrap()))
            }
            libc::RTA_DST if value == destination && !actual_destination => {
                actual_destination = true
            }
            libc::RTA_MARK
                if value.len() == 4 && u32::from_ne_bytes(value.try_into().unwrap()) == mark => {}
            libc::RTA_GATEWAY | libc::RTA_MULTIPATH | 18 | 19 | 21 | 22 => {
                return Err(PairingError::LanUnavailable)
            } // VIA/NEWDST/ENCAP aren't direct LAN.
            libc::RTA_OIF | libc::RTA_DST | libc::RTA_MARK => {
                return Err(PairingError::NativeUnsupported)
            }
            _ => {}
        }
        offset += padded;
    }
    if actual_interface != Some(index) || !actual_destination {
        return Err(PairingError::LanUnavailable);
    }
    Ok(())
}
