//! Exact user-owned Windows fixture. Auth/tree only; never enumerate/create/read/delete files.
use kloda_storage_native::NegotiatedSmb;
use smb2::client::Tree;
use std::{fs, os::unix::fs::PermissionsExt, time::Duration};

fn stage<T, E>(value: Result<T, E>, name: &str) -> T {
    value.unwrap_or_else(|_| {
        panic!("owned Windows {name} failed; details suppressed to protect credentials")
    })
}

#[test]
#[ignore = "requires the explicitly prepared Windows test share and private credential file"]
fn windows_owned_encrypted_auth() {
    assert_eq!(
        std::env::var("KLODA_SMB16_WINDOWS_AUTH").as_deref(),
        Ok("owned-auth-only")
    );
    let path = stage(
        std::env::var("KLODA_SMB16_WINDOWS_PASSWORD_FILE"),
        "credential path",
    );
    let metadata = stage(fs::symlink_metadata(&path), "credential metadata");
    assert!(metadata.is_file() && metadata.permissions().mode() & 0o777 == 0o600);
    assert!((1..=4096).contains(&metadata.len()));
    let password = stage(fs::read_to_string(&path), "credential read");
    assert!(!password.contains('\0'));
    let runtime = stage(
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build(),
        "runtime",
    );
    runtime.block_on(async {
        let result = tokio::time::timeout(Duration::from_secs(20), async {
            let address = "192.168.1.54:445".parse().expect("fixed fixture endpoint");
            let stream = stage(tokio::net::TcpStream::connect(address).await, "TCP");
            assert_eq!(stream.local_addr().expect("source").ip().to_string(), "192.168.1.91");
            let pending = stage(NegotiatedSmb::from_stream(stream, address, Duration::from_secs(5)).await, "SMB3 negotiate");
            println!("PASS SMB3 negotiate before credential release");
            let mut connection = stage(pending.authenticate("kloda16a", &password, "MMHA").await, "named-account authentication");
            let params = connection.params().expect("negotiated parameters");
            assert!(params.signing_required);
            println!("PASS named-account auth/signing; dialect={:?} cipher={:?}", params.dialect, params.cipher);
            let tree = stage(Tree::connect(&mut connection, "KlodaTest16a").await, "encrypted tree connect");
            assert!(tree.encrypt_data && !tree.is_dfs && tree.dfs_origin.is_none());
            stage(tree.disconnect(&mut connection).await, "encrypted tree disconnect");
            println!("PASS encrypted share connect/disconnect; no file operations; host-only wire proof, not iOS authority");
        }).await;
        assert!(result.is_ok(), "owned Windows auth deadline exceeded");
    });
}
