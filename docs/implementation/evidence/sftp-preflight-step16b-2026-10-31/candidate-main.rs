use russh::{
    client,
    keys::PublicKeyOrCertificate,
    keys::{
        HashAlg,
        ssh_key::{Algorithm, Fingerprint},
    },
};
use russh_sftp::{
    client::{Config, RawSftpSession},
    protocol::{FileAttributes, OpenFlags, Status, StatusCode},
};
use sha2::{Digest, Sha256};
use std::{
    borrow::Cow,
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};
type Result<T> = std::result::Result<T, Box<dyn std::error::Error + Send + Sync>>;
struct Pin {
    expected: Fingerprint,
    admitted: Arc<AtomicBool>,
    seen: Arc<AtomicBool>,
}
impl client::Handler for Pin {
    type Error = russh::Error;
    async fn check_server_key(
        &mut self,
        key: &PublicKeyOrCertificate,
    ) -> std::result::Result<bool, Self::Error> {
        self.seen.store(true, Ordering::SeqCst);
        let valid = matches!(key, PublicKeyOrCertificate::PublicKey { key, .. } if key.fingerprint(HashAlg::Sha256) == self.expected);
        self.admitted.store(valid, Ordering::SeqCst);
        Ok(valid)
    }
}
fn ack(status: Status) {
    assert_eq!(status.status_code, StatusCode::Ok);
}
async fn session(
    pin: &str,
    flag: Arc<AtomicBool>,
    seen: Arc<AtomicBool>,
) -> Result<client::Handle<Pin>> {
    let expected: Fingerprint = pin.parse()?;
    if !matches!(expected, Fingerprint::Sha256(_)) {
        return Err("only independent SHA256 pin allowed".into());
    }
    let mut config = client::Config::default();
    config.preferred.key = Cow::Owned(vec![Algorithm::Ed25519]);
    config.inactivity_timeout = Some(Duration::from_secs(10));
    let stream = tokio::net::TcpStream::connect("127.0.0.1:27448").await?;
    Ok(client::connect_stream(
        Arc::new(config),
        stream,
        Pin {
            expected,
            admitted: flag,
            seen,
        },
    )
    .await?)
}
async fn run() -> Result<()> {
    let pin = std::env::args()
        .nth(1)
        .ok_or("independent fixture fingerprint missing")?;
    let blocked = Arc::new(AtomicBool::new(false));
    let seen = Arc::new(AtomicBool::new(false));
    assert!(session("", blocked.clone(), seen.clone()).await.is_err());
    assert!(
        session(
            "SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            blocked.clone(),
            seen.clone()
        )
        .await
        .is_err()
    );
    assert!(seen.load(Ordering::SeqCst) && !blocked.load(Ordering::SeqCst));
    println!("PASS missing/changed pin: no password authentication invoked");
    let admitted = Arc::new(AtomicBool::new(false));
    let mut ssh = session(&pin, admitted.clone(), Arc::new(AtomicBool::new(false))).await?;
    assert!(admitted.load(Ordering::SeqCst));
    assert!(
        ssh.authenticate_password("owned-sftp", "owned-disposable-fixture")
            .await?
            .success()
    );
    let channel = ssh.channel_open_session().await?;
    channel.request_subsystem(true, "sftp").await?;
    let sftp = RawSftpSession::new_with_config(
        channel.into_stream(),
        Config {
            max_packet_len: 131072,
            max_concurrent_reads: 1,
            max_concurrent_writes: 1,
            max_write_packet_len: 32768,
            request_timeout_secs: 5,
        },
    );
    let version = sftp.init().await?;
    assert_eq!(version.version, 3);
    assert_eq!(
        version
            .extensions
            .get("fsync@openssh.com")
            .map(String::as_str),
        Some("1")
    );
    let unique = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_nanos();
    let temp = format!("/home/owned-sftp/owned-{unique}.part");
    let final_path = format!("/home/owned-sftp/owned-{unique}.bin");
    let flags = OpenFlags::CREATE | OpenFlags::EXCLUDE | OpenFlags::WRITE;
    let bytes: Vec<u8> = (0..131073).map(|i| (i % 251) as u8).collect();
    let file = sftp.open(&temp, flags, FileAttributes::empty()).await?;
    for (i, chunk) in bytes.chunks(32768).enumerate() {
        ack(sftp
            .write(&file.handle, (i * 32768) as u64, chunk.to_vec())
            .await?);
    }
    ack(sftp.fsync(&file.handle).await?);
    ack(sftp.close(file.handle).await?);
    assert!(
        sftp.open(&temp, flags, FileAttributes::empty())
            .await
            .is_err()
    );
    ack(sftp.rename(&temp, &final_path).await?);
    let other = format!("/home/owned-sftp/owned-{unique}-collision.part");
    let file = sftp.open(&other, flags, FileAttributes::empty()).await?;
    ack(sftp
        .write(&file.handle, 0, b"foreign-fixture-sentinel".to_vec())
        .await?);
    ack(sftp.fsync(&file.handle).await?);
    ack(sftp.close(file.handle).await?);
    assert!(sftp.rename(&other, &final_path).await.is_err());
    let read = sftp
        .open(&final_path, OpenFlags::READ, FileAttributes::empty())
        .await?;
    let mut actual = Vec::new();
    while actual.len() < bytes.len() {
        let data = sftp
            .read(&read.handle, actual.len() as u64, 32768)
            .await?
            .data;
        assert!(
            !data.is_empty() && data.len() <= 32768 && actual.len() + data.len() <= bytes.len()
        );
        actual.extend(data);
    }
    assert!(
        sftp.read(&read.handle, bytes.len() as u64, 1)
            .await
            .is_err()
    );
    ack(sftp.close(read.handle).await?);
    assert_eq!(actual, bytes);
    assert_eq!(Sha256::digest(&actual), Sha256::digest(&bytes));
    println!(
        "PASS pinned password + SFTPv3: exclusive create, bounded WRITE ACKs, explicit fsync ACK, CLOSE ACK, no-overwrite rename/collision, fresh read size/bytes/SHA256"
    );
    sftp.close_session()?;
    ssh.disconnect(russh::Disconnect::ByApplication, "owned fixture done", "en")
        .await?;
    Ok(())
}
#[tokio::main]
async fn main() -> Result<()> {
    tokio::time::timeout(Duration::from_secs(45), run()).await?
}
