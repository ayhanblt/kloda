use super::*;
fn hex(text: &str) -> Vec<u8> {
    (0..text.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&text[i..i + 2], 16).unwrap())
        .collect()
}
#[test]
fn frozen_keys_fingerprints_and_point_profile_negatives() {
    let v: serde_json::Value = serde_json::from_str(include_str!(
        "../../../docs/security/qr-pairing-v1-protocol-vectors.json"
    ))
    .unwrap();
    for role in ["pc", "phone"] {
        let encoded = hex(v[format!("{role}_spki_hex")].as_str().unwrap());
        let key = Spki::parse(&encoded).unwrap();
        assert_eq!(
            key.fingerprint().as_slice(),
            hex(v[format!("{role}_sha256_hex")].as_str().unwrap())
        );
        let mut changed = encoded.clone();
        changed[26] = 2;
        assert!(Spki::parse(&changed).is_err());
        let mut changed = encoded.clone();
        changed[27..59].copy_from_slice(&FIELD);
        assert!(Spki::parse(&changed).is_err());
        let mut changed = encoded.clone();
        changed[59..91].copy_from_slice(&FIELD);
        assert!(Spki::parse(&changed).is_err());
        let mut changed = encoded.clone();
        changed[27..].fill(0);
        assert!(Spki::parse(&changed).is_err());
        let mut changed = encoded.clone();
        changed[90] ^= 1;
        assert!(Spki::parse(&changed).is_err());
        let mut changed = encoded.clone();
        changed[22] ^= 1;
        assert!(Spki::parse(&changed).is_err());
        assert!(Spki::parse(&encoded[..90]).is_err());
    }
}
