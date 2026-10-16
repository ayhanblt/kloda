use crate::error::{PairingError, Result};
use crate::key::Spki;
use rustls::Connection;
use std::io::{self, Read, Write};
use std::net::{IpAddr, Shutdown, TcpStream};
use std::pin::Pin;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::task::{Context, Poll};
use std::time::{Duration, Instant};
use tokio::io::{AsyncRead, AsyncWrite, ReadBuf};

#[derive(Clone)]
pub(crate) struct Evidence {
    pub(crate) peer: Spki,
    pub(crate) ip: IpAddr,
    state: Arc<LiveState>,
}
impl std::fmt::Debug for Evidence {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("NativeFilePeer")
            .field("ip", &self.ip)
            .finish_non_exhaustive()
    }
}
struct LiveState {
    live: AtomicBool,
    socket: TcpStream,
    last_progress: Mutex<Instant>,
}
const INACTIVITY: Duration = Duration::from_secs(10);
impl Evidence {
    pub(crate) fn check_live(&self) -> Result<()> {
        let expired = self
            .state
            .last_progress
            .lock()
            .map(|progress| progress.elapsed() >= INACTIVITY)
            .unwrap_or(true);
        if expired {
            self.close();
        }
        if !self.state.live.load(Ordering::Acquire) {
            return Err(PairingError::ConnectionClosed);
        }
        let mut byte = [0];
        match self.state.socket.peek(&mut byte) {
            Ok(0) => {
                self.close();
                Err(PairingError::ConnectionClosed)
            }
            Ok(_) => Ok(()),
            Err(e) if e.kind() == io::ErrorKind::WouldBlock => Ok(()),
            Err(_) => Err(PairingError::ConnectionClosed),
        }
    }
    pub(crate) fn close(&self) {
        self.state.live.store(false, Ordering::Release);
        let _ = self.state.socket.shutdown(Shutdown::Both);
    }
    pub(crate) fn same_channel(&self, other: &Self) -> bool {
        Arc::ptr_eq(&self.state, &other.state)
    }
    fn note_progress(&self) -> io::Result<()> {
        let mut progress = self
            .state
            .last_progress
            .lock()
            .map_err(|_| io::ErrorKind::BrokenPipe)?;
        if progress.elapsed() >= INACTIVITY || !self.state.live.load(Ordering::Acquire) {
            drop(progress);
            self.close();
            return Err(io::ErrorKind::TimedOut.into());
        }
        *progress = Instant::now();
        Ok(())
    }
}

