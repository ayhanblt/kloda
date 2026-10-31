//! Wire evidence only: native owners persist ACKs and atomically decide Completed.
use crate::paths::{relative_path, source_uuid};
use sha2::{Digest, Sha256};
use smb2::client::{Connection, Tree};
use std::{
    fs::File,
    io::{Read, Seek, SeekFrom},
    sync::Arc,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Ack {
    Created,
    DataFlushed(u64),
    Closed,
    Renamed,
    BytesVerified,
}

#[derive(Debug)]
pub enum PublishError {
    InvalidInput,
    SnapshotChanged,
    VerificationFailed,
    Admission,
    Journal,
    Local(std::io::Error),
    Wire(smb2::Error),
}
impl From<std::io::Error> for PublishError {
    fn from(error: std::io::Error) -> Self {
        Self::Local(error)
    }
}
impl From<smb2::Error> for PublishError {
    fn from(error: smb2::Error) -> Self {
        Self::Wire(error)
    }
}
impl std::fmt::Display for PublishError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::InvalidInput => "invalid_publication",
            Self::SnapshotChanged => "snapshot_changed",
            Self::VerificationFailed => "verification_failed",
            Self::Admission => "admission_changed",
            Self::Journal => "receipt_write_failed",
            Self::Local(_) => "snapshot_io_failed",
            Self::Wire(_) => "smb_io_failed",
        })
    }
}
impl std::error::Error for PublishError {}

pub trait NativeReceipt {
    /// Recheck cancellation, route, source and immutable target/credential generations.
    fn admit(&mut self) -> Result<(), PublishError>;
    /// Must durably record this received ACK before returning; do not fence it away.
    fn record(&mut self, ack: Ack) -> Result<(), PublishError>;
}

pub struct Publication<'a> {
    pub operation_id: &'a str,
    pub final_path: &'a str,
    pub size: u64,
    pub sha256: [u8; 32],
}
impl Publication<'_> {
    pub(crate) fn staged_path(&self) -> Result<String, PublishError> {
        let name = self.final_path.rsplit('/').next().unwrap_or_default();
        if !source_uuid(self.operation_id)
            || self.operation_id != self.operation_id.to_ascii_lowercase()
            || !relative_path(self.final_path)
            || name.to_lowercase().starts_with(".kloda-")
            || self.size > i64::MAX as u64
        {
            return Err(PublishError::InvalidInput);
        }
        let parent = self.final_path.rsplit_once('/').map(|(p, _)| p);
        let stage = format!(".kloda-smb-{}.part", self.operation_id);
        let path = parent.map_or(stage.clone(), |p| format!("{p}/{stage}"));
        if !relative_path(&path) {
            return Err(PublishError::InvalidInput);
        }
        Ok(path)
    }
}

/// Takes a native-owned, private, immutable snapshot FD. Never reopens a source path.
/// No retry/adoption or remote cleanup: any uncertain response leaves review to its owner.
pub async fn publish(
    conn: &mut Connection,
    tree: Arc<Tree>,
    snapshot: &mut File,
    job: &Publication<'_>,
    receipt: &mut impl NativeReceipt,
) -> Result<(), PublishError> {
    let staged = job.staged_path()?;
    if !conn.should_encrypt() {
        return Err(PublishError::InvalidInput);
    }
    let info = snapshot.metadata()?;
    if !info.is_file() || info.len() != job.size {
        return Err(PublishError::SnapshotChanged);
    }
    snapshot.seek(SeekFrom::Start(0))?;
    receipt.admit()?;
    let mut writer = tree
        .create_file_writer_exclusive(conn.clone(), &staged)
        .await?;
    receipt.record(Ack::Created)?;
    let mut buffer = [0u8; 65536];
    let mut hash = Sha256::new();
    let mut total = 0u64;
    loop {
        receipt.admit()?;
        let count = snapshot.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        total = total
            .checked_add(count as u64)
            .ok_or(PublishError::SnapshotChanged)?;
        if total > job.size {
            return Err(PublishError::SnapshotChanged);
        }
        hash.update(&buffer[..count]);
        writer.write_chunk(&buffer[..count]).await?;
    }
    if total != job.size || hash.finalize().as_slice() != job.sha256 {
        return Err(PublishError::SnapshotChanged);
    }
    receipt.admit()?;
    writer.flush_checkpoint().await?;
    // flush_checkpoint confirms every full WRITE and FLUSH, not merely queued data.
    receipt.record(Ack::DataFlushed(writer.bytes_written()))?;
    if writer.bytes_written() != job.size {
        return Err(PublishError::VerificationFailed);
    }
    receipt.admit()?;
    let confirmed = writer.finish().await?;
    receipt.record(Ack::Closed)?;
    if confirmed != job.size {
        return Err(PublishError::VerificationFailed);
    }
    receipt.admit()?;
    tree.rename(conn, &staged, job.final_path).await?;
    receipt.record(Ack::Renamed)?;
    receipt.admit()?;
    let reader = tree.open_file_reader(conn.clone(), job.final_path).await?;
    if reader.size() != job.size || reader.info().is_directory {
        return Err(PublishError::VerificationFailed);
    }
    let mut hash = Sha256::new();
    let mut offset = 0u64;
    while offset < job.size {
        receipt.admit()?;
        let length = (job.size - offset).min(buffer.len() as u64);
        let bytes = reader.read_at(offset, length).await?;
        if bytes.len() as u64 != length {
            return Err(PublishError::VerificationFailed);
        }
        hash.update(&bytes);
        offset += length;
    }
    reader.close().await?;
    if hash.finalize().as_slice() != job.sha256 {
        return Err(PublishError::VerificationFailed);
    }
    receipt.admit()?;
    receipt.record(Ack::BytesVerified)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_aliases_and_separates_staging_from_final() {
        let mut job = Publication {
            operation_id: "01234567-89ab-cdef-0123-456789abcdef",
            final_path: "photos/source.png",
            size: 0,
            sha256: [0; 32],
        };
        assert_eq!(
            job.staged_path().unwrap(),
            "photos/.kloda-smb-01234567-89ab-cdef-0123-456789abcdef.part"
        );
        for path in [
            "../source",
            "x?y",
            ".KLODA-SMB-owned.part",
            ".Kloda-smb-owned.part",
            "CON.txt",
        ] {
            job.final_path = path;
            assert!(job.staged_path().is_err());
        }
        job.final_path = "safe";
        job.operation_id = "01234567-89AB-cdef-0123-456789abcdef";
        assert!(job.staged_path().is_err());
    }
}
