//! SMB wire only. Native admission/receipts and product activation remain separate gates.
#[cfg(all(unix, feature = "android-jni"))]
mod android_jni;
#[cfg(unix)]
pub mod bridge;
#[cfg(unix)]
pub mod bridge_socket;
pub mod paths;
pub mod photo_manifest;
pub mod publication;
#[cfg(unix)]
pub mod read_bound;

use async_trait::async_trait;
use smb2::{
    client::{Cipher, Connection, Session},
    transport::{ReceiveProgress, TcpTransport, TransportReceive, TransportSend},
    types::Dialect,
};
use std::{
    net::SocketAddr,
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};

#[derive(Clone)]
struct EncryptedWire {
    tcp: Arc<TcpTransport>,
    required: Arc<AtomicBool>,
}
impl EncryptedWire {
    fn check(&self, frame: &[u8]) -> smb2::Result<()> {
        require_encrypted(self.required.load(Ordering::Acquire), frame)
    }
}
#[async_trait]
impl TransportSend for EncryptedWire {
    async fn send(&self, frame: &[u8]) -> smb2::Result<()> {
        self.check(frame)?;
        self.tcp.send(frame).await
    }
}
#[async_trait]
impl TransportReceive for EncryptedWire {
    async fn receive(&self) -> smb2::Result<Vec<u8>> {
        let frame = self.tcp.receive().await?;
        self.check(&frame)?;
        Ok(frame)
    }
    fn receive_progress(&self) -> Option<Arc<ReceiveProgress>> {
        self.tcp.receive_progress()
    }
}

pub struct NegotiatedSmb {
    conn: Connection,
    encrypted: Arc<AtomicBool>,
    cipher: Cipher,
}
impl NegotiatedSmb {
    // A numeric endpoint pins the address: native LAN-route admission is still a separate required gate.
    pub async fn connect(address: SocketAddr, remaining: Duration) -> smb2::Result<Self> {
        if remaining.is_zero() {
            return Err(smb2::Error::invalid_data("cancelled"));
        }
        let tcp = TcpTransport::connect(address, remaining).await?;
        Self::negotiate(tcp, address, remaining).await
    }
    /// Wrap only a connected, exclusively owned socket supplied by the native route owner.
    /// Peer equality is an additional fence, not proof of OS route/source admission.
    pub async fn from_stream(
        stream: tokio::net::TcpStream,
        address: SocketAddr,
        remaining: Duration,
    ) -> smb2::Result<Self> {
        if remaining.is_zero() {
            return Err(smb2::Error::invalid_data("cancelled"));
        }
        if stream.peer_addr().map_err(smb2::Error::Io)? != address {
            return Err(smb2::Error::invalid_data("socket_peer_mismatch"));
        }
        stream.set_nodelay(true).map_err(smb2::Error::Io)?;
        Self::negotiate(TcpTransport::from_tokio_stream(stream), address, remaining).await
    }
    async fn negotiate(
        tcp: TcpTransport,
        address: SocketAddr,
        remaining: Duration,
    ) -> smb2::Result<Self> {
        let tcp = Arc::new(tcp);
        let encrypted = Arc::new(AtomicBool::new(false));
        let wire = EncryptedWire {
            tcp,
            required: encrypted.clone(),
        };
        let mut conn = Connection::from_transport(
            Box::new(wire.clone()),
            Box::new(wire),
            address.ip().to_string(),
        );
        conn.set_compression_requested(false);
        conn.set_response_timeout(Some(remaining));
        conn.negotiate().await?;
        let params = conn
            .params()
            .ok_or_else(|| smb2::Error::invalid_data("negotiate_missing"))?;
        if params.dialect < Dialect::Smb3_0 {
            return Err(smb2::Error::invalid_data("smb3_required"));
        }
        let cipher = match params.dialect {
            Dialect::Smb3_1_1 => params
                .cipher
                .ok_or_else(|| smb2::Error::invalid_data("encryption_required"))?,
            _ if params
                .capabilities
                .contains(smb2::types::flags::Capabilities::ENCRYPTION) =>
            {
                Cipher::Aes128Ccm
            }
            _ => return Err(smb2::Error::invalid_data("encryption_required")),
        };
        Ok(Self {
            conn,
            encrypted,
            cipher,
        })
    }
    pub async fn authenticate(
        mut self,
        username: &str,
        password: &str,
        domain: &str,
    ) -> smb2::Result<Connection> {
        require_named_account(username)?;
        let session = Session::setup(&mut self.conn, username, password, domain).await?;
        if !session.should_sign {
            return Err(smb2::Error::invalid_data("signing_required"));
        }
        let enc = session
            .encryption_key
            .ok_or_else(|| smb2::Error::invalid_data("encryption_required"))?;
        let dec = session
            .decryption_key
            .ok_or_else(|| smb2::Error::invalid_data("encryption_required"))?;
        self.conn.activate_encryption(enc, dec, self.cipher);
        self.encrypted.store(true, Ordering::Release);
        Ok(self.conn)
    }
}

fn require_named_account(username: &str) -> smb2::Result<()> {
    if username.trim().is_empty() || username.eq_ignore_ascii_case("guest") {
        return Err(smb2::Error::invalid_data("named_account_required"));
    }
    Ok(())
}
fn require_encrypted(required: bool, frame: &[u8]) -> smb2::Result<()> {
    if required && !frame.starts_with(b"\xfdSMB") {
        return Err(smb2::Error::invalid_data("encryption_required"));
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn authenticated_wire_rejects_plaintext_including_signed_frames() {
        let mut signed_plain = vec![0; 64];
        signed_plain[..4].copy_from_slice(b"\xfeSMB");
        signed_plain[16] = 8;
        assert!(require_encrypted(true, &signed_plain).is_err());
        assert!(require_encrypted(false, &signed_plain).is_ok());
        assert!(require_encrypted(true, b"\xfcSMBcompressed").is_err());
    }
    #[test]
    fn guest_and_empty_accounts_fail_without_rejecting_a_domain_named_guest() {
        for name in ["", " ", "Guest", "gUeSt"] {
            assert!(require_named_account(name).is_err());
        }
        assert!(require_named_account("owned@guest").is_ok());
    }
    #[test]
    fn expired_budget_stops_before_transport() {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let result = rt.block_on(NegotiatedSmb::connect(
            "127.0.0.1:0".parse().unwrap(),
            Duration::ZERO,
        ));
        assert!(
            matches!(result, Err(smb2::Error::InvalidData { message }) if message == "cancelled")
        );
    }
}
