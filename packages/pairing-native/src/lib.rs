#![deny(unsafe_op_in_unsafe_fn)]

mod certificate;
mod error;
mod frame;
mod handle;
mod identity;
mod initialization;
mod installation_files;
mod key;
mod owner;
mod pc;
mod pc_commit;
mod phone;
mod proof;
mod qr;
mod qr_base64;
mod qr_ip;
mod qr_json;
mod route;
mod runtime;
mod state;
mod status;
mod store;
mod store_pc;
mod store_phone;
mod store_rows;
mod store_schema;
mod tls;
mod tls_config;
mod tls_verifier;
pub use error::{PairingError, Result};
pub use owner::{PairingOwner, PairingSnapshot};

#[cfg(target_os = "android")]
mod android_context;
#[cfg(target_os = "macos")]
mod apple_cf;
#[cfg(all(target_os = "android", feature = "android-jni"))]
mod jni_bridge;
#[cfg(all(feature = "desktop-node", not(target_os = "android"), not(test)))]
mod node;
