use crate::error::{PairingError, Result};
use crate::frame::Frame;
use crate::key::Spki;
use crate::proof;
use crate::qr::{self, LanHint, QrPayload};
use crate::state::{Flow, Phase, ReserveOutcome, INVITATION_MS};
use crate::store::Store;
use crate::store_rows::RecordRole;
use crate::tls::Channel;
use ring::rand::{SecureRandom, SystemRandom};
use zeroize::Zeroizing;

/// All operations run in the native owner's single serialization domain, including writes.
pub(crate) struct Pc {
    pub(super) sid: [u8; 16],
    pub(super) local: Spki,
    pub(super) epoch: [u8; 16],
    pub(super) phase: Phase,
    pub(super) flow: Option<Flow>,
    pub(super) repair: Option<[u8; 16]>,
    pub(super) proof: Option<Zeroizing<[u8; 32]>>,
    pub(super) secret: Option<Zeroizing<[u8; 32]>>,
    pub(super) qr: Option<Zeroizing<String>>,
    pub(super) created_ms: u64,
    pub(super) last_ms: u64,
    pub(super) authorized: bool,
}

impl Pc {
    pub(crate) fn create(store: &Store, hint: LanHint, now_ms: u64) -> Result<Self> {
        crate::store_rows::validate_hint(&hint)?;
        let random = SystemRandom::new();
        let mut sid = [0; 16];
        loop {
            random
                .fill(&mut sid)
                .map_err(|_| PairingError::NativeUnsupported)?;
            if !store.sid_exists(&sid)? {
                break;
            }
        }
        let mut secret = Zeroizing::new([0; 32]);
        random
            .fill(secret.as_mut())
            .map_err(|_| PairingError::NativeUnsupported)?;
        let payload = QrPayload {
            sid,
            pc_fingerprint: store.local().fingerprint(),
            secret,
            hint,
        };
        let encoded = Zeroizing::new(qr::encode(&payload)?);
        Ok(Self {
            sid,
            local: store.local().clone(),
            epoch: *store.epoch(),
            phase: Phase::Open,
            flow: None,
            repair: None,
            proof: None,
            secret: Some(payload.secret),
            qr: Some(encoded),
            created_ms: now_ms,
            last_ms: now_ms,
            authorized: false,
        })
    }

    pub(crate) fn sid(&self) -> &[u8; 16] {
        &self.sid
    }
    pub(crate) fn phase(&self) -> Phase {
        self.phase
    }
    pub(crate) fn qr(&self) -> Option<&str> {
        self.qr.as_ref().map(|qr| qr.as_str())
    }
    pub(crate) fn generation(&self) -> Option<u64> {
        self.flow.as_ref().map(|f| f.generation)
    }
    pub(crate) fn peer_fingerprint(&self) -> Option<[u8; 32]> {
        self.flow.as_ref().map(|f| f.peer.fingerprint())
    }
    pub(crate) fn repair_required(&self) -> bool {
        self.repair.is_some()
    }

    pub(crate) fn remaining_ms(&self, now_ms: u64) -> Result<u64> {
        if now_ms < self.last_ms {
            return Err(PairingError::InvitationExpired);
        }
        let elapsed = now_ms
            .checked_sub(self.created_ms)
            .ok_or(PairingError::InvitationExpired)?;
        Ok(INVITATION_MS.saturating_sub(elapsed))
    }

    pub(crate) fn expire(&mut self, now_ms: u64) -> Result<()> {
        if !matches!(self.phase, Phase::Open | Phase::Reserved) {
            return Ok(());
        }
        let remaining = self.remaining_ms(now_ms);
        if remaining.map_or(true, |value| value == 0) {
            self.invalidate();
            return Err(PairingError::InvitationExpired);
        }
        self.last_ms = now_ms;
        Ok(())
    }

    pub(crate) fn reserve(
        &mut self,
        store: &Store,
        channel: &Channel,
        frame: &Frame,
        now_ms: u64,
    ) -> Result<ReserveOutcome> {
        self.expire(now_ms)?;
        let Frame::Proof { sid, tag } = frame else {
            return Err(PairingError::ProofRejected);
        };
        if sid != &self.sid {
            return Err(PairingError::ProofRejected);
        }
        if self.phase == Phase::Reserved {
            let flow = self.flow.as_ref().ok_or(PairingError::CandidateStale)?;
            flow.check(channel)?;
            if self
                .proof
                .as_ref()
                .is_some_and(|saved| saved.as_ref() == tag)
            {
                return Ok(ReserveOutcome::Duplicate);
            }
            return Err(PairingError::ProofRejected);
        }
        if self.phase != Phase::Open {
            return Err(PairingError::CandidateStale);
        }
        self.continuity(store)?;
        let secret = self.secret.as_ref().ok_or(PairingError::CandidateStale)?;
        proof::verify(
            secret,
            &self.sid,
            &self.local.fingerprint(),
            &channel.peer().fingerprint(),
            channel.binding(),
            tag,
        )?;
        let repair = store.repair_required(RecordRole::Pc, &channel.peer().fingerprint())?;
        self.flow = Some(Flow::new(channel));
        self.proof = Some(Zeroizing::new(*tag));
        self.repair = repair;
        self.phase = Phase::Reserved;
        self.secret = None;
        self.qr = None;
        Ok(ReserveOutcome::Reserved)
    }

    /// An unrelated unproved contender does not call this; only the owned winner's failure does.
    pub(crate) fn disconnect(&mut self, generation: u64) {
        if self.generation() != Some(generation) {
            return;
        }
        if matches!(self.phase, Phase::Open | Phase::Reserved) {
            self.invalidate();
        } else {
            self.flow = None;
            self.proof = None;
        }
    }

    pub(crate) fn invalidate(&mut self) {
        self.secret = None;
        self.proof = None;
        self.qr = None;
        self.flow = None;
        self.repair = None;
        self.phase = Phase::Invalid;
    }

    pub(super) fn continuity(&self, store: &Store) -> Result<()> {
        if self.local != *store.local() || self.epoch != *store.epoch() {
            return Err(PairingError::ContinuityLost);
        }
        store.ready()
    }
}

#[cfg(test)]
#[path = "pc_tests.rs"]
mod tests;
