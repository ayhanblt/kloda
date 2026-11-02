use sha2::{Digest, Sha256};
use std::{env, fs, path::Path};

fn main() {
    if env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("android") {
        println!("cargo:rustc-link-arg-cdylib=-Wl,-z,max-page-size=16384");
        println!("cargo:rustc-link-arg-cdylib=-Wl,-z,common-page-size=16384");
    }
    let manifest = Path::new(env!("CARGO_MANIFEST_DIR"));
    let root = env::var_os("CARGO_MANIFEST_DIR").expect("Cargo manifest root");
    let root = Path::new(&root).join("vendor/smb2");
    println!(
        "cargo:rerun-if-changed={}",
        manifest.join("vendor/smb2.sha256").display()
    );
    for line in include_str!("vendor/smb2.sha256").lines() {
        let (expected, relative) = line.split_once("  ").expect("SDK hash entry");
        assert!(
            !relative.starts_with('/') && !relative.split('/').any(|p| p == ".."),
            "SDK path"
        );
        let path = root.join(relative);
        let data = fs::read(&path).unwrap_or_else(|_| panic!("SDK source missing: {relative}"));
        let actual: String = Sha256::digest(data)
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect();
        assert_eq!(
            actual, expected,
            "SDK hash mismatch: {relative}; explicit version/patch review required"
        );
        println!("cargo:rerun-if-changed={}", path.display());
    }
}
