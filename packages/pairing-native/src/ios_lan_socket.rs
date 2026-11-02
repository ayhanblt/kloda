//! Reuse the existing iOS OS-route owner for a synchronous SMB worker.
use crate::{qr::LanHint, route};
use std::{ffi::c_void, net::IpAddr, os::fd::AsRawFd, panic::AssertUnwindSafe, time::Duration};

struct Lease {
    route: route::Route,
    peer: IpAddr,
}

type Worker = unsafe extern "C" fn(*mut c_void, i32, *const c_void) -> i32;

/// The worker borrows both FD and lease until it returns, and must not unwind.
/// A consumed FD must be a dup; the original is retained and closed here.
#[no_mangle]
pub unsafe extern "C" fn kloda_ios_lan_with_socket(
    address: *const u8,
    length: usize,
    port: u16,
    worker: Option<Worker>,
    context: *mut c_void,
) -> i32 {
    std::panic::catch_unwind(AssertUnwindSafe(|| {
        if address.is_null() || length == 0 || length > 39 || port == 0 {
            return 1;
        }
        let Some(worker) = worker else { return 1 };
        // Native caller retains this bounded buffer throughout the synchronous call.
        let bytes = unsafe { std::slice::from_raw_parts(address, length) };
        let Ok(text) = std::str::from_utf8(bytes) else {
            return 1;
        };
        let Ok(peer) = text.parse::<IpAddr>() else {
            return 1;
        };
        let hint = LanHint { ip: peer, port };
        let Ok(route) = route::for_peer(&hint) else {
            return 1;
        };
        let Ok(socket) = route.connect(&hint, Duration::from_secs(5)) else {
            return 1;
        };
        let lease = Lease { route, peer };
        if lease.route.check(peer).is_err() {
            return 1;
        }
        // The stack lease and owned socket outlive the complete worker call.
        unsafe { worker(context, socket.as_raw_fd(), (&lease as *const Lease).cast()) }
    }))
    .unwrap_or(1)
}

/// Only the exact lease supplied to the current synchronous worker is valid.
#[no_mangle]
pub unsafe extern "C" fn kloda_ios_lan_current(raw: *const c_void) -> i32 {
    if raw.is_null() {
        return 1;
    }
    std::panic::catch_unwind(AssertUnwindSafe(|| {
        // This pointer is native-only, borrowed, never persisted or exposed to JS.
        let lease = unsafe { &*raw.cast::<Lease>() };
        if lease.route.check(lease.peer).is_ok() {
            0
        } else {
            1
        }
    }))
    .unwrap_or(1)
}

#[cfg(test)]
mod tests {
    use super::*;
    unsafe extern "C" fn unreachable_worker(_: *mut c_void, _: i32, _: *const c_void) -> i32 {
        std::process::abort();
    }
    #[test]
    fn invalid_inputs_never_reach_the_worker() {
        unsafe {
            assert_eq!(kloda_ios_lan_current(std::ptr::null()), 1);
            for address in ["", "not-an-ip", "192.168.1.10:445", "192.168.1.10\0"] {
                assert_eq!(
                    kloda_ios_lan_with_socket(
                        address.as_ptr(),
                        address.len(),
                        445,
                        Some(unreachable_worker),
                        std::ptr::null_mut()
                    ),
                    1
                );
            }
            assert_eq!(
                kloda_ios_lan_with_socket(
                    std::ptr::null(),
                    1,
                    445,
                    Some(unreachable_worker),
                    std::ptr::null_mut()
                ),
                1
            );
            assert_eq!(
                kloda_ios_lan_with_socket(
                    b"192.168.1.10".as_ptr(),
                    12,
                    0,
                    Some(unreachable_worker),
                    std::ptr::null_mut()
                ),
                1
            );
        }
    }
}
