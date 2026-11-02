use kloda_storage_native::{
    NegotiatedSmb,
    publication::{Ack, NativeReceipt, Publication, PublishError, publish},
};
use sha2::{Digest, Sha256};
use smb2::client::Tree;
use std::{
    fs::{File, OpenOptions},
    io::Write,
    net::TcpStream,
    os::{fd::IntoRawFd, unix::fs::OpenOptionsExt},
    sync::Arc,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;

struct Receipt {
    file: File,
    events: Vec<Ack>,
    fence: Option<Ack>,
    fail_record: Option<Ack>,
}
impl NativeReceipt for Receipt {
    fn admit(&mut self) -> std::result::Result<(), PublishError> {
        if self.fence.is_some_and(|a| self.events.contains(&a)) {
            Err(PublishError::Admission)
        } else {
            Ok(())
        }
    }
    fn record(&mut self, ack: Ack) -> std::result::Result<(), PublishError> {
        if self.fail_record == Some(ack) {
            return Err(PublishError::Journal);
        }
        writeln!(self.file, "{ack:?}")?;
        self.file.sync_all()?;
        self.events.push(ack);
        Ok(())
    }
}
fn new_file(path: &std::path::Path) -> std::io::Result<File> {
    OpenOptions::new()
        .read(true)
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(path)
}
#[test]
#[ignore = "requires the recorded owned loopback Samba fixture"]
fn owned_publication() -> Result<()> {
    assert_eq!(
        std::env::var("KLODA_SMB16_FIXTURE").as_deref(),
        Ok("owned-loopback")
    );
    let unique = SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos();
    let local = std::env::temp_dir().join(format!("kloda-smb-publication-{unique}"));
    std::fs::create_dir(&local)?;
    let bytes: Vec<u8> = (0..1048576).map(|n| (n % 251) as u8).collect();
    let hash: [u8; 32] = Sha256::digest(&bytes).into();
    let source = local.join("snapshot");
    {
        let mut file = new_file(&source)?;
        file.write_all(&bytes)?;
        file.sync_all()?;
    }
    tokio::runtime::Builder::new_current_thread().enable_all().build()?.block_on(async {
        let address = "127.0.0.1:27445".parse()?;
        let stream = tokio::net::TcpStream::connect(address).await?;
        let pending = NegotiatedSmb::from_stream(stream, address, Duration::from_secs(5)).await?;
        let mut conn = pending.authenticate("owned", "owned-disposable-fixture", "").await?;
        let tree = Arc::new(Tree::connect(&mut conn, "owned").await?);
        for case in 0..8 {
            let operation_id = format!("{:08x}-0000-4000-8000-{:012x}", (unique >> 32) as u32, (unique as u64 + case) & 0xffffffffffff);
            let final_path = match case {
                0 => format!("publish-owned-{unique}/nested/payload.bin"),
                7 => format!("publish-owned-{unique}-parent-file/child.bin"),
                _ => format!("publish-owned-{unique}-{case}.bin"),
            };
            let mut job = Publication { operation_id: &operation_id, final_path: &final_path, size: bytes.len() as u64, sha256: hash };
            let mut receipt = Receipt { file: new_file(&local.join(format!("receipt-{case}")))?, events: vec![],
                fence: match case { 1 => Some(Ack::Created), 2 => Some(Ack::Renamed), _ => None },
                fail_record: if case == 3 { Some(Ack::Renamed) } else { None } };
            if case == 4 { job.sha256 = [0; 32]; }
            if case == 5 { tree.write_file_compound_exclusive(&mut conn, &final_path, b"foreign").await?; }
            if case == 7 { tree.write_file_compound_exclusive(&mut conn, &format!("publish-owned-{unique}-parent-file"), b"foreign").await?; }
            if case == 6 { job.size = 0; job.sha256 = Sha256::digest([]).into(); }
            let mut snapshot = if case == 6 { new_file(&local.join("empty"))? } else { File::open(&source)? };
            let result = publish(&mut conn, tree.clone(), &mut snapshot, &job, &mut receipt).await;
            match case {
                0 | 6 => {
                    result?;
                    assert_eq!(receipt.events, [Ack::Created, Ack::DataFlushed(job.size), Ack::Closed, Ack::Renamed, Ack::BytesVerified]);
                    assert_eq!(std::fs::read_to_string(local.join(format!("receipt-{case}")))?, format!("Created\nDataFlushed({})\nClosed\nRenamed\nBytesVerified\n", job.size));
                }
                1 => { assert!(matches!(result, Err(PublishError::Admission))); assert_eq!(receipt.events, [Ack::Created]); }
                2 => { assert!(matches!(result, Err(PublishError::Admission))); assert_eq!(receipt.events.last(), Some(&Ack::Renamed)); }
                3 => { assert!(matches!(result, Err(PublishError::Journal))); assert_eq!(receipt.events.last(), Some(&Ack::Closed)); }
                4 => { assert!(matches!(result, Err(PublishError::SnapshotChanged))); assert_eq!(receipt.events, [Ack::Created]); }
                5 => {
                    assert!(matches!(result, Err(PublishError::Wire(_))));
                    assert_eq!(receipt.events.last(), Some(&Ack::Closed));
                    assert_eq!(tree.read_file_compound_sized(&mut conn, &final_path, 7).await?, b"foreign");
                }
                7 => {
                    assert!(matches!(result, Err(PublishError::InvalidInput)));
                    assert!(receipt.events.is_empty());
                    assert_eq!(tree.read_file_compound_sized(&mut conn, &format!("publish-owned-{unique}-parent-file"), 7).await?, b"foreign");
                }
                _ => unreachable!(),
            }
            if matches!(case, 0 | 2 | 3 | 6) {
                let expected = if case == 6 { &[][..] } else { &bytes[..] };
                assert_eq!(tree.read_file_compound_sized(&mut conn, &final_path, job.size).await?, expected);
                let before = receipt.events.clone();
                receipt.fence = None; receipt.fail_record = None;
                assert!(publish(&mut conn, tree.clone(), &mut snapshot, &job, &mut receipt).await.is_err());
                assert!(!receipt.events[before.len()..].contains(&Ack::BytesVerified), "never adopt an existing hash-equal final");
            }
            println!("PASS publication case {case}: durable observed ACKs, conservative failure/retry");
        }
        tree.disconnect(&mut conn).await?;
        Ok::<(), Box<dyn std::error::Error>>(())
    })?;
    unsafe extern "C" fn admitted(_: *mut std::ffi::c_void, event: i32, _: u64) -> i32 {
        if event == 0 { 0 } else { 1 }
    }
    unsafe extern "C" fn cancelled(_: *mut std::ffi::c_void, _: i32, _: u64) -> i32 {
        1
    }
    for case in 0..5 {
        let path = local.join(format!("read-stage-{case}"));
        let output = new_file(&path)?;
        let socket = TcpStream::connect("127.0.0.1:27445")?;
        let mut expected = hash;
        if case == 1 {
            expected = [0; 32];
        }
        let request = serde_json::json!({"address":"127.0.0.1", "port":27445, "share":"owned", "username":"owned",
            "password":"owned-disposable-fixture", "domain":"", "operationId":"11111111-1111-4111-8111-111111111111",
            "finalPath":if case == 4 { format!("publish-owned-{unique}/nested") } else { format!("publish-owned-{unique}/nested/payload.bin") },
            "size":if case == 2 { "1".to_owned() } else { bytes.len().to_string() }, "sha256":expected.to_vec(), "responseTimeoutMs":5000});
        let json = serde_json::to_vec(&request)?;
        let result = unsafe {
            kloda_storage_native::read_bound::kloda_smb_read_bound(
                json.as_ptr(),
                json.len(),
                output.into_raw_fd(),
                socket.into_raw_fd(),
                Some(if case == 3 { cancelled } else { admitted }),
                std::ptr::null_mut(),
            )
        };
        assert_eq!(
            result,
            match case {
                0 => 0,
                3 => 4,
                _ => 7,
            }
        );
        if case == 0 {
            assert_eq!(std::fs::read(&path)?, bytes);
        }
        if matches!(case, 2..=4) {
            assert_eq!(std::fs::metadata(&path)?.len(), 0);
        }
        println!(
            "PASS read-only case {case}: bounded stage verification/refusal; no remote mutation or adoption"
        );
    }
    // Only this invocation's newly created local files. Remote fixture layers are retained.
    std::fs::remove_dir_all(local)?;
    Ok(())
}
