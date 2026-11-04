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
