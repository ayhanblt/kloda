use crate::{Error, NativeReceipt, Result, request::Request};
use russh::{
    client,
    keys::{
        HashAlg, PublicKeyOrCertificate,
        ssh_key::{Algorithm, Fingerprint},
    },
};
use russh_sftp::client::{Config, RawSftpSession};
use std::{
    borrow::Cow,
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};
pub struct Pin {
    expected: Fingerprint,
    accepted: Arc<AtomicBool>,
    seen: Arc<AtomicBool>,
}
impl client::Handler for Pin {
    type Error = russh::Error;
    async fn check_server_key(
        &mut self,
        key: &PublicKeyOrCertificate,
    ) -> std::result::Result<bool, Self::Error> {
        self.seen.store(true, Ordering::SeqCst);
        let valid = matches!(key, PublicKeyOrCertificate::PublicKey{key,..} if key.fingerprint(HashAlg::Sha256)==self.expected);
        self.accepted.store(valid, Ordering::SeqCst);
        Ok(valid)
    }
}
pub struct Session {
    pub sftp: RawSftpSession,
    ssh: client::Handle<Pin>,
}
impl Session {
    pub async fn open(
        stream: tokio::net::TcpStream,
        request: &Request,
        owner: &mut dyn NativeReceipt,
        writing: bool,
    ) -> Result<Self> {
        request.validate()?;
        owner.admit()?;
        if stream.peer_addr().map_err(|_| Error::Transport)?
            != std::net::SocketAddr::new(request.address, request.port)
        {
            return Err(Error::Admission);
        }
        let expected = request.fingerprint.parse().map_err(|_| Error::Invalid)?;
        let accepted = Arc::new(AtomicBool::new(false));
        let seen = Arc::new(AtomicBool::new(false));
        let timeout = Duration::from_millis(request.response_timeout_ms.into());
        let mut config = client::Config::default();
        config.preferred.key = Cow::Owned(vec![Algorithm::Ed25519]);
        config.inactivity_timeout = Some(timeout);
        let connect = client::connect_stream(
            Arc::new(config),
            stream,
            Pin {
                expected,
                accepted: accepted.clone(),
                seen: seen.clone(),
            },
        );
        let mut ssh = tokio::time::timeout(timeout, connect)
            .await
            .map_err(|_| Error::Transport)?
            .map_err(|_| {
                if seen.load(Ordering::SeqCst) && !accepted.load(Ordering::SeqCst) {
                    Error::HostKey
                } else {
                    Error::Transport
                }
            })?;
        if !accepted.load(Ordering::SeqCst) {
            return Err(Error::HostKey);
        }
        owner.admit()?;
        if !tokio::time::timeout(
            timeout,
            ssh.authenticate_password(&request.username, &request.password),
        )
        .await
        .map_err(|_| Error::Transport)?
        .map_err(|_| Error::Authentication)?
        .success()
        {
            return Err(Error::Authentication);
        }
        owner.admit()?;
        let channel = tokio::time::timeout(timeout, ssh.channel_open_session())
            .await
            .map_err(|_| Error::Transport)?
            .map_err(|_| Error::Transport)?;
        tokio::time::timeout(timeout, channel.request_subsystem(true, "sftp"))
            .await
            .map_err(|_| Error::Transport)?
            .map_err(|_| Error::Transport)?;
        let sftp = RawSftpSession::new_with_config(
            channel.into_stream(),
            Config {
                max_packet_len: 131072,
                max_concurrent_reads: 1,
                max_concurrent_writes: 1,
                max_write_packet_len: 32768,
                request_timeout_secs: request.response_timeout_ms.div_ceil(1000) as u64,
            },
        );
        let version = sftp.init().await.map_err(|_| Error::Transport)?;
        if version.version != 3 {
            return Err(Error::Transport);
        }
        if writing
            && version
                .extensions
                .get("fsync@openssh.com")
                .map(String::as_str)
                != Some("1")
        {
            return Err(Error::FsyncUnsupported);
        }
        let session = Self { sftp, ssh };
        session.root(request).await?;
        owner.admit()?;
        Ok(session)
    }
    pub async fn root(&self, request: &Request) -> Result<()> {
        let path = self
            .sftp
            .realpath(&request.root)
            .await
            .map_err(|_| Error::Root)?;
        if path.files.len() != 1 || path.files[0].filename != request.root {
            return Err(Error::Root);
        }
        let attrs = self
            .sftp
            .lstat(&request.root)
            .await
            .map_err(|_| Error::Root)?
            .attrs;
        if attrs.permissions.map(|mode| mode & 0o170000) != Some(0o40000) {
            return Err(Error::Root);
        }
        Ok(())
    }
    pub async fn close(self) -> Result<()> {
        self.sftp.close_session().map_err(|_| Error::Transport)?;
        self.ssh
            .disconnect(
                russh::Disconnect::ByApplication,
                "Kloda operation complete",
                "en",
            )
            .await
            .map_err(|_| Error::Transport)
    }
}
