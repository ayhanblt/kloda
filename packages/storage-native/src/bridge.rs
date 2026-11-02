//! Synchronous native-worker ABI. Never call on the UI thread or pass unadmitted JS input.
use crate::{
    NegotiatedSmb,
    paths::{metadata_name, relative_path},
    publication::{self, Ack, NativeReceipt, Publication, PublishError},
};
use serde::Deserialize;
use std::{
    ffi::c_void,
    fs::File,
    os::fd::FromRawFd,
    panic::{AssertUnwindSafe, catch_unwind},
    time::Duration,
};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Request {
    pub(crate) address: std::net::IpAddr,
    pub(crate) port: u16,
    pub(crate) share: String,
    pub(crate) username: String,
    pub(crate) password: String,
    pub(crate) domain: String,
    pub(crate) operation_id: String,
    pub(crate) final_path: String,
    pub(crate) size: String,
    pub(crate) sha256: [u8; 32],
    pub(crate) response_timeout_ms: u32,
}
impl Request {
    pub(crate) fn size(&self) -> Result<u64, PublishError> {
        if self.size.len() > 19
            || self.size.is_empty()
            || !self.size.bytes().all(|b| b.is_ascii_digit())
            || (self.size.starts_with('0') && self.size != "0")
        {
            return Err(PublishError::InvalidInput);
        }
        let size: i64 = self.size.parse().map_err(|_| PublishError::InvalidInput)?;
        if self.port == 0
            || self.share.contains('/')
            || !relative_path(&self.share)
            || !metadata_name(&self.username)
            || self.username.len() > 1024
            || self.domain.len() > 1024
            || self.password.len() > 4096
            || self.password.contains('\0')
            || self.domain.chars().any(char::is_control)
            || !(1..=30000).contains(&self.response_timeout_ms)
        {
            return Err(PublishError::InvalidInput);
        }
        Ok(size as u64)
    }
}

pub type ReceiptCallback = unsafe extern "C" fn(*mut c_void, i32, u64) -> i32;
pub(crate) struct Receipt {
    pub(crate) callback: ReceiptCallback,
    pub(crate) context: *mut c_void,
}
impl NativeReceipt for Receipt {
    fn admit(&mut self) -> Result<(), PublishError> {
        if unsafe { (self.callback)(self.context, 0, 0) } == 0 {
            Ok(())
        } else {
            Err(PublishError::Admission)
        }
    }
    fn record(&mut self, ack: Ack) -> Result<(), PublishError> {
        let (event, bytes) = match ack {
            Ack::Created => (1, 0),
            Ack::DataFlushed(bytes) => (2, bytes),
            Ack::Closed => (3, 0),
            Ack::Renamed => (4, 0),
            Ack::BytesVerified => (5, 0),
        };
        if unsafe { (self.callback)(self.context, event, bytes) } == 0 {
            Ok(())
        } else {
            Err(PublishError::Journal)
        }
    }
}

/// Publishes from a transferred snapshot FD on the calling native worker thread.
/// The callback must persist events 1..5 before returning and fence only event 0.
/// A zero result is verified wire evidence, never a native Completed authorization.
///
/// # Safety
/// `json` must point to `length` readable bytes for this call. `snapshot_fd` must be
/// a valid exclusively transferred FD (consumed on every return, including errors).
/// `context` must remain valid for synchronous callbacks, which must not unwind.
/// The native owner must validate LAN admission/target/source/credential generations
/// in event 0, and atomically recheck authority before committing its own Completed.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn kloda_smb_publish(
    json: *const u8,
    length: usize,
    snapshot_fd: i32,
    callback: Option<ReceiptCallback>,
    context: *mut c_void,
) -> i32 {
    unsafe { publish_with_socket(json, length, snapshot_fd, callback, context, None) }
}

