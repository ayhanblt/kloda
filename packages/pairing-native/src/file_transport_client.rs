use crate::error::{PairingError, Result};
use crate::route::Route;
use crate::store_rows::Record;
use axum::body::Body;
use axum::http::{Request, StatusCode};
use rustls::sign::CertifiedKey;
use serde::Deserialize;
use std::net::TcpStream;
use std::sync::Arc;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Ack {
    state: String,
    pair_id: String,
}

/// A fresh native mTLS channel authenticates both the current pin and exact SID request.
pub(crate) async fn revoke(
    socket: TcpStream,
    key: Arc<CertifiedKey>,
    record: &Record,
    route: &Route,
) -> Result<()> {
    let hint = record.hint.as_ref().ok_or(PairingError::LanUnavailable)?;
    revoke_checked(socket, key, record, || route.check(hint.ip)).await
}

async fn revoke_checked(
    socket: TcpStream,
    key: Arc<CertifiedKey>,
    record: &Record,
    check_route: impl Fn() -> Result<()>,
) -> Result<()> {
    let hint = record.hint.as_ref().ok_or(PairingError::LanUnavailable)?;
    let mut channel =
        crate::file_sender::Channel::connect(socket, key, record, &check_route).await?;
    let request = Request::builder()
        .method("POST")
        .uri("/v1/pair/revoke")
        .header("host", hint.ip.to_string())
        .header("x-kloda-pair", crate::qr_base64::encode(&record.sid))
        .header("content-length", "0")
        .body(Body::empty())
        .map_err(|_| PairingError::NativeUnsupported)?;
    let response = channel.exchange(request, 128, &check_route).await?;
    if response.status() != StatusCode::OK {
        return Err(PairingError::TlsRejected);
    }
    let ack: Ack =
        serde_json::from_slice(response.body()).map_err(|_| PairingError::TlsRejected)?;
    if ack.state != "pc_confirmed"
        || crate::qr_base64::fixed::<16>(&ack.pair_id).map_err(|_| PairingError::TlsRejected)?
            != record.sid
    {
        return Err(PairingError::TlsRejected);
    }
    check_route()?;
    Ok(())
}

#[cfg(test)]
pub(crate) async fn revoke_loopback_fixture(
    socket: TcpStream,
    key: Arc<CertifiedKey>,
    record: &Record,
) -> Result<()> {
    // Synthetic loopback is not production route or custody evidence.
    revoke_checked(socket, key, record, || Ok(())).await
}
