//! Explicitly authorized disposable runtime only; never opens a real namespace.
use super::*;
use crate::state::test_support::Directory;

fn fixture_file(directory: &Directory) -> PathBuf {
    let file = directory.path().join("disposable-lease.bin");
    let created = handles::open(
        &file,
        GENERIC_READ | GENERIC_WRITE,
        FILE_SHARE_NONE,
        CREATE_NEW,
        false,
        true,
    )
    .unwrap()
    .unwrap();
    assert_eq!(created.metadata().unwrap().len(), 0);
    drop(created);
    file
}

#[test]
#[ignore = "D3 disposable native runtime needs explicit authorization"]
fn exclusive_existing_lock_refuses_concurrent_open_until_release() {
    let directory = Directory::new();
    let file = fixture_file(&directory);
    let first = lock(&file).unwrap();
    assert!(matches!(lock(&file), Err(PairingError::StorageFailure)));
    drop(first);
    let reopened = lock(&file).unwrap();
    assert_eq!(reopened.metadata().unwrap().len(), 0);
}

#[test]
#[ignore = "D3 disposable native runtime needs explicit authorization"]
fn owner_arc_retains_original_lock_until_last_clone_drops() {
    let directory = Directory::new();
    let file = fixture_file(&directory);
    let owner = OwnerLock {
        directory: directory.path().to_path_buf(),
        _pins: Arc::new(OwnerPins {
            _owner: lock(&file).unwrap(),
            _ancestors: Vec::new(),
            _generation: None,
        }),
    };
    let retained = owner.clone();
    drop(owner);
    assert!(matches!(lock(&file), Err(PairingError::StorageFailure)));
    drop(retained);
    let reopened = lock(&file).unwrap();
    assert_eq!(reopened.metadata().unwrap().len(), 0);
}
