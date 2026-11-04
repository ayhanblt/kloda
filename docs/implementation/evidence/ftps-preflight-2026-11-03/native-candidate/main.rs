use std::{io::Cursor, net::{IpAddr, Ipv4Addr, SocketAddr, TcpStream}, sync::{Arc, atomic::{AtomicUsize, Ordering}}, time::Duration};
use suppaftp::{RustlsFtpStream, RustlsConnector, Mode, FtpError, rustls};
fn open(address: SocketAddr, expected: IpAddr, allowed: bool) -> suppaftp::FtpResult<TcpStream> {
    if address.ip()!=expected || !allowed { return Err(FtpError::ConnectionError(std::io::Error::new(std::io::ErrorKind::PermissionDenied,"owner denied"))); }
    let stream=TcpStream::connect_timeout(&address,Duration::from_secs(5)).map_err(FtpError::ConnectionError)?;
    stream.set_read_timeout(Some(Duration::from_secs(5))).map_err(FtpError::ConnectionError)?;
    stream.set_write_timeout(Some(Duration::from_secs(5))).map_err(FtpError::ConnectionError)?;
    assert_eq!(stream.peer_addr().unwrap(),address);
    Ok(stream)
}
fn main() {
    let args:Vec<String>=std::env::args().collect();
    let port:u16=args[1].parse().unwrap();let deny=args[3]=="deny";
    let ip=IpAddr::V4(Ipv4Addr::LOCALHOST);
    assert!(open(SocketAddr::new(IpAddr::V4(Ipv4Addr::new(192,0,2,1)),port),ip,true).is_err());
    let mut roots=rustls::RootCertStore::empty();
    roots.add(rustls::pki_types::CertificateDer::from(std::fs::read(&args[2]).unwrap())).unwrap();
    let config=rustls::ClientConfig::builder().with_root_certificates(roots).with_no_client_auth();
    let calls=Arc::new(AtomicUsize::new(0));let counted=calls.clone();
    let mut ftp=RustlsFtpStream::connect_with_stream(open(SocketAddr::new(ip,port),ip,true).unwrap()).unwrap()
        .passive_stream_builder(move |address| {counted.fetch_add(1,Ordering::SeqCst);open(address,ip,!deny)})
        .into_secure(RustlsConnector::from(Arc::new(config)),"localhost").unwrap();
    ftp.set_mode(Mode::ExtendedPassive);
    ftp.login("probe","unused").unwrap();
    if deny {assert!(ftp.nlst(None).is_err());assert!(calls.load(Ordering::SeqCst)>0);println!("PASS data-socket owner denial");return;}
    let name=format!("native-probe-{}.bin",std::process::id());
    assert!(!ftp.nlst(None).unwrap().contains(&name));
    let payload=b"new native candidate payload";
    assert_eq!(ftp.put_file(&name,&mut Cursor::new(payload)).unwrap(),payload.len() as u64);
    assert_eq!(ftp.retr_as_buffer(&name).unwrap().into_inner(),payload);
    assert!(calls.load(Ordering::SeqCst)>=3);
    ftp.quit().unwrap();
    println!("PASS configured control socket + guarded EPSV data sockets + TLS + fresh readback; fixture only");
}
