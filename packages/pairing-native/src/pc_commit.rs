use crate::error::{PairingError, Result};
use crate::frame::Frame;
use crate::pc::Pc;
use crate::state::{Flow, Phase};
use crate::store::Store;
use crate::store_rows::RecordState;
use crate::tls::Channel;

impl Pc {
    /// Exact UI approval and consume authorization share the owner's serialization fence.
    /// The supplied reading is sampled by the native OS clock, never by JS. Once this
    /// decision is ordered, neither a later deadline nor queued cancel rolls it back.
    pub(crate) fn approve(
        &mut self,
        store: &mut Store,
        operation: &[u8; 16],
        generation: u64,
        channel: &Channel,
        now_ms: u64,
    ) -> Result<Frame> {
        if operation != &self.sid
            || self.generation() != Some(generation)
            || self.phase != Phase::Reserved
        {
            return Err(PairingError::CandidateStale);
        }
        self.flow
            .as_ref()
            .ok_or(PairingError::CandidateStale)?
            .check(channel)?;
        self.expire(now_ms)?;
        if let Err(error) = self.continuity(store) {
            self.invalidate();
            return Err(error);
        }
        // APPROVED is memory-only. This is the irreversible authorization ordering point.
        self.authorized = true;
        let peer = &self.flow.as_ref().ok_or(PairingError::CandidateStale)?.peer;
        match store.pc_consume(&self.sid, peer, self.repair) {
            Ok(record) => {
                self.phase = if record.state == RecordState::Complete {
                    Phase::Complete
                } else {
                    Phase::ConsumedPendingAck
                };
                self.proof = None;
                Ok(Frame::Commit { sid: self.sid })
            }
            Err(error) => {
                self.invalidate();
                Err(error)
            }
        }
    }

    /// Only call after the owned TLS writer has successfully sent the returned commit.
    pub(crate) fn commit_sent(&mut self, channel: &Channel) -> Result<()> {
        if !matches!(self.phase, Phase::ConsumedPendingAck | Phase::Complete) {
            return Err(PairingError::CandidateStale);
        }
        let flow = self.flow.as_mut().ok_or(PairingError::CandidateStale)?;
        flow.check(channel)?;
        flow.response_sent = true;
        Ok(())
    }

    pub(crate) fn ack(
        &mut self,
        store: &mut Store,
        channel: &Channel,
        frame: &Frame,
    ) -> Result<Frame> {
        let Frame::Ack { sid } = frame else {
            return Err(PairingError::TlsRejected);
        };
        if sid != &self.sid || !matches!(self.phase, Phase::ConsumedPendingAck | Phase::Complete) {
            return Err(if self.phase == Phase::Revoked {
                PairingError::Revoked
            } else {
                PairingError::TlsRejected
            });
        }
        self.continuity(store)?;
        let flow = self.flow.as_ref().ok_or(PairingError::CandidateStale)?;
        flow.check(channel)?;
        if !flow.response_sent {
            return Err(PairingError::TlsRejected);
        }
        store.pc_complete(&self.sid, &flow.peer)?;
        self.phase = Phase::Complete;
        Ok(Frame::Complete { sid: self.sid })
    }

    pub(crate) fn resume(store: &Store, sid: [u8; 16], channel: &Channel) -> Result<(Self, Frame)> {
        let record = store.pc_recover(&sid, channel.peer())?;
        let phase = if record.state == RecordState::Complete {
            Phase::Complete
        } else {
            Phase::ConsumedPendingAck
        };
        let state = Self {
            sid,
            local: store.local().clone(),
            epoch: *store.epoch(),
            phase,
            flow: Some(Flow::recovery(channel)),
            repair: None,
            proof: None,
            secret: None,
            qr: None,
            created_ms: 0,
            last_ms: 0,
            authorized: true,
        };
        Ok((state, Frame::Commit { sid }))
    }

    /// Matching recovery duplicates reuse the existing flow; they never refresh a deadline.
    pub(crate) fn recover(
        &mut self,
        store: &Store,
        channel: &Channel,
        frame: &Frame,
    ) -> Result<Frame> {
        let Frame::Recover { sid } = frame else {
            return Err(PairingError::TlsRejected);
        };
        if sid != &self.sid || !matches!(self.phase, Phase::ConsumedPendingAck | Phase::Complete) {
            return Err(PairingError::TlsRejected);
        }
        self.continuity(store)?;
        let flow = self.flow.as_ref().ok_or(PairingError::CandidateStale)?;
        flow.check(channel)?;
        if !flow.recovery {
            return Err(PairingError::TlsRejected);
        }
        store.pc_recover(&self.sid, &flow.peer)?;
        Ok(Frame::Commit { sid: self.sid })
    }

    pub(crate) fn deny(
        &mut self,
        store: &mut Store,
        operation: &[u8; 16],
        generation: u64,
    ) -> Result<()> {
        if operation != &self.sid || self.generation() != Some(generation) {
            return Err(PairingError::CandidateStale);
        }
        self.cancel(store)
    }

    pub(crate) fn cancel(&mut self, store: &mut Store) -> Result<()> {
        if self.phase == Phase::Revoked {
            return Ok(());
        }
        if self.authorized {
            // Includes cancel queued after authorization, even when the write outcome
            // was uncertain. A poisoned store refuses further work until reopen/inspection.
            self.invalidate(); // Drain live callbacks even if tombstone persistence fails.
            match store.record(&self.sid)? {
                Some(_) => {
                    store.pc_revoke(&self.sid)?;
                }
                None => {
                    return Ok(());
                }
            }
            self.phase = Phase::Revoked;
        } else {
            self.invalidate();
        }
        Ok(())
    }
}
