use super::*;
use crate::store_rows::{RecordRole, RecordState};
use zeroize::Zeroizing;

impl Actor {
    pub(super) fn scan(&mut self, text: Zeroizing<String>) -> Result<()> {
        if !matches!(self.context.role, OwnerRole::Phone) {
            return Err(PairingError::NativeUnsupported);
        }
        let payload = crate::qr::parse(&text)?;
        drop(text);
        if self.phone.as_ref().is_some_and(|work| {
            work.source.is_some()
                || (work.io.is_some() && work.engine.is_none())
                || work.engine.as_ref().is_some_and(|engine| {
                    !matches!(engine.phase(), Phase::Complete | Phase::Revoked)
                })
        }) {
            return Err(PairingError::AlreadyPaired);
        }
        if let Some(record) = self.installation.store.record(&payload.sid)? {
            return Err(if record.state == RecordState::Revoked {
                PairingError::Revoked
            } else {
                PairingError::AlreadyPaired
            });
        }
        #[cfg(target_os = "android")]
        let route = crate::route::for_peer(&payload.hint, &self.context.platform)?;
        #[cfg(not(target_os = "android"))]
        let route = crate::route::for_peer(&payload.hint)?;
        route.check(payload.hint.ip)?;
        self.phone = Some(PhoneWork {
            sid: payload.sid,
            hint: payload.hint.clone(),
            expected: payload.pc_fingerprint,
            source: Some(PhoneSource::Scan(payload)),
            route: Some(route),
            io: None,
            engine: None,
            repair: None,
            approval_wait: false,
            initial: true,
            commit_seen: false,
            complete_seen: false,
        });
        self.terminal = None;
        self.error = None;
        // The actor replies CONNECTING now. No connect, handshake, PENDING, or proof has
        // happened yet. Those are separate owned work units after the queue is drained.
        Ok(())
    }

    pub(super) fn resume_phone(&mut self, record: Record) -> Result<()> {
        if self.phone.as_ref().is_some_and(|work| {
            work.source.is_some() || (work.sid != record.sid && work.io.is_some())
        }) {
            return Err(PairingError::AlreadyPaired);
        }
        let hint = record.hint.clone().ok_or(PairingError::ContinuityLost)?;
        #[cfg(target_os = "android")]
        let route = crate::route::for_peer(&hint, &self.context.platform)?;
        #[cfg(not(target_os = "android"))]
        let route = crate::route::for_peer(&hint)?;
        route.check(hint.ip)?;
        self.phone = Some(PhoneWork {
            sid: record.sid,
            hint,
            expected: record.expected,
            source: Some(PhoneSource::Resume),
            route: Some(route),
            io: None,
            engine: None,
            repair: None,
            approval_wait: false,
            initial: false,
            commit_seen: false,
            complete_seen: false,
        });
        self.retained = Some(record);
        Ok(())
    }

    pub(super) fn approve_phone(
        &mut self,
        sid: [u8; 16],
        generation: u64,
        _now: u64,
    ) -> Result<()> {
        let mut work = self.phone.take().ok_or(PairingError::CandidateStale)?;
        let result = (|| {
            if work.sid != sid
                || work.repair.is_none()
                || work.io.as_ref().map(|io| io.tls.generation()) != Some(generation)
            {
                return Err(PairingError::CandidateStale);
            }
            let io = work.io.as_mut().ok_or(PairingError::CandidateStale)?;
            work.route
                .as_ref()
                .ok_or(PairingError::LanUnavailable)?
                .check(io.tls.peer_ip()?)?;
            io.tls.pump(self.now()?)?;
            io.tls.authorize_live()?;
            let now = self.now()?;
            io.tls.check_deadline(now, false)?;
            let channel = io.channel.as_ref().ok_or(PairingError::CandidateStale)?;
            let Some(PhoneSource::Scan(payload)) = work.source.take() else {
                return Err(PairingError::CandidateStale);
            };
            let old = work.repair.take().ok_or(PairingError::CandidateStale)?;
            let (engine, frame) =
                Phone::start_repair(&mut self.installation.store, payload, channel, old)?;
            work.engine = Some(engine);
            io.queue(frame, SentKind::Request, true)?;
            io.tls.progress(now)?;
            self.refresh(&sid)?;
            self.error = None;
            Ok(())
        })();
        if let Err(error) = result {
            if error != PairingError::CandidateStale {
                work.io = None;
                work.source = None;
                work.route = None;
                work.repair = None;
                work.approval_wait = false;
                if work.engine.is_none() {
                    self.terminal = Some((work.sid, Phase::Invalid));
                }
                self.error = Some(error);
            }
        }
        self.phone = Some(work);
        result
    }

    pub(super) fn cancel_phone(&mut self, sid: [u8; 16]) -> Result<()> {
        let owns = self.phone.as_ref().is_some_and(|work| work.sid == sid)
            || self
                .retained
                .as_ref()
                .is_some_and(|record| record.sid == sid && record.role == RecordRole::Phone)
            || self.terminal.is_some_and(|(operation, _)| operation == sid);
        if !owns {
            return Err(PairingError::CandidateStale);
        }
        let mut work = if self.phone.as_ref().is_some_and(|work| work.sid == sid) {
            self.phone.take()
        } else {
            None
        };
        // Drop all live socket/secret state even if the tombstone commit fails.
        if let Some(work) = &mut work {
            work.io = None;
            work.source = None;
            work.route = None;
        }
        let record = self.installation.store.record(&sid)?;
        if record.is_some() {
            if let Some(engine) = work.as_mut().and_then(|work| work.engine.as_mut()) {
                engine.cancel(&mut self.installation.store)?;
                self.refresh(&sid)?;
            } else {
                self.retained = Some(self.installation.store.phone_revoke(&sid)?);
            }
            self.terminal = None;
        } else {
            self.terminal = Some((sid, Phase::Invalid));
        }
        self.error = Some(PairingError::Cancelled);
        Ok(())
    }
}
