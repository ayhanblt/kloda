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
#[cfg(target_os = "macos")]
mod apple_cf;
#[cfg(all(target_os = "android", feature = "android-jni"))]
mod jni_bridge;
#[cfg(all(feature = "desktop-node", not(target_os = "android"), not(test)))]
mod node;
#[cfg(all(feature = "desktop-node", not(target_os = "android"), not(test)))]
mod node_retention;

#[cfg(not(target_os = "android"))]
mod foreground;

#[cfg(test)]
mod windows_publication_contract;
#[cfg(any(target_os = "windows", test))]
mod installation_generation_record;
#[cfg(any(target_os = "windows", test))]
mod installation_generation_chain;
#[cfg(target_os = "windows")]
mod store_windows_vfs;
#[cfg(target_os = "windows")]
mod store_windows_connection;
#[cfg(all(test, not(target_os = "android")))]
mod store_generation_tests;
#[cfg(any(target_os = "windows", test))]
mod windows_publication_name;
