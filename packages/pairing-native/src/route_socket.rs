#[cfg(unix)]
use super::{elapsed_ms, Route};
use crate::error::{PairingError, Result};
#[cfg(unix)]
use crate::qr::LanHint;
use socket2::{Domain, Protocol, Socket, Type};
use std::net::{IpAddr, SocketAddr};
#[cfg(unix)]
use std::{net::TcpStream, os::fd::AsRawFd, time::Duration};
#[cfg(target_os = "windows")]
#[path = "route_windows_socket.rs"]
mod windows;
#[cfg(target_os = "windows")]
pub(super) use windows::connect;

pub(super) fn new(local: IpAddr) -> Result<Socket> {
    let socket = Socket::new(
        if local.is_ipv4() {
            Domain::IPV4
        } else {
            Domain::IPV6
        },
        Type::STREAM,
        Some(Protocol::TCP),
    )
    .map_err(|_| PairingError::LanUnavailable)?;
    if local.is_ipv6() {
        socket
            .set_only_v6(true)
            .map_err(|_| PairingError::LanUnavailable)?;
    }
    #[cfg(target_os = "windows")]
    windows::exclusive(&socket)?;
    socket
        .set_nonblocking(true)
        .map_err(|_| PairingError::LanUnavailable)?;
    socket
        .set_tcp_nodelay(true)
        .map_err(|_| PairingError::LanUnavailable)?;
    Ok(socket)
}

pub(super) fn bind(socket: &Socket, local: IpAddr, port: u16) -> Result<()> {
    socket
        .bind(&SocketAddr::new(local, port).into())
        .map_err(|_| PairingError::LanUnavailable)
}

#[cfg(unix)]
pub(super) fn connect(route: &Route, hint: &LanHint, timeout: Duration) -> Result<TcpStream> {
    let limit = u64::try_from(timeout.as_millis()).map_err(|_| PairingError::LanUnavailable)?;
    if hint.port == 0 || limit == 0 || limit > 10_000 {
        return Err(PairingError::LanUnavailable);
    }
    let start = elapsed_ms()?;
    route.check(hint.ip)?; // Before even creating a connection attempt.
    let socket = new(route.inner.local_ip())?;
    route.inner.bind(&socket)?;
    bind(&socket, route.inner.local_ip(), 0)?;
    route.check(hint.ip)?;
    if elapsed_ms()?
        .checked_sub(start)
        .ok_or(PairingError::LanUnavailable)?
        >= limit
    {
        return Err(PairingError::ConnectionClosed);
    }
    let connected = match socket.connect(&SocketAddr::new(hint.ip, hint.port).into()) {
        Ok(()) => true,
        Err(error)
            if matches!(
                error.raw_os_error(),
                Some(libc::EINPROGRESS) | Some(libc::EALREADY) | Some(libc::EWOULDBLOCK)
            ) =>
        {
            false
        }
        Err(_) => return Err(PairingError::ConnectionClosed),
    };
    if !connected {
        loop {
            route.check(hint.ip)?;
            let spent = elapsed_ms()?
                .checked_sub(start)
                .ok_or(PairingError::LanUnavailable)?;
            if spent >= limit {
                return Err(PairingError::ConnectionClosed);
            }
            let mut poll = libc::pollfd {
                fd: socket.as_raw_fd(),
                events: libc::POLLOUT,
                revents: 0,
            };
            let ready = unsafe { libc::poll(&mut poll, 1, (limit - spent).min(25) as i32) };
            if ready < 0 {
                if std::io::Error::last_os_error().kind() == std::io::ErrorKind::Interrupted {
                    continue;
                }
                return Err(PairingError::ConnectionClosed);
            }
            if ready == 0 {
                continue;
            }
            route.check(hint.ip)?;
            if poll.revents & libc::POLLNVAL != 0
                || socket
                    .take_error()
                    .map_err(|_| PairingError::ConnectionClosed)?
                    .is_some()
            {
                return Err(PairingError::ConnectionClosed);
            }
            if poll.revents & libc::POLLOUT != 0 {
                break;
            }
            return Err(PairingError::ConnectionClosed);
        }
    }
    if elapsed_ms()?
        .checked_sub(start)
        .ok_or(PairingError::LanUnavailable)?
        >= limit
    {
        return Err(PairingError::ConnectionClosed);
    }
    route.check(hint.ip)?;
    let stream: TcpStream = socket.into();
    if stream
        .local_addr()
        .map_err(|_| PairingError::LanUnavailable)?
        .ip()
        != route.inner.local_ip()
        || stream
            .peer_addr()
            .map_err(|_| PairingError::LanUnavailable)?
            != SocketAddr::new(hint.ip, hint.port)
    {
        return Err(PairingError::LanUnavailable);
    }
    Ok(stream)
}
