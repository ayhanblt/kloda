use super::*;
fn vectors() -> serde_json::Value {
    serde_json::from_str(include_str!(
        "../../../docs/security/qr-pairing-v1-protocol-vectors.json"
    ))
    .unwrap()
}
#[test]
fn frozen_parser_fixtures() {
    let fixture = vectors();
    for item in fixture["parser_fixtures"].as_array().unwrap() {
        let result = parse(item["wire"].as_str().unwrap());
        let expected = item["expected"].as_str().unwrap();
        if expected == "accept_syntax_only" {
            assert!(result.is_ok(), "{}", item["id"]);
        } else {
            assert!(result.is_err(), "{}", item["id"]);
        }
    }
}

#[test]
fn exact_native_version_diagnostics_follow_normative_token_rules() {
    let fixture = vectors();
    let json = fixture["qr_json"].as_str().unwrap();
    for token in ["1.0", "1e0", "\"1\"", "true", "false", "null", "-1", "01"] {
        let changed = json.replacen("\"v\":1", &format!("\"v\":{token}"), 1);
        let wire = format!(
            "KLODA-PAIR:{}",
            crate::qr_base64::encode(changed.as_bytes())
        );
        assert!(
            matches!(parse(&wire), Err(PairingError::InvalidQr)),
            "{token}"
        );
    }
    for token in ["0", "2", "99999999999999999999999999999999"] {
        let changed = json.replacen("\"v\":1", &format!("\"v\":{token}"), 1);
        let wire = format!(
            "KLODA-PAIR:{}",
            crate::qr_base64::encode(changed.as_bytes())
        );
        assert!(
            matches!(parse(&wire), Err(PairingError::UnsupportedVersion)),
            "{token}"
        );
    }
}
#[test]
fn producer_matches_exact_frozen_wire() {
    let fixture = vectors();
    let wire = fixture["qr_wire"].as_str().unwrap();
    let payload = parse(wire).unwrap();
    assert_eq!(encode(&payload).unwrap(), wire);
}
#[test]
fn expanded_ipv6_normalizes_and_all_producer_outputs_parse() {
    let wire = vectors()["qr_wire"].as_str().unwrap().to_owned();
    let mut payload = parse(&wire).unwrap();
    payload.hint.ip = crate::qr_ip::parse("FD00:0000:0000:0000:0000:0000:0000:0001").unwrap();
    let normalized = encode(&payload).unwrap();
    assert!(parse(&normalized).unwrap().hint == payload.hint);
    for ip in [
        "10.0.0.1",
        "172.16.0.1",
        "169.254.1.2",
        "2001:db8::1",
        "fc00::1",
    ] {
        payload.hint.ip = crate::qr_ip::parse(ip).unwrap();
        assert!(parse(&encode(&payload).unwrap()).unwrap().hint == payload.hint);
    }
    for ip in [
        "172.15.0.1",
        "192.168.01.1",
        "127.0.0.1",
        "fe80::1",
        "::ffff:10.0.0.1",
        "fc00::1%en0",
    ] {
        assert!(crate::qr_ip::parse(ip).is_err());
    }
}
