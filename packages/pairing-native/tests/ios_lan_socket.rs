//! Harness only: deterministic route double, not actual OS LAN admission proof.
use std::{
    cell::RefCell,
    ffi::c_void,
    net::{TcpListener, TcpStream},
    os::fd::AsRawFd,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Duration,
};

mod qr {
    pub struct LanHint {
        pub ip: std::net::IpAddr,
        pub port: u16,
    }
}
#[derive(Clone, Copy, PartialEq)]
enum Mode {
    Admit,
    OpenFails,
    ConnectFails,
    CurrentFails,
    PanicConnect,
}
struct Fixture {
    mode: Mode,
    valid: Arc<AtomicBool>,
    fd: i32,
    drops: usize,
}
thread_local! {
    static FIXTURE: RefCell<Fixture> = RefCell::new(Fixture {
        mode: Mode::Admit, valid: Arc::new(AtomicBool::new(true)), fd: -1, drops: 0 });
}
mod route {
    use super::*;
    pub struct Route {
        valid: Arc<AtomicBool>,
    }
    pub fn for_peer(hint: &qr::LanHint) -> Result<Route, ()> {
        assert_eq!(hint.port, 445);
        assert_eq!(hint.ip.to_string(), "192.168.1.10");
        FIXTURE.with(|f| {
            let f = f.borrow();
            if f.mode == Mode::OpenFails {
                Err(())
            } else {
                Ok(Route {
                    valid: f.valid.clone(),
                })
            }
        })
    }
    impl Route {
        pub fn connect(&self, _: &qr::LanHint, timeout: Duration) -> Result<TcpStream, ()> {
            assert_eq!(timeout, Duration::from_secs(5));
            let mode = FIXTURE.with(|f| f.borrow().mode);
            if mode == Mode::PanicConnect {
                panic!("owned injected panic");
            }
            if mode == Mode::ConnectFails {
                return Err(());
            }
            let listener = TcpListener::bind("127.0.0.1:0").unwrap();
            let socket = TcpStream::connect(listener.local_addr().unwrap()).unwrap();
            let _accepted = listener.accept().unwrap();
            FIXTURE.with(|f| f.borrow_mut().fd = socket.as_raw_fd());
            Ok(socket)
        }
        pub fn check(&self, _: std::net::IpAddr) -> Result<(), ()> {
            let fail = FIXTURE.with(|f| f.borrow().mode == Mode::CurrentFails);
            if !fail && self.valid.load(Ordering::SeqCst) {
                Ok(())
            } else {
                Err(())
            }
        }
    }
    impl Drop for Route {
        fn drop(&mut self) {
            FIXTURE.with(|f| f.borrow_mut().drops += 1);
        }
    }
}

#[path = "../src/ios_lan_socket.rs"]
mod bridge;

unsafe extern "C" {
    fn fcntl(fd: i32, command: i32, ...) -> i32;
}
struct Worker {
    result: i32,
    calls: usize,
}
unsafe extern "C" fn worker(context: *mut c_void, fd: i32, lease: *const c_void) -> i32 {
    let context = unsafe { &mut *context.cast::<Worker>() };
    context.calls += 1;
    assert!(unsafe { fcntl(fd, 1) } >= 0);
    assert_eq!(unsafe { bridge::kloda_ios_lan_current(lease) }, 0);
    FIXTURE.with(|f| {
        let f = f.borrow();
        assert_eq!(f.drops, 0); // Route witness must outlive the complete callback.
        f.valid.store(false, Ordering::SeqCst);
    });
    assert_eq!(unsafe { bridge::kloda_ios_lan_current(lease) }, 1);
    assert_eq!(unsafe { bridge::kloda_ios_lan_current(lease) }, 1);
    context.result
}

#[test]
fn borrowed_lifetime_invalidation_and_socket_cleanup() {
    for (mode, result, expected_calls) in [
        (Mode::Admit, 0, 1),
        (Mode::Admit, 7, 1),
        (Mode::OpenFails, 1, 0),
        (Mode::ConnectFails, 1, 0),
        (Mode::CurrentFails, 1, 0),
        (Mode::PanicConnect, 1, 0),
    ] {
        FIXTURE.with(|f| {
            *f.borrow_mut() = Fixture {
                mode,
                valid: Arc::new(AtomicBool::new(true)),
                fd: -1,
                drops: 0,
            }
        });
        let mut context = Worker { result, calls: 0 };
        let address = b"192.168.1.10";
        let got = unsafe {
            bridge::kloda_ios_lan_with_socket(
                address.as_ptr(),
                address.len(),
                445,
                Some(worker),
                (&mut context as *mut Worker).cast(),
            )
        };
        assert_eq!(got, result);
        assert_eq!(context.calls, expected_calls);
        FIXTURE.with(|f| {
            let f = f.borrow();
            assert_eq!(f.drops, usize::from(mode != Mode::OpenFails));
            if f.fd >= 0 {
                assert_eq!(unsafe { fcntl(f.fd, 1) }, -1);
            }
        });
    }
    let address = b"192.168.1.10";
    assert_eq!(
        unsafe {
            bridge::kloda_ios_lan_with_socket(
                address.as_ptr(),
                address.len(),
                445,
                None,
                std::ptr::null_mut(),
            )
        },
        1
    );
    assert_eq!(
        unsafe {
            bridge::kloda_ios_lan_with_socket(address.as_ptr(), 40, 445, None, std::ptr::null_mut())
        },
        1
    );
}

unsafe extern "C" fn ftps_data_worker(_: *mut c_void, control: i32, lease: *const c_void) -> i32 {
    assert!(unsafe { fcntl(control,1) } >= 0);
    let data=unsafe { bridge::kloda_ios_lan_connect(lease,43210) };
    assert!(data>=0 && unsafe { fcntl(data,1) } >= 0);
    drop(unsafe { <std::fs::File as std::os::fd::FromRawFd>::from_raw_fd(data) });
    assert!(unsafe { fcntl(data,1) } < 0);
    FIXTURE.with(|f| { let f=f.borrow(); assert_eq!(f.drops,0); f.valid.store(false,Ordering::SeqCst); });
    assert_eq!(unsafe { bridge::kloda_ios_lan_connect(lease,43211) },-1);
    assert!(unsafe { fcntl(control,1) } >= 0);
    0
}
#[test]
fn ftps_data_uses_live_control_lease_and_fails_after_invalidation() {
    assert_eq!(unsafe { bridge::kloda_ios_lan_connect(std::ptr::null(),21) },-1);
    FIXTURE.with(|f| *f.borrow_mut()=Fixture {mode:Mode::Admit,valid:Arc::new(AtomicBool::new(true)),fd:-1,drops:0});
    let address=b"192.168.1.10";
    assert_eq!(unsafe { bridge::kloda_ios_lan_with_socket(address.as_ptr(),address.len(),445,Some(ftps_data_worker),std::ptr::null_mut()) },0);
    FIXTURE.with(|f|assert_eq!(f.borrow().drops,1));
}
