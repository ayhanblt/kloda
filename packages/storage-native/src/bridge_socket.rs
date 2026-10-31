//! Native connected-socket ABI. No socket creation, DNS or fallback in this entry.
use crate::bridge::{ReceiptCallback, publish_with_socket};
use std::{ffi::c_void, fs::File, net::TcpStream, os::fd::FromRawFd};

/// Same receipt contract as kloda_smb_publish, with a native route-bound connected socket.
/// Both descriptors are consumed on every return. Native route/source/credential fences
/// remain mandatory before the call, in event 0 and at local Completed authorization.
///
/// # Safety
/// Pointer/callback rules match kloda_smb_publish. Each nonnegative descriptor must
/// be valid and exclusively transferred; socket_fd must be a connected TCP socket.
/// The native owner must close other socket duplicates before transferring ownership.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn kloda_smb_publish_bound(
    json: *const u8,
    length: usize,
    snapshot_fd: i32,
    socket_fd: i32,
    callback: Option<ReceiptCallback>,
    context: *mut c_void,
) -> i32 {
    if snapshot_fd == socket_fd {
        if snapshot_fd >= 0 {
            drop(unsafe { File::from_raw_fd(snapshot_fd) });
        }
        return 1;
    }
    let socket = if socket_fd >= 0 {
        Some(unsafe { TcpStream::from_raw_fd(socket_fd) })
    } else {
        None
    };
    if snapshot_fd < 0 || socket.is_none() {
        if snapshot_fd >= 0 {
            drop(unsafe { File::from_raw_fd(snapshot_fd) });
        }
        return 1;
    }
    unsafe { publish_with_socket(json, length, snapshot_fd, callback, context, socket) }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{io::Read, net::TcpListener, os::fd::IntoRawFd, ptr, time::Duration};

    #[test]
    fn malformed_request_and_alias_consume_socket_without_sending_bytes() {
        for alias in [false, true] {
            let listener = TcpListener::bind("127.0.0.1:0").unwrap();
            let stream = TcpStream::connect(listener.local_addr().unwrap()).unwrap();
            let (mut peer, _) = listener.accept().unwrap();
            peer.set_read_timeout(Some(Duration::from_secs(1))).unwrap();
            let socket = stream.into_raw_fd();
            let snapshot = if alias {
                socket
            } else {
                File::open("/dev/null").unwrap().into_raw_fd()
            };
            assert_eq!(
                unsafe {
                    kloda_smb_publish_bound(ptr::null(), 0, snapshot, socket, None, ptr::null_mut())
                },
                1
            );
            assert_eq!(peer.read(&mut [0u8; 1]).unwrap(), 0);
        }
    }
    unsafe extern "C" fn allow(_: *mut c_void, _: i32, _: u64) -> i32 {
        0
    }
    unsafe extern "C" fn refuse(_: *mut c_void, _: i32, _: u64) -> i32 {
        1
    }

    #[test]
    fn wrong_peer_and_revoked_admission_close_without_protocol_or_auth_bytes() {
        for revoked in [false, true] {
            let listener = TcpListener::bind("127.0.0.1:0").unwrap();
            let stream = TcpStream::connect(listener.local_addr().unwrap()).unwrap();
            let (mut peer, _) = listener.accept().unwrap();
            peer.set_read_timeout(Some(Duration::from_secs(1))).unwrap();
            let json = serde_json::to_vec(&serde_json::json!({
                "address": "127.0.0.2", "port": listener.local_addr().unwrap().port(),
                "share":"owned", "username":"owned", "password":"fictional", "domain":"",
                "operationId":"01234567-89ab-cdef-0123-456789abcdef", "finalPath":"owned.bin",
                "size":"0", "sha256":vec![0u8;32], "responseTimeoutMs":1000
            }))
            .unwrap();
            let callback: ReceiptCallback = if revoked { refuse } else { allow };
            let result = unsafe {
                kloda_smb_publish_bound(
                    json.as_ptr(),
                    json.len(),
                    File::open("/dev/null").unwrap().into_raw_fd(),
                    stream.into_raw_fd(),
                    Some(callback),
                    ptr::null_mut(),
                )
            };
            assert_eq!(result, if revoked { 4 } else { 3 });
            assert_eq!(peer.read(&mut [0u8; 1]).unwrap(), 0);
        }
    }
}
