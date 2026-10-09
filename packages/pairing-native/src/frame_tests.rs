use super::*;
fn decode_hex(text: &str) -> Vec<u8> {
    (0..text.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&text[i..i + 2], 16).unwrap())
        .collect()
}
#[test]
fn frozen_frames_all_fragment_boundaries_and_coalescing() {
    let v: serde_json::Value = serde_json::from_str(include_str!(
        "../../../docs/security/qr-pairing-v1-protocol-vectors.json"
    ))
    .unwrap();
    let mut coalesced = Vec::new();
    for (_, text) in v["frames_hex"].as_object().unwrap() {
        let encoded = decode_hex(text.as_str().unwrap());
        coalesced.extend_from_slice(&encoded);
        for split in 0..encoded.len() {
            let mut decoder = FrameDecoder::new();
            let (n, frame) = decoder.feed(&encoded[..split]).unwrap();
            assert_eq!(n, split);
            assert!(frame.is_none());
            if split > 0 {
                assert!(decoder.finish().is_err());
            }
            let (n, frame) = decoder.feed(&encoded[split..]).unwrap();
            assert_eq!(n, encoded.len() - split);
            let mut out = [0; 52];
            let len = frame.unwrap().encode(&mut out);
            assert_eq!(&out[..len], &encoded);
            assert!(decoder.finish().is_ok());
        }
    }
    let mut decoder = FrameDecoder::new();
    let mut cursor = 0;
    let mut count = 0;
    while cursor < coalesced.len() {
        let (consumed, frame) = decoder.feed(&coalesced[cursor..]).unwrap();
        assert!(consumed > 0);
        cursor += consumed;
        assert!(frame.is_some());
        count += 1;
    }
    assert_eq!(count, 5);
}
#[test]
fn invalid_length_poisoning_wrong_types_and_partial_eof() {
    for length in [0u16, 17, 19, 49, 51, 65535] {
        let mut decoder = FrameDecoder::new();
        assert!(decoder.feed(&length.to_be_bytes()).is_err());
        assert!(decoder.feed(&[0; 52]).is_err());
    }
    for (length, version, kind) in [(18, 0, 2), (18, 1, 1), (50, 1, 2), (18, 1, 6)] {
        let mut body = [0; 50];
        body[0] = version;
        body[1] = kind;
        assert!(Frame::parse_body(&body[..length]).is_err());
    }
    let mut decoder = FrameDecoder::new();
    assert!(decoder.feed(&[0]).unwrap().1.is_none());
    assert!(decoder.finish().is_err());
}