pub(crate) unsafe fn publish_with_socket(
    json: *const u8,
    length: usize,
    snapshot_fd: i32,
    callback: Option<ReceiptCallback>,
    context: *mut c_void,
    socket: Option<std::net::TcpStream>,
) -> i32 {
    if snapshot_fd < 0 {
        return 1;
    }
    let mut snapshot = unsafe { File::from_raw_fd(snapshot_fd) };
    let result = catch_unwind(AssertUnwindSafe(|| -> Result<(), PublishError> {
        if json.is_null() || length == 0 || length > 16384 {
            return Err(PublishError::InvalidInput);
        }
        let request: Request =
            serde_json::from_slice(unsafe { std::slice::from_raw_parts(json, length) })
                .map_err(|_| PublishError::InvalidInput)?;
        let size = request.size()?;
        let job = Publication {
            operation_id: &request.operation_id,
            final_path: &request.final_path,
            size,
            sha256: request.sha256,
        };
        job.staged_path()?;
        let callback = callback.ok_or(PublishError::InvalidInput)?;
        let mut receipt = Receipt { callback, context };
        receipt.admit()?;
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()?;
        runtime.block_on(async {
            let address = (request.address, request.port).into();
            let remaining = Duration::from_millis(request.response_timeout_ms.into());
            let pending = if let Some(socket) = socket {
                socket.set_nonblocking(true)?;
                let stream = tokio::net::TcpStream::from_std(socket)?;
                NegotiatedSmb::from_stream(stream, address, remaining).await?
            } else {
                NegotiatedSmb::connect(address, remaining).await?
            };
            receipt.admit()?;
            let mut conn = pending
                .authenticate(&request.username, &request.password, &request.domain)
                .await?;
            receipt.admit()?;
            let tree =
                std::sync::Arc::new(smb2::client::Tree::connect(&mut conn, &request.share).await?);
            let job = Publication {
                operation_id: &request.operation_id,
                final_path: &request.final_path,
                size,
                sha256: request.sha256,
            };
            publication::publish(&mut conn, tree, &mut snapshot, &job, &mut receipt).await
        })
    }));
    result_code(result)
}

pub(crate) fn result_code(result: std::thread::Result<Result<(), PublishError>>) -> i32 {
    match result {
        Ok(Ok(())) => 0,
        Ok(Err(PublishError::InvalidInput)) => 1,
        Ok(Err(PublishError::Local(_))) => 2,
        Ok(Err(PublishError::Wire(_))) => 3,
        Ok(Err(PublishError::Admission)) => 4,
        Ok(Err(PublishError::Journal)) => 5,
        Ok(Err(PublishError::SnapshotChanged)) => 6,
        Ok(Err(PublishError::VerificationFailed)) => 7,
        Err(_) => 8,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{os::fd::IntoRawFd, ptr};
    unsafe extern "C" fn refuse(_: *mut c_void, _: i32, _: u64) -> i32 {
        1
    }
    fn request() -> serde_json::Value {
        serde_json::json!({"address":"127.0.0.1","port":27445,"share":"owned","username":"owned",
            "password":"owned-disposable-fixture","domain":"","operationId":"01234567-89ab-cdef-0123-456789abcdef",
            "finalPath":"owned.bin","size":"0","sha256":vec![0u8; 32],"responseTimeoutMs":1000})
    }
    #[test]
    fn rejects_duplicate_fields_and_noncanonical_sizes_before_connect() {
        let mut json = request();
        for size in ["00", "-1", "9223372036854775808"] {
            json["size"] = size.into();
            let value: Request = serde_json::from_value(json.clone()).unwrap();
            assert!(value.size().is_err());
        }
        assert!(
            serde_json::from_str::<Request>(
                "{\"address\":\"127.0.0.1\",\"address\":\"127.0.0.1\"}"
            )
            .is_err()
        );
    }
    #[test]
    fn cancellation_before_socket_and_null_callback_fail_closed() {
        let bytes = serde_json::to_vec(&request()).unwrap();
        let descriptor = File::open("/dev/null").unwrap().into_raw_fd();
        assert_eq!(
            unsafe {
                kloda_smb_publish(
                    bytes.as_ptr(),
                    bytes.len(),
                    descriptor,
                    Some(refuse),
                    ptr::null_mut(),
                )
            },
            4
        );
        let descriptor = File::open("/dev/null").unwrap().into_raw_fd();
        assert_eq!(
            unsafe {
                kloda_smb_publish(
                    bytes.as_ptr(),
                    bytes.len(),
                    descriptor,
                    None,
                    ptr::null_mut(),
                )
            },
            1
        );
    }
}
