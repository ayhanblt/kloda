use kloda_storage_native::NegotiatedSmb;
use smb2::client::{Connection, Tree};
use std::{
    net::{Ipv4Addr, SocketAddr},
    sync::atomic::{AtomicUsize, Ordering},
    time::Duration,
};
type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;
static AUTHS: AtomicUsize = AtomicUsize::new(0);
async fn connect(port: u16, password: &str) -> Result<(Connection, Tree)> {
    assert!((27445..=27449).contains(&port));
    let pending = NegotiatedSmb::connect(
        SocketAddr::from((Ipv4Addr::LOCALHOST, port)),
        Duration::from_secs(5),
    )
    .await?;
    AUTHS.fetch_add(1, Ordering::SeqCst);
    let mut conn = pending.authenticate("owned", password, "").await?;
    let tree = Tree::connect(&mut conn, "owned").await?;
    Ok((conn, tree))
}
#[test]
#[ignore = "requires the recorded owned loopback Samba fixture"]
fn owned_candidate() -> Result<()> {
    assert_eq!(
        std::env::var("KLODA_SMB16_FIXTURE").as_deref(),
        Ok("owned-loopback")
    );
    tokio::runtime::Builder::new_current_thread().enable_all().build()?.block_on(async {
        let (mut conn,tree)=connect(27445,"owned-disposable-fixture").await?;
        assert!(conn.should_encrypt());
        let prefix=format!("alt-owned-{}",std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)?.as_nanos());
        let staged=format!("{prefix}.stage");let final_name=format!("{prefix}.bin");let foreign=format!("{prefix}.foreign");
        let bytes:Vec<u8>=(0..1048576).map(|n|(n%251) as u8).collect();
        assert_eq!(tree.write_file_compound_exclusive(&mut conn,&staged,&bytes).await?,bytes.len() as u64);
        assert!(tree.write_file_compound_exclusive(&mut conn,&staged,b"must-not-overwrite").await.is_err());
        assert_eq!(tree.write_file_compound_exclusive(&mut conn,&foreign,b"foreign").await?,7);
        assert!(tree.rename(&mut conn,&staged,&foreign).await.is_err());
        assert_eq!(tree.read_file_compound_sized(&mut conn,&foreign,7).await?,b"foreign");
        tree.rename(&mut conn,&staged,&final_name).await?;
        assert_eq!(tree.read_file_compound_sized(&mut conn,&final_name,bytes.len() as u64).await?,bytes);
        tree.disconnect(&mut conn).await?;drop(conn);
        assert!(connect(27445,"wrong-owned-password").await.is_err());
        let before=AUTHS.load(Ordering::SeqCst);
        assert!(connect(27446,"owned-disposable-fixture").await.is_err());
        assert!(connect(27447,"owned-disposable-fixture").await.is_err());
        assert_eq!(AUTHS.load(Ordering::SeqCst),before,"unsupported server rejected before auth API");
        assert!(connect(27448,"owned-disposable-fixture").await.is_err());
        assert!(connect(27449,"owned-disposable-fixture").await.is_err());
        println!("PASS smb2 strict1MiB/no-clobber/full byte readback; wrong password; SMB2/encryption-off before auth; stripped auth signature/corrupt encrypted response");
        Ok(())
    })
}
