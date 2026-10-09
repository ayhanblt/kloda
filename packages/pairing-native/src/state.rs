use crate::error::{PairingError, Result};
use crate::key::Spki;
use crate::tls::Channel;
use zeroize::Zeroizing;

pub(crate) const INVITATION_MS: u64 = 120_000;

#[derive(Clone, Copy, Eq, PartialEq, Debug)]
pub(crate) enum Phase {
    Open,
    Reserved,
    ConsumedPendingAck,
    Pending,
    PinnedPendingAck,
    Complete,
    Invalid,
    Revoked,
}

#[derive(Clone, Copy, Eq, PartialEq, Debug)]
pub(crate) enum ReserveOutcome {
    Reserved,
    Duplicate,
}

/// Facts copied only from a native verified, owned live TLS channel.
pub(super) struct Flow {
    pub(super) generation: u64,
    pub(super) peer: Spki,
    binding: Zeroizing<[u8; 32]>,
    pub(super) response_sent: bool,
    pub(super) recovery: bool,
}

impl Flow {
    pub(super) fn new(channel: &Channel) -> Self {
        Self {
            generation: channel.generation(),
            peer: channel.peer().clone(),
            binding: Zeroizing::new(*channel.binding()),
            response_sent: false,
            recovery: false,
        }
    }

    pub(super) fn recovery(channel: &Channel) -> Self {
        let mut flow = Self::new(channel);
        flow.recovery = true;
        flow
    }

    pub(super) fn check(&self, channel: &Channel) -> Result<()> {
        if self.generation != channel.generation()
            || self.peer != *channel.peer()
            || self.binding.as_ref() != channel.binding()
        {
            return Err(PairingError::CandidateStale);
        }
        Ok(())
    }
}

#[cfg(test)]
#[path = "state_test_support.rs"]
pub(crate) mod test_support;
