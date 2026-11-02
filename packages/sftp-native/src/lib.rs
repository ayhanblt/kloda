//! SFTP wire only; the native owner supplies current route/source/profile/pin authority.
#[cfg(all(unix, feature = "android-jni"))]
mod android_jni;
#[cfg(unix)]
pub mod bridge;
pub mod publication;
pub mod request;
pub mod session;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(i32)]
pub enum Error {
    Invalid = 1,
    Admission = 2,
    Journal = 3,
    Source = 4,
    Local = 5,
    HostKey = 6,
    Verification = 7,
    Transport = 8,
    Authentication = 9,
    FsyncUnsupported = 10,
    Root = 11,
}
impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::Invalid => "sftp_invalid_request",
            Self::Admission => "context_changed",
            Self::Journal => "receipt_write_failed",
            Self::Source => "source_changed",
            Self::Local => "snapshot_io_failed",
            Self::HostKey => "host_key_changed",
            Self::Verification => "verification_failed",
            Self::Transport => "sftp_io_failed",
            Self::Authentication => "authentication_failed",
            Self::FsyncUnsupported => "sftp_fsync_required",
            Self::Root => "sftp_root_unsafe",
        })
    }
}
impl std::error::Error for Error {}
pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Ack {
    Created,
    DataFlushed(u64),
    Closed,
    Renamed,
    BytesVerified,
}
pub trait NativeReceipt {
    fn admit(&mut self) -> Result<()>;
    // Persist received ACKs even if current authority changed; only the owner can decide Completed.
    fn record(&mut self, ack: Ack) -> Result<()>;
}
