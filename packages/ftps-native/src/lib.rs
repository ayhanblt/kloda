#[cfg(all(unix, feature = "android-jni"))]
mod android_jni;
// Explicit FTPS wire engine. Native owners retain socket, source and credential authority.
#[cfg(unix)]
pub mod bridge;
mod request;
mod session;
mod transfer;
pub use request::Request;
pub use session::Session;
use std::{
    net::{SocketAddr, TcpStream},
    sync::Arc,
};
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(i32)]
pub enum Error {
    Invalid = 1,
    Admission = 2,
    Journal = 3,
    Source = 4,
    Local = 5,
    Tls = 6,
    Verification = 7,
    Transport = 8,
    Authentication = 9,
    Exists = 10,
    Root = 11,
}
pub type Result<T> = std::result::Result<T, Error>;
#[derive(Clone, Copy)]
pub enum Event {
    Intent = 1,
    Uploaded = 2,
    Verified = 3,
}
pub trait Owner: Send + Sync {
    fn current(&self) -> Result<()>;
    // Every returned FD is connected by the native OS-route owner, never by this engine.
    fn connect(&self, address: SocketAddr) -> Result<TcpStream>;
    fn record(&self, event: Event, bytes: u64) -> Result<()>;
}
pub type Authority = Arc<dyn Owner>;

// Build-time owned-fixture trust is visibly marked and forbidden by production packaging.
#[cfg(feature = "owned-fixture")]
#[unsafe(no_mangle)]
pub extern "C" fn kloda_ftps_owned_fixture_marker() -> i32 {
    16
}
