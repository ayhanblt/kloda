use super::super::elapsed_ms;
use crate::error::{PairingError, Result};
use socket2::{Domain, SockAddr, Socket, Type};
use std::{
    mem,
    net::{IpAddr, SocketAddr},
    os::fd::AsRawFd,
};

pub(super) fn monitor() -> Result<Socket> {
    let socket = Socket::new(Domain::from(libc::PF_ROUTE), Type::RAW, None)
        .map_err(|_| PairingError::LanUnavailable)?;
    socket
        .set_nonblocking(true)
        .map_err(|_| PairingError::LanUnavailable)?;
    Ok(socket)
}

/// RTM_GET proves actual kernel routing; both default lookup and enforced scope must be direct.
pub(super) fn direct(peer: IpAddr, index: u32) -> Result<()> {
    query(peer, index, false)?;
    query(peer, index, true)
}

fn query(peer: IpAddr, index: u32, scoped: bool) -> Result<()> {
    if index == 0 || index > u16::MAX as u32 {
        return Err(PairingError::LanUnavailable);
    }
    let socket = monitor()?;
    let target = SockAddr::from(SocketAddr::new(peer, 0));
    let header_size = mem::size_of::<libc::rt_msghdr>();
    let address_size = (target.len() as usize + 3) & !3;
    let size = header_size + address_size + mem::size_of::<libc::sockaddr_dl>();
    let mut bytes = [0u8; 1_024];
    if size > bytes.len() {
        return Err(PairingError::LanUnavailable);
    }
    let mut header: libc::rt_msghdr = unsafe { mem::zeroed() };
    header.rtm_msglen = size as u16;
    header.rtm_version = libc::RTM_VERSION as u8;
    header.rtm_type = libc::RTM_GET as u8;
    header.rtm_flags = libc::RTF_UP | if scoped { libc::RTF_IFSCOPE } else { 0 };
    header.rtm_addrs = libc::RTA_DST | libc::RTA_IFP;
    header.rtm_pid = unsafe { libc::getpid() };
    header.rtm_seq = 1; // Each request has a fresh private socket.
    header.rtm_index = if scoped { index as u16 } else { 0 };
    let mut link: libc::sockaddr_dl = unsafe { mem::zeroed() };
    link.sdl_len = mem::size_of::<libc::sockaddr_dl>() as u8;
    link.sdl_family = libc::AF_LINK as u8;
    // Apple network_cmds route.c: sockaddr records rounded to sizeof(uint32_t), not pointer width.
    unsafe {
        std::ptr::write_unaligned(bytes.as_mut_ptr().cast::<libc::rt_msghdr>(), header);
        std::ptr::copy_nonoverlapping(
            target.as_ptr().cast::<u8>(),
            bytes.as_mut_ptr().add(header_size),
            target.len() as usize,
        );
        std::ptr::write_unaligned(
            bytes
                .as_mut_ptr()
                .add(header_size + address_size)
                .cast::<libc::sockaddr_dl>(),
            link,
        );
    }
    let fd = socket.as_raw_fd();
    let start = elapsed_ms()?;
    if unsafe { libc::write(fd, bytes.as_ptr().cast(), size) } != size as isize {
        return Err(PairingError::LanUnavailable);
    }
    for _ in 0..64 {
        let spent = elapsed_ms()?
            .checked_sub(start)
            .ok_or(PairingError::LanUnavailable)?;
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
        let count = unsafe { libc::recv(fd, bytes.as_mut_ptr().cast(), bytes.len(), 0) };
        if count < header_size as isize {
            continue;
        }
        let response =
            unsafe { std::ptr::read_unaligned(bytes.as_ptr().cast::<libc::rt_msghdr>()) };
        if response.rtm_pid != header.rtm_pid
            || response.rtm_seq != header.rtm_seq
            || response.rtm_type != libc::RTM_GET as u8
        {
            continue;
        }
        if response.rtm_version != libc::RTM_VERSION as u8
            || response.rtm_errno != 0
            || response.rtm_msglen as usize != count as usize
            || response.rtm_index as u32 != index
        {
            break;
        }
        let forbidden = libc::RTF_GATEWAY
            | libc::RTF_REJECT
            | libc::RTF_BLACKHOLE
            | libc::RTF_DYNAMIC
            | libc::RTF_MODIFIED
            | libc::RTF_PROXY
            | libc::RTF_CONDEMNED
            | libc::RTF_DEAD
            | libc::RTF_BROADCAST
            | libc::RTF_MULTICAST
            | libc::RTF_LOCAL;
        if response.rtm_flags & libc::RTF_UP == 0 || response.rtm_flags & forbidden != 0 {
            break;
        }
        return addresses(&bytes[..count as usize], response.rtm_addrs, index);
    }
    Err(PairingError::LanUnavailable)
}

