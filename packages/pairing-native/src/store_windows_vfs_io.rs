use super::*;

#[repr(C)]
pub(super) struct File {
    pub(super) base: ffi::sqlite3_file,
    pub(super) inner: *mut ffi::sqlite3_file,
    pub(super) ctx: *const Context,
    pub(super) kind: Object,
}
unsafe fn file<'a>(p: *mut ffi::sqlite3_file) -> &'a File { unsafe { &*p.cast::<File>() } }
unsafe fn methods(p: *mut ffi::sqlite3_file) -> &'static ffi::sqlite3_io_methods { unsafe {
    &*(*file(p).inner).pMethods
} }
macro_rules! forward {
    ($name:ident, $field:ident $(, $arg:ident: $ty:ty)*) => {
        unsafe extern "C" fn $name(p: *mut ffi::sqlite3_file, $($arg: $ty),*) -> c_int { unsafe {
            let f = file(p);
            if (*f.ctx).poisoned.load(Ordering::Acquire) { return ffi::SQLITE_IOERR; }
            match methods(p).$field {
                Some(call) => call(f.inner, $($arg),*),
                None => refuse(&*f.ctx),
            }
        } }
    };
}
forward!(read, xRead, out: *mut c_void, size: c_int, offset: i64);
forward!(write, xWrite, input: *const c_void, size: c_int, offset: i64);
forward!(truncate, xTruncate, size: i64);
forward!(sync, xSync, flags: c_int);
forward!(size, xFileSize, out: *mut i64);
forward!(lock, xLock, level: c_int);
// Unlock is also needed during cleanup after a poisoned operation.
unsafe extern "C" fn unlock(p: *mut ffi::sqlite3_file, level: c_int) -> c_int { unsafe {
    methods(p).xUnlock.map_or(ffi::SQLITE_IOERR, |call| call(file(p).inner, level))
} }
forward!(reserved, xCheckReservedLock, out: *mut c_int);
// These callbacks return capabilities/sizes, not SQLite result codes.
unsafe extern "C" fn sector(p: *mut ffi::sqlite3_file) -> c_int { unsafe {
    if (*file(p).ctx).poisoned.load(Ordering::Acquire) { return 512; }
    methods(p).xSectorSize.map_or(512, |call| call(file(p).inner))
} }
unsafe extern "C" fn device(p: *mut ffi::sqlite3_file) -> c_int { unsafe {
    if (*file(p).ctx).poisoned.load(Ordering::Acquire) { return 0; }
    methods(p).xDeviceCharacteristics.map_or(0, |call| call(file(p).inner))
} }

unsafe extern "C" fn close(p: *mut ffi::sqlite3_file) -> c_int { unsafe {
    let f = file(p);
    let result = methods(p).xClose.map_or(ffi::SQLITE_IOERR_CLOSE, |call| call(f.inner));
    ffi::sqlite3_free(f.inner.cast());
    let slot = if f.kind == Object::Main { &(*f.ctx).main_open } else { &(*f.ctx).wal_open };
    slot.store(false, Ordering::Release);
    (*p).pMethods = std::ptr::null();
    result
} }
unsafe extern "C" fn control(p: *mut ffi::sqlite3_file, op: c_int, arg: *mut c_void) -> c_int { unsafe {
    let f = file(p);
    if (*f.ctx).poisoned.load(Ordering::Acquire) { return ffi::SQLITE_IOERR; }
    if op == ffi::SQLITE_FCNTL_PRAGMA && !arg.is_null() {
        // Public SQLite char** contract: [1] is name, [2] optional argument.
        let args = arg.cast::<*const c_char>();
        let name = *args.add(1);
        let value = *args.add(2);
        if !name.is_null() && !value.is_null() {
            let name = CStr::from_ptr(name).to_bytes();
            let value = CStr::from_ptr(value).to_bytes();
            if (name.eq_ignore_ascii_case(b"locking_mode") && !value.eq_ignore_ascii_case(b"exclusive"))
                || (name.eq_ignore_ascii_case(b"journal_mode") && !value.eq_ignore_ascii_case(b"wal"))
            {
                return refuse(&*f.ctx);
            }
        }
    }
    // Never permit handle replacement, wrapper escape or file-pointer access.
    if matches!(op, ffi::SQLITE_FCNTL_WIN32_SET_HANDLE | ffi::SQLITE_FCNTL_FILE_POINTER |
        ffi::SQLITE_FCNTL_JOURNAL_POINTER | ffi::SQLITE_FCNTL_VFS_POINTER) {
        return refuse(&*f.ctx);
    }
    methods(p).xFileControl.map_or(ffi::SQLITE_NOTFOUND, |call| call(f.inner, op, arg))
} }
unsafe extern "C" fn shm_map(p: *mut ffi::sqlite3_file, _: c_int, _: c_int, _: c_int, out: *mut *mut c_void) -> c_int { unsafe {
    if !out.is_null() { *out = std::ptr::null_mut(); }
    refuse(&*file(p).ctx)
} }
unsafe extern "C" fn shm_lock(p: *mut ffi::sqlite3_file, _: c_int, _: c_int, _: c_int) -> c_int { unsafe { refuse(&*file(p).ctx) } }
unsafe extern "C" fn shm_barrier(p: *mut ffi::sqlite3_file) { unsafe { refuse(&*file(p).ctx); } }
unsafe extern "C" fn shm_unmap(p: *mut ffi::sqlite3_file, _: c_int) -> c_int { unsafe { refuse(&*file(p).ctx) } }

pub(super) static METHODS: ffi::sqlite3_io_methods = ffi::sqlite3_io_methods {
    iVersion: 2, xClose: Some(close), xRead: Some(read), xWrite: Some(write),
    xTruncate: Some(truncate), xSync: Some(sync), xFileSize: Some(size),
    xLock: Some(lock), xUnlock: Some(unlock), xCheckReservedLock: Some(reserved),
    xFileControl: Some(control), xSectorSize: Some(sector), xDeviceCharacteristics: Some(device),
    xShmMap: Some(shm_map), xShmLock: Some(shm_lock), xShmBarrier: Some(shm_barrier),
    xShmUnmap: Some(shm_unmap), xFetch: None, xUnfetch: None,
};
