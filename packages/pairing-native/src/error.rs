use std::fmt;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PairingError {
    InvalidQr,
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
}

impl PairingError {
    pub fn code(self) -> &'static str {
        match self {
            Self::InvalidQr => "invalid_qr",
            Self::UnsupportedVersion => "unsupported_version",
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
