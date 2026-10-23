use super::*;
use std::panic::{catch_unwind, AssertUnwindSafe};

pub(super) fn install(vfs: &mut ffi::sqlite3_vfs) {
    vfs.xOpen = Some(open);
    vfs.xDelete = Some(delete);
    vfs.xAccess = Some(access);
    vfs.xFullPathname = Some(full_path);
    // Non-file callbacks must receive the original VFS, not its replacement pAppData.
    vfs.xRandomness = Some(random);
    vfs.xSleep = Some(sleep);
    vfs.xCurrentTime = Some(time);
    vfs.xCurrentTimeInt64 = Some(time64);
    vfs.xGetLastError = Some(last_error);
    // Extension/system-call mutation is outside this private store contract.
    vfs.xDlOpen = None; vfs.xDlError = None; vfs.xDlSym = None; vfs.xDlClose = None;
    vfs.xSetSystemCall = None; vfs.xGetSystemCall = None; vfs.xNextSystemCall = None;
}
unsafe extern "C" fn open(vfs: *mut ffi::sqlite3_vfs, name: *const c_char, output: *mut ffi::sqlite3_file,
    flags: c_int, out_flags: *mut c_int) -> c_int { unsafe {
    (*output).pMethods = std::ptr::null();
    let ctx = context(vfs);
    catch_unwind(AssertUnwindSafe(|| open_checked(ctx, name, output, flags, out_flags)))
        .unwrap_or_else(|_| refuse(ctx))
} }
unsafe fn open_checked(ctx: &Context, name: *const c_char, output: *mut ffi::sqlite3_file,
    flags: c_int, out_flags: *mut c_int) -> c_int { unsafe {
    if ctx.poisoned.load(Ordering::Acquire) { return ffi::SQLITE_IOERR; }
    let Some(kind) = classify(ctx, name) else { return refuse(ctx); };
    let expected = if kind == Object::Main { ffi::SQLITE_OPEN_MAIN_DB } else { ffi::SQLITE_OPEN_WAL };
    let type_mask = ffi::SQLITE_OPEN_MAIN_DB | ffi::SQLITE_OPEN_TEMP_DB | ffi::SQLITE_OPEN_TRANSIENT_DB |
        ffi::SQLITE_OPEN_MAIN_JOURNAL | ffi::SQLITE_OPEN_TEMP_JOURNAL | ffi::SQLITE_OPEN_SUBJOURNAL |
        ffi::SQLITE_OPEN_SUPER_JOURNAL | ffi::SQLITE_OPEN_WAL;
    if flags & type_mask != expected || flags & (ffi::SQLITE_OPEN_DELETEONCLOSE | ffi::SQLITE_OPEN_READONLY) != 0 {
        return refuse(ctx);
    }
    let slot = if kind == Object::Main { &ctx.main_open } else { &ctx.wal_open };
    if slot.swap(true, Ordering::AcqRel) { return refuse(ctx); }
    let inner = ffi::sqlite3_malloc64((*ctx.underlying).szOsFile as u64).cast::<ffi::sqlite3_file>();
    if inner.is_null() { slot.store(false, Ordering::Release); return ffi::SQLITE_NOMEM; }
    std::ptr::write_bytes(inner.cast::<u8>(), 0, (*ctx.underlying).szOsFile as usize);
    let mut actual_flags = 0;
    let result = match (*ctx.underlying).xOpen {
        Some(call) => call(ctx.underlying, name, inner, flags & !ffi::SQLITE_OPEN_CREATE, &mut actual_flags),
        None => ffi::SQLITE_CANTOPEN,
    };
    let valid = result == ffi::SQLITE_OK
        && actual_flags & ffi::SQLITE_OPEN_READWRITE != 0
        && actual_flags & ffi::SQLITE_OPEN_READONLY == 0
        && !(*inner).pMethods.is_null() && {
        let mut handle: HANDLE = std::ptr::null_mut();
        let methods = &*(*inner).pMethods;
        methods.xFileControl.is_some_and(|call| call(inner, ffi::SQLITE_FCNTL_WIN32_GET_HANDLE,
            (&mut handle as *mut HANDLE).cast()) == ffi::SQLITE_OK) &&
            catch_unwind(AssertUnwindSafe(|| ctx.admission.validate(kind, handle))).unwrap_or(false)
    };
    if !valid {
        if !(*inner).pMethods.is_null() {
            if let Some(close) = (*(*inner).pMethods).xClose { close(inner); }
        }
        ffi::sqlite3_free(inner.cast()); slot.store(false, Ordering::Release);
        let refusal = refuse(ctx);
        return if result != ffi::SQLITE_OK { result } else { refusal };
    }
    output.cast::<io::File>().write(io::File { base: ffi::sqlite3_file { pMethods: &io::METHODS },
        inner, ctx, kind });
    if !out_flags.is_null() { *out_flags = actual_flags; }
    ffi::SQLITE_OK
} }
unsafe extern "C" fn delete(vfs: *mut ffi::sqlite3_vfs, _: *const c_char, _: c_int) -> c_int { unsafe { refuse(context(vfs)) } }
unsafe extern "C" fn access(vfs: *mut ffi::sqlite3_vfs, name: *const c_char, flags: c_int, out: *mut c_int) -> c_int { unsafe {
    let ctx = context(vfs);
    // SQLite checks an absent rollback journal during WAL reopen. Report absent
    // only for that exact sibling; never open/create it or probe another path.
    let main = ctx.paths[0].to_bytes();
    let input = if name.is_null() { &[][..] } else { CStr::from_ptr(name).to_bytes() };
    if input.len() == main.len() + 8 && input.starts_with(main) && input.ends_with(b"-journal") {
        *out = 0; return ffi::SQLITE_OK;
    }
    if classify(ctx, name).is_none() { return refuse(ctx); }
    (*ctx.underlying).xAccess.map_or(ffi::SQLITE_IOERR_ACCESS, |call| call(ctx.underlying, name, flags, out))
} }
unsafe extern "C" fn full_path(vfs: *mut ffi::sqlite3_vfs, name: *const c_char, capacity: c_int, out: *mut c_char) -> c_int { unsafe {
    let ctx = context(vfs);
    if classify(ctx, name) != Some(Object::Main) { return refuse(ctx); }
    let bytes = CStr::from_ptr(name).to_bytes_with_nul();
    if capacity < 0 || bytes.len() > capacity as usize { return ffi::SQLITE_CANTOPEN; }
    std::ptr::copy_nonoverlapping(bytes.as_ptr().cast(), out, bytes.len()); ffi::SQLITE_OK
} }
unsafe extern "C" fn random(v: *mut ffi::sqlite3_vfs, n: c_int, out: *mut c_char) -> c_int { unsafe {
    let u = context(v).underlying; (*u).xRandomness.map_or(0, |f| f(u,n,out))
} }
unsafe extern "C" fn sleep(v: *mut ffi::sqlite3_vfs, n: c_int) -> c_int { unsafe {
    let u = context(v).underlying; (*u).xSleep.map_or(0, |f| f(u,n))
} }
unsafe extern "C" fn time(v: *mut ffi::sqlite3_vfs, out: *mut f64) -> c_int { unsafe {
    let u = context(v).underlying; (*u).xCurrentTime.map_or(ffi::SQLITE_ERROR, |f| f(u,out))
} }
unsafe extern "C" fn time64(v: *mut ffi::sqlite3_vfs, out: *mut i64) -> c_int { unsafe {
    let u = context(v).underlying; (*u).xCurrentTimeInt64.map_or(ffi::SQLITE_ERROR, |f| f(u,out))
} }
unsafe extern "C" fn last_error(v: *mut ffi::sqlite3_vfs, n: c_int, out: *mut c_char) -> c_int { unsafe {
    let u = context(v).underlying; (*u).xGetLastError.map_or(0, |f| f(u,n,out))
} }
