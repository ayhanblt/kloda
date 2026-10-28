#![deny(unsafe_op_in_unsafe_fn)]

#[cfg(not(target_os = "android"))]
mod backup_retention;
mod backup_retention_schema;
#[cfg(not(target_os = "android"))]
mod backup_root;
mod certificate;
mod error;
mod file_protocol;
#[cfg(not(target_os = "android"))]
mod file_receiver;
mod file_schema;
mod file_sender;
mod file_sender_ack;
mod file_sender_command;
#[cfg(all(test, unix, not(target_os = "android")))]
mod file_sender_tls_tests;
mod file_transport;
mod file_transport_client;
mod file_transport_http;
mod file_transport_io;
mod frame;
mod handle;
mod identity;
mod initialization;
mod installation_files;
mod key;
mod owner;
#[cfg(not(target_os = "android"))]
mod paired_devices;
mod pc;
mod pc_commit;
mod phone;
mod proof;
mod qr;
mod qr_base64;
mod qr_ip;
mod qr_json;
#[cfg(not(target_os = "android"))]
mod receiver_activity;
mod route;
mod runtime;
mod startup_diagnostics;
mod state;
mod status;
mod store;
#[cfg(not(target_os = "android"))]
mod store_acl;
mod store_acl_schema;
mod store_pc;
mod store_phone;
mod store_rows;
mod store_schema;
mod tls;
mod tls_config;
#[cfg(test)]
mod tls_test_identity;
mod tls_verifier;
pub use error::{PairingError, Result};
pub use owner::{PairingOwner, PairingSnapshot};

#[cfg(target_os = "android")]
mod android_context;
#[cfg(any(target_os = "macos", target_os = "ios"))]
mod apple_cf;
#[cfg(all(target_os = "android", feature = "android-jni"))]
mod jni_bridge;
#[cfg(all(feature = "desktop-node", not(target_os = "android"), not(test)))]
mod node;
#[cfg(all(feature = "desktop-node", not(target_os = "android"), not(test)))]
mod node_retention;

mod foreground;

#[cfg(any(target_os = "windows", test))]
mod installation_generation_chain;
#[cfg(any(target_os = "windows", test))]
mod installation_generation_record;
#[cfg(all(test, not(target_os = "android")))]
mod store_generation_tests;
#[cfg(target_os = "windows")]
mod store_windows_connection;
#[cfg(target_os = "windows")]
mod store_windows_vfs;
#[cfg(test)]
mod windows_publication_contract;
#[cfg(any(target_os = "windows", test))]
mod windows_publication_name;

#[cfg(any(target_os = "ios", all(test, feature = "ios-ffi")))]
mod ios_background;
#[cfg(all(feature = "ios-ffi", any(target_os = "ios", test)))]
mod ios_bridge;
