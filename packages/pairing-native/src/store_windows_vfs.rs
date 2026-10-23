//! Connection-private, reopen-only Windows VFS. No legacy admission or CREATE.
use crate::error::{PairingError, Result};
use rusqlite::{ffi, Connection, OpenFlags};
use std::ffi::{c_char, c_int, c_void, CStr, CString};
use std::sync::{atomic::{AtomicBool, AtomicU64, Ordering}, Arc};
use windows_sys::Win32::Foundation::HANDLE;

#[path = "store_windows_vfs_io.rs"]
mod io;
#[path = "store_windows_vfs_callbacks.rs"]
mod callbacks;
#[cfg(test)]
#[path = "store_windows_vfs_tests.rs"]
mod tests;
#[cfg(test)]
#[path = "store_windows_vfs_native_tests.rs"]
mod native_tests;

#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) enum Object { Main, Wal }

/// Implemented only by native generation admission, retaining original pins.
/// Validation must not panic and must compare the actual borrowed SQLite handle.
pub(crate) trait Admission: Send + Sync {
    /// Atomically consume this generation's one-connection admission. Never reset.
    fn claim_connection(&self) -> bool;
    fn path(&self, object: Object) -> &CStr;
    fn validate(&self, object: Object, handle: HANDLE) -> bool;
}

pub(super) struct Context {
    underlying: *mut ffi::sqlite3_vfs,
    admission: Arc<dyn Admission>,
    paths: [CString; 2],
    main_open: AtomicBool,
    wal_open: AtomicBool,
    poisoned: AtomicBool,
}

/// Close the connection before unregistering/freeing callbacks and admission.
pub(crate) struct BoundConnection {
    connection: Option<Connection>,
    registration: Registration,
}
impl std::ops::Deref for BoundConnection {
    type Target = Connection;
    fn deref(&self) -> &Connection { self.connection.as_ref().expect("live bound connection") }
}
impl std::ops::DerefMut for BoundConnection {
    fn deref_mut(&mut self) -> &mut Connection { self.connection.as_mut().expect("live bound connection") }
}
impl BoundConnection {
    pub(crate) fn healthy(&self) -> Result<()> {
        let context = &self.registration.context;
        if context.poisoned.load(Ordering::Acquire)
            || !context.main_open.load(Ordering::Acquire)
            || !context.wal_open.load(Ordering::Acquire)
        {
            Err(PairingError::StorageFailure)
        } else {
            Ok(())
        }
    }
    pub(crate) fn connection(&mut self) -> Result<&mut Connection> {
        if self.registration.context.poisoned.load(Ordering::Acquire) {
            return Err(PairingError::StorageFailure);
        }
        self.connection.as_mut().ok_or(PairingError::StorageFailure)
    }
}
impl Drop for BoundConnection {
    fn drop(&mut self) {
        // Safe Rust cannot retain a Statement past this borrow. If SQLite still
        // refuses close, leak the entire registration rather than dangling C data.
        if let Some(conn) = self.connection.take() {
            if let Err((conn, _)) = conn.close() {
                std::mem::forget(conn);
                self.registration.leaked = true;
            }
        }
    }
}
struct Registration {
    vfs: Option<Box<ffi::sqlite3_vfs>>,
    context: Box<Context>,
    name: CString,
    leaked: bool,
}
// SQLite Connection is Send, not Sync. Stable heap callbacks are used only by
// that single serialized connection; global register/unregister is SQLite-owned.
unsafe impl Send for Registration {}
impl Drop for Registration {
    fn drop(&mut self) {
        if self.leaked {
            if let Some(vfs) = self.vfs.take() { Box::leak(vfs); }
            // Move all callback-referenced storage into process-lifetime leaks.
            let admission = self.context.admission.clone();
            let context = std::mem::replace(&mut self.context, Box::new(Context {
                underlying: std::ptr::null_mut(), paths: [CString::default(), CString::default()], admission,
                main_open: AtomicBool::new(false), wal_open: AtomicBool::new(false),
                poisoned: AtomicBool::new(true),
            }));
            Box::leak(context);
            let name = std::mem::replace(&mut self.name, CString::default());
            std::mem::forget(name);
        } else if let Some(vfs) = self.vfs.as_mut() {
            unsafe { ffi::sqlite3_vfs_unregister(&mut **vfs); }
        }
    }
}

