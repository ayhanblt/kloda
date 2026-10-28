use crate::{
    error::{PairingError, Result},
    qr::LanHint,
};
use std::{
    net::{IpAddr, TcpListener, TcpStream},
    time::Duration,
};

#[cfg(any(
    target_os = "macos",
    target_os = "ios",
    target_os = "android",
    target_os = "windows"
))]
#[path = "route_address.rs"]
mod address;
#[path = "route_clock.rs"]
mod clock;
#[cfg(target_os = "macos")]
#[path = "route_macos.rs"]
mod platform;
#[cfg(target_os = "ios")]
#[path = "route_ios.rs"]
mod platform;
#[cfg(target_os = "android")]
#[path = "route_android.rs"]
mod platform;
#[cfg(target_os = "windows")]
#[path = "route_windows.rs"]
mod platform;
#[cfg(any(
    target_os = "macos",
    target_os = "ios",
    target_os = "android",
    target_os = "windows"
))]
#[path = "route_socket.rs"]
mod socket;

pub(crate) use clock::{elapsed_ms, unix_seconds};

/// Call after the native owner/worker has dropped its routes and drained callbacks.
#[cfg(target_os = "windows")]
pub(crate) fn cleanup_check() -> Result<()> {
    platform::cleanup_check()
}

/// The platform evidence and socket restriction are native-owned, never caller claims.
pub(crate) struct Route {
    #[cfg(any(
        target_os = "macos",
        target_os = "ios",
        target_os = "android",
        target_os = "windows"
    ))]
    inner: platform::Route,
}

#[cfg(any(target_os = "macos", target_os = "windows"))]
pub(crate) fn listener(port: Option<u16>) -> Result<(Route, TcpListener, LanHint)> {
    listen(
        Route {
            inner: platform::Route::open(None)?,
        },
        port,
    )
}

#[cfg(target_os = "android")]
pub(crate) fn listener(
    port: Option<u16>,
    context: &crate::android_context::AndroidContext,
) -> Result<(Route, TcpListener, LanHint)> {
    listen(
        Route {
            inner: platform::Route::open(None, context)?,
        },
        port,
    )
}

#[cfg(not(any(target_os = "macos", target_os = "android", target_os = "windows")))]
pub(crate) fn listener(_: Option<u16>) -> Result<(Route, TcpListener, LanHint)> {
    Err(PairingError::NativeUnsupported)
}

#[cfg(any(target_os = "macos", target_os = "ios", target_os = "windows"))]
pub(crate) fn for_peer(hint: &LanHint) -> Result<Route> {
    if hint.port == 0 {
        return Err(PairingError::LanUnavailable);
    }
    Ok(Route {
        inner: platform::Route::open(Some(hint.ip))?,
    })
}

#[cfg(target_os = "android")]
pub(crate) fn for_peer(
    hint: &LanHint,
    context: &crate::android_context::AndroidContext,
) -> Result<Route> {
    if hint.port == 0 {
        return Err(PairingError::LanUnavailable);
    }
    Ok(Route {
        inner: platform::Route::open(Some(hint.ip), context)?,
    })
}

#[cfg(not(any(
    target_os = "macos",
    target_os = "ios",
    target_os = "android",
    target_os = "windows"
)))]
pub(crate) fn for_peer(_: &LanHint) -> Result<Route> {
    Err(PairingError::NativeUnsupported)
}

#[cfg(any(target_os = "macos", target_os = "android", target_os = "windows"))]
fn listen(route: Route, port: Option<u16>) -> Result<(Route, TcpListener, LanHint)> {
    if port == Some(0) {
        return Err(PairingError::LanUnavailable);
    }
    route.check_local()?;
    let socket = socket::new(route.inner.local_ip())?;
    route.inner.bind(&socket)?;
    socket::bind(&socket, route.inner.local_ip(), port.unwrap_or(0))?;
    socket.listen(8).map_err(|_| PairingError::LanUnavailable)?;
    let actual = socket
        .local_addr()
        .map_err(|_| PairingError::LanUnavailable)?
        .as_socket()
        .ok_or(PairingError::LanUnavailable)?;
    route.check_local()?;
    if actual.ip() != route.inner.local_ip()
        || actual.port() == 0
        || port.is_some_and(|saved| actual.port() != saved)
    {
        return Err(PairingError::LanUnavailable);
    }
    #[cfg(target_os = "windows")]
    if !platform::unscoped(actual) {
        return Err(PairingError::LanUnavailable);
    }
    let hint = LanHint {
        ip: actual.ip(),
        port: actual.port(),
    };
    Ok((route, socket.into(), hint))
}

impl Route {
    /// Called before every native socket I/O iteration, even while accepting.
    pub(crate) fn check_local(&self) -> Result<()> {
        #[cfg(any(
            target_os = "macos",
            target_os = "ios",
            target_os = "android",
            target_os = "windows"
        ))]
        {
            self.inner.check_local()
        }
        #[cfg(not(any(
            target_os = "macos",
            target_os = "ios",
            target_os = "android",
            target_os = "windows"
        )))]
        {
            Err(PairingError::NativeUnsupported)
        }
    }

    /// Call with the actual socket peer address before TLS and on every I/O iteration.
    pub(crate) fn check(&self, peer: IpAddr) -> Result<()> {
        #[cfg(any(
            target_os = "macos",
            target_os = "ios",
            target_os = "android",
            target_os = "windows"
        ))]
        {
            self.inner.check(peer)
        }
        #[cfg(not(any(
            target_os = "macos",
            target_os = "ios",
            target_os = "android",
            target_os = "windows"
        )))]
        {
            let _ = peer;
            Err(PairingError::NativeUnsupported)
        }
    }

    /// Reapply platform binding to accepted sockets; no reliance on option inheritance.
    pub(crate) fn bind_accepted(&self, stream: &TcpStream) -> Result<()> {
        #[cfg(any(
            target_os = "macos",
            target_os = "ios",
            target_os = "android",
            target_os = "windows"
        ))]
        {
            let peer = stream
                .peer_addr()
                .map_err(|_| PairingError::LanUnavailable)?;
            self.check(peer.ip())?;
            let local = stream
                .local_addr()
                .map_err(|_| PairingError::LanUnavailable)?;
            if local.ip() != self.inner.local_ip() {
                return Err(PairingError::LanUnavailable);
            }
            #[cfg(target_os = "windows")]
            if !platform::unscoped(local) || !platform::unscoped(peer) {
                return Err(PairingError::LanUnavailable);
            }
            self.inner.bind(&socket2::SockRef::from(stream))?;
            stream
                .set_nonblocking(true)
                .map_err(|_| PairingError::LanUnavailable)?;
            self.check(peer.ip())
        }
        #[cfg(not(any(
            target_os = "macos",
            target_os = "ios",
            target_os = "android",
            target_os = "windows"
        )))]
        {
            let _ = stream;
            Err(PairingError::NativeUnsupported)
        }
    }

    pub(crate) fn connect(&self, hint: &LanHint, timeout: Duration) -> Result<TcpStream> {
        #[cfg(any(
            target_os = "macos",
            target_os = "ios",
            target_os = "android",
            target_os = "windows"
        ))]
        {
            socket::connect(self, hint, timeout)
        }
        #[cfg(not(any(
            target_os = "macos",
            target_os = "ios",
            target_os = "android",
            target_os = "windows"
        )))]
        {
            let _ = (hint, timeout);
            Err(PairingError::NativeUnsupported)
        }
    }
}
