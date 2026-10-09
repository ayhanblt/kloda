use super::*;
use crate::frame::Frame;
use crate::state::ReserveOutcome;

impl Actor {
    pub(super) fn pc_step(&mut self, peer: &mut PcPeer, _now: u64) -> Result<()> {
        let route = &self
            .listener
            .as_ref()
            .ok_or(PairingError::LanUnavailable)?
            .route;
        route.check(peer.io.tls.peer_ip()?)?;
        let now = self.now()?;
        peer.io.check_handshake(now)?;
        let human = peer.recovery.is_none()
            && self.pc.as_ref().is_some_and(|pc| {
                pc.phase() == Phase::Reserved && pc.generation() == Some(peer.io.tls.generation())
            });
        peer.io.tls.check_deadline(now, human)?;
        if peer.io.pump_next {
            peer.io.tls.pump(now)?;
            peer.io.pump_next = false;
            return Ok(());
        }
        peer.io.pump_next = true;
        if !peer.io.tls.established() {
            return Ok(());
        }
        if peer.io.has_output() {
            if let Some(sent) = peer.io.flush()? {
                if matches!(sent.kind, SentKind::Commit) {
                    let channel = peer.io.channel.as_ref().ok_or(PairingError::TlsRejected)?;
                    if let Some(pc) = &mut peer.recovery {
                        pc.commit_sent(channel)?;
                    } else {
                        self.pc
                            .as_mut()
                            .ok_or(PairingError::CandidateStale)?
                            .commit_sent(channel)?;
                    }
                }
                if sent.advances {
                    peer.io.tls.progress(now)?;
                }
            }
            return Ok(());
        }
        let Some(frame) = peer.io.tls.next_frame(now)? else {
            return Ok(());
        };
        let sid = *frame.sid();
        peer.io.bind(sid, self.installation.store.local())?;
        let channel = peer.io.channel.as_ref().ok_or(PairingError::TlsRejected)?;
        if let Some(pc) = &mut peer.recovery {
            let (response, advances) = match &frame {
                Frame::Recover { .. } => (
                    pc.recover(&self.installation.store, channel, &frame)?,
                    false,
                ),
                Frame::Ack { .. } => {
                    let advances = !peer.io.ack_seen;
                    let response = pc.ack(&mut self.installation.store, channel, &frame)?;
                    peer.io.ack_seen = true;
                    (response, advances)
                }
                _ => return Err(PairingError::TlsRejected),
            };
            let kind = if matches!(&response, Frame::Commit { .. }) {
                SentKind::Commit
            } else {
                SentKind::Complete
            };
            peer.io.queue(response, kind, advances)?;
            if advances {
                peer.io.tls.progress(now)?;
            }
            // Recovery for an old durable sid never replaces an unrelated OPEN invitation.
            if self.focuses(&sid) {
                self.refresh(&sid)?;
            }
            return Ok(());
        }
        match &frame {
            Frame::Recover { .. } => {
                let (pc, response) = Pc::resume(&self.installation.store, sid, channel)?;
                peer.recovery = Some(pc);
                peer.io.queue(response, SentKind::Commit, true)?;
                peer.io.tls.progress(now)?;
                if self
                    .pc
                    .as_ref()
                    .is_none_or(|pc| !matches!(pc.phase(), Phase::Open | Phase::Reserved))
                {
                    self.refresh(&sid)?;
                    self.error = None;
                }
            }
            Frame::Proof { .. } => {
                let pc = self.pc.as_mut().ok_or(PairingError::ProofRejected)?;
                if pc.sid() != &sid {
                    return Err(PairingError::ProofRejected);
                }
                match pc.reserve(&self.installation.store, channel, &frame, now)? {
                    ReserveOutcome::Reserved => {
                        peer.io.tls.progress(now)?;
                        self.error = None;
                    }
                    ReserveOutcome::Duplicate => (),
                }
            }
            Frame::Ack { .. } => {
                let pc = self.pc.as_mut().ok_or(PairingError::TlsRejected)?;
                let advances = !peer.io.ack_seen;
                let response = pc.ack(&mut self.installation.store, channel, &frame)?;
                peer.io.ack_seen = true;
                peer.io.queue(response, SentKind::Complete, advances)?;
                if advances {
                    peer.io.tls.progress(now)?;
                }
                self.refresh(&sid)?;
            }
            _ => return Err(PairingError::TlsRejected),
        }
        Ok(())
    }

    pub(super) fn focuses(&self, sid: &[u8; 16]) -> bool {
        if let Some(pc) = &self.pc {
            if matches!(pc.phase(), Phase::Open | Phase::Reserved) {
                return pc.sid() == sid;
            }
            if pc.sid() == sid {
                return true;
            }
        }
        self.retained
            .as_ref()
            .is_some_and(|record| &record.sid == sid)
    }

    pub(super) fn pc_failure(&mut self, peer: &PcPeer, error: PairingError) {
        let generation = peer.io.tls.generation();
        let winner = self
            .pc
            .as_ref()
            .is_some_and(|pc| pc.generation() == Some(generation));
        let relevant = winner
            || peer
                .io
                .sid
                .as_ref()
                .is_some_and(|sid| peer.recovery.is_some() && self.focuses(sid));
        if winner {
            if let Some(pc) = &mut self.pc {
                pc.disconnect(generation);
            }
        }
        if matches!(
            error,
            PairingError::StorageFailure
                | PairingError::OutcomeUnknown
                | PairingError::ContinuityLost
                | PairingError::IdentityUnavailable
                | PairingError::NativeUnsupported
        ) {
            self.fail_all(error);
        } else if relevant {
            let durable = peer.io.sid.as_ref().is_some_and(|sid| {
                self.retained
                    .as_ref()
                    .is_some_and(|record| &record.sid == sid)
            });
            let complete = self.retained.as_ref().is_some_and(|record| {
                peer.io.sid == Some(record.sid)
                    && record.state == crate::store_rows::RecordState::Complete
            });
            if !(complete && error == PairingError::ConnectionClosed) {
                self.error = Some(if durable && error == PairingError::ConnectionClosed {
                    PairingError::OutcomeUnknown
                } else {
                    error
                });
            }
        }
        // Drop of the removed peer drains its actual socket and all proof/exporter buffers.
    }
}
