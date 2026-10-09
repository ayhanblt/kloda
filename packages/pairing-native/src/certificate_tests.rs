use super::*;
use rcgen::{
    CertificateParams, CustomExtension, ExtendedKeyUsagePurpose, KeyPair, KeyUsagePurpose,
};
use ring::{
    rand::SystemRandom,
    signature::{self, KeyPair as _},
};
use std::sync::Arc;

// Software keys exist only inside this cfg(test) module, never production identity custody.
struct TestHardware {
    key: signature::EcdsaKeyPair,
}
impl CertificateSigner for TestHardware {
    fn sign_certificate_tbs(&self, tbs: &[u8]) -> Result<Vec<u8>> {
        self.key
            .sign(&SystemRandom::new(), tbs)
            .map(|signature| signature.as_ref().to_vec())
            .map_err(|_| PairingError::IdentityUnavailable)
    }
}
fn hardware() -> (Spki, Arc<TestHardware>) {
    let random = SystemRandom::new();
    let document = signature::EcdsaKeyPair::generate_pkcs8(
        &signature::ECDSA_P256_SHA256_ASN1_SIGNING,
        &random,
    )
    .unwrap();
    let key = signature::EcdsaKeyPair::from_pkcs8(
        &signature::ECDSA_P256_SHA256_ASN1_SIGNING,
        document.as_ref(),
        &random,
    )
    .unwrap();
    let mut encoded = vec![
        0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08,
        0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0,
    ];
    encoded.extend_from_slice(key.public_key().as_ref());
    (
        Spki::parse(&encoded).unwrap(),
        Arc::new(TestHardware { key }),
    )
}
#[test]
fn callback_issuance_time_role_self_signature_and_same_key_renewal() {
    let (spki, signer) = hardware();
    let before = 1767225600;
    let after = before + 86400;
    let pc = create(Role::Pc, &spki, before, after, signer.clone()).unwrap();
    let phone = create(Role::Phone, &spki, before, after, signer.clone()).unwrap();
    assert!(validate(&pc, Role::Pc, before).unwrap() == spki);
    assert!(validate(&pc, Role::Pc, after).is_ok());
    assert!(validate(&pc, Role::Pc, before - 1).is_err());
    assert!(validate(&pc, Role::Pc, after + 1).is_err());
    assert!(validate(&pc, Role::Phone, before).is_err());
    assert!(validate(&phone, Role::Phone, before).unwrap() == spki);
    let renewed = create(Role::Pc, &spki, after, after + 86400, signer).unwrap();
    assert_eq!(
        validate(&renewed, Role::Pc, after).unwrap().fingerprint(),
        spki.fingerprint()
    );
    let mut corrupt = pc.clone();
    *corrupt.last_mut().unwrap() ^= 1;
    assert!(validate(&corrupt, Role::Pc, before).is_err());
    let mut trailing = pc;
    trailing.push(0);
    assert!(validate(&trailing, Role::Pc, before).is_err());
    assert!(validate(&vec![0; 4097], Role::Pc, before).is_err());
}
fn base() -> CertificateParams {
    let mut p = CertificateParams::default();
    p.not_before = rcgen::date_time_ymd(2026, 1, 1);
    p.not_after = rcgen::date_time_ymd(2026, 1, 2);
    let mut usage = CustomExtension::from_oid_content(&[2, 5, 29, 15], vec![3, 2, 7, 0x80]);
    usage.set_criticality(true);
    p.custom_extensions.push(usage);
    p.extended_key_usages = vec![ExtendedKeyUsagePurpose::ServerAuth];
    let mut basic = CustomExtension::from_oid_content(&[2, 5, 29, 19], vec![0x30, 0]);
    basic.set_criticality(true);
    p.custom_extensions.push(basic);
    p
}
#[test]
fn hostile_correctly_signed_profiles_are_not_accepted() {
    let key = KeyPair::generate().unwrap();
    let now = 1767225600;
    let mut variants = Vec::new();
    let mut p = base();
    p.custom_extensions.clear();
    variants.push(p);
    let mut p = base();
    p.custom_extensions[1].set_criticality(false);
    variants.push(p);
    let mut p = base();
    p.key_usages.push(KeyUsagePurpose::KeyCertSign);
    variants.push(p);
    let mut p = base();
    p.custom_extensions.remove(0);
    variants.push(p);
    let mut p = base();
    p.extended_key_usages.clear();
    variants.push(p);
    let mut p = base();
    p.extended_key_usages = vec![ExtendedKeyUsagePurpose::ClientAuth];
    variants.push(p);
    let mut p = base();
    p.custom_extensions.push(p.custom_extensions[0].clone());
    variants.push(p);
    let mut p = base();
    let mut unknown = CustomExtension::from_oid_content(&[1, 2, 3, 4], vec![5, 0]);
    unknown.set_criticality(true);
    p.custom_extensions.push(unknown);
    variants.push(p);
    let mut p = base();
    p.not_after = rcgen::date_time_ymd(2025, 1, 1);
    variants.push(p);
    let mut p = base();
    p.is_ca = rcgen::IsCa::Ca(rcgen::BasicConstraints::Unconstrained);
    p.custom_extensions.clear();
    variants.push(p);
    for p in variants {
        let cert = p.self_signed(&key).unwrap();
        assert!(validate(cert.der().as_ref(), Role::Pc, now).is_err());
    }
    let mut both = base();
    both.extended_key_usages
        .push(ExtendedKeyUsagePurpose::ClientAuth);
    let cert = both.self_signed(&key).unwrap();
    assert!(validate(cert.der().as_ref(), Role::Pc, now).is_ok());
    assert!(validate(cert.der().as_ref(), Role::Phone, now).is_ok());
}
