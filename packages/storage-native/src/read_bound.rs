//! Verified read into a newly created private stage; never remote mutation/adoption.
use crate::{
    NegotiatedSmb,
    bridge::{Receipt, ReceiptCallback, Request, result_code},
    publication::{NativeReceipt, Publication, PublishError},
};
use sha2::{Digest, Sha256};
use smb2::client::Tree;
use std::{
    ffi::c_void,
    fs::File,
    io::{Seek, SeekFrom, Write},
    net::TcpStream,
    os::{fd::FromRawFd, unix::fs::MetadataExt},
    panic::{AssertUnwindSafe, catch_unwind},
    time::Duration,
};

/// Uses the publication request shape, but performs only a bounded verified read.
/// Event0 is current native read/restore admission. Return0 proves stage bytes only.
///
/// # Safety
/// Buffer/callback/context rules match publish_bound. Both nonnegative FDs must be
/// valid exclusive transfers and are consumed on every return, including alias/error.
/// Output is a freshly created private empty regular file, never a user destination.
/// Other socket duplicates remain native-owned without concurrent socket I/O.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn kloda_smb_read_bound(
    json: *const u8,
    length: usize,
    output_fd: i32,
    socket_fd: i32,
    callback: Option<ReceiptCallback>,
    context: *mut c_void,
) -> i32 {
    if output_fd == socket_fd {
        if output_fd >= 0 {
            drop(unsafe { File::from_raw_fd(output_fd) });
        }
        return 1;
    }
    let output = (output_fd >= 0).then(|| unsafe { File::from_raw_fd(output_fd) });
    let socket = (socket_fd >= 0).then(|| unsafe { TcpStream::from_raw_fd(socket_fd) });
    let (Some(mut output), Some(socket)) = (output, socket) else {
        return 1;
    };
    result_code(catch_unwind(AssertUnwindSafe(
        || -> Result<(), PublishError> {
            if json.is_null() || length == 0 || length > 16384 {
                return Err(PublishError::InvalidInput);
            }
            let request: Request =
                serde_json::from_slice(unsafe { std::slice::from_raw_parts(json, length) })
                    .map_err(|_| PublishError::InvalidInput)?;
            let size = request.size()?;
            Publication {
                operation_id: &request.operation_id,
                final_path: &request.final_path,
                size,
                sha256: request.sha256,
            }
            .staged_path()?;
            let info = output.metadata()?;
            if !info.is_file()
                || info.len() != 0
                || info.nlink() != 1
                || info.mode() & 0o077 != 0
                || info.mode() & 0o200 == 0
            {
                return Err(PublishError::InvalidInput);
            }
            output.seek(SeekFrom::Start(0))?;
            let mut receipt = Receipt {
                callback: callback.ok_or(PublishError::InvalidInput)?,
                context,
            };
            receipt.admit()?;
            tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()?
                .block_on(async {
                    socket.set_nonblocking(true)?;
                    let stream = tokio::net::TcpStream::from_std(socket)?;
                    let address = (request.address, request.port).into();
                    let pending = NegotiatedSmb::from_stream(
                        stream,
                        address,
                        Duration::from_millis(request.response_timeout_ms.into()),
                    )
                    .await?;
                    receipt.admit()?;
                    let mut conn = pending
                        .authenticate(&request.username, &request.password, &request.domain)
                        .await?;
                    receipt.admit()?;
                    let tree = std::sync::Arc::new(Tree::connect(&mut conn, &request.share).await?);
                    for (end, _) in request.final_path.match_indices('/') {
                        receipt.admit()?;
                        let parent = tree.stat(&mut conn, &request.final_path[..end]).await?;
                        if !parent.is_directory
                            || parent.attributes.0 & smb2::FileAttributes::REPARSE_POINT != 0
                        {
                            return Err(PublishError::InvalidInput);
                        }
                    }
                    receipt.admit()?;
                    let info = tree.stat(&mut conn, &request.final_path).await?;
                    if info.is_directory
                        || info.size != size
                        || info.attributes.0 & smb2::FileAttributes::REPARSE_POINT != 0
                    {
                        return Err(PublishError::VerificationFailed);
                    }
                    let reader = tree
                        .open_file_reader(conn.clone(), &request.final_path)
                        .await?;
                    if reader.info().is_directory || reader.size() != size {
                        return Err(PublishError::VerificationFailed);
                    }
                    let mut hash = Sha256::new();
                    let mut offset = 0;
                    while offset < size {
                        receipt.admit()?;
                        let length = (size - offset).min(65536);
                        let bytes = reader.read_at(offset, length).await?;
                        if bytes.len() as u64 != length {
                            return Err(PublishError::VerificationFailed);
                        }
                        output.write_all(&bytes)?;
                        hash.update(&bytes);
                        offset += length;
                    }
                    reader.close().await?;
                    if hash.finalize().as_slice() != request.sha256 {
                        return Err(PublishError::VerificationFailed);
                    }
                    output.sync_all()?;
                    receipt.admit()?;
                    Ok(())
                })
        },
    )))
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::{io::Read, net::TcpListener, os::fd::IntoRawFd, os::unix::fs::OpenOptionsExt};
    unsafe extern "C" fn refuse(_: *mut c_void, _: i32, _: u64) -> i32 {
        1
    }
    #[test]
    fn read_refuses_before_network_and_consumes_descriptors_without_overwrite() {
        let root = std::env::temp_dir().join(format!("kloda-smb-read-unit-{}", std::process::id()));
        std::fs::create_dir(&root).unwrap();
        for case in 0..5 {
            let listener = TcpListener::bind("127.0.0.1:0").unwrap();
            let socket = TcpStream::connect(listener.local_addr().unwrap()).unwrap();
            let (mut peer, _) = listener.accept().unwrap();
            peer.set_read_timeout(Some(Duration::from_secs(1))).unwrap();
            let path = root.join(case.to_string());
            let mut output = std::fs::OpenOptions::new()
                .read(true)
                .write(true)
                .create_new(true)
                .mode(0o600)
                .open(&path)
                .unwrap();
            if case == 3 {
                output.write_all(b"preserve").unwrap();
            }
            let request = serde_json::json!({"address":"127.0.0.1","port":27445,"share":"owned", "username":"owned",
                "password":"fictional-unit-only","domain":"", "operationId":"11111111-1111-4111-8111-111111111111",
                "finalPath":"owned.bin", "size":"0", "sha256":Sha256::digest([]).to_vec(), "responseTimeoutMs":5000});
            let data = if case == 0 {
                b"bad-json".to_vec()
            } else {
                serde_json::to_vec(&request).unwrap()
            };
            let output = output.into_raw_fd();
            let socket = socket.into_raw_fd();
            let result = unsafe {
                kloda_smb_read_bound(
                    data.as_ptr(),
                    data.len(),
                    output,
                    if case == 4 { output } else { socket },
                    if case == 2 { None } else { Some(refuse) },
                    std::ptr::null_mut(),
                )
            };
            if case == 4 {
                drop(unsafe { File::from_raw_fd(socket) });
            }
            assert_eq!(result, if case == 1 { 4 } else { 1 });
            assert_eq!(peer.read(&mut [0u8; 1]).unwrap(), 0);
            assert_eq!(
                std::fs::read(path).unwrap(),
                if case == 3 {
                    b"preserve".as_slice()
                } else {
                    b"".as_slice()
                }
            );
        }
        std::fs::remove_dir_all(root).unwrap();
    }
}
