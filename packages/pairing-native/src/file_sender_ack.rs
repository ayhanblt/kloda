use crate::error::{PairingError, Result};
use crate::file_protocol::{Error, Operation, OperationState, Upload, CHUNK_LIMIT};
use crate::file_sender_command::{validate_id, Command, Reply, Task};
use axum::http::{HeaderMap, Response};
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Failure {
    code: Error,
    retryable: bool,
}

pub(crate) fn decode<B: AsRef<[u8]>>(
    response: Response<B>,
    task: &Task,
    previous: Option<&Operation>,
) -> Result<Reply> {
    let status = response.status().as_u16();
    let mut reply = Reply {
        status,
        ..Reply::default()
    };
    if status != 200 {
        require_type(response.headers(), "application/json")?;
        let error: Failure = serde_json::from_slice(response.body().as_ref())
            .map_err(|_| PairingError::OutcomeUnknown)?;
        let expected_status = match error.code {
            Error::InvalidRequest | Error::BackupPathRejected => 400,
            Error::Denied | Error::BackupPermissionDenied => 403,
            Error::NotFound => 404,
            Error::Conflict | Error::HashMismatch | Error::BackupScopeChanged => 409,
            Error::AclBusy | Error::BackupBusy => 423,
            Error::BackupFull => 507,
            Error::OutcomeUnknown => 500,
            _ => 503,
        };
        let retryable = matches!(
            error.code,
            Error::AclBusy
                | Error::BackupBusy
                | Error::AclUnavailable
                | Error::BackupUnavailable
                | Error::ConnectionClosed
                | Error::OutcomeUnknown
        );
        if status != expected_status || error.retryable != retryable {
            return Err(PairingError::OutcomeUnknown);
        }
        reply.error_code = Some(
            serde_json::to_value(error.code)
                .map_err(|_| PairingError::OutcomeUnknown)?
                .as_str()
                .ok_or(PairingError::OutcomeUnknown)?
                .to_owned(),
        );
        return Ok(reply);
    }
    match &task.command {
        Command::List { after } => {
            require_type(response.headers(), "application/json")?;
            let photos: Vec<Operation> = serde_json::from_slice(response.body().as_ref())
                .map_err(|_| PairingError::OutcomeUnknown)?;
            if photos.len() > 32 {
                return Err(PairingError::OutcomeUnknown);
            }
            let mut last = after.as_deref();
            for photo in &photos {
                validate(photo)?;
                if photo.state != OperationState::Completed
                    || last.is_some_and(|id| id >= photo.id.as_str())
                {
                    return Err(PairingError::OutcomeUnknown);
                }
                last = Some(&photo.id);
            }
            reply.photos = Some(photos);
        }
        Command::Restore { id, offset } => {
            let old = previous
                .filter(|old| old.id == *id && old.state == OperationState::Completed)
                .ok_or(PairingError::OutcomeUnknown)?;
            require_type(response.headers(), "application/octet-stream")?;
            let actual = decimal(response.headers(), "x-kloda-offset")?;
            let size = decimal(response.headers(), "x-kloda-size")?;
            let bytes = response.body().as_ref();
            if actual != *offset
                || size != old.size
                || size > i64::MAX as u64
                || actual > size
                || bytes.len() != (size - actual).min(CHUNK_LIMIT as u64) as usize
            {
                return Err(PairingError::OutcomeUnknown);
            }
            write(task, actual, bytes)?;
            reply.bytes = Some(bytes.len() as u64);
            reply.offset = Some(actual);
            reply.size = Some(size);
        }
        command => {
            require_type(response.headers(), "application/json")?;
            let operation: Operation = serde_json::from_slice(response.body().as_ref())
                .map_err(|_| PairingError::OutcomeUnknown)?;
            validate(&operation)?;
            match command {
                Command::Create { upload } => {
                    if !same_upload(&operation, upload) {
                        return Err(PairingError::OutcomeUnknown);
                    }
                }
                Command::Status { id } => {
                    if operation.id != *id {
                        return Err(PairingError::OutcomeUnknown);
                    }
                    if let Some(old) = previous.filter(|old| old.id == *id) {
                        same_operation(old, &operation)?;
                    }
                }
                Command::Chunk { id, offset, length } => {
                    let old = previous
                        .filter(|old| old.id == *id)
                        .ok_or(PairingError::OutcomeUnknown)?;
                    same_operation(old, &operation)?;
                    let end = offset
                        .checked_add(*length as u64)
                        .ok_or(PairingError::OutcomeUnknown)?;
                    if operation.state != OperationState::Receiving
                        || operation.offset != old.offset.max(end)
                    {
                        return Err(PairingError::OutcomeUnknown);
                    }
                }
                Command::Finalize { id } => {
                    let old = previous
                        .filter(|old| old.id == *id)
                        .ok_or(PairingError::OutcomeUnknown)?;
                    same_operation(old, &operation)?;
                    if old.offset != old.size || operation.state != OperationState::Completed {
                        return Err(PairingError::OutcomeUnknown);
                    }
                }
                _ => unreachable!(),
            }
            reply.operation = Some(operation);
        }
    }
    Ok(reply)
}
fn same_upload(op: &Operation, upload: &Upload) -> bool {
    op.request_id == upload.request_id
        && op.source_id == upload.source_id
        && op.source_revision == upload.source_revision
        && op.name == upload.name
        && op.sha256 == upload.sha256
        && op.size == upload.size
}
fn same_operation(old: &Operation, op: &Operation) -> Result<()> {
    if op.id != old.id
        || op.request_id != old.request_id
        || op.source_id != old.source_id
        || op.source_revision != old.source_revision
        || op.name != old.name
        || op.sha256 != old.sha256
        || op.size != old.size
        || op.offset < old.offset
        || (op.state as u8) < old.state as u8
    {
        return Err(PairingError::OutcomeUnknown);
    }
    Ok(())
}
fn validate(op: &Operation) -> Result<()> {
    validate_id(&op.id).map_err(|_| PairingError::OutcomeUnknown)?;
    for id in [&op.request_id, &op.source_id] {
        validate_id(id).map_err(|_| PairingError::OutcomeUnknown)?;
    }
    crate::qr_base64::fixed::<32>(&op.sha256).map_err(|_| PairingError::OutcomeUnknown)?;
    if op.source_revision.is_empty()
        || op.source_revision.len() > 1024
        || !crate::file_schema::safe_name(&op.name)
        || op.size > i64::MAX as u64
    {
        return Err(PairingError::OutcomeUnknown);
    }
    if op.offset > op.size || (op.state != OperationState::Receiving && op.offset != op.size) {
        return Err(PairingError::OutcomeUnknown);
    }
    Ok(())
}
fn header<'a>(headers: &'a HeaderMap, name: &str) -> Result<&'a str> {
    let mut values = headers.get_all(name).iter();
    let value = values.next().ok_or(PairingError::OutcomeUnknown)?;
    if values.next().is_some() {
        return Err(PairingError::OutcomeUnknown);
    }
    value.to_str().map_err(|_| PairingError::OutcomeUnknown)
}
fn require_type(headers: &HeaderMap, expected: &str) -> Result<()> {
    if header(headers, "content-type")? != expected {
        return Err(PairingError::OutcomeUnknown);
    }
    Ok(())
}
fn decimal(headers: &HeaderMap, name: &str) -> Result<u64> {
    let text = header(headers, name)?;
    if text.is_empty()
        || text.len() > 20
        || (text.len() > 1 && text.starts_with('0'))
        || !text.bytes().all(|b| b.is_ascii_digit())
    {
        return Err(PairingError::OutcomeUnknown);
    }
    text.parse().map_err(|_| PairingError::OutcomeUnknown)
}
#[cfg(unix)]
fn write(task: &Task, offset: u64, bytes: &[u8]) -> Result<()> {
    use std::os::unix::fs::FileExt;
    let file = task.file.as_ref().ok_or(PairingError::InvalidRequest)?;
    if file
        .metadata()
        .map_err(|_| PairingError::BackupUnavailable)?
        .len()
        != offset
    {
        return Err(PairingError::InvalidRequest);
    }
    file.write_all_at(bytes, offset).map_err(io_error)?;
    file.sync_all().map_err(io_error)
}
#[cfg(not(unix))]
fn write(_: &Task, _: u64, _: &[u8]) -> Result<()> {
    Err(PairingError::NativeUnsupported)
}
fn io_error(error: std::io::Error) -> PairingError {
    match error.raw_os_error() {
        Some(libc::ENOSPC) => PairingError::BackupFull,
        _ => PairingError::BackupUnavailable,
    }
}
