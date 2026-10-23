//! Ignored disposable Windows runtime; explicit separate authorization required.
//! No KnownFolder, production owner, authority, TPM or user data is accessed.
use super::*;
use crate::state::test_support::Directory;
use std::fs::{File, OpenOptions};
use std::os::windows::fs::OpenOptionsExt;
use std::os::windows::io::AsRawHandle;
use std::path::Path;
use std::sync::atomic::AtomicUsize;
use windows_sys::Win32::Storage::FileSystem::{
    GetFileInformationByHandleEx, FileIdInfo, FILE_ID_INFO, FILE_SHARE_READ, FILE_SHARE_WRITE,
};

fn identity(handle: HANDLE) -> Option<(u64, [u8; 16])> {
    let mut info: FILE_ID_INFO = unsafe { std::mem::zeroed() };
    let result = unsafe { GetFileInformationByHandleEx(handle, FileIdInfo,
        (&mut info as *mut FILE_ID_INFO).cast(), std::mem::size_of::<FILE_ID_INFO>() as u32) };
    (result != 0).then_some((info.VolumeSerialNumber, info.FileId.Identifier))
}
fn pin(path: &Path) -> File {
    OpenOptions::new().read(true).share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE).open(path).unwrap()
}
struct TestAdmission {
    paths: [CString; 2],
    pins: [Option<File>; 2],
    claimed: AtomicBool,
    validated: [AtomicUsize; 2],
    reject_main: bool,
}
impl Admission for TestAdmission {
    fn claim_connection(&self) -> bool { !self.claimed.swap(true, Ordering::AcqRel) }
    fn path(&self, kind: Object) -> &CStr { &self.paths[usize::from(kind == Object::Wal)] }
    fn validate(&self, kind: Object, actual: HANDLE) -> bool {
        let i = usize::from(kind == Object::Wal);
        self.validated[i].fetch_add(1, Ordering::Relaxed);
        if self.reject_main && kind == Object::Main { return false; }
        self.pins[i].as_ref().is_some_and(|expected| {
            let expected = identity(expected.as_raw_handle());
            expected.is_some() && identity(actual) == expected
        })
    }
}
fn seed(directory: &Directory) {
    let db = directory.path().join("pairing.sqlite3");
    let conn = Connection::open(&db).unwrap();
    let mode: String = conn.query_row("PRAGMA locking_mode=EXCLUSIVE", [], |r| r.get(0)).unwrap();
    assert_eq!(mode, "exclusive");
    let mut persist: c_int = 1;
    let result = unsafe { ffi::sqlite3_file_control(conn.handle(), c"main".as_ptr(),
        ffi::SQLITE_FCNTL_PERSIST_WAL, (&mut persist as *mut c_int).cast()) };
    assert_eq!(result, ffi::SQLITE_OK);
    let wal: String = conn.query_row("PRAGMA journal_mode=WAL", [], |r| r.get(0)).unwrap();
    assert_eq!(wal, "wal");
    conn.execute_batch("PRAGMA synchronous=FULL; CREATE TABLE synthetic(value INTEGER NOT NULL);
        INSERT INTO synthetic VALUES(7);").unwrap();
    conn.close().unwrap();
    assert!(directory.path().join("pairing.sqlite3-wal").is_file());
    assert!(!directory.path().join("pairing.sqlite3-shm").exists());
}
fn admission(directory: &Directory, reject_main: bool, missing_wal: bool) -> Arc<TestAdmission> {
    let paths = [directory.path().join("pairing.sqlite3"), directory.path().join("pairing.sqlite3-wal")];
    Arc::new(TestAdmission {
        paths: paths.each_ref().map(|path| CString::new(path.to_str().unwrap()).unwrap()),
        pins: [Some(pin(&paths[0])), if missing_wal { None } else { Some(pin(&paths[1])) }],
        claimed: AtomicBool::new(false), validated: [AtomicUsize::new(0), AtomicUsize::new(0)], reject_main,
    })
}
#[test]
#[ignore = "explicit disposable Windows native VFS runtime authorization required"]
fn disposable_existing_wal_validates_both_handles_and_single_connection() {
    let directory = Directory::new();
    seed(&directory);
    let admission = admission(&directory, false, false);
    let mut conn = open(admission.clone()).unwrap();
    assert_eq!(conn.connection().unwrap().query_row("SELECT value FROM synthetic", [], |r| r.get::<_, i64>(0)).unwrap(), 7);
    conn.connection().unwrap().execute("INSERT INTO synthetic VALUES(8)", []).unwrap();
    conn.healthy().unwrap();
    assert_eq!(admission.validated[0].load(Ordering::Relaxed), 1);
    assert!(admission.validated[1].load(Ordering::Relaxed) >= 1);
    assert!(open(admission.clone()).is_err());
    assert!(!directory.path().join("pairing.sqlite3-shm").exists());
    drop(conn);
    assert!(directory.path().join("pairing.sqlite3-wal").exists());
    drop(admission);
}
#[test]
#[ignore = "explicit disposable Windows native VFS runtime authorization required"]
fn disposable_rejected_main_handle_never_admits_sql() {
    let directory = Directory::new();
    seed(&directory);
    let before = std::fs::read(directory.path().join("pairing.sqlite3")).unwrap();
    let admission = admission(&directory, true, false);
    assert!(open(admission.clone()).is_err());
    assert_eq!(admission.validated[0].load(Ordering::Relaxed), 1);
    assert_eq!(admission.validated[1].load(Ordering::Relaxed), 0);
    assert_eq!(std::fs::read(directory.path().join("pairing.sqlite3")).unwrap(), before);
    drop(admission);
}
#[test]
#[ignore = "explicit disposable Windows native VFS runtime authorization required"]
fn disposable_missing_wal_is_not_recreated() {
    let directory = Directory::new();
    seed(&directory);
    let wal = directory.path().join("pairing.sqlite3-wal");
    // Deliberately remove only this fixture's generated sidecar, before pinning.
    std::fs::remove_file(&wal).unwrap();
    let admission = admission(&directory, false, true);
    match open(admission.clone()) {
        Err(_) => {},
        Ok(mut conn) => {
            assert!(conn.connection().unwrap().query_row("SELECT value FROM synthetic", [], |r| r.get::<_, i64>(0)).is_err());
        }
    }
    assert!(!wal.exists());
    drop(admission);
}
