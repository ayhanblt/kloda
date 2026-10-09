use crate::error::{PairingError, Result};
use crate::tls_verifier::Verifier;
use rustls::client::{ResolvesClientCert, Resumption};
use rustls::pki_types::ServerName;
use rustls::server::{ClientHello, NoServerSessionStorage, ProducesTickets, ResolvesServerCert};
use rustls::sign::CertifiedKey;
use rustls::{
    ClientConfig, ClientConnection, Connection, ServerConfig, ServerConnection, SignatureScheme,
};
use std::net::IpAddr;
use std::sync::{Arc, LazyLock, Mutex};

pub(crate) const ALPN: &[u8] = b"kloda-pair/1";

#[derive(Debug)]
struct Resolver(Arc<CertifiedKey>);
impl ResolvesServerCert for Resolver {
    fn resolve(&self, hello: ClientHello<'_>) -> Option<Arc<CertifiedKey>> {
        hello
            .signature_schemes()
            .contains(&SignatureScheme::ECDSA_NISTP256_SHA256)
            .then(|| self.0.clone())
    }
}
impl ResolvesClientCert for Resolver {
    fn resolve(&self, _: &[&[u8]], schemes: &[SignatureScheme]) -> Option<Arc<CertifiedKey>> {
        schemes
            .contains(&SignatureScheme::ECDSA_NISTP256_SHA256)
            .then(|| self.0.clone())
    }
    fn has_certs(&self) -> bool {
        true
    }
}

#[derive(Debug)]
struct DisabledTickets;
impl ProducesTickets for DisabledTickets {
    fn enabled(&self) -> bool {
        false
    }
    fn lifetime(&self) -> u32 {
        0
    }
    fn encrypt(&self, _: &[u8]) -> Option<Vec<u8>> {
        None
    }
    fn decrypt(&self, _: &[u8]) -> Option<Vec<u8>> {
        None
    }
}

static PROVIDER: LazyLock<Arc<rustls::crypto::CryptoProvider>> = LazyLock::new(|| {
    let mut provider = rustls::crypto::ring::default_provider();
    provider.cipher_suites = vec![rustls::crypto::ring::cipher_suite::TLS13_AES_128_GCM_SHA256];
    provider.kx_groups = vec![rustls::crypto::ring::kx_group::SECP256R1];
    Arc::new(provider)
});

fn provider() -> Arc<rustls::crypto::CryptoProvider> {
    PROVIDER.clone()
}
pub(super) fn algorithms() -> &'static rustls::crypto::WebPkiSupportedAlgorithms {
    &PROVIDER.signature_verification_algorithms
}

pub(super) fn server(key: Arc<CertifiedKey>) -> Result<(Connection, Arc<Verifier>)> {
    let verifier = Arc::new(Verifier {
        expected_pc: None,
        verified_key: Mutex::new(None),
    });
    let mut config = ServerConfig::builder_with_provider(provider())
        .with_protocol_versions(&[&rustls::version::TLS13])
        .map_err(|_| PairingError::TlsRejected)?
        .with_client_cert_verifier(verifier.clone())
        .with_cert_resolver(Arc::new(Resolver(key)));
    config.alpn_protocols = vec![ALPN.to_vec()];
    config.session_storage = Arc::new(NoServerSessionStorage {});
    config.ticketer = Arc::new(DisabledTickets);
    config.send_tls13_tickets = 0;
    config.max_early_data_size = 0;
    let connection =
        ServerConnection::new(Arc::new(config)).map_err(|_| PairingError::TlsRejected)?;
    Ok((Connection::Server(connection), verifier))
}

pub(super) fn client(
    key: Arc<CertifiedKey>,
    expected: [u8; 32],
    ip: IpAddr,
) -> Result<(Connection, Arc<Verifier>)> {
    let verifier = Arc::new(Verifier {
        expected_pc: Some(expected),
        verified_key: Mutex::new(None),
    });
    let mut config = ClientConfig::builder_with_provider(provider())
        .with_protocol_versions(&[&rustls::version::TLS13])
        .map_err(|_| PairingError::TlsRejected)?
        .dangerous()
        .with_custom_certificate_verifier(verifier.clone())
        .with_client_cert_resolver(Arc::new(Resolver(key)));
    config.alpn_protocols = vec![ALPN.to_vec()];
    config.resumption = Resumption::disabled();
    config.enable_early_data = false;
    config.enable_sni = false;
    let connection = ClientConnection::new(Arc::new(config), ServerName::IpAddress(ip.into()))
        .map_err(|_| PairingError::TlsRejected)?;
    Ok((Connection::Client(connection), verifier))
}
