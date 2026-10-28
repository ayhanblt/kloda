use crate::error::{PairingError, Result};
use socket2::Socket;
use std::{
    net::IpAddr,
    num::NonZeroU32,
    sync::atomic::{AtomicBool, Ordering},
};

#[path = "route_ios_if.rs"]
mod interfaces;
#[path = "route_ios_query.rs"]
mod query;

pub(super) struct Route {
    interface: interfaces::Interface,
    witness: query::Witness,
    invalid: AtomicBool,
}

impl Route {
    pub(super) fn open(peer: Option<IpAddr>) -> Result<Self> {
        let peer = peer
            .filter(|ip| super::address::supported(*ip))
            .ok_or(PairingError::LanUnavailable)?;
        let witness = query::Witness::open()?;
        let interface = interfaces::select(peer, &witness)?;
        witness.select(&interface.name, interface.index)?;
        let route = Self {
            interface,
            witness,
            invalid: AtomicBool::new(false),
        };
        route.check(peer)?;
        Ok(route)
    }

    pub(super) fn local_ip(&self) -> IpAddr {
        self.interface.prefix.local
    }

    pub(super) fn bind(&self, socket: &Socket) -> Result<()> {
        self.check_base()?;
        let index = NonZeroU32::new(self.interface.index).ok_or(PairingError::LanUnavailable)?;
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
        // iOS checks observed path state and the bound interface; not kernel no-gateway proof.
        let result = self
            .witness
            .check()
            .and_then(|_| interfaces::current(self.interface, &self.witness));
        if result.is_err() {
            self.invalid.store(true, Ordering::Release);
        }
        result
    }

    pub(super) fn check_local(&self) -> Result<()> {
        self.check_base()
    }

    pub(super) fn check(&self, peer: IpAddr) -> Result<()> {
        if !self.interface.prefix.accepts(peer) {
            return Err(PairingError::LanUnavailable);
        }
        self.check_base()
    }
}