/// Does not execute schema/migration SQL. Only complete selected generations
/// with preowned DB AND WAL are eligible; fresh bootstrap is a separate gate.
pub(crate) fn open(admission: Arc<dyn Admission>) -> Result<BoundConnection> {
    if !admission.claim_connection() { return Err(PairingError::StorageFailure); }
    static NEXT: AtomicU64 = AtomicU64::new(1);
    let id = NEXT.try_update(Ordering::Relaxed, Ordering::Relaxed, |v| v.checked_add(1))
        .map_err(|_| PairingError::StorageFailure)?;
    let name = CString::new(format!("kloda-generation-{id}")).map_err(|_| PairingError::StorageFailure)?;
    unsafe {
        if ffi::sqlite3_initialize() != ffi::SQLITE_OK { return Err(PairingError::StorageFailure); }
        let underlying = ffi::sqlite3_vfs_find(c"win32".as_ptr());
        if underlying.is_null() || (*underlying).szOsFile <= 0 { return Err(PairingError::StorageFailure); }
        let paths = [admission.path(Object::Main).to_owned(), admission.path(Object::Wal).to_owned()];
        let mut context = Box::new(Context { underlying, admission, paths,
            main_open: AtomicBool::new(false), wal_open: AtomicBool::new(false), poisoned: AtomicBool::new(false) });
        let mut vfs = Box::new(*underlying);
        vfs.iVersion = 2;
        vfs.szOsFile = std::mem::size_of::<io::File>() as c_int;
        vfs.pNext = std::ptr::null_mut();
        vfs.zName = name.as_ptr();
        vfs.pAppData = (&mut *context as *mut Context).cast();
        callbacks::install(&mut vfs);
        if ffi::sqlite3_vfs_register(&mut *vfs, 0) != ffi::SQLITE_OK { return Err(PairingError::StorageFailure); }
        let registration = Registration { vfs: Some(vfs), context, name, leaked: false };
        let path = registration.context.paths[0].to_str().map_err(|_| PairingError::StorageFailure)?;
        let connection = Connection::open_with_flags_and_vfs(path,
            OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_NO_MUTEX | OpenFlags::SQLITE_OPEN_PRIVATE_CACHE,
            registration.name.to_str().map_err(|_| PairingError::StorageFailure)?)
            .map_err(|_| PairingError::StorageFailure)?;
        let mut bound = BoundConnection { connection: Some(connection), registration };
        // This PRAGMA cannot read schema/WAL. It precedes every WAL access.
        let mode: String = bound.connection()?.query_row("PRAGMA locking_mode=EXCLUSIVE", [], |r| r.get(0))
            .map_err(|_| PairingError::StorageFailure)?;
        if mode != "exclusive" { return Err(PairingError::StorageFailure); }
        let mut persist: c_int = 1;
        let db = bound.connection()?.handle();
        if ffi::sqlite3_file_control(db, c"main".as_ptr(), ffi::SQLITE_FCNTL_PERSIST_WAL,
            (&mut persist as *mut c_int).cast()) != ffi::SQLITE_OK || persist != 1 {
            return Err(PairingError::StorageFailure);
        }
        let wal: String = bound.connection()?.query_row("PRAGMA journal_mode", [], |r| r.get(0))
            .map_err(|_| PairingError::StorageFailure)?;
        if wal != "wal" { return Err(PairingError::StorageFailure); }
        bound.connection()?.execute_batch("PRAGMA synchronous=FULL; PRAGMA temp_store=MEMORY;")
            .map_err(|_| PairingError::StorageFailure)?;
        Ok(bound)
    }
}

unsafe fn context<'a>(vfs: *mut ffi::sqlite3_vfs) -> &'a Context { unsafe {
    &*((*vfs).pAppData.cast::<Context>())
} }
unsafe fn classify(ctx: &Context, name: *const c_char) -> Option<Object> { unsafe {
    if name.is_null() { return None; }
    let name = CStr::from_ptr(name);
    if name == ctx.paths[0].as_c_str() { Some(Object::Main) }
    else if name == ctx.paths[1].as_c_str() { Some(Object::Wal) } else { None }
} }
fn refuse(ctx: &Context) -> c_int {
    ctx.poisoned.store(true, Ordering::Release);
    ffi::SQLITE_IOERR
}
