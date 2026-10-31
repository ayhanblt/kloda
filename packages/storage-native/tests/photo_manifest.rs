use kloda_storage_native::photo_manifest::{Favorite, SmbPhotoManifest};
use serde_json::{Value, json};
const GOLDEN: &[u8] = include_bytes!("../fixtures/smb-photo-v1.json");
fn decode(value: &Value) -> bool {
    SmbPhotoManifest::decode(&serde_json::to_vec(value).unwrap()).is_ok()
}
#[test]
fn exact_metadata_and_int64_strings_roundtrip_without_path_name_mapping() {
    let value = SmbPhotoManifest::decode(GOLDEN).unwrap();
    assert_eq!(value.revision, "9007199254740993");
    assert_eq!(value.resources[0].name, "source:photo?.png");
    assert_eq!(value.favorite, Favorite::Known(true));
    assert_eq!(
        SmbPhotoManifest::decode(&value.encode().unwrap()).unwrap(),
        value
    );
    let mut unknown: Value = serde_json::from_slice(GOLDEN).unwrap();
    unknown["favorite"] = Value::Null;
    assert_eq!(
        SmbPhotoManifest::decode(&serde_json::to_vec(&unknown).unwrap())
            .unwrap()
            .favorite,
        Favorite::Unknown(())
    );
    unknown.as_object_mut().unwrap().remove("favorite");
    assert!(!decode(&unknown));
}
#[test]
fn rejects_other_protocols_fake_receipts_unknown_and_duplicate_keys() {
    let valid: Value = serde_json::from_slice(GOLDEN).unwrap();
    for format in ["kloda-webdav-photo", "kloda-photo"] {
        let mut value = valid.clone();
        value["format"] = json!(format);
        assert!(!decode(&value));
    }
    let mut value = valid.clone();
    value["resources"][0]["operationId"] = json!("fake-pc-id");
    assert!(!decode(&value));
    let mut value = valid.clone();
    value["state"] = json!("completed");
    assert!(!decode(&value));
    let text = String::from_utf8(valid.to_string().into_bytes()).unwrap();
    let text = text.replacen("\"version\":1", "\"version\":1,\"version\":1", 1);
    assert!(SmbPhotoManifest::decode(text.as_bytes()).is_err());
}
#[test]
fn rejects_alias_traversal_noncanonical_numbers_and_hashes() {
    let valid: Value = serde_json::from_slice(GOLDEN).unwrap();
    for path in [
        "../escape.png",
        "12345678-1234-1234-1234-123456789abc/../escape",
        "12345678-1234-1234-1234-123456789abc/a?b.png",
    ] {
        let mut value = valid.clone();
        value["resources"][0]["relativePath"] = json!(path);
        assert!(!decode(&value));
    }
    let mut value = valid.clone();
    let mut alias = value["resources"][0].clone();
    alias["relativePath"] = json!("12345678-1234-1234-1234-123456789abc/ORIGINAL.png");
    alias["role"] = json!("resource-2");
    value["resources"].as_array_mut().unwrap().push(alias);
    assert!(!decode(&value));
    for n in ["01", "-1", "9223372036854775808", "+1"] {
        let mut value = valid.clone();
        value["revision"] = json!(n);
        assert!(!decode(&value));
    }
    let mut value = valid.clone();
    value["resources"][0]["size"] = json!(68);
    assert!(!decode(&value));
    let mut value = valid;
    value["resources"][0]["sha256"] = json!("A".repeat(42) + "B");
    assert!(!decode(&value));
    assert!(SmbPhotoManifest::decode(&vec![b' '; 65537]).is_err());
}
