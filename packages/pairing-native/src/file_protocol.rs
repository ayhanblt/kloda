use crate::error::PairingError;
use serde::{Deserialize, Serialize};

pub(crate) const ALPN: &[u8] = b"kloda-file/1";
pub(crate) const CHUNK_LIMIT: usize = 65_536;
pub(crate) const METADATA_LIMIT: usize = 8_192;

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Upload {
    pub(crate) request_id: String,
    pub(crate) source_id: String,
    pub(crate) source_revision: String,
    pub(crate) name: String,
    pub(crate) sha256: String,
    pub(crate) size: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) rebackup_of: Option<String>,
}

pub(crate) enum Request {
    Create(Upload),
    Chunk {
        id: String,
        offset: u64,
        bytes: Vec<u8>,
    },
    Finalize {
        id: String,
    },
    Status {
        id: String,
    },
    List {
        after: Option<String>,
    },
    Restore {
        id: String,
        offset: u64,
    },
    RevokePair,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Operation {
    pub(crate) id: String,
    pub(crate) request_id: String,
    pub(crate) source_id: String,
    pub(crate) source_revision: String,
    pub(crate) name: String,
    pub(crate) sha256: String,
    pub(crate) size: u64,
    pub(crate) offset: u64,
    pub(crate) state: OperationState,
}

#[derive(Clone, Copy, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum OperationState {
    Receiving,
    Validating,
    Publishing,
    Completed,
}

pub(crate) enum Response {
    Operation(Operation),
    List(Vec<Operation>),
    Data {
        bytes: Vec<u8>,
        offset: u64,
        size: u64,
    },
    PairRevoked,
    // Internal bounded finalize work: the HTTP handler resubmits on a later owner turn.
    Pending,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum Error {
    Denied,
    InvalidRequest,
    NotFound,
    OwnerDeleted,
    Conflict,
    HashMismatch,
    AclBusy,
    AclUnavailable,
    BackupUnavailable,
    BackupFull,
    BackupBusy,
    BackupPermissionDenied,
    BackupPathRejected,
    BackupScopeChanged,
    OutcomeUnknown,
    ConnectionClosed,
}

impl From<PairingError> for Error {
    fn from(error: PairingError) -> Self {
        match error {
            PairingError::InvalidRequest => Self::InvalidRequest,
            PairingError::AclBusy => Self::AclBusy,
            PairingError::AclUnavailable => Self::AclUnavailable,
            PairingError::BackupUnavailable => Self::BackupUnavailable,
            PairingError::BackupFull => Self::BackupFull,
            PairingError::BackupBusy => Self::BackupBusy,
            PairingError::BackupPermissionDenied => Self::BackupPermissionDenied,
            PairingError::BackupPathRejected => Self::BackupPathRejected,
            PairingError::BackupScopeChanged => Self::BackupScopeChanged,
            PairingError::OutcomeUnknown
            | PairingError::ContinuityLost
            | PairingError::StorageFailure => Self::OutcomeUnknown,
            PairingError::ConnectionClosed | PairingError::Cancelled => Self::ConnectionClosed,
            PairingError::NativeUnsupported => Self::BackupUnavailable,
            _ => Self::Denied,
        }
    }
}

pub(crate) type Result<T, E = Error> = std::result::Result<T, E>;
