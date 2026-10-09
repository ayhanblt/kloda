use super::*;

#[derive(Debug)]
pub(super) struct Resolver(pub(super) Arc<CertifiedKey>);
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
