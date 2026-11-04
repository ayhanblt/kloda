use crate::{Credentials, Operation, Provider, Reply, Target};
use serde::Deserialize;
use serde_json::json;
use zeroize::Zeroize;
const MAX_INPUT: usize = 1024 * 1024;
const MAX_OUTPUT: usize = 4 * 1024 * 1024;
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Sign {
    provider: String,
    endpoint: String,
    region: String,
    bucket: String,
    prefix: String,
    path_style: bool,
    access_key: String,
    secret: String,
    token: Option<String>,
    key: String,
    operation: Action,
}
impl Drop for Sign {
    fn drop(&mut self) {
        self.secret.zeroize();
        if let Some(token) = self.token.as_mut() {
            token.zeroize();
        }
    }
}
#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
enum Action {
    Create { job: String },
    Part { upload: String, number: u16 },
    Complete { upload: String, etags: Vec<String> },
    Abort { upload: String },
    Parts { upload: String, marker: u16 },
    Get { version: Option<String> },
    Head,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Ack {
    status: u16,
    body: String,
    bucket: String,
    key: String,
}
fn process(kind: u32, input: &[u8]) -> Result<Vec<u8>, ()> {
    let value = match kind {
        0 => {
            let request: Sign = serde_json::from_slice(input).map_err(|_| ())?;
            let provider = match request.provider.as_str() {
                "s3-compatible" => Provider::Compatible,
                "amazon-s3" => Provider::Amazon,
                _ => return Err(()),
            };
            let target = Target::new(
                provider,
                &request.endpoint,
                &request.region,
                &request.bucket,
                &request.prefix,
                request.path_style,
            )
            .map_err(|_| ())?;
            let c = match request.token.as_ref() {
                Some(t) => Credentials::new_with_token(&request.access_key, &request.secret, t),
                None => Credentials::new(&request.access_key, &request.secret),
            };
            let op = match &request.operation {
                Action::Create { job } => Operation::Create { job },
                Action::Part { upload, number } => Operation::Part {
                    upload,
                    number: *number,
                },
                Action::Complete { upload, etags } => Operation::Complete { upload, etags },
                Action::Abort { upload } => Operation::Abort { upload },
                Action::Parts { upload, marker } => Operation::Parts {
                    upload,
                    marker: *marker,
                },
                Action::Get { version } => Operation::Get {
                    version: version.as_deref(),
                },
                Action::Head => Operation::Head,
            };
            let p = crate::prepare(&target, &c, &request.key, op).map_err(|_| ())?;
            json!({"method":p.method,"url":p.url().as_str(),"headers":p.headers,"body":String::from_utf8(p.body.clone()).map_err(|_|())?})
        }
        1 | 2 => {
            let r: Ack = serde_json::from_slice(input).map_err(|_| ())?;
            let reply = if kind == 1 {
                crate::creation(r.status, r.body.as_bytes(), &r.bucket, &r.key)
            } else {
                crate::completion(r.status, r.body.as_bytes(), &r.bucket, &r.key)
            };
            match reply {
                Reply::Created { upload } => json!({"kind":"created","upload":upload}),
                Reply::CompletionAck { etag } => json!({"kind":"completion_ack","etag":etag}),
                Reply::Conflict => json!({"kind":"conflict"}),
                Reply::Reinitialize => json!({"kind":"reinitialize"}),
                Reply::Rejected => json!({"kind":"rejected"}),
                Reply::Review => json!({"kind":"review"}),
            }
        }
        _ => return Err(()),
    };
    let bytes = serde_json::to_vec(&value).map_err(|_| ())?;
    if bytes.len() > MAX_OUTPUT {
        return Err(());
    };
    Ok(bytes)
}
/// Native caller owns all buffers; no pointer/authority is retained. No network operation.
/// # Safety
/// Input/output/written must point to valid nonoverlapping allocations of the stated lengths.
/// Native caller must erase credential input and signed output after use; never log either.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn kloda_s3_json_v1(
    kind: u32,
    input: *const u8,
    length: usize,
    output: *mut u8,
    capacity: usize,
    written: *mut usize,
) -> i32 {
    if written.is_null() {
        return 1;
    };
    unsafe { *written = 0 };
    if input.is_null()
        || length == 0
        || length > MAX_INPUT
        || capacity > MAX_OUTPUT
        || (capacity > 0 && output.is_null())
    {
        return 1;
    }
    let result = std::panic::catch_unwind(|| -> Result<i32, ()> {
        let bytes = unsafe { std::slice::from_raw_parts(input, length) };
        let mut result = process(kind, bytes)?;
        unsafe { *written = result.len() };
        if capacity < result.len() {
            result.zeroize();
            return Ok(2);
        };
        unsafe { std::ptr::copy_nonoverlapping(result.as_ptr(), output, result.len()) };
        result.zeroize();
        Ok(0)
    });
    match result {
        Ok(Ok(code)) => code,
        _ => 1,
    }
}
#[cfg(feature = "android-jni")]
#[unsafe(no_mangle)]
pub extern "system" fn Java_com_kloda_sync_S3NativeEngine_process(
    env: jni::JNIEnv<'_>,
    _class: jni::objects::JClass<'_>,
    kind: jni::sys::jint,
    input: jni::objects::JByteArray<'_>,
) -> jni::sys::jbyteArray {
    let Ok(length) = env.get_array_length(&input) else {
        return std::ptr::null_mut();
    };
    if length <= 0 || length as usize > MAX_INPUT {
        return std::ptr::null_mut();
    }
    let Ok(mut bytes) = env.convert_byte_array(&input) else {
        return std::ptr::null_mut();
    };
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        process(kind as u32, &bytes)
    }));
    bytes.zeroize();
    let Ok(Ok(mut output)) = result else {
        return std::ptr::null_mut();
    };
    let result = env
        .byte_array_from_slice(&output)
        .map(|array| array.into_raw())
        .unwrap_or(std::ptr::null_mut());
    output.zeroize();
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn sign_request_is_native_only_bounded_and_strict() {
        let request=br#"{"provider":"s3-compatible","endpoint":"https://127.0.0.1:9443","region":"us-east-1","bucket":"owned-bucket","prefix":"owned","path_style":true,"access_key":"synthetic","secret":"synthetic-secret","token":null,"key":"x","operation":{"kind":"create","job":"0123456789abcdef0123456789abcdef"}}"#;
        let out = process(0, request).unwrap();
        let value: serde_json::Value = serde_json::from_slice(&out).unwrap();
        assert_eq!(value["method"], "POST");
        assert!(!String::from_utf8(out).unwrap().contains("synthetic-secret"));
        let mut written = 0;
        let mut sentinel = [42u8; 2];
        unsafe {
            assert_eq!(
                kloda_s3_json_v1(
                    0,
                    request.as_ptr(),
                    request.len(),
                    sentinel.as_mut_ptr(),
                    2,
                    &mut written
                ),
                2
            );
        }
        assert_eq!(sentinel, [42, 42]);
        assert!(written > 2);
        let bad = String::from_utf8(request.to_vec())
            .unwrap()
            .replace("s3-compatible", "untrusted");
        assert!(process(0, bad.as_bytes()).is_err());
    }
    #[test]
    fn bounds_and_unknown_kind_fail_closed() {
        unsafe {
            let mut written = 99;
            assert_eq!(
                kloda_s3_json_v1(
                    0,
                    std::ptr::null(),
                    0,
                    std::ptr::null_mut(),
                    0,
                    &mut written
                ),
                1
            );
            assert_eq!(written, 0);
            assert_eq!(
                kloda_s3_json_v1(99, b"{}".as_ptr(), 2, std::ptr::null_mut(), 0, &mut written),
                1
            );
        }
    }
    #[test]
    fn ack_two_pass_buffer_and_no_completion_elevation() {
        unsafe {
            let input = br#"{"status":0,"body":"","bucket":"owned-bucket","key":"owned/x"}"#;
            let mut size = 0;
            assert_eq!(
                kloda_s3_json_v1(
                    2,
                    input.as_ptr(),
                    input.len(),
                    std::ptr::null_mut(),
                    0,
                    &mut size
                ),
                2
            );
            let mut out = vec![0; size];
            let capacity = out.len();
            assert_eq!(
                kloda_s3_json_v1(
                    2,
                    input.as_ptr(),
                    input.len(),
                    out.as_mut_ptr(),
                    capacity,
                    &mut size
                ),
                0
            );
            assert_eq!(std::str::from_utf8(&out).unwrap(), "{\"kind\":\"review\"}");
            let bad = br#"{"status":0,"body":"","bucket":"x","key":"y","extra":1}"#;
            assert_eq!(
                kloda_s3_json_v1(
                    2,
                    bad.as_ptr(),
                    bad.len(),
                    out.as_mut_ptr(),
                    capacity,
                    &mut size
                ),
                1
            );
        }
    }
}
