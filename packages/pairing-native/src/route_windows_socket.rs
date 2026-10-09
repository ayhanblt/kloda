use super::super::{elapsed_ms, Route};
use crate::{
    error::{PairingError, Result},
    qr::LanHint,
};
use socket2::Socket;
use std::{
    net::{SocketAddr, TcpStream},
    os::windows::io::AsRawSocket,
    ptr,
    time::Duration,
};
use windows_sys::Win32::Networking::WinSock::*;

pub(super) fn exclusive(socket: &Socket) -> Result<()> {
    let value = 1i32;
    let mut actual = 0i32;
    let mut length = std::mem::size_of::<i32>() as i32;
    let raw = socket.as_raw_socket() as SOCKET;
    // Before binding, reserve the exact local address/port against socket hijacking.
    if unsafe {
        setsockopt(
            raw,
            SOL_SOCKET,
            SO_EXCLUSIVEADDRUSE,
            ptr::from_ref(&value).cast(),
            length,
        )
    } != 0
        || unsafe {
            getsockopt(
                raw,
                SOL_SOCKET,
                SO_EXCLUSIVEADDRUSE,
                ptr::from_mut(&mut actual).cast(),
                &mut length,
            )
        } != 0
        || length != std::mem::size_of::<i32>() as i32
        || actual == 0
    {
        return Err(PairingError::LanUnavailable);
    }
    Ok(())
}

pub(in super::super) fn connect(
    route: &Route,
    hint: &LanHint,
    timeout: Duration,
) -> Result<TcpStream> {
    let limit = duration_bound(timeout)?;
    if hint.port == 0 {
        return Err(PairingError::LanUnavailable);
    }
    let start = elapsed_ms()?;
    route.check(hint.ip)?;
    let socket = super::new(route.inner.local_ip())?;
    route.inner.bind(&socket)?;
    super::bind(&socket, route.inner.local_ip(), 0)?;
    route.check(hint.ip)?;
    remaining(start, limit)?;
    let peer = SocketAddr::new(hint.ip, hint.port);
    let connected = match socket.connect(&peer.into()) {
        Ok(()) => true,
        Err(error)
            if matches!(
                error.raw_os_error(),
                Some(WSAEWOULDBLOCK) | Some(WSAEINPROGRESS) | Some(WSAEALREADY)
            ) =>
        {
            false
        }
        Err(_) => return Err(PairingError::ConnectionClosed),
    };
    if !connected {
        loop {
            route.check(hint.ip)?;
            let wait = remaining(start, limit)?.min(25) as i32;
            let mut poll = WSAPOLLFD {
                fd: socket.as_raw_socket() as SOCKET,
                events: POLLWRNORM,
                revents: 0,
            };
            // Windows 11 reports connect errors with ERR|HUP|WRNORM. Read the
            // actual SO_ERROR via socket2 as well; writable alone is not success.
            let ready = unsafe { WSAPoll(&mut poll, 1, wait) };
            if ready == SOCKET_ERROR {
                if unsafe { WSAGetLastError() } == WSAEINTR {
                    continue;
                }
                return Err(PairingError::ConnectionClosed);
            }
            if ready == 0 {
                continue;
            }
            route.check(hint.ip)?;
            let error = socket
                .take_error()
                .map_err(|_| PairingError::ConnectionClosed)?;
            if error.is_some()
                || poll.revents & (POLLNVAL | POLLERR | POLLHUP) != 0
                || poll.revents & POLLWRNORM == 0
            {
                return Err(PairingError::ConnectionClosed);
            }
            break;
        }
    }
    remaining(start, limit)?;
    route.check(hint.ip)?;
    if socket
        .take_error()
        .map_err(|_| PairingError::ConnectionClosed)?
        .is_some()
    {
        return Err(PairingError::ConnectionClosed);
    }
    let stream: TcpStream = socket.into();
    let local = stream
        .local_addr()
        .map_err(|_| PairingError::LanUnavailable)?;
    if local.ip() != route.inner.local_ip()
        || !super::super::platform::unscoped(local)
        || stream
            .peer_addr()
            .map_err(|_| PairingError::LanUnavailable)?
            != peer
    {
        return Err(PairingError::LanUnavailable);
    }
    route.check(hint.ip)?;
    remaining(start, limit)?;
    Ok(stream)
}

fn duration_bound(timeout: Duration) -> Result<u64> {
    let millis = u64::try_from(timeout.as_millis()).map_err(|_| PairingError::LanUnavailable)?;
    if millis == 0 || timeout > Duration::from_secs(10) {
        return Err(PairingError::LanUnavailable);
    }
    Ok(millis)
}

fn remaining(start: u64, limit: u64) -> Result<u64> {
    let spent = elapsed_ms()?
        .checked_sub(start)
        .ok_or(PairingError::LanUnavailable)?;
    if spent >= limit {
        return Err(PairingError::ConnectionClosed);
    }
    Ok(limit - spent)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn connect_deadline_rejects_fractional_overflow() {
        assert!(duration_bound(Duration::ZERO).is_err());
        assert!(duration_bound(Duration::from_nanos(999_999)).is_err());
        assert_eq!(duration_bound(Duration::from_millis(1)).unwrap(), 1);
        assert_eq!(duration_bound(Duration::from_secs(10)).unwrap(), 10_000);
        assert!(duration_bound(Duration::from_secs(10) + Duration::from_nanos(1)).is_err());
        assert!(duration_bound(Duration::MAX).is_err());
    }
}
