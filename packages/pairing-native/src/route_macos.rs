use crate::error::{PairingError, Result};
use socket2::Socket;
use std::{
    net::IpAddr,
    num::NonZeroU32,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Mutex,
    },
};

#[path = "route_macos_if.rs"]
mod interfaces;
#[path = "route_macos_query.rs"]
mod query;

pub(super) struct Route {
    interface: interfaces::Interface,
    monitor: Socket,
    invalid: AtomicBool,
    last_direct_ms: AtomicU64,
    last_direct_peer: Mutex<Option<IpAddr>>,
}

impl Route {
    pub(super) fn open(peer: Option<IpAddr>) -> Result<Self> {
        if peer.is_some_and(|ip| !super::address::supported(ip)) {
            return Err(PairingError::LanUnavailable);
        }
        // Subscribe before taking evidence so changes during classification cannot go unnoticed.
        let monitor = query::monitor()?;
        let interface = interfaces::select(peer)?;
        let route = Self {
            interface,
            monitor,
            invalid: AtomicBool::new(false),
            last_direct_ms: AtomicU64::new(0),
            last_direct_peer: Mutex::new(None),
        };
        match peer {
            Some(peer) => route.check_uncached(peer)?,
            None => route.check_local_uncached()?,
        }
        Ok(route)
    }

    pub(super) fn local_ip(&self) -> IpAddr {
        self.interface.prefix.local
    }

    pub(super) fn bind(&self, socket: &Socket) -> Result<()> {
        self.check_base()?;
        let index = NonZeroU32::new(self.interface.index).ok_or(PairingError::LanUnavailable)?;
        // socket2 maps these exact calls to SDK IP_BOUND_IF / IPV6_BOUND_IF on macOS.
        let result = if self.local_ip().is_ipv4() {
            socket.bind_device_by_index_v4(Some(index))
        } else {
            socket.bind_device_by_index_v6(Some(index))
        };
        result.map_err(|_| PairingError::LanUnavailable)?;
        let actual = if self.local_ip().is_ipv4() {
            socket.device_index_v4()
        } else {
            socket.device_index_v6()
        }
        .map_err(|_| PairingError::LanUnavailable)?;
        if actual != Some(index) {
            return Err(PairingError::LanUnavailable);
        }
        self.check_base()
    }

    fn check_base(&self) -> Result<()> {
        if self.invalid.load(Ordering::Acquire) {
            return Err(PairingError::LanUnavailable);
        }
        let result =
            query::unchanged(&self.monitor).and_then(|_| interfaces::current(self.interface));
        if result.is_err() {
            self.invalid.store(true, Ordering::Release);
        }
        result
    }

    fn monitor_unchanged(&self) -> Result<()> {
        if self.invalid.load(Ordering::Acquire) {
            return Err(PairingError::LanUnavailable);
        }
        let result = query::unchanged(&self.monitor);
        if result.is_err() {
            self.invalid.store(true, Ordering::Release);
        }
        result
    }

    fn check_local_uncached(&self) -> Result<()> {
        self.check_base()?;
        query::direct(self.interface.prefix.witness()?, self.interface.index)?;
        self.check_base()
    }

    fn check_uncached(&self, peer: IpAddr) -> Result<()> {
        // An ineligible contender cannot poison an otherwise valid listener.
        if !self.interface.prefix.accepts(peer) {
            return Err(PairingError::LanUnavailable);
        }
        self.check_base()?;
        query::direct(peer, self.interface.index)?;
        self.check_base()
    }

    pub(super) fn check_local(&self) -> Result<()> {
        let target = self.interface.prefix.witness()?;
        self.monitor_unchanged()?;
        let now = super::elapsed_ms()?;
        let last = self.last_direct_ms.load(Ordering::Acquire);
        if last != 0
            && now.saturating_sub(last) < 250
            && self
                .last_direct_peer
                .lock()
                .is_ok_and(|saved| *saved == Some(target))
        {
            return Ok(());
        }
        self.check_local_uncached()?;
        if let Ok(mut saved) = self.last_direct_peer.lock() {
            *saved = Some(target);
        }
        self.last_direct_ms.store(now, Ordering::Release);
        Ok(())
    }

    pub(super) fn check(&self, peer: IpAddr) -> Result<()> {
        if !self.interface.prefix.accepts(peer) {
            return Err(PairingError::LanUnavailable);
        }
        self.monitor_unchanged()?;
        let now = super::elapsed_ms()?;
        let last = self.last_direct_ms.load(Ordering::Acquire);
        if last != 0
            && now.saturating_sub(last) < 250
            && self
                .last_direct_peer
                .lock()
                .is_ok_and(|saved| *saved == Some(peer))
        {
            return Ok(());
        }
        self.check_uncached(peer)?;
        if let Ok(mut saved) = self.last_direct_peer.lock() {
            *saved = Some(peer);
        }
        self.last_direct_ms.store(now, Ordering::Release);
        Ok(())
    }
}
