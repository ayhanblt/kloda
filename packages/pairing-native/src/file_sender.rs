use crate::error::{PairingError, Result};
use crate::file_sender_command::{Command, Reply, Task};
use crate::store_rows::Record;
use axum::body::{to_bytes, Body, Bytes};
use axum::http::{Request, Response};
use hyper_util::rt::TokioIo;
use rustls::pki_types::ServerName;
use rustls::sign::CertifiedKey;
use std::future::Future;
use std::net::TcpStream;
use std::pin::Pin;
use std::sync::Arc;
use std::task::Poll;

type Connection = hyper::client::conn::http1::Connection<
    TokioIo<tokio_rustls::client::TlsStream<tokio::net::TcpStream>>,
    Body,
>;
pub(crate) struct Channel {
    sender: hyper::client::conn::http1::SendRequest<Body>,
    connection: Pin<Box<Connection>>,
    pub(crate) record: Record,
    operation: Option<crate::file_protocol::Operation>,
}
impl Channel {
    pub(crate) async fn connect(
        socket: TcpStream,
        key: Arc<CertifiedKey>,
        record: &Record,
        check_route: impl Fn() -> Result<()>,
    ) -> Result<Self> {
        let hint = record.hint.as_ref().ok_or(PairingError::LanUnavailable)?;
        let peer = record.peer.as_ref().ok_or(PairingError::TlsRejected)?;
        let address = socket
            .peer_addr()
            .map_err(|_| PairingError::ConnectionClosed)?;
        if address.ip() != hint.ip || address.port() != hint.port {
            return Err(PairingError::LanUnavailable);
        }
        check_route()?;
        socket
            .set_nonblocking(true)
            .map_err(|_| PairingError::ConnectionClosed)?;
        let socket =
            tokio::net::TcpStream::from_std(socket).map_err(|_| PairingError::ConnectionClosed)?;
        let (config, verifier) = crate::tls_config::client_config(key, record.expected)?;
        let tls = tokio_rustls::TlsConnector::from(config)
            .connect(ServerName::IpAddress(hint.ip.into()), socket)
            .await
            .map_err(|_| PairingError::TlsRejected)?;
        if !crate::tls_config::full_profile(tls.get_ref().1, crate::file_protocol::ALPN) {
            return Err(PairingError::TlsRejected);
        }
        let actual = verifier
            .verified_key
            .lock()
            .map_err(|_| PairingError::TlsRejected)?
            .clone()
            .ok_or(PairingError::TlsRejected)?;
        if &actual != peer || actual.fingerprint() != record.expected {
            return Err(PairingError::TlsRejected);
        }
        check_route()?;
        let (sender, connection) = hyper::client::conn::http1::handshake(TokioIo::new(tls))
            .await
            .map_err(|_| PairingError::ConnectionClosed)?;
        Ok(Self {
            sender,
            connection: Box::pin(connection),
            record: record.clone(),
            operation: None,
        })
    }
    pub(crate) fn matches(&self, record: &Record) -> bool {
        self.record.sid == record.sid
            && self.record.peer == record.peer
            && self.record.expected == record.expected
            && self.record.hint.as_ref().map(|h| (h.ip, h.port))
                == record.hint.as_ref().map(|h| (h.ip, h.port))
    }
    pub(crate) async fn exchange(
        &mut self,
        request: Request<Body>,
        limit: usize,
        check_route: impl Fn() -> Result<()>,
    ) -> Result<Response<Bytes>> {
        check_route()?;
        let sender = &mut self.sender;
        let exchange = async {
            sender
                .ready()
                .await
                .map_err(|_| PairingError::ConnectionClosed)?;
            let response = sender
                .send_request(request)
                .await
                .map_err(|_| PairingError::OutcomeUnknown)?;
            let (parts, body) = response.into_parts();
            let bytes = to_bytes(Body::new(body), limit)
                .await
                .map_err(|_| PairingError::OutcomeUnknown)?;
            check_route()?;
            Ok(Response::from_parts(parts, bytes))
        };
        let mut exchange = std::pin::pin!(exchange);
        let connection = &mut self.connection;
        // No detached driver: one owner polls and drops both halves, including hardware TLS keys.
        std::future::poll_fn(|cx| {
            if let Err(error) = check_route() {
                return Poll::Ready(Err(error));
            }
            if let Poll::Ready(result) = exchange.as_mut().poll(cx) {
                return Poll::Ready(result);
            }
            if connection.as_mut().poll(cx).is_ready() {
                if let Poll::Ready(result) = exchange.as_mut().poll(cx) {
                    return Poll::Ready(result);
                }
                return Poll::Ready(Err(PairingError::OutcomeUnknown));
            }
            exchange.as_mut().poll(cx)
        })
        .await
    }
    pub(crate) async fn transfer(
        &mut self,
        task: Task,
        check_route: impl Fn() -> Result<()>,
    ) -> Result<Reply> {
        if let Command::Chunk { id, offset, length } = &task.command {
            let old = self
                .operation
                .as_ref()
                .filter(|old| old.id == *id)
                .ok_or(PairingError::CandidateStale)?;
            let end = offset
                .checked_add(*length as u64)
                .ok_or(PairingError::InvalidRequest)?;
            if old.state != crate::file_protocol::OperationState::Receiving
                || end > old.size
                || *offset > old.offset
                || (*offset < old.offset && end > old.offset)
            {
                return Err(PairingError::InvalidRequest);
            }
            if task
                .file
                .as_ref()
                .ok_or(PairingError::InvalidRequest)?
                .metadata()
                .map_err(|_| PairingError::BackupUnavailable)?
                .len()
                != old.size
            {
                return Err(PairingError::InvalidRequest);
            }
        }
        let (request, limit) = request(&self.record, &task)?;
        let response = self.exchange(request, limit, &check_route).await?;
        check_route()?;
        let reply = crate::file_sender_ack::decode(response, &task, self.operation.as_ref())?;
        if let Some(operation) = &reply.operation {
            self.operation = Some(operation.clone());
        }
        Ok(reply)
    }
}
fn request(record: &Record, task: &Task) -> Result<(Request<Body>, usize)> {
    use crate::file_protocol::{CHUNK_LIMIT, METADATA_LIMIT};
    let (method, path, bytes, offset) = match &task.command {
        Command::Create { upload } => (
            "POST",
            "/v1/operations".to_owned(),
            serde_json::to_vec(upload).map_err(|_| PairingError::InvalidRequest)?,
            None,
        ),
        Command::Status { id } => ("GET", format!("/v1/operations/{id}"), Vec::new(), None),
        Command::Chunk { id, offset, length } => (
            "PUT",
            format!("/v1/operations/{id}/bytes"),
            read(task, *offset, *length)?,
            Some(*offset),
        ),
        Command::Finalize { id } => (
            "POST",
            format!("/v1/operations/{id}/finalize"),
            Vec::new(),
            None,
        ),
        Command::List { after } => (
            "GET",
            after
                .as_ref()
                .map(|id| format!("/v1/photos?after={id}"))
                .unwrap_or_else(|| "/v1/photos".to_owned()),
            Vec::new(),
            None,
        ),
        Command::Restore { id, offset } => (
            "GET",
            format!("/v1/photos/{id}/bytes"),
            Vec::new(),
            Some(*offset),
        ),
    };
    let mut request = Request::builder()
        .method(method)
        .uri(path)
        .header(
            "host",
            record
                .hint
                .as_ref()
                .ok_or(PairingError::LanUnavailable)?
                .ip
                .to_string(),
        )
        .header("x-kloda-pair", crate::qr_base64::encode(&record.sid))
        .header("content-length", bytes.len().to_string());
    if let Some(offset) = offset {
        request = request.header("x-kloda-offset", offset.to_string());
    }
    if matches!(&task.command, Command::Create { .. }) {
        request = request.header("content-type", "application/json");
    }
    let limit = match task.command {
        Command::List { .. } => METADATA_LIMIT * 32,
        Command::Restore { .. } => CHUNK_LIMIT,
        _ => METADATA_LIMIT,
    };
    Ok((
        request
            .body(Body::from(bytes))
            .map_err(|_| PairingError::InvalidRequest)?,
        limit,
    ))
}
#[cfg(unix)]
fn read(task: &Task, offset: u64, length: usize) -> Result<Vec<u8>> {
    use std::os::unix::fs::FileExt;
    let file = task.file.as_ref().ok_or(PairingError::InvalidRequest)?;
    if offset
        .checked_add(length as u64)
        .ok_or(PairingError::InvalidRequest)?
        > file
            .metadata()
            .map_err(|_| PairingError::BackupUnavailable)?
            .len()
    {
        return Err(PairingError::InvalidRequest);
    }
    let mut bytes = vec![0; length];
    file.read_exact_at(&mut bytes, offset)
        .map_err(|_| PairingError::BackupUnavailable)?;
    Ok(bytes)
}
#[cfg(not(unix))]
fn read(_: &Task, _: u64, _: usize) -> Result<Vec<u8>> {
    Err(PairingError::NativeUnsupported)
}
