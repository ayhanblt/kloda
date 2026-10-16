use std::fmt;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PairingError {
    InvalidQr,
    InvalidRequest,
    UnsupportedVersion,
    LanUnavailable,
    NativeUnsupported,
    IdentityUnavailable,
    ContinuityLost,
    TlsRejected,
    ProofRejected,
    InvitationExpired,
    CandidateStale,
    AlreadyPaired,
    StorageFailure,
    ConnectionClosed,
    OutcomeUnknown,
    Cancelled,
    Revoked,
    AclBusy,
    AclUnavailable,
    BackupUnavailable,
    BackupFull,
    BackupBusy,
    BackupPermissionDenied,
    BackupPathRejected,
    BackupScopeChanged,
}

impl PairingError {
    pub fn code(self) -> &'static str {
        match self {
            Self::InvalidQr => "invalid_qr",
            Self::UnsupportedVersion => "unsupported_version",
            Self::InvalidRequest => "invalid_request",
            Self::LanUnavailable => "lan_unavailable",
            Self::NativeUnsupported => "native_unsupported",
            Self::IdentityUnavailable => "identity_unavailable",
            Self::ContinuityLost => "continuity_lost",
            Self::TlsRejected => "tls_rejected",
            Self::ProofRejected => "proof_rejected",
            Self::InvitationExpired => "invitation_expired",
            Self::CandidateStale => "candidate_stale",
            Self::AlreadyPaired => "already_paired",
            Self::StorageFailure => "storage_failure",
            Self::ConnectionClosed => "connection_closed",
            Self::OutcomeUnknown => "outcome_unknown",
            Self::Cancelled => "cancelled",
            Self::Revoked => "revoked",
            Self::AclBusy => "acl_busy",
            Self::AclUnavailable => "acl_unavailable",
            Self::BackupUnavailable => "backup_unavailable",
            Self::BackupPermissionDenied => "backup_permission_denied",
            Self::BackupFull => "backup_full",
            Self::BackupBusy => "backup_busy",
            Self::BackupPathRejected => "backup_path_rejected",
            Self::BackupScopeChanged => "backup_scope_changed",
        }
    }
}

impl fmt::Display for PairingError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.code())
    }
}

impl std::error::Error for PairingError {}
pub type Result<T, E = PairingError> = std::result::Result<T, E>;
