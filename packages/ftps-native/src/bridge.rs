//! Both input FDs transfer ownership; callback pointers are borrowed for this synchronous call only.
use crate::{Authority, Error, Event, Owner, Request, Result, Session};
use std::{
    ffi::c_void,
    fs::File,
    net::{SocketAddr, TcpStream},
    os::fd::FromRawFd,
    panic::{AssertUnwindSafe, catch_unwind},
    sync::Arc,
};
pub type Receipt = unsafe extern "C" fn(*mut c_void, i32, u64) -> i32;
pub type Connect = unsafe extern "C" fn(*mut c_void, *const u8, usize, u16) -> i32;
struct Native {
    receipt: Receipt,
    connect: Connect,
    context: usize,
}
impl Owner for Native {
    fn current(&self) -> Result<()> {
        if unsafe { (self.receipt)(self.context as *mut c_void, 0, 0) } == 0 {
            Ok(())
        } else {
            Err(Error::Admission)
        }
    }
    fn record(&self, event: Event, bytes: u64) -> Result<()> {
        if unsafe { (self.receipt)(self.context as *mut c_void, event as i32, bytes) } == 0 {
            Ok(())
        } else {
            Err(Error::Journal)
        }
    }
    fn connect(&self, address: SocketAddr) -> Result<TcpStream> {
        self.current()?;
        let ip = address.ip().to_string();
        let fd = unsafe {
            (self.connect)(
                self.context as *mut c_void,
                ip.as_ptr(),
                ip.len(),
                address.port(),
            )
        };
        if fd < 0 {
            return Err(Error::Admission);
        }
        let stream = unsafe { TcpStream::from_raw_fd(fd) };
        self.current()?;
        Ok(stream)
    }
}
unsafe fn run(
    json: *const u8,
    length: usize,
    file: i32,
    socket: i32,
    callbacks: (Option<Receipt>, Option<Connect>),
    context: *mut c_void,
    writing: bool,
) -> i32 {
    let (receipt, connect) = callbacks;
    if file >= 0 && file == socket {
        drop(unsafe { File::from_raw_fd(file) });
        return Error::Invalid as i32;
    }
    let file = if file >= 0 {
        Some(unsafe { File::from_raw_fd(file) })
    } else {
        None
    };
    let socket = if socket >= 0 {
        Some(unsafe { TcpStream::from_raw_fd(socket) })
    } else {
        None
    };
    let result = catch_unwind(AssertUnwindSafe(|| -> Result<()> {
        let mut file = file.ok_or(Error::Invalid)?;
        let socket = socket.ok_or(Error::Invalid)?;
        if json.is_null() || length == 0 || length > 16384 {
            return Err(Error::Invalid);
        }
        let request: Request =
            serde_json::from_slice(unsafe { std::slice::from_raw_parts(json, length) })
                .map_err(|_| Error::Invalid)?;
        request.validate()?;
        let owner: Authority = Arc::new(Native {
            receipt: receipt.ok_or(Error::Invalid)?,
            connect: connect.ok_or(Error::Invalid)?,
            context: context as usize,
        });
        let mut session = Session::open(socket, &request, owner)?;
        if writing {
            session.publish(&request, &mut file)?
        } else {
            session.download(&request, &mut file)?
        }
        session.close()
    }));
    match result {
        Ok(Ok(())) => 0,
        Ok(Err(e)) => e as i32,
        Err(_) => Error::Transport as i32,
    }
}
/// # Safety
/// Valid FDs transfer once even on error. JSON and callbacks remain valid synchronously.
/// Callbacks must not unwind. Every data socket must be a fresh connected duplicate owned by the caller's same route lease.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn kloda_ftps_publish_bound(
    json: *const u8,
    length: usize,
    file: i32,
    socket: i32,
    receipt: Option<Receipt>,
    connect: Option<Connect>,
    context: *mut c_void,
) -> i32 {
    unsafe {
        run(
            json,
            length,
            file,
            socket,
            (receipt, connect),
            context,
            true,
        )
    }
}
/// # Safety
/// Same ownership/callback contract; output must be a new empty private staging file.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn kloda_ftps_read_bound(
    json: *const u8,
    length: usize,
    file: i32,
    socket: i32,
    receipt: Option<Receipt>,
    connect: Option<Connect>,
    context: *mut c_void,
) -> i32 {
    unsafe {
        run(
            json,
            length,
            file,
            socket,
            (receipt, connect),
            context,
            false,
        )
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        io::Read,
        os::{fd::IntoRawFd, unix::net::UnixStream},
        sync::atomic::{AtomicI32, Ordering},
    };
    const VALID: &str = r#"{"address":"127.0.0.1","port":990,"hostname":"nas.local","username":"probe","password":"secret","root":"/","operationId":"12345678-1234-4321-8765-123456789abc","finalPath":"a.bin","size":"0","sha256":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"responseTimeoutMs":5000}"#;
    static CALLS: AtomicI32 = AtomicI32::new(0);
    unsafe extern "C" fn reject(context: *mut c_void, event: i32, _: u64) -> i32 {
        assert_eq!(event, 0);
        unsafe { &*context.cast::<AtomicI32>() }.fetch_add(1, Ordering::SeqCst);
        1
    }
    unsafe extern "C" fn no_connect(_: *mut c_void, _: *const u8, _: usize, _: u16) -> i32 {
        CALLS.fetch_add(1, Ordering::SeqCst);
        -1
    }
    fn pair() -> (i32, UnixStream) {
        let (ours, peer) = UnixStream::pair().unwrap();
        // Set before the bridge closes `ours`: macOS rejects SO_RCVTIMEO once the peer is gone.
        peer.set_read_timeout(Some(std::time::Duration::from_secs(2)))
            .unwrap();
        (ours.into_raw_fd(), peer)
    }
    fn closed(mut peer: UnixStream) -> bool {
        peer.read(&mut [0; 1]).unwrap() == 0
    }
    fn call(json: &[u8], callbacks: (Option<Receipt>, Option<Connect>), writing: bool) -> i32 {
        let (file, file_peer) = pair();
        let (socket, socket_peer) = pair();
        let before = json.to_vec();
        let mut calls = AtomicI32::new(0);
        let context = (&mut calls as *mut AtomicI32).cast();
        let code = unsafe {
            if writing {
                kloda_ftps_publish_bound(
                    json.as_ptr(),
                    json.len(),
                    file,
                    socket,
                    callbacks.0,
                    callbacks.1,
                    context,
                )
            } else {
                kloda_ftps_read_bound(
                    json.as_ptr(),
                    json.len(),
                    file,
                    socket,
                    callbacks.0,
                    callbacks.1,
                    context,
                )
            }
        };
        assert_eq!(json, before.as_slice());
        assert!(closed(file_peer) && closed(socket_peer));
        code + 100 * calls.load(Ordering::SeqCst)
    }
    #[test]
    fn c_boundary_rejects_without_network_and_consumes_both_fds() {
        let both = (Some(reject as Receipt), Some(no_connect as Connect));
        let invalid = Error::Invalid as i32;
        for writing in [true, false] {
            assert_eq!(call(b"{", both, writing), invalid);
            assert_eq!(
                call(VALID.replace("secret", "").as_bytes(), both, writing),
                invalid
            );
            assert_eq!(
                call(
                    VALID
                        .replace(r#""size":"0""#, r#""size":"0","x":1"#)
                        .as_bytes(),
                    both,
                    writing
                ),
                invalid
            );
            assert_eq!(
                call(VALID.as_bytes(), (None, Some(no_connect)), writing),
                invalid
            );
            assert_eq!(
                call(VALID.as_bytes(), (Some(reject), None), writing),
                invalid
            );
            assert_eq!(
                call(VALID.as_bytes(), both, writing),
                Error::Admission as i32 + 100
            );
        }
        assert_eq!(CALLS.load(Ordering::SeqCst), 0);
    }
    #[test]
    fn c_boundary_null_length_and_fd_contract() {
        let json = VALID.as_bytes();
        let (file, file_peer) = pair();
        let (socket, socket_peer) = pair();
        let code = unsafe {
            kloda_ftps_publish_bound(
                std::ptr::null(),
                1,
                file,
                socket,
                None,
                None,
                std::ptr::null_mut(),
            )
        };
        assert_eq!(code, Error::Invalid as i32);
        assert!(closed(file_peer) && closed(socket_peer));
        let (file, file_peer) = pair();
        let (socket, socket_peer) = pair();
        let code = unsafe {
            kloda_ftps_read_bound(
                json.as_ptr(),
                16385,
                file,
                socket,
                None,
                None,
                std::ptr::null_mut(),
            )
        };
        assert_eq!(code, Error::Invalid as i32);
        assert!(closed(file_peer) && closed(socket_peer));
        let (same, peer) = pair();
        let code = unsafe {
            kloda_ftps_publish_bound(
                json.as_ptr(),
                json.len(),
                same,
                same,
                None,
                None,
                std::ptr::null_mut(),
            )
        };
        assert_eq!(code, Error::Invalid as i32);
        assert!(closed(peer));
        let (file, file_peer) = pair();
        let code = unsafe {
            kloda_ftps_read_bound(
                json.as_ptr(),
                json.len(),
                file,
                -1,
                None,
                None,
                std::ptr::null_mut(),
            )
        };
        assert_eq!(code, Error::Invalid as i32);
        assert!(closed(file_peer));
        let (socket, socket_peer) = pair();
        let code = unsafe {
            kloda_ftps_publish_bound(
                json.as_ptr(),
                json.len(),
                -1,
                socket,
                None,
                None,
                std::ptr::null_mut(),
            )
        };
        assert_eq!(code, Error::Invalid as i32);
        assert!(closed(socket_peer));
    }
}
