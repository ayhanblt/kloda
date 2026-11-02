//! Consuming-FD synchronous ABI; caller stays on a native worker with a current OS route lease.
use crate::{Ack, Error, NativeReceipt, Result, request::Request, session::Session};
use std::{
    ffi::c_void,
    fs::File,
    os::fd::FromRawFd,
    panic::{AssertUnwindSafe, catch_unwind},
};
pub type Callback = unsafe extern "C" fn(*mut c_void, i32, u64) -> i32;
struct Owner {
    callback: Callback,
    context: *mut c_void,
}
impl NativeReceipt for Owner {
    fn admit(&mut self) -> Result<()> {
        if unsafe { (self.callback)(self.context, 0, 0) } == 0 {
            Ok(())
        } else {
            Err(Error::Admission)
        }
    }
    fn record(&mut self, ack: Ack) -> Result<()> {
        let (event, bytes) = match ack {
            Ack::Created => (1, 0),
            Ack::DataFlushed(n) => (2, n),
            Ack::Closed => (3, 0),
            Ack::Renamed => (4, 0),
            Ack::BytesVerified => (5, 0),
        };
        if unsafe { (self.callback)(self.context, event, bytes) } == 0 {
            Ok(())
        } else {
            Err(Error::Journal)
        }
    }
}
unsafe fn run(
    json: *const u8,
    length: usize,
    file_fd: i32,
    socket_fd: i32,
    callback: Option<Callback>,
    context: *mut c_void,
    writing: bool,
) -> i32 {
    if file_fd >= 0 && file_fd == socket_fd {
        drop(unsafe { File::from_raw_fd(file_fd) });
        return Error::Invalid as i32;
    }
    let file = if file_fd >= 0 {
        Some(unsafe { File::from_raw_fd(file_fd) })
    } else {
        None
    };
    let stream = if socket_fd >= 0 {
        Some(unsafe { std::net::TcpStream::from_raw_fd(socket_fd) })
    } else {
        None
    };
    let result = catch_unwind(AssertUnwindSafe(|| -> Result<()> {
        let mut file = file.ok_or(Error::Invalid)?;
        let stream = stream.ok_or(Error::Invalid)?;
        if json.is_null() || length == 0 || length > 16384 {
            return Err(Error::Invalid);
        }
        let request: Request =
            serde_json::from_slice(unsafe { std::slice::from_raw_parts(json, length) })
                .map_err(|_| Error::Invalid)?;
        request.validate()?;
        let mut owner = Owner {
            callback: callback.ok_or(Error::Invalid)?,
            context,
        };
        owner.admit()?;
        stream.set_nonblocking(true).map_err(|_| Error::Transport)?;
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .map_err(|_| Error::Local)?;
        runtime.block_on(async {
            let stream = tokio::net::TcpStream::from_std(stream).map_err(|_| Error::Transport)?;
            let session = Session::open(stream, &request, &mut owner, writing).await?;
            let result = if writing {
                crate::publication::publish(&session, &request, &mut owner, &mut file).await
            } else {
                crate::publication::download(&session, &request, &mut owner, &mut file).await
            };
            let closed = session.close().await;
            result?;
            closed
        })
    }));
    match result {
        Ok(Ok(())) => 0,
        Ok(Err(code)) => code as i32,
        Err(_) => Error::Transport as i32,
    }
}
/// # Safety
/// JSON points to length readable bytes; both valid FDs transfer ownership on every return.
/// callback/context remain valid synchronously and never unwind; event0 checks route/source/profile/pin.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn kloda_sftp_publish_bound(
    json: *const u8,
    length: usize,
    snapshot: i32,
    socket: i32,
    callback: Option<Callback>,
    context: *mut c_void,
) -> i32 {
    unsafe { run(json, length, snapshot, socket, callback, context, true) }
}
/// # Safety
/// Same consuming-FD/callback contract; output is a new empty private staging FD, receipt already owned.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn kloda_sftp_read_bound(
    json: *const u8,
    length: usize,
    output: i32,
    socket: i32,
    callback: Option<Callback>,
    context: *mut c_void,
) -> i32 {
    unsafe { run(json, length, output, socket, callback, context, false) }
}
