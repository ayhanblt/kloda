// Disposable software keys are test fixtures, never production identity custody.
use crate::certificate::{self, CertificateSigner, Role};
use crate::error::{PairingError, Result};
use crate::key::Spki;
use ring::{
    rand::SystemRandom,
    signature::{self, KeyPair as _},
};
use rustls::pki_types::{CertificateDer, PrivatePkcs8KeyDer};
use rustls::sign::CertifiedKey;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

struct SoftwareSigner(signature::EcdsaKeyPair);
impl CertificateSigner for SoftwareSigner {
    fn sign_certificate_tbs(&self, tbs: &[u8]) -> Result<Vec<u8>> {
        self.0
            .sign(&SystemRandom::new(), tbs)
            .map(|s| s.as_ref().to_vec())
            .map_err(|_| PairingError::IdentityUnavailable)
    }
}

pub(crate) struct Identity {
    pub spki: Spki,
    pub key: Arc<CertifiedKey>,
    signer: Arc<SoftwareSigner>,
}
impl Identity {
    pub fn new(role: Role) -> Self {
        let random = SystemRandom::new();
        let document = signature::EcdsaKeyPair::generate_pkcs8(
            &signature::ECDSA_P256_SHA256_ASN1_SIGNING,
            &random,
        )
        .unwrap();
        let pair = signature::EcdsaKeyPair::from_pkcs8(
            &signature::ECDSA_P256_SHA256_ASN1_SIGNING,
            document.as_ref(),
            &random,
        )
        .unwrap();
        let mut der = vec![
            0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06,
            0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0,
        ];
        der.extend_from_slice(pair.public_key().as_ref());
        let spki = Spki::parse(&der).unwrap();
        let signer = Arc::new(SoftwareSigner(pair));
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let cert = certificate::create(
            role,
            &spki,
            now - 86_400,
            now + 364 * 86_400,
            signer.clone(),
        )
        .unwrap();
        let private = PrivatePkcs8KeyDer::from(document.as_ref().to_vec()).into();
        let key = Arc::new(
            CertifiedKey::from_der(
                vec![CertificateDer::from(cert)],
                private,
                &rustls::crypto::ring::default_provider(),
            )
            .unwrap(),
        );
        Self { spki, key, signer }
    }
    pub fn certificate(&self, role: Role, expired: bool) -> Arc<CertifiedKey> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let after = if expired { now - 1 } else { now + 86_400 };
        let cert = certificate::create(role, &self.spki, now - 86_400, after, self.signer.clone())
            .unwrap();
        Arc::new(CertifiedKey::new(
            vec![CertificateDer::from(cert)],
            self.key.key.clone(),
        ))
    }
}
