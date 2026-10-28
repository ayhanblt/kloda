use super::*;
use std::ffi::CStr;

fn json_reply(reply: *mut c_char) -> serde_json::Value {
    assert!(!reply.is_null());
    let result = unsafe { CStr::from_ptr(reply) }.to_str().unwrap();
    let decoded = serde_json::from_str(result).unwrap();
    unsafe {
        kloda_ios_reply_free(reply);
    }
    decoded
}
fn request(bytes: &[u8]) -> serde_json::Value {
    json_reply(unsafe { kloda_ios_request(u64::MAX, bytes.as_ptr(), bytes.len(), 0) })
}
#[test]
fn ios_abi_rejects_null_oversize_non_utf8_and_trailing_json_without_owner_access() {
    let oversized = vec![b'x'; INPUT_LIMIT + 1];
    for (pointer, length) in [(std::ptr::null(), 1), (oversized.as_ptr(), oversized.len())] {
        let reply = json_reply(unsafe { kloda_ios_request(1, pointer, length, 0) });
        assert_eq!(reply["errorCode"], "invalid_request");
    }
    for bytes in [&[255][..], b"", b"{\"kind\":\"status\"} true"] {
        assert_eq!(request(bytes)["errorCode"], "invalid_request");
    }
}
#[test]
fn ios_abi_has_no_pc_authority_key_signing_or_context_override_commands() {
    for kind in [
        "createInvitation",
        "approveBackup",
        "revokeBackup",
        "removeDevice",
        "sign",
        "openPc",
        "suspend",
        "setForeground",
    ] {
        assert_eq!(
            request(format!(r#"{{"kind":"{kind}"}}"#).as_bytes())["errorCode"],
            "invalid_request"
        );
    }
    assert_eq!(
        request(br#"{"kind":"status","trusted":true}"#)["errorCode"],
        "invalid_request"
    );
}
#[test]
fn ios_abi_stale_or_closed_id_is_not_an_authority_and_free_null_is_safe() {
    assert_eq!(
        request(br#"{"kind":"status"}"#)["errorCode"],
        "candidate_stale"
    );
    assert_eq!(
        request(br#"{"kind":"close"}"#)["errorCode"],
        "candidate_stale"
    );
    unsafe {
        kloda_ios_reply_free(std::ptr::null_mut());
    }
}
#[test]
fn ios_command_ids_and_generation_are_canonical_and_secrets_bounded() {
    for value in [
        r#"{"kind":"resume","record":"wrong"}"#,
        r#"{"kind":"approve","operation":"AAAAAAAAAAAAAAAAAAAAAA","generation":"01"}"#,
        r#"{"kind":"scan","wire":"é"}"#,
    ] {
        let command: command::PhoneCommand = serde_json::from_str(value).unwrap();
        assert!(command.action().is_err());
    }
    let command: command::PhoneCommand =
        serde_json::from_value(serde_json::json!({"kind":"scan","wire":"A".repeat(513)})).unwrap();
    assert!(command.action().is_err());
    let command: command::PhoneCommand =
        serde_json::from_str(r#"{"kind":"resume","record":"AAAAAAAAAAAAAAAAAAAAAA"}"#).unwrap();
    assert!(matches!(
        command.action().unwrap(),
        crate::handle::Action::Resume { .. }
    ));
}
#[test]
fn ios_abi_open_never_opens_a_real_host_authority() {
    assert_eq!(
        json_reply(unsafe { kloda_ios_open(b"relative".as_ptr(), 8) })["errorCode"],
        "invalid_request"
    );
    let path = b"/never-created-ios-abi-test";
    assert_eq!(
        json_reply(unsafe { kloda_ios_open(path.as_ptr(), path.len()) })["errorCode"],
        "native_unsupported"
    );
}
#[test]
fn ios_abi_panics_are_sanitized_instead_of_crossing_c() {
    let reply = response(|| -> Result<serde_json::Value> { panic!("synthetic test panic") });
    assert_eq!(json_reply(reply)["errorCode"], "outcome_unknown");
}

#[test]
fn ios_transfer_and_lifecycle_entry_reject_unknown_owner_before_descriptor_use() {
    let record = b"AAAAAAAAAAAAAAAAAAAAAA";
    let command = br#"{"kind":"status","id":"AAAAAAAAAAAAAAAAAAAAAA"}"#;
    assert_eq!(
        json_reply(kloda_ios_suspend(u64::MAX))["errorCode"],
        "candidate_stale"
    );
    let reply = unsafe {
        kloda_ios_transfer(
            u64::MAX,
            record.as_ptr(),
            record.len(),
            command.as_ptr(),
            command.len(),
            i32::MAX,
            0,
        )
    };
    assert_eq!(json_reply(reply)["errorCode"], "candidate_stale");
}

#[test]
fn ios_foreground_entry_rejects_non_boolean_bytes_and_stale_owner() {
    for active in [2, 127, 255] {
        assert_eq!(
            json_reply(kloda_ios_set_foreground(u64::MAX, active))["errorCode"],
            "invalid_request"
        );
    }
    for active in [0, 1] {
        assert_eq!(
            json_reply(kloda_ios_set_foreground(u64::MAX, active))["errorCode"],
            "candidate_stale"
        );
    }
}

#[test]
fn ios_background_abi_bounds_and_unknown_owner_never_authorize_files_or_ui() {
    let record = b"AAAAAAAAAAAAAAAAAAAAAA";
    let command = br#"{"kind":"status","id":"AAAAAAAAAAAAAAAAAAAAAA"}"#;
    for reply in [
        unsafe { kloda_ios_background_begin(u64::MAX, record.as_ptr(), record.len()) },
        unsafe { kloda_ios_background_end(u64::MAX, record.as_ptr(), record.len()) },
        unsafe {
            kloda_ios_background_transfer(
                u64::MAX,
                record.as_ptr(),
                record.len(),
                command.as_ptr(),
                command.len(),
                i32::MAX,
                record.as_ptr(),
                record.len(),
            )
        },
    ] {
        assert_eq!(json_reply(reply)["errorCode"], "candidate_stale");
    }
    assert_eq!(
        json_reply(unsafe { kloda_ios_background_begin(1, std::ptr::null(), 22) })["errorCode"],
        "invalid_request"
    );
    assert_eq!(
        json_reply(unsafe {
            kloda_ios_background_transfer(
                1,
                record.as_ptr(),
                record.len(),
                command.as_ptr(),
                command.len(),
                i32::MAX,
                record.as_ptr(),
                23,
            )
        })["errorCode"],
        "invalid_request"
    );
    assert_eq!(
        request(br#"{"kind":"backgroundBegin"}"#)["errorCode"],
        "invalid_request"
    );
}
