//! D8 public-constructor consumer only; no SMB auth, product ABI or OS admission claim.
use smb2::transport::{TcpTransport, TransportReceive};
use std::{
    io::Read,
    net::{TcpListener, TcpStream},
    time::Duration,
};

#[test]
fn public_constructor_preserves_connected_socket_ownership_and_progress() {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let stream = TcpStream::connect(listener.local_addr().unwrap()).unwrap();
    let (mut peer, _) = listener.accept().unwrap();
    peer.set_read_timeout(Some(Duration::from_secs(1))).unwrap();
    stream.set_nonblocking(true).unwrap();
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();
    runtime.block_on(async {
        let socket = tokio::net::TcpStream::from_std(stream).unwrap();
        let transport = TcpTransport::from_tokio_stream(socket);
        assert!(transport.receive_progress().is_some());
        drop(transport);
    });
    assert_eq!(
        peer.read(&mut [0u8; 1]).unwrap(),
        0,
        "no payload, socket closed with transport"
    );
}