fn addresses(bytes: &[u8], flags: i32, index: u32) -> Result<()> {
    let mut cursor = mem::size_of::<libc::rt_msghdr>();
    let mut gateway = false;
    let mut interface = false;
    for bit in 0..8 {
        if flags & (1 << bit) == 0 {
            continue;
        }
        if cursor + 2 > bytes.len() {
            return Err(PairingError::LanUnavailable);
        }
        let length = bytes[cursor] as usize;
        let family = bytes[cursor + 1] as i32;
        let padded = if length == 0 { 4 } else { (length + 3) & !3 };
        if cursor + padded > bytes.len() {
            return Err(PairingError::LanUnavailable);
        }
        if bit == libc::RTAX_GATEWAY || bit == libc::RTAX_IFP {
            if family != libc::AF_LINK || length < 8 {
                return Err(PairingError::LanUnavailable);
            }
            let actual = u16::from_ne_bytes([bytes[cursor + 2], bytes[cursor + 3]]) as u32;
            if actual != index {
                return Err(PairingError::LanUnavailable);
            }
            if bit == libc::RTAX_GATEWAY {
                gateway = true;
            } else {
                interface = true;
            }
        }
        cursor += padded;
    }
    if cursor != bytes.len() || !gateway || !interface {
        return Err(PairingError::LanUnavailable);
    }
    Ok(())
}

/// Routing notifications retain change evidence even if a route disappears and comes back.
pub(super) fn unchanged(socket: &Socket) -> Result<()> {
    let mut bytes = [0u8; 4_096];
    for _ in 0..64 {
        let count = unsafe {
            libc::recv(
                socket.as_raw_fd(),
                bytes.as_mut_ptr().cast(),
                bytes.len(),
                0,
            )
        };
        if count < 0 {
            return if std::io::Error::last_os_error().kind() == std::io::ErrorKind::WouldBlock {
                Ok(())
            } else {
                Err(PairingError::LanUnavailable)
            };
        }
        if count < 4 {
            return Err(PairingError::LanUnavailable);
        }
        let length = u16::from_ne_bytes([bytes[0], bytes[1]]) as usize;
        if length != count as usize || bytes[2] != libc::RTM_VERSION as u8 {
            return Err(PairingError::LanUnavailable);
        }
        let kind = bytes[3] as i32;
        if kind == libc::RTM_GET {
            continue;
        }
        if matches!(kind, libc::RTM_ADD | libc::RTM_DELETE | libc::RTM_CHANGE)
            && count as usize >= mem::size_of::<libc::rt_msghdr>()
        {
            let header =
                unsafe { std::ptr::read_unaligned(bytes.as_ptr().cast::<libc::rt_msghdr>()) };
            // Neighbor-cache churn is not topology change; every peer still receives RTM_GET proof.
            if header.rtm_flags & (libc::RTF_LLINFO | libc::RTF_WASCLONED) != 0
                && header.rtm_flags & (libc::RTF_GATEWAY | libc::RTF_REJECT | libc::RTF_BLACKHOLE)
                    == 0
            {
                continue;
            }
        }
        return Err(PairingError::LanUnavailable);
    }
    Err(PairingError::LanUnavailable)
}
