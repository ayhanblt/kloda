use crate::{Authority, Error, Request, Result};
use std::{net::TcpStream, sync::Arc, time::Duration};
use suppaftp::{FtpError, Mode, RustlsConnector, RustlsFtpStream, rustls};
pub struct Session {
    pub(crate) ftp: RustlsFtpStream,
    pub(crate) owner: Authority,
}
impl Session {
    pub fn open(stream: TcpStream, r: &Request, owner: Authority) -> Result<Self> {
        r.validate()?;
        owner.current()?;
        let roots =
            rustls::RootCertStore::from_iter(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());
        #[cfg(feature = "owned-fixture")]
        let roots = {
            let mut roots = roots;
            roots
                .add(rustls::pki_types::CertificateDer::from(
                    include_bytes!(env!("KLODA_FTPS_FIXTURE_CA_DER")).to_vec(),
                ))
                .map_err(|_| Error::Tls)?;
            roots
        };
        Self::with_roots(stream, r, owner, roots)
    }
    // No public custom-CA entry or configuration in production.
    fn with_roots(
        stream: TcpStream,
        r: &Request,
        owner: Authority,
        roots: rustls::RootCertStore,
    ) -> Result<Self> {
        let expected = std::net::SocketAddr::new(r.address, r.port);
        if stream.peer_addr().map_err(|_| Error::Transport)? != expected {
            return Err(Error::Admission);
        }
        stream
            .set_nonblocking(false)
            .map_err(|_| Error::Transport)?;
        let timeout = Some(Duration::from_millis(r.response_timeout_ms.into()));
        stream
            .set_read_timeout(timeout)
            .map_err(|_| Error::Transport)?;
        stream
            .set_write_timeout(timeout)
            .map_err(|_| Error::Transport)?;
        let config = rustls::ClientConfig::builder()
            .with_root_certificates(roots)
            .with_no_client_auth();
        let data_owner = owner.clone();
        let ip = r.address;
        let mut ftp = RustlsFtpStream::connect_with_stream(stream)
            .map_err(|_| Error::Transport)?
            .passive_stream_builder(move |address| {
                if address.ip() != ip || address.port() == 0 {
                    return Err(FtpError::ConnectionError(std::io::Error::new(
                        std::io::ErrorKind::PermissionDenied,
                        "data peer rejected",
                    )));
                }
                data_owner.current().map_err(|_| {
                    FtpError::ConnectionError(std::io::Error::from(
                        std::io::ErrorKind::PermissionDenied,
                    ))
                })?;
                let socket = data_owner.connect(address).map_err(|_| {
                    FtpError::ConnectionError(std::io::Error::from(
                        std::io::ErrorKind::PermissionDenied,
                    ))
                })?;
                if socket.peer_addr().map_err(FtpError::ConnectionError)? != address {
                    return Err(FtpError::ConnectionError(std::io::Error::from(
                        std::io::ErrorKind::PermissionDenied,
                    )));
                }
                socket
                    .set_nonblocking(false)
                    .map_err(FtpError::ConnectionError)?;
                socket
                    .set_read_timeout(timeout)
                    .map_err(FtpError::ConnectionError)?;
                socket
                    .set_write_timeout(timeout)
                    .map_err(FtpError::ConnectionError)?;
                data_owner.current().map_err(|_| {
                    FtpError::ConnectionError(std::io::Error::from(
                        std::io::ErrorKind::PermissionDenied,
                    ))
                })?;
                Ok(socket)
            })
            .into_secure(RustlsConnector::from(Arc::new(config)), &r.hostname)
            .map_err(|_| Error::Tls)?;
        owner.current()?;
        ftp.login(&r.username, &r.password)
            .map_err(|_| Error::Authentication)?;
        ftp.set_mode(Mode::ExtendedPassive);
        ftp.transfer_type(suppaftp::types::FileType::Binary)
            .map_err(|_| Error::Transport)?;
        owner.current()?;
        ftp.cwd(&r.root).map_err(|_| Error::Root)?;
        if ftp.pwd().map_err(|_| Error::Root)? != r.root {
            return Err(Error::Root);
        }
        Ok(Self { ftp, owner })
    }
    pub fn close(mut self) -> Result<()> {
        self.owner.current()?;
        self.ftp.quit().map_err(|_| Error::Transport)
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use crate::{Event, Owner};
    use sha2::{Digest, Sha256};
    use std::{
        io::{Seek, Write},
        sync::{
            Mutex,
            atomic::{AtomicBool, Ordering},
        },
    };
    struct TestOwner {
        events: Mutex<Vec<i32>>,
        deny_data: AtomicBool,
    }
    impl Owner for TestOwner {
        fn current(&self) -> Result<()> {
            Ok(())
        }
        fn connect(&self, address: std::net::SocketAddr) -> Result<TcpStream> {
            if self.deny_data.load(Ordering::SeqCst) || !address.ip().is_loopback() {
                return Err(Error::Admission);
            }
            TcpStream::connect(address).map_err(|_| Error::Transport)
        }
        fn record(&self, event: Event, _: u64) -> Result<()> {
            self.events.lock().unwrap().push(event as i32);
            Ok(())
        }
    }
    #[test]
    #[ignore = "requires explicitly owned loopback FTPS fixture"]
    fn owned_fixture_practical_publication_and_denials() {
        let port: u16 = std::env::var("KLODA_FTPS_FIXTURE_PORT")
            .unwrap()
            .parse()
            .unwrap();
        let der = std::fs::read(std::env::var("KLODA_FTPS_FIXTURE_CA").unwrap()).unwrap();
        let roots = || {
            let mut r = rustls::RootCertStore::empty();
            r.add(rustls::pki_types::CertificateDer::from(der.clone()))
                .unwrap();
            r
        };
        let payload = b"owned Rust FTPS engine snapshot";
        let mut r = Request {
            address: "127.0.0.1".parse().unwrap(),
            port,
            hostname: "localhost".into(),
            username: "probe".into(),
            password: "unused".into(),
            root: "/".into(),
            operation_id: "12345678-1234-4321-8765-123456789abc".into(),
            final_path: format!("engine-{}.bin", std::process::id()),
            size: payload.len().to_string(),
            sha256: Sha256::digest(payload).into(),
            response_timeout_ms: 5000,
        };
        let owner = Arc::new(TestOwner {
            events: Mutex::new(Vec::new()),
            deny_data: AtomicBool::new(false),
        });
        let make = |req: &Request, owner: Arc<TestOwner>| {
            Session::with_roots(
                TcpStream::connect(("127.0.0.1", port)).unwrap(),
                req,
                owner,
                roots(),
            )
            .unwrap()
        };
        let local = std::env::temp_dir().join(format!("kloda-ftps-source-{}", std::process::id()));
        let mut source = std::fs::OpenOptions::new()
            .read(true)
            .write(true)
            .create_new(true)
            .open(&local)
            .unwrap();
        source.write_all(payload).unwrap();
        source.rewind().unwrap();
        let mut s = make(&r, owner.clone());
        s.publish(&r, &mut source).unwrap();
        assert_eq!(*owner.events.lock().unwrap(), vec![1, 2, 3]);
        assert_eq!(s.publish(&r, &mut source), Err(Error::Exists));
        assert_eq!(*owner.events.lock().unwrap(), vec![1, 2, 3]);
        s.close().unwrap();
        let mut denied = make(&r, owner.clone());
        owner.deny_data.store(true, Ordering::SeqCst);
        assert!(denied.ftp.nlst(None).is_err());
        drop(denied);
        owner.deny_data.store(false, Ordering::SeqCst);
        r.final_path = format!("invalid-source-{}.bin", std::process::id());
        r.sha256 = [0; 32];
        let mut s = make(&r, owner.clone());
        assert_eq!(s.publish(&r, &mut source), Err(Error::Source));
        s.close().unwrap();
        assert_eq!(*owner.events.lock().unwrap(), vec![1, 2, 3]);
        drop(source);
        std::fs::remove_file(local).unwrap();
    }
    #[test]
    #[ignore = "requires owned fixture with dropped STOR completion"]
    fn lost_upload_ack_does_not_record_upload_or_verification() {
        let port: u16 = std::env::var("KLODA_FTPS_FIXTURE_PORT")
            .unwrap()
            .parse()
            .unwrap();
        let der = std::fs::read(std::env::var("KLODA_FTPS_FIXTURE_CA").unwrap()).unwrap();
        let mut roots = rustls::RootCertStore::empty();
        roots
            .add(rustls::pki_types::CertificateDer::from(der))
            .unwrap();
        let payload = b"owned lost ACK check";
        let r = Request {
            address: "127.0.0.1".parse().unwrap(),
            port,
            hostname: "localhost".into(),
            username: "probe".into(),
            password: "unused".into(),
            root: "/".into(),
            operation_id: "12345678-1234-4321-8765-123456789abc".into(),
            final_path: format!("drop-ack-{}.bin", std::process::id()),
            size: payload.len().to_string(),
            sha256: Sha256::digest(payload).into(),
            response_timeout_ms: 5000,
        };
        let owner = Arc::new(TestOwner {
            events: Mutex::new(Vec::new()),
            deny_data: AtomicBool::new(false),
        });
        let mut session = Session::with_roots(
            TcpStream::connect(("127.0.0.1", port)).unwrap(),
            &r,
            owner.clone(),
            roots,
        )
        .unwrap();
        let path = std::env::temp_dir().join(format!("kloda-ftps-lost-{}", std::process::id()));
        let mut file = std::fs::OpenOptions::new()
            .read(true)
            .write(true)
            .create_new(true)
            .open(&path)
            .unwrap();
        file.write_all(payload).unwrap();
        file.rewind().unwrap();
        assert_eq!(session.publish(&r, &mut file), Err(Error::Transport));
        assert_eq!(*owner.events.lock().unwrap(), vec![1]);
        drop(file);
        std::fs::remove_file(path).unwrap();
    }
}