/// Only an already completed full native FILE handshake can create this stream.
pub(crate) struct TlsIo {
    socket: tokio::net::TcpStream,
    connection: Connection,
    evidence: Evidence,
}
impl TlsIo {
    pub(crate) fn new(socket: TcpStream, mut connection: Connection, peer: Spki) -> Result<Self> {
        socket
            .set_nonblocking(true)
            .map_err(|_| PairingError::ConnectionClosed)?;
        let ip = socket
            .peer_addr()
            .map_err(|_| PairingError::ConnectionClosed)?
            .ip();
        let probe = socket
            .try_clone()
            .map_err(|_| PairingError::ConnectionClosed)?;
        let socket =
            tokio::net::TcpStream::from_std(socket).map_err(|_| PairingError::ConnectionClosed)?;
        connection.set_buffer_limit(Some(crate::file_protocol::CHUNK_LIMIT + 8192));
        Ok(Self {
            socket,
            connection,
            evidence: Evidence {
                peer,
                ip,
                state: Arc::new(LiveState {
                    live: AtomicBool::new(true),
                    socket: probe,
                    last_progress: Mutex::new(Instant::now()),
                }),
            },
        })
    }
    pub(crate) fn evidence(&self) -> Evidence {
        self.evidence.clone()
    }
    fn flush_tls(&mut self, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        if self.evidence.check_live().is_err() {
            return Poll::Ready(Err(io::ErrorKind::BrokenPipe.into()));
        }
        while self.connection.wants_write() {
            match self.connection.write_tls(&mut SocketIo(&self.socket)) {
                Ok(0) => return Poll::Ready(Err(io::ErrorKind::BrokenPipe.into())),
                Ok(_) => {
                    if let Err(error) = self.evidence.note_progress() {
                        return Poll::Ready(Err(error));
                    }
                }
                Err(e) if e.kind() == io::ErrorKind::WouldBlock => {
                    match self.socket.poll_write_ready(cx) {
                        Poll::Ready(Ok(())) => continue,
                        other => return other,
                    }
                }
                Err(e) => return Poll::Ready(Err(e)),
            }
        }
        Poll::Ready(Ok(()))
    }
}
struct SocketIo<'a>(&'a tokio::net::TcpStream);
impl Read for SocketIo<'_> {
    fn read(&mut self, bytes: &mut [u8]) -> io::Result<usize> {
        self.0.try_read(bytes)
    }
}
impl Write for SocketIo<'_> {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        self.0.try_write(bytes)
    }
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}
impl AsyncRead for TlsIo {
    fn poll_read(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        output: &mut ReadBuf<'_>,
    ) -> Poll<io::Result<()>> {
        let this = self.get_mut();
        if this.evidence.check_live().is_err() {
            return Poll::Ready(Err(io::ErrorKind::BrokenPipe.into()));
        }
        if output.remaining() == 0 {
            return Poll::Ready(Ok(()));
        }
        loop {
            match this.connection.reader().read(output.initialize_unfilled()) {
                Ok(n) => {
                    output.advance(n);
                    return Poll::Ready(Ok(()));
                }
                Err(e) if e.kind() == io::ErrorKind::WouldBlock => (),
                Err(e) => return Poll::Ready(Err(e)),
            }
            if let Poll::Ready(Err(e)) = this.flush_tls(cx) {
                return Poll::Ready(Err(e));
            }
            match this.connection.read_tls(&mut SocketIo(&this.socket)) {
                Ok(0) => {
                    this.evidence.close();
                    return Poll::Ready(Err(io::ErrorKind::UnexpectedEof.into()));
                }
                Ok(_) => {
                    if let Err(error) = this.evidence.note_progress() {
                        return Poll::Ready(Err(error));
                    }
                    match this.connection.process_new_packets() {
                        Ok(state) => {
                            if state.peer_has_closed() {
                                this.evidence.close();
                            }
                        }
                        Err(e) => {
                            this.evidence.close();
                            return Poll::Ready(Err(io::Error::other(e)));
                        }
                    }
                }
                Err(e) if e.kind() == io::ErrorKind::WouldBlock => {
                    match this.socket.poll_read_ready(cx) {
                        Poll::Ready(Ok(())) => continue,
                        other => return other,
                    }
                }
                Err(e) => {
                    this.evidence.close();
                    return Poll::Ready(Err(e));
                }
            }
        }
    }
}
impl AsyncWrite for TlsIo {
    fn poll_write(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        bytes: &[u8],
    ) -> Poll<io::Result<usize>> {
        let this = self.get_mut();
        match this.flush_tls(cx) {
            Poll::Ready(Ok(())) => (),
            Poll::Ready(Err(e)) => return Poll::Ready(Err(e)),
            Poll::Pending => return Poll::Pending,
        }
        Poll::Ready(this.connection.writer().write(bytes))
    }
    fn poll_flush(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        self.get_mut().flush_tls(cx)
    }
    fn poll_shutdown(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        let this = self.get_mut();
        this.connection.send_close_notify();
        match this.flush_tls(cx) {
            Poll::Ready(Ok(())) => {
                this.evidence.close();
                Poll::Ready(Ok(()))
            }
            other => other,
        }
    }
}
impl Drop for TlsIo {
    fn drop(&mut self) {
        self.evidence.close();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn progress(evidence: &Evidence) -> std::sync::MutexGuard<'_, Instant> {
        match evidence.state.last_progress.lock() {
            Ok(progress) => progress,
            Err(_) => panic!("inactivity fixture progress poisoned"),
        }
    }
    #[test]
    fn real_socket_inactivity_expires_without_commands_extending_it() {
        let listener = std::net::TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0)).unwrap();
        let _peer = TcpStream::connect(listener.local_addr().unwrap()).unwrap();
        let (socket, address) = listener.accept().unwrap();
        socket.set_nonblocking(true).unwrap();
        let evidence = Evidence {
            peer: crate::state::test_support::key("phone"),
            ip: address.ip(),
            state: Arc::new(LiveState {
                live: AtomicBool::new(true),
                socket,
                last_progress: Mutex::new(Instant::now()),
            }),
        };
        assert!(evidence.same_channel(&evidence.clone()));
        let previous = Instant::now() - Duration::from_secs(5);
        *progress(&evidence) = previous;
        evidence.check_live().unwrap();
        assert_eq!(*progress(&evidence), previous);
        evidence.note_progress().unwrap();
        assert!(*progress(&evidence) > previous);
        *progress(&evidence) = Instant::now() - INACTIVITY;
        assert_eq!(evidence.check_live(), Err(PairingError::ConnectionClosed));
        assert!(evidence.note_progress().is_err());
    }
}
