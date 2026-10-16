use super::*;

#[test]
fn read_only_local_journal_reports_acl_unavailable_without_losing_target_tail() {
    let (_directory, mut store, mut receiver, folder) = setup();
    let id = operation(run(
        &mut receiver,
        &mut store,
        Request::Create(upload(51, b"journal-tail")),
    ))
    .id;
    store.conn.execute_batch("PRAGMA query_only=ON").unwrap();
    assert!(matches!(
        run(
            &mut receiver,
            &mut store,
            Request::Chunk {
                id: id.clone(),
                offset: 0,
                bytes: b"journal-tail".to_vec(),
            }
        ),
        Err(Error::AclUnavailable)
    ));
    let path = peer_folder(&folder).join(temp_name(&id));
    assert_eq!(fs::read(&path).unwrap(), b"journal-tail");
    assert_eq!(
        operation(run(
            &mut receiver,
            &mut store,
            Request::Status { id: id.clone() }
        ))
        .offset,
        0
    );
    store.conn.execute_batch("PRAGMA query_only=OFF").unwrap();
    assert_eq!(
        operation(run(
            &mut receiver,
            &mut store,
            Request::Chunk {
                id,
                offset: 0,
                bytes: b"journal-tail".to_vec(),
            }
        ))
        .offset,
        12
    );
    assert_eq!(fs::read(path).unwrap(), b"journal-tail");
}

#[test]
fn actual_sqlite_full_and_read_only_are_metadata_errors_not_target_storage_errors() {
    let directory = Directory::new();
    let path = directory.path().join("bounded-metadata.sqlite3");
    let conn = rusqlite::Connection::open(&path).unwrap();
    conn.execute_batch(
        "PRAGMA page_size=512; CREATE TABLE quota(bytes BLOB); PRAGMA max_page_count=2;",
    )
    .unwrap();
    let full = conn
        .execute("INSERT INTO quota(bytes) VALUES(zeroblob(8192))", [])
        .unwrap_err();
    assert!(
        matches!(&full, rusqlite::Error::SqliteFailure(code, _) if code.code == rusqlite::ErrorCode::DiskFull)
    );
    assert_eq!(rows::storage(full), Error::AclUnavailable);
    drop(conn);
    let conn =
        rusqlite::Connection::open_with_flags(&path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
            .unwrap();
    let read_only = conn
        .execute("INSERT INTO quota(bytes) VALUES(x'01')", [])
        .unwrap_err();
    assert!(
        matches!(&read_only, rusqlite::Error::SqliteFailure(code, _) if code.code == rusqlite::ErrorCode::ReadOnly)
    );
    assert_eq!(rows::storage(read_only), Error::AclUnavailable);
    assert_eq!(
        io_error(std::io::Error::from(std::io::ErrorKind::StorageFull)),
        Error::BackupFull
    );
    assert_eq!(
        io_error(std::io::Error::from(std::io::ErrorKind::PermissionDenied)),
        Error::BackupPermissionDenied
    );
    assert_eq!(
        io_error(std::io::Error::from(std::io::ErrorKind::WouldBlock)),
        Error::BackupBusy
    );
}
