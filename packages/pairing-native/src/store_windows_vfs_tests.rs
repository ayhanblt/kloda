//! Pure callbacks only: no SQLite connection, Windows handle, file or VFS open.
use super::*;

struct Fake;
impl Admission for Fake {
    fn claim_connection(&self) -> bool { false }
    fn path(&self, kind: Object) -> &CStr {
        if kind == Object::Main { c"synthetic.sqlite3" } else { c"synthetic.sqlite3-wal" }
    }
    fn validate(&self, _: Object, _: HANDLE) -> bool { panic!("no real handle admission") }
}
fn context_for_test() -> Box<Context> {
    Box::new(Context { underlying: std::ptr::null_mut(), admission: Arc::new(Fake),
        paths: [c"synthetic.sqlite3".to_owned(), c"synthetic.sqlite3-wal".to_owned()],
        main_open: AtomicBool::new(false), wal_open: AtomicBool::new(false),
        poisoned: AtomicBool::new(false) })
}
#[test]
fn names_and_connection_admission_refuse_without_native_calls() {
    let ctx = context_for_test();
    unsafe {
        assert!(classify(&ctx, c"synthetic.sqlite3".as_ptr()) == Some(Object::Main));
        assert!(classify(&ctx, c"synthetic.sqlite3-wal".as_ptr()) == Some(Object::Wal));
        for name in [c"synthetic.sqlite3-shm", c"synthetic.sqlite3-journal", c"../synthetic.sqlite3", c"other"] {
            assert!(classify(&ctx, name.as_ptr()).is_none());
        }
        assert!(classify(&ctx, std::ptr::null()).is_none());
    }
    assert!(open(Arc::new(Fake)).is_err());
}
#[test]
fn unexpected_shm_poison_is_sticky_before_any_delegate() {
    let ctx = context_for_test();
    let mut file = io::File { base: ffi::sqlite3_file { pMethods: &io::METHODS },
        inner: std::ptr::null_mut(), ctx: &*ctx, kind: Object::Main };
    unsafe {
        let p = (&mut file as *mut io::File).cast();
        let mut output = std::ptr::dangling_mut::<c_void>();
        assert_ne!(io::METHODS.xShmMap.unwrap()(p, 0, 32768, 1, &mut output), ffi::SQLITE_OK);
        assert!(output.is_null());
        assert!(ctx.poisoned.load(Ordering::Acquire));
        // Null delegate proves no read/write forwarding happens after refusal.
        assert_ne!(io::METHODS.xRead.unwrap()(p, std::ptr::null_mut(), 0, 0), ffi::SQLITE_OK);
        assert_ne!(io::METHODS.xWrite.unwrap()(p, std::ptr::null(), 0, 0), ffi::SQLITE_OK);
        assert_eq!(io::METHODS.xSectorSize.unwrap()(p), 512);
        assert_eq!(io::METHODS.xDeviceCharacteristics.unwrap()(p), 0);
    }
}
#[test]
fn normal_locking_or_non_wal_mode_is_refused_before_delegate() {
    for (name, value) in [(c"locking_mode", c"NORMAL"), (c"journal_mode", c"DELETE")] {
        let ctx = context_for_test();
        let mut file = io::File { base: ffi::sqlite3_file { pMethods: &io::METHODS },
            inner: std::ptr::null_mut(), ctx: &*ctx, kind: Object::Main };
        let mut args = [std::ptr::null(), name.as_ptr(), value.as_ptr()];
        unsafe {
            assert_ne!(io::METHODS.xFileControl.unwrap()(
                (&mut file as *mut io::File).cast(), ffi::SQLITE_FCNTL_PRAGMA,
                args.as_mut_ptr().cast(),
            ), ffi::SQLITE_OK);
        }
        assert!(ctx.poisoned.load(Ordering::Acquire));
    }
}
