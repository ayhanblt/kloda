use super::*;
fn bytes<const N: usize>(text: &str) -> [u8; N] {
    assert_eq!(text.len(), N * 2);
    let mut out = [0; N];
    for (i, byte) in out.iter_mut().enumerate() {
        *byte = u8::from_str_radix(&text[i * 2..i * 2 + 2], 16).unwrap();
    }
    out
}
#[test]
fn frozen_transcript_and_tag_with_live_binding_negatives() {
    let v: serde_json::Value = serde_json::from_str(include_str!(
        "../../../docs/security/qr-pairing-v1-protocol-vectors.json"
    ))
    .unwrap();
    let sid = bytes(v["sid_hex"].as_str().unwrap());
    let secret = bytes(v["secret_hex"].as_str().unwrap());
    let pc = bytes(v["pc_sha256_hex"].as_str().unwrap());
    let phone = bytes(v["phone_sha256_hex"].as_str().unwrap());
    let cb = bytes(v["synthetic_cb_hex"].as_str().unwrap());
    let expected = bytes::<32>(v["hmac_sha256_hex"].as_str().unwrap());
    assert_eq!(
        context(&sid, &pc, &phone),
        bytes::<98>(v["context_hex"].as_str().unwrap())
    );
    assert_eq!(
        transcript(&sid, &pc, &phone, &cb),
        bytes::<138>(v["proof_input_hex"].as_str().unwrap())
    );
    assert_eq!(tag(&secret, &sid, &pc, &phone, &cb), expected);
    assert!(verify(&secret, &sid, &pc, &phone, &cb, &expected).is_ok());
    let mut other_cb = cb;
    other_cb[0] ^= 1;
    let mut other_sid = sid;
    other_sid[0] ^= 1;
    assert!(verify(&secret, &sid, &pc, &phone, &other_cb, &expected).is_err());
    assert!(verify(&secret, &other_sid, &pc, &phone, &cb, &expected).is_err());
    assert!(verify(&secret, &sid, &phone, &pc, &cb, &expected).is_err());
    assert!(verify(&secret, &sid, &pc, &phone, &cb, &expected[..31]).is_err());
    for index in 0..32 {
        let mut wrong = expected;
        wrong[index] ^= 1;
        assert!(verify(&secret, &sid, &pc, &phone, &cb, &wrong).is_err());
    }
}
