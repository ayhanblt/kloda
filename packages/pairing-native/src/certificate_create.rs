use super::{validate, Role};
use crate::{
    error::{PairingError, Result},
    key::Spki,
};
use rcgen::{
    CertificateParams, CustomExtension, DistinguishedName, DnType, ExtendedKeyUsagePurpose,
    KeyPair, RemoteKeyPair, SignatureAlgorithm, PKCS_ECDSA_P256_SHA256,
};
use ring::rand::{SecureRandom, SystemRandom};
use std::sync::Arc;

/// Internal hardware custody interface. Only native-owned V1 certificate TBS enters this callback.
pub(crate) trait CertificateSigner: Send + Sync {
    fn sign_certificate_tbs(&self, tbs: &[u8]) -> Result<Vec<u8>>;
}
struct HardwareKey {
    spki: Spki,
    signer: Arc<dyn CertificateSigner>,
}
impl RemoteKeyPair for HardwareKey {
    fn public_key(&self) -> &[u8] {
        &self.spki.as_bytes()[26..]
    }
    fn sign(&self, msg: &[u8]) -> std::result::Result<Vec<u8>, rcgen::Error> {
        self.signer
            .sign_certificate_tbs(msg)
            .map_err(|_| rcgen::Error::RemoteKeyError)
    }
    fn algorithm(&self) -> &'static SignatureAlgorithm {
        &PKCS_ECDSA_P256_SHA256
    }
}

pub(crate) fn create(
    role: Role,
    spki: &Spki,
    not_before: u64,
    not_after: u64,
    signer: Arc<dyn CertificateSigner>,
) -> Result<Vec<u8>> {
    if not_after <= not_before {
        return Err(PairingError::IdentityUnavailable);
    }
    let mut params = CertificateParams::default();
    params.not_before = x509_parser::time::ASN1Time::from_timestamp(
        i64::try_from(not_before).map_err(|_| PairingError::IdentityUnavailable)?,
    )
    .map_err(|_| PairingError::IdentityUnavailable)?
    .to_datetime();
    params.not_after = x509_parser::time::ASN1Time::from_timestamp(
        i64::try_from(not_after).map_err(|_| PairingError::IdentityUnavailable)?,
    )
    .map_err(|_| PairingError::IdentityUnavailable)?
    .to_datetime();
    let mut name = DistinguishedName::new();
    name.push(DnType::CommonName, "Kloda Pairing");
    params.distinguished_name = name;
    // rcgen 0.13.2 pads its named-bit KU to nine bits; emit canonical DER instead.
    let mut usage = CustomExtension::from_oid_content(&[2, 5, 29, 15], vec![3, 2, 7, 0x80]);
    usage.set_criticality(true);
    params.custom_extensions.push(usage);
    params.extended_key_usages = vec![match role {
        Role::Pc => ExtendedKeyUsagePurpose::ServerAuth,
        Role::Phone => ExtendedKeyUsagePurpose::ClientAuth,
    }];
    // IsCa::ExplicitNoCa emits an explicit DEFAULT FALSE. Canonical DER omits it.
    let mut basic = CustomExtension::from_oid_content(&[2, 5, 29, 19], vec![0x30, 0]);
    basic.set_criticality(true);
    params.custom_extensions.push(basic);
    let mut serial = [0; 16];
    SystemRandom::new()
        .fill(&mut serial)
        .map_err(|_| PairingError::IdentityUnavailable)?;
    serial[0] &= 0x7f;
    if serial.iter().all(|b| *b == 0) {
        serial[15] = 1;
    }
    params.serial_number = Some(serial.to_vec().into());
    let key = KeyPair::from_remote(Box::new(HardwareKey {
        spki: spki.clone(),
        signer,
    }))
    .map_err(|_| PairingError::IdentityUnavailable)?;
    let certificate = params
        .self_signed(&key)
        .map_err(|_| PairingError::IdentityUnavailable)?;
    let bytes = certificate.der().to_vec();
    let actual =
        validate(&bytes, role, not_before).map_err(|_| PairingError::IdentityUnavailable)?;
    if actual != *spki {
        return Err(PairingError::IdentityUnavailable);
    }
    Ok(bytes)
}
