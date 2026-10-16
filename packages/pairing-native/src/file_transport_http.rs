use crate::file_protocol::{self as protocol, Error, Request, Response};
use crate::file_transport::Command;
use crate::file_transport_io::Evidence;
use axum::body::{to_bytes, Body};
use axum::extract::{ConnectInfo, State};
use axum::http::{HeaderMap, Method, StatusCode};
use axum::response::Response as HttpResponse;
use axum::Router;
use tokio::sync::{mpsc, oneshot};

pub(crate) fn router(commands: mpsc::Sender<Command>) -> Router {
    Router::new().fallback(handle).with_state(commands)
}
async fn handle(
    State(commands): State<mpsc::Sender<Command>>,
    ConnectInfo(evidence): ConnectInfo<Evidence>,
    http: axum::extract::Request,
) -> HttpResponse {
    match execute(commands, evidence, http).await {
        Ok((response, sid)) => encode(response, &sid),
        Err(error) => failure(error),
    }
}
async fn execute(
    commands: mpsc::Sender<Command>,
    evidence: Evidence,
    http: axum::extract::Request,
) -> protocol::Result<(Response, [u8; 16])> {
    evidence.check_live().map_err(Error::from)?;
    let (parts, body) = http.into_parts();
    let sid = crate::qr_base64::fixed::<16>(header(&parts.headers, "x-kloda-pair")?)
        .map_err(|_| Error::InvalidRequest)?;
    let offset = || decimal(header(&parts.headers, "x-kloda-offset")?);
    let path = parts.uri.path();
    let query = parts.uri.query();
    let method = &parts.method;
    let mut request = if method == Method::POST && path == "/v1/operations" && query.is_none() {
        Request::Create(
            serde_json::from_slice(
                &to_bytes(body, protocol::METADATA_LIMIT)
                    .await
                    .map_err(|_| Error::InvalidRequest)?,
            )
            .map_err(|_| Error::InvalidRequest)?,
        )
    } else if method == Method::GET && path == "/v1/photos" {
        let after = match query {
            None => None,
            Some(query) => Some(id(query
                .strip_prefix("after=")
                .ok_or(Error::InvalidRequest)?)?),
        };
        empty(body).await?;
        Request::List { after }
    } else if method == Method::POST && path == "/v1/pair/revoke" && query.is_none() {
        empty(body).await?;
        Request::RevokePair
    } else if let Some(tail) = path.strip_prefix("/v1/operations/") {
        if query.is_some() {
            return Err(Error::InvalidRequest);
        }
        let (key, suffix) = tail.split_once('/').unwrap_or((tail, ""));
        let id = id(key)?;
        match (method, suffix) {
            (&Method::PUT, "bytes") => {
                let offset = offset()?;
                let bytes = to_bytes(body, protocol::CHUNK_LIMIT)
                    .await
                    .map_err(|_| Error::InvalidRequest)?
                    .to_vec();
                Request::Chunk { id, offset, bytes }
            }
            (&Method::POST, "finalize") => {
                empty(body).await?;
                Request::Finalize { id }
            }
            (&Method::GET, "") => {
                empty(body).await?;
                Request::Status { id }
            }
            _ => return Err(Error::InvalidRequest),
        }
    } else if let Some(tail) = path.strip_prefix("/v1/photos/") {
        if method != Method::GET || query.is_some() {
            return Err(Error::InvalidRequest);
        }
        let id = id(tail.strip_suffix("/bytes").ok_or(Error::InvalidRequest)?)?;
        let offset = offset()?;
        empty(body).await?;
        Request::Restore { id, offset }
    } else {
        return Err(Error::NotFound);
    };
    loop {
        evidence.check_live().map_err(Error::from)?;
        let finalize = match &request {
            Request::Finalize { id } => Some(id.clone()),
            _ => None,
        };
        let (reply, result) = oneshot::channel();
        commands
            .try_send(Command {
                evidence: evidence.clone(),
                sid,
                request,
                reply,
            })
            .map_err(|_| Error::BackupBusy)?;
        let response = result.await.map_err(|_| Error::ConnectionClosed)??;
        if !matches!(response, Response::Pending) {
            return Ok((response, sid));
        }
        request = Request::Finalize {
            id: finalize.ok_or(Error::OutcomeUnknown)?,
        };
        // Each bounded hash/publication step returns through the local management queue.
        tokio::task::yield_now().await;
    }
}
fn header<'a>(headers: &'a HeaderMap, name: &str) -> protocol::Result<&'a str> {
    let mut values = headers.get_all(name).iter();
    let value = values.next().ok_or(Error::InvalidRequest)?;
    if values.next().is_some() {
        return Err(Error::InvalidRequest);
    }
    value.to_str().map_err(|_| Error::InvalidRequest)
}
fn decimal(text: &str) -> protocol::Result<u64> {
    if text.is_empty()
        || text.len() > 20
        || (text.len() > 1 && text.starts_with('0'))
        || !text.bytes().all(|b| b.is_ascii_digit())
    {
        return Err(Error::InvalidRequest);
    }
    text.parse().map_err(|_| Error::InvalidRequest)
}
fn id(text: &str) -> protocol::Result<String> {
    crate::qr_base64::fixed::<16>(text).map_err(|_| Error::InvalidRequest)?;
    Ok(text.to_owned())
}
async fn empty(body: Body) -> protocol::Result<()> {
    if !to_bytes(body, 0)
        .await
        .map_err(|_| Error::InvalidRequest)?
        .is_empty()
    {
        return Err(Error::InvalidRequest);
    }
    Ok(())
}
fn json(value: impl serde::Serialize, status: StatusCode) -> HttpResponse {
    match serde_json::to_vec(&value) {
        Ok(bytes) => HttpResponse::builder()
            .status(status)
            .header("content-type", "application/json")
            .body(Body::from(bytes))
            .expect("static HTTP response"),
        Err(_) => HttpResponse::builder()
            .status(StatusCode::INTERNAL_SERVER_ERROR)
            .body(Body::empty())
            .expect("static HTTP response"),
    }
}
fn encode(response: Response, sid: &[u8; 16]) -> HttpResponse {
    match response {
        Response::Operation(operation) => json(operation, StatusCode::OK),
        Response::List(operations) => json(operations, StatusCode::OK),
        Response::PairRevoked => {
            let mut response = json(
                serde_json::json!({
                    "state":"pc_confirmed", "pairId":crate::qr_base64::encode(sid),
                }),
                StatusCode::OK,
            );
            response.headers_mut().insert(
                axum::http::header::CONNECTION,
                axum::http::HeaderValue::from_static("close"),
            );
            response
        }
        Response::Data {
            bytes,
            offset,
            size,
        } => HttpResponse::builder()
            .status(StatusCode::OK)
            .header("content-type", "application/octet-stream")
            .header("x-kloda-offset", offset.to_string())
            .header("x-kloda-size", size.to_string())
            .body(Body::from(bytes))
            .expect("static HTTP response"),
        Response::Pending => failure(Error::OutcomeUnknown),
    }
}
fn failure(code: Error) -> HttpResponse {
    let status = match code {
        Error::InvalidRequest | Error::BackupPathRejected => StatusCode::BAD_REQUEST,
        Error::Denied | Error::BackupPermissionDenied => StatusCode::FORBIDDEN,
        Error::NotFound => StatusCode::NOT_FOUND,
        Error::Conflict | Error::HashMismatch | Error::BackupScopeChanged => StatusCode::CONFLICT,
        Error::AclBusy | Error::BackupBusy => StatusCode::LOCKED,
        Error::BackupFull => StatusCode::INSUFFICIENT_STORAGE,
        Error::OutcomeUnknown => StatusCode::INTERNAL_SERVER_ERROR,
        _ => StatusCode::SERVICE_UNAVAILABLE,
    };
    let retryable = matches!(
        code,
        Error::AclBusy
            | Error::BackupBusy
            | Error::AclUnavailable
            | Error::BackupUnavailable
            | Error::ConnectionClosed
            | Error::OutcomeUnknown
    );
    json(
        serde_json::json!({"code":code,"retryable":retryable}),
        status,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn native_wire_offset_is_canonical_and_bounded() {
        assert_eq!(decimal("0"), Ok(0));
        assert_eq!(decimal("18446744073709551615"), Ok(u64::MAX));
        for bad in ["", "00", "+1", " 1", "18446744073709551616"] {
            assert_eq!(decimal(bad), Err(Error::InvalidRequest));
        }
    }
}
