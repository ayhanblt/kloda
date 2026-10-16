use crate::error::{PairingError, Result};
use crate::frame::{Frame, FrameDecoder};
use crate::key::Spki;
use crate::{proof, tls_config, tls_verifier::Verifier};
use rustls::sign::CertifiedKey;
use rustls::Connection;
use std::io::{ErrorKind, Read, Write};
use std::net::{IpAddr, Shutdown, TcpStream};
use std::sync::Arc;
use zeroize::Zeroizing;
#[path = "tls_admission.rs"]
mod admission;

pub(crate) struct Channel {
    generation: u64,
    peer: Spki,
    binding: Zeroizing<[u8; 32]>,
}
impl Channel {
    pub(crate) fn generation(&self) -> u64 {
        self.generation
    }
    pub(crate) fn peer(&self) -> &Spki {
        &self.peer
    }
    pub(crate) fn binding(&self) -> &[u8; 32] {
        &self.binding
    }
    #[cfg(test)]
    pub(crate) fn for_state_test(generation: u64, peer: Spki, binding: [u8; 32]) -> Self {
        Self {
            generation,
            peer,
            binding: Zeroizing::new(binding),
        }
    }
}

/// No channel evidence exists until the engine has completed full mutual TLS.
pub(crate) struct Session {
    connection: Option<Connection>,
    verifier: Arc<Verifier>,
    socket: Option<TcpStream>,
    generation: u64,
    pc: bool,
    peer: Option<Spki>,
    decoder: FrameDecoder,
    deadline: u64,
    partial_since: Option<u64>,
    established: bool,
    outbound: bool,
    eof: bool,
    peer_closed: bool,
}
impl Session {
    pub(crate) fn server(
        socket: TcpStream,
        key: Arc<CertifiedKey>,
        generation: u64,
        now: u64,
    ) -> Result<Self> {
        let (connection, verifier) = tls_config::server(key)?;
        Self::new(socket, connection, verifier, generation, true, now)
    }
    pub(crate) fn client(
        socket: TcpStream,
        key: Arc<CertifiedKey>,
        generation: u64,
        now: u64,
        expected: [u8; 32],
        ip: IpAddr,
    ) -> Result<Self> {
        let (connection, verifier) = tls_config::client(key, expected, ip)?;
        Self::new(socket, connection, verifier, generation, false, now)
    }
    fn new(
        socket: TcpStream,
        mut connection: Connection,
        verifier: Arc<Verifier>,
        generation: u64,
        pc: bool,
        now: u64,
    ) -> Result<Self> {
        socket
            .set_nonblocking(true)
            .map_err(|_| PairingError::LanUnavailable)?;
        connection.set_buffer_limit(Some(4096));
        Ok(Self {
            connection: Some(connection),
            verifier,
            socket: Some(socket),
            generation,
            pc,
            peer: None,
            decoder: FrameDecoder::new(),
            deadline: now
                .checked_add(10_000)
                .ok_or(PairingError::NativeUnsupported)?,
            partial_since: None,
            established: false,
            outbound: false,
            eof: false,
            peer_closed: false,
        })
    }
    pub(crate) fn generation(&self) -> u64 {
        self.generation
    }
    pub(crate) fn peer_ip(&self) -> Result<IpAddr> {
        self.socket
            .as_ref()
            .ok_or(PairingError::ConnectionClosed)?
            .peer_addr()
            .map(|a| a.ip())
            .map_err(|_| PairingError::ConnectionClosed)
    }
    pub(crate) fn established(&self) -> bool {
        self.established
    }
    pub(crate) fn channel(&self, sid: &[u8; 16], local: &Spki) -> Result<Channel> {
        if !self.established || self.is_file() {
            return Err(PairingError::TlsRejected);
        }
        let peer = self.peer.as_ref().ok_or(PairingError::TlsRejected)?;
        let local_fp = local.fingerprint();
        let peer_fp = peer.fingerprint();
        let (pc, phone) = if self.pc {
            (&local_fp, &peer_fp)
        } else {
            (&peer_fp, &local_fp)
        };
        let context = proof::context(sid, pc, phone);
        let mut binding = Zeroizing::new([0; 32]);
        self.connection
            .as_ref()
            .ok_or(PairingError::TlsRejected)?
            .export_keying_material(binding.as_mut(), proof::EXPORTER_LABEL, Some(&context))
            .map_err(|_| PairingError::TlsRejected)?;
        Ok(Channel {
            generation: self.generation,
            peer: peer.clone(),
            binding,
        })
    }
    /// Called only for actual state advancement; duplicates cannot extend inactivity.
    pub(crate) fn progress(&mut self, now: u64) -> Result<()> {
        self.deadline = now
            .checked_add(10_000)
            .ok_or(PairingError::NativeUnsupported)?;
        Ok(())
    }
    pub(crate) fn check_deadline(&self, now: u64, human_approval: bool) -> Result<()> {
        if self
            .partial_since
            .is_some_and(|start| now < start || now - start >= 10_000)
            || (!human_approval && now >= self.deadline)
        {
            return Err(PairingError::ConnectionClosed);
        }
        Ok(())
    }
    pub(crate) fn pump(&mut self, now: u64) -> Result<()> {
        self.flush()?;
        let connection = self.connection.as_mut().ok_or(PairingError::TlsRejected)?;
        if !self.eof && connection.wants_read() {
            let socket = self.socket.as_mut().ok_or(PairingError::ConnectionClosed)?;
            match connection.read_tls(socket) {
                Ok(0) => {
                    self.eof = true;
                }
                Ok(_) => {
                    let state = connection.process_new_packets().map_err(|error|
                    if matches!(&error,rustls::Error::General(message) if message=="identity_unavailable") {
                        PairingError::IdentityUnavailable
                    } else {PairingError::TlsRejected})?;
                    self.peer_closed |= state.peer_has_closed();
                }
                Err(e) if e.kind() == ErrorKind::WouldBlock => (),
                Err(_) => return Err(PairingError::ConnectionClosed),
            }
        }
        self.flush()?;
        let connection = self.connection.as_ref().ok_or(PairingError::TlsRejected)?;
        if !self.established && !connection.is_handshaking() {
            let alpn = connection
                .alpn_protocol()
                .ok_or(PairingError::TlsRejected)?;
            let allowed = alpn == tls_config::ALPN || (self.pc && alpn == tls_config::FILE_ALPN);
            let valid = allowed && tls_config::full_profile(connection, alpn);
            if !valid {
                return Err(PairingError::TlsRejected);
            }
            self.peer = self
                .verifier
                .verified_key
                .lock()
                .map_err(|_| PairingError::TlsRejected)?
                .clone();
            if self.peer.is_none() {
                return Err(PairingError::TlsRejected);
            }
            self.established = true;
            self.progress(now)?;
        }
        if self.eof && !self.established {
            return Err(PairingError::ConnectionClosed);
        }
        Ok(())
    }
    pub(crate) fn next_frame(&mut self, now: u64) -> Result<Option<Frame>> {
        if !self.established {
            return Ok(None);
        }
        if self.is_file() {
            return Err(PairingError::TlsRejected);
        }
        let connection = self.connection.as_mut().ok_or(PairingError::TlsRejected)?;
        let mut buffer = Zeroizing::new([0; 52]);
        loop {
            let limit = self.decoder.read_bound();
            match connection.reader().read(&mut buffer[..limit]) {
                Ok(0) => {
                    self.decoder.finish()?;
                    return Err(PairingError::ConnectionClosed);
                }
                Ok(count) => {
                    if self.partial_since.is_none() {
                        self.partial_since = Some(now)
                    }
                    let (_, frame) = self.decoder.feed(&buffer[..count])?;
                    buffer.fill(0);
                    if frame.is_some() {
                        self.partial_since = None;
                        return Ok(frame);
                    }
                }
                Err(e) if e.kind() == ErrorKind::WouldBlock => return Ok(None),
                Err(_) => return Err(PairingError::ConnectionClosed),
            }
        }
    }
    pub(crate) fn send(&mut self, frame: &Frame) -> Result<()> {
        if !self.established || self.outbound || self.is_file() {
            return Err(PairingError::TlsRejected);
        }
        let mut encoded = Zeroizing::new([0; 52]);
        let length = frame.encode(&mut encoded);
        self.connection
            .as_mut()
            .ok_or(PairingError::TlsRejected)?
            .writer()
            .write_all(&encoded[..length])
            .map_err(|_| PairingError::ConnectionClosed)?;
        self.outbound = true;
        self.flush()
    }
    pub(crate) fn sent(&mut self) -> Result<bool> {
        self.flush()?;
        if self.outbound
            && !self
                .connection
                .as_ref()
                .ok_or(PairingError::TlsRejected)?
                .wants_write()
        {
            self.outbound = false;
            return Ok(true);
        }
        Ok(false)
    }
    fn flush(&mut self) -> Result<()> {
        let connection = self.connection.as_mut().ok_or(PairingError::TlsRejected)?;
        let socket = self.socket.as_mut().ok_or(PairingError::ConnectionClosed)?;
        while connection.wants_write() {
            match connection.write_tls(socket) {
                Ok(0) => return Err(PairingError::ConnectionClosed),
                Ok(_) => (),
                Err(e) if e.kind() == ErrorKind::WouldBlock => break,
                Err(_) => return Err(PairingError::ConnectionClosed),
            }
        }
        Ok(())
    }
}
impl Drop for Session {
    fn drop(&mut self) {
        if let Some(socket) = &self.socket {
            let _ = socket.shutdown(Shutdown::Both);
        }
    }
}

#[cfg(test)]
#[path = "tls_tests.rs"]
mod tests;
