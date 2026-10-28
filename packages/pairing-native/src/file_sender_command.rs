use crate::error::{PairingError, Result};
use crate::file_protocol::{Operation, Upload, CHUNK_LIMIT, METADATA_LIMIT};
use serde::{Deserialize, Serialize};
use std::fs::File;

#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
pub(crate) enum Command {
    Create {
        upload: Upload,
    },
    Status {
        id: String,
    },
    Chunk {
        id: String,
        offset: u64,
        length: usize,
    },
    Finalize {
        id: String,
    },
    List {
        after: Option<String>,
    },
    Restore {
        id: String,
        offset: u64,
    },
}
pub(crate) struct Task {
    pub(crate) command: Command,
    pub(crate) file: Option<File>,
}
#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Reply {
    pub(crate) status: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) operation: Option<Operation>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) photos: Option<Vec<Operation>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) offset: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) size: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) error_code: Option<String>,
}
impl Task {
    pub(crate) fn parse(json: &str, descriptor: i32) -> Result<Self> {
        Self::parse_allowed(json, descriptor, false)
    }
    #[cfg(any(target_os = "ios", all(test, feature = "ios-ffi")))]
    pub(crate) fn parse_background(json: &str, descriptor: i32) -> Result<Self> {
        Self::parse_allowed(json, descriptor, true)
    }
    fn parse_allowed(json: &str, descriptor: i32, background: bool) -> Result<Self> {
        if json.len() > METADATA_LIMIT {
            return Err(PairingError::InvalidRequest);
        }
        let command: Command =
            serde_json::from_str(json).map_err(|_| PairingError::InvalidRequest)?;
        if background && matches!(command, Command::List { .. } | Command::Restore { .. }) {
            return Err(PairingError::InvalidRequest);
        }
        match &command {
            Command::Create { upload } => validate_upload(upload)?,
            Command::Chunk { id, offset, length } => {
                validate_id(id)?;
                if *length == 0
                    || *length > CHUNK_LIMIT
                    || offset.checked_add(*length as u64).is_none()
                {
                    return Err(PairingError::InvalidRequest);
                }
            }
            Command::Status { id } | Command::Finalize { id } | Command::Restore { id, .. } => {
                validate_id(id)?
            }
            Command::List { after } => {
                if let Some(id) = after {
                    validate_id(id)?;
                }
            }
        }
        let needs_file = matches!(command, Command::Chunk { .. } | Command::Restore { .. });
        let file = if needs_file {
            Some(duplicate(descriptor)?)
        } else {
            if descriptor != -1 {
                return Err(PairingError::InvalidRequest);
            }
            None
        };
        Ok(Self { command, file })
    }
}
pub(crate) fn validate_id(id: &str) -> Result<()> {
    crate::qr_base64::fixed::<16>(id)
        .map(|_| ())
        .map_err(|_| PairingError::InvalidRequest)
}
pub(crate) fn validate_upload(upload: &Upload) -> Result<()> {
    validate_id(&upload.request_id)?;
    validate_id(&upload.source_id)?;
    crate::qr_base64::fixed::<32>(&upload.sha256).map_err(|_| PairingError::InvalidRequest)?;
    if upload.source_revision.is_empty()
        || upload.source_revision.len() > 1024
        || !crate::file_schema::safe_name(&upload.name)
        || upload.size > i64::MAX as u64
    {
        return Err(PairingError::InvalidRequest);
    }
    Ok(())
}
#[cfg(unix)]
fn duplicate(descriptor: i32) -> Result<File> {
    use std::os::fd::FromRawFd;
    use std::os::unix::fs::MetadataExt;
    if descriptor < 0 {
        return Err(PairingError::InvalidRequest);
    }
    let fd = unsafe { libc::fcntl(descriptor, libc::F_DUPFD_CLOEXEC, 0) };
    if fd < 0 {
        return Err(PairingError::BackupUnavailable);
    }
    let file = unsafe { File::from_raw_fd(fd) };
    let metadata = file
        .metadata()
        .map_err(|_| PairingError::BackupUnavailable)?;
    // Native accepts only private regular files, never a provider pipe or shared media FD.
    if !metadata.is_file()
        || metadata.uid() != unsafe { libc::geteuid() }
        || metadata.mode() & 0o077 != 0
        || metadata.mode() & 0o400 == 0
        || metadata.nlink() != 1
    {
        return Err(PairingError::BackupPathRejected);
    }
    Ok(file)
}
#[cfg(not(unix))]
fn duplicate(_: i32) -> Result<File> {
    Err(PairingError::NativeUnsupported)
}

pub(crate) fn json(result: Result<Reply>) -> Result<String> {
    let reply = result.unwrap_or_else(|error| Reply {
        status: 0,
        error_code: Some(error.code().to_owned()),
        ..Reply::default()
    });
    serde_json::to_string(&reply).map_err(|_| PairingError::OutcomeUnknown)
}

#[cfg(test)]
#[path = "file_sender_tests.rs"]
mod tests;
