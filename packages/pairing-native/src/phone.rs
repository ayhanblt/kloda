use crate::error::{PairingError, Result};
use crate::frame::Frame;
use crate::key::Spki;
use crate::proof;
use crate::qr::QrPayload;
use crate::state::{Flow, Phase};
use crate::store::Store;
use crate::store_rows::{RecordRole, RecordState};
use crate::tls::Channel;

pub(crate) struct Phone {
    sid: [u8; 16],
    local: Spki,
    epoch: [u8; 16],
    phase: Phase,
    flow: Option<Flow>,
    request_sent: bool,
}

impl Phone {
    pub(crate) fn start(
        store: &mut Store,
        payload: QrPayload,
        channel: &Channel,
    ) -> Result<(Self, Frame)> {
        Self::start_inner(store, payload, channel, None)
    }

    /// Called only after exact native-derived candidate approval in the Pair again modal.
    pub(crate) fn start_repair(
        store: &mut Store,
        payload: QrPayload,
        channel: &Channel,
        old_revoked_sid: [u8; 16],
    ) -> Result<(Self, Frame)> {
        Self::start_inner(store, payload, channel, Some(old_revoked_sid))
    }

    fn start_inner(
        store: &mut Store,
        payload: QrPayload,
        channel: &Channel,
        consent: Option<[u8; 16]>,
    ) -> Result<(Self, Frame)> {
        if payload.pc_fingerprint != channel.peer().fingerprint() {
            return Err(PairingError::TlsRejected);
        }
        // No proof exists until both the binding and retry hint commit durably.
        store.phone_pending(
            &payload.sid,
            &payload.pc_fingerprint,
            &payload.hint,
            consent,
        )?;
        let tag = proof::tag(
            &payload.secret,
            &payload.sid,
            &payload.pc_fingerprint,
            &store.local().fingerprint(),
            channel.binding(),
        );
        let sid = payload.sid;
        drop(payload); // Zeroizing raw secret cannot survive into the retained session.
        let state = Self {
            sid,
            local: store.local().clone(),
            epoch: *store.epoch(),
            phase: Phase::Pending,
            flow: Some(Flow::new(channel)),
            request_sent: false,
        };
        Ok((state, Frame::Proof { sid, tag }))
    }

    pub(crate) fn repair_required(
        store: &Store,
        payload: &QrPayload,
        channel: &Channel,
    ) -> Result<Option<[u8; 16]>> {
        if payload.pc_fingerprint != channel.peer().fingerprint() {
            return Err(PairingError::TlsRejected);
        }
        store.repair_required(RecordRole::Phone, &payload.pc_fingerprint)
    }

    pub(crate) fn resume(store: &Store, sid: [u8; 16], channel: &Channel) -> Result<(Self, Frame)> {
        let record = store.phone_recover(&sid, channel.peer())?;
        let phase = match record.state {
            RecordState::Pending => Phase::Pending,
            RecordState::PinnedPendingAck => Phase::PinnedPendingAck,
            RecordState::Complete => Phase::Complete,
            _ => return Err(PairingError::TlsRejected),
        };
        Ok((
            Self {
                sid,
                local: store.local().clone(),
                epoch: *store.epoch(),
                phase,
                flow: Some(Flow::recovery(channel)),
                request_sent: false,
            },
            Frame::Recover { sid },
        ))
    }

    pub(crate) fn phase(&self) -> Phase {
        self.phase
    }
    pub(crate) fn generation(&self) -> Option<u64> {
        self.flow.as_ref().map(|f| f.generation)
    }

    /// Called after the native writer sends this flow's single proof or recover request.
    pub(crate) fn request_sent(&mut self, channel: &Channel) -> Result<()> {
        self.flow
            .as_ref()
            .ok_or(PairingError::CandidateStale)?
            .check(channel)?;
        if self.request_sent {
            return Err(PairingError::CandidateStale);
        }
        self.request_sent = true;
        Ok(())
    }

    pub(crate) fn commit(
        &mut self,
        store: &mut Store,
        channel: &Channel,
        frame: &Frame,
    ) -> Result<Frame> {
        let Frame::Commit { sid } = frame else {
            return Err(PairingError::TlsRejected);
        };
        if sid != &self.sid {
            return Err(PairingError::TlsRejected);
        }
        self.continuity(store)?;
        let flow = self.flow.as_ref().ok_or(PairingError::CandidateStale)?;
        flow.check(channel)?;
        if !self.request_sent {
            return Err(PairingError::TlsRejected);
        }
        let record = store.phone_pin(&self.sid, &flow.peer)?;
        self.phase = if record.state == RecordState::Complete {
            Phase::Complete
        } else {
            Phase::PinnedPendingAck
        };
        // The returned ACK is gated on the durable exact key/pin, including duplicates.
        Ok(Frame::Ack { sid: self.sid })
    }

    /// Actual successful native TLS write callback, not a caller-created trust flag.
    pub(crate) fn ack_sent(&mut self, channel: &Channel) -> Result<()> {
        if !matches!(self.phase, Phase::PinnedPendingAck | Phase::Complete) {
            return Err(PairingError::TlsRejected);
        }
        let flow = self.flow.as_mut().ok_or(PairingError::CandidateStale)?;
        flow.check(channel)?;
        flow.response_sent = true;
        Ok(())
    }

    pub(crate) fn complete(
        &mut self,
        store: &mut Store,
        channel: &Channel,
        frame: &Frame,
    ) -> Result<()> {
        let Frame::Complete { sid } = frame else {
            return Err(PairingError::TlsRejected);
        };
        if sid != &self.sid {
            return Err(PairingError::TlsRejected);
        }
        self.continuity(store)?;
        let flow = self.flow.as_ref().ok_or(PairingError::CandidateStale)?;
        flow.check(channel)?;
        if !flow.response_sent {
            return Err(PairingError::TlsRejected);
        }
        store.phone_complete(&self.sid, &flow.peer)?;
        self.phase = Phase::Complete;
        Ok(())
    }

    pub(crate) fn cancel(&mut self, store: &mut Store) -> Result<()> {
        // A failed/uncertain disable still drains the live callback generation immediately.
        self.flow = None;
        store.phone_revoke(&self.sid)?;
        self.phase = Phase::Revoked;
        Ok(())
    }

    pub(crate) fn disconnect(&mut self, generation: u64) {
        if self.generation() == Some(generation) {
            self.flow = None;
        }
    }

    fn continuity(&self, store: &Store) -> Result<()> {
        if self.phase == Phase::Revoked {
            return Err(PairingError::Revoked);
        }
        if self.local != *store.local() || self.epoch != *store.epoch() {
            return Err(PairingError::ContinuityLost);
        }
        store.ready()
    }
}

#[cfg(test)]
#[path = "phone_tests.rs"]
mod tests;
