use super::address::Prefix;
use crate::{
    android_context::AndroidContext,
    error::{PairingError, Result},
};
use serde::Deserialize;
use socket2::Socket;
use std::{
    fmt::Write,
    net::IpAddr,
    os::fd::AsRawFd,
    sync::atomic::{AtomicBool, Ordering},
};

#[path = "route_android_query.rs"]
mod query;

// NDK android/multinetwork.h: net_handle_t = uint64_t, android_setsocknetwork since API23.
// https://developer.android.com/ndk/reference/group/networking
#[link(name = "android")]
unsafe extern "C" {
    fn android_setsocknetwork(network: u64, socket: libc::c_int) -> libc::c_int;
}

#[derive(Clone, Copy, PartialEq, Eq)]
struct Evidence {
    network: u64,
    generation: u64,
    index: u32,
    interface: [u8; 16],
    prefix: Prefix,
    transport: u8,
    api: u32,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Snapshot<'a> {
    network: u64,
    generation: u64,
    index: u32,
    #[serde(borrow)]
    interface: &'a str,
    #[serde(borrow)]
    local: &'a str,
    prefix: u8,
    #[serde(borrow)]
    transport: &'a str,
    #[serde(rename = "routePrefix")]
    route_prefix: u8,
    api: u32,
}

struct IpText {
    bytes: [u8; 39],
    length: usize,
}
impl Write for IpText {
    fn write_str(&mut self, text: &str) -> std::fmt::Result {
        if self.length + text.len() > self.bytes.len() {
            return Err(std::fmt::Error);
        }
        self.bytes[self.length..self.length + text.len()].copy_from_slice(text.as_bytes());
        self.length += text.len();
        Ok(())
    }
}

fn snapshot(context: &AndroidContext, peer: Option<IpAddr>) -> Result<Evidence> {
    let mut text = IpText {
        bytes: [0; 39],
        length: 0,
    };
    if let Some(peer) = peer {
        write!(&mut text, "{peer}").map_err(|_| PairingError::LanUnavailable)?;
    }
    let argument = std::str::from_utf8(&text.bytes[..text.length])
        .map_err(|_| PairingError::LanUnavailable)?;
    let response = context
        .call_string("nativeRouteSnapshot", argument)
        .map_err(|error| {
            if error == PairingError::NativeUnsupported {
                error
            } else {
                PairingError::LanUnavailable
            }
        })?;
    if response == "unsupported" {
        return Err(PairingError::NativeUnsupported);
    }
    if response.len() > 1_024 {
        return Err(PairingError::LanUnavailable);
    }
    let value: Snapshot<'_> =
        serde_json::from_str(&response).map_err(|_| PairingError::LanUnavailable)?;
    if value.api < 23 {
        return Err(PairingError::NativeUnsupported);
    }
    if value.network == 0
        || value.generation == 0
        || value.index == 0
        || value.interface.is_empty()
        || value.interface.len() >= 16
        || !value
            .interface
            .bytes()
            .all(|byte| (33..=126).contains(&byte))
    {
        return Err(PairingError::LanUnavailable);
    }
    let local = crate::qr_ip::parse(value.local).map_err(|_| PairingError::LanUnavailable)?;
    let prefix = Prefix {
        local,
        bits: value.prefix,
    };
    prefix.validate()?;
    if value.route_prefix == 0
        || value.route_prefix > if local.is_ipv4() { 32 } else { 128 }
        || peer.is_some_and(|ip| !prefix.accepts(ip))
    {
        return Err(PairingError::LanUnavailable);
    }
    let transport = match value.transport {
        "wifi" => 1,
        "ethernet" => 2,
        _ => return Err(PairingError::LanUnavailable),
    };
    let mut interface = [0; 16];
    interface[..value.interface.len()].copy_from_slice(value.interface.as_bytes());
    let actual = unsafe { libc::if_nametoindex(interface.as_ptr().cast()) };
    if actual != value.index {
        return Err(PairingError::LanUnavailable);
    }
    Ok(Evidence {
        network: value.network,
        generation: value.generation,
        index: value.index,
        interface,
        prefix,
        transport,
        api: value.api,
    })
}

pub(super) struct Route {
    context: AndroidContext,
    evidence: Evidence,
    invalid: AtomicBool,
    lookup: Option<query::Lookup>,
}

impl Route {
    pub(super) fn open(peer: Option<IpAddr>, context: &AndroidContext) -> Result<Self> {
        if peer.is_some_and(|ip| !super::address::supported(ip)) {
            return Err(PairingError::LanUnavailable);
        }
        let evidence = snapshot(context, peer)?;
        let lookup = if evidence.api < 33 {
            let socket = super::socket::new(evidence.prefix.local)?;
            if unsafe { android_setsocknetwork(evidence.network, socket.as_raw_fd()) } != 0 {
                return Err(PairingError::NativeUnsupported);
            }
            super::socket::bind(&socket, evidence.prefix.local, 0)?;
            Some(query::Lookup::open(
                &socket,
                evidence.prefix.local,
                peer.unwrap_or(evidence.prefix.witness()?),
                evidence.index,
            )?)
        } else {
            None
        };
        let route = Self {
            context: context.clone(),
            evidence,
            invalid: AtomicBool::new(false),
            lookup,
        };
        match peer {
            Some(peer) => route.check(peer)?,
            None => route.check_local()?,
        }
        Ok(route)
    }

    pub(super) fn local_ip(&self) -> IpAddr {
        self.evidence.prefix.local
    }

    pub(super) fn bind(&self, socket: &Socket) -> Result<()> {
        self.check_local()?;
        // Binds the concrete OS Network's routing domain, not process default connectivity.
        // Combined with bind(exact LinkProperties source IP), this scopes to its verified interface.
        if unsafe { android_setsocknetwork(self.evidence.network, socket.as_raw_fd()) } != 0 {
            return Err(PairingError::LanUnavailable);
        }
        self.check_local()
    }

    fn compare(&self, peer: Option<IpAddr>) -> Result<()> {
        if self.invalid.load(Ordering::Acquire) {
            return Err(PairingError::LanUnavailable);
        }
        let result = snapshot(&self.context, peer).and_then(|value| {
            if value == self.evidence {
                Ok(())
            } else {
                Err(PairingError::LanUnavailable)
            }
        });
        if result.is_err() {
            self.invalid.store(true, Ordering::Release);
        }
        result
    }

    pub(super) fn check_local(&self) -> Result<()> {
        let peer = self.evidence.prefix.witness()?;
        self.compare(Some(peer))?;
        if let Some(lookup) = &self.lookup {
            lookup.direct(self.local_ip(), peer, self.evidence.index)?;
        }
        Ok(())
    }

    pub(super) fn check(&self, peer: IpAddr) -> Result<()> {
        if !self.evidence.prefix.accepts(peer) {
            return Err(PairingError::LanUnavailable);
        }
        self.compare(Some(self.evidence.prefix.witness()?))?;
        let value = snapshot(&self.context, Some(peer))?;
        if value != self.evidence {
            return Err(PairingError::LanUnavailable);
        }
        if let Some(lookup) = &self.lookup {
            lookup.direct(self.local_ip(), peer, self.evidence.index)?;
        }
        Ok(())
    }
}
