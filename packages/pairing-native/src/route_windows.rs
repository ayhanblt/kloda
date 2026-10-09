use crate::error::{PairingError, Result};
use socket2::Socket;
use std::net::IpAddr;

#[path = "route_windows_if.rs"]
mod interfaces;
#[path = "route_windows_query.rs"]
mod query;
#[path = "route_windows_watch.rs"]
mod watch;

pub(super) struct Route {
    interface: interfaces::Interface,
    watch: watch::Watch,
}

impl Route {
    pub(super) fn open(peer: Option<IpAddr>) -> Result<Self> {
        if peer.is_some_and(|ip| !super::address::supported(ip)) {
            return Err(PairingError::LanUnavailable);
        }
        // Subscribe before taking any evidence: remove/re-add cannot revive this route.
        let watch = watch::Watch::open()?;
        let interface = interfaces::select(peer)?;
        let route = Self { interface, watch };
        match peer {
            Some(peer) => route.check(peer)?,
            None => route.check_local()?,
        }
        Ok(route)
    }

    pub(super) fn local_ip(&self) -> IpAddr {
        self.interface.prefix.local
    }

    pub(super) fn bind(&self, socket: &Socket) -> Result<()> {
        self.check_base()?;
        query::bind(socket, self.interface)?;
        self.check_base()
    }

    fn check_base(&self) -> Result<()> {
        self.watch.check()?;
        let result = interfaces::current(self.interface);
        if result.is_err() {
            self.watch.invalidate();
        }
        result?;
        self.watch.check()
    }

    pub(super) fn check_local(&self) -> Result<()> {
        self.check_base()?;
        let result = query::direct(self.interface.prefix.witness()?, self.interface);
        if result.is_err() {
            self.watch.invalidate();
        }
        result?;
        self.check_base()
    }

    pub(super) fn check(&self, peer: IpAddr) -> Result<()> {
        // Bad incoming contenders do not invalidate a healthy listener.
        if !self.interface.prefix.accepts(peer) {
            return Err(PairingError::LanUnavailable);
        }
        self.check_base()?;
        query::direct(peer, self.interface)?;
        self.check_base()
    }
}

pub(super) fn unscoped(address: std::net::SocketAddr) -> bool {
    match address {
        std::net::SocketAddr::V4(_) => true,
        std::net::SocketAddr::V6(address) => address.scope_id() == 0 && address.flowinfo() == 0,
    }
}

pub(super) fn cleanup_check() -> Result<()> {
    watch::cleanup_check()
}

#[cfg(test)]
mod tests {
    use super::unscoped;
    use std::net::{SocketAddr, SocketAddrV6};

    #[test]
    fn frozen_ipv6_endpoints_never_discard_numeric_scope() {
        let ip = "fd12::42".parse().unwrap();
        assert!(unscoped(SocketAddr::V6(SocketAddrV6::new(ip, 1234, 0, 0))));
        assert!(!unscoped(SocketAddr::V6(SocketAddrV6::new(ip, 1234, 0, 7))));
        assert!(!unscoped(SocketAddr::V6(SocketAddrV6::new(ip, 1234, 1, 0))));
    }
}
