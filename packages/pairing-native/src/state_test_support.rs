use crate::key::Spki;
use crate::qr::LanHint;
use crate::store::Store;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

static NEXT: AtomicU64 = AtomicU64::new(1);

pub(crate) struct Directory(PathBuf);
impl Directory {
    pub(crate) fn new() -> Self {
        let serial = NEXT.fetch_add(1, Ordering::Relaxed);
        let random = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "kloda-state-{}-{random}-{serial}",
            std::process::id()
        ));
        std::fs::create_dir(&path).unwrap();
        Self(path)
    }
    pub(crate) fn path(&self) -> &Path {
        &self.0
    }
    pub(crate) fn store(&self, local: Spki) -> Store {
        Store::open(&self.0, local, [7; 16]).unwrap()
    }
}
impl Drop for Directory {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

pub(crate) fn key(role: &str) -> Spki {
    let vector: serde_json::Value = serde_json::from_str(include_str!(
        "../../../docs/security/qr-pairing-v1-protocol-vectors.json"
    ))
    .unwrap();
    let hex = vector[format!("{role}_spki_hex")].as_str().unwrap();
    let bytes: Vec<u8> = (0..hex.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).unwrap())
        .collect();
    Spki::parse(&bytes).unwrap()
}

pub(crate) fn hint() -> LanHint {
    LanHint {
        ip: "192.168.1.20".parse().unwrap(),
        port: 9443,
    }
}
