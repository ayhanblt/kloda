use super::*;
use crate::frame::Frame;
use crate::store_rows::RecordState;

impl Actor {
    pub(super) fn phone_tick(&mut self, now: u64) {
        let Some(mut work) = self.phone.take() else {
            return;
        };
        let result = self.phone_step(&mut work, now);
        if let Err(error) = result {
            if let (Some(engine), Some(io)) = (&mut work.engine, &work.io) {
                engine.disconnect(io.tls.generation());
            }
            work.io = None;
            work.route = None;
            work.source = None;
            work.repair = None;
            work.approval_wait = false;
            if work.engine.is_none()
                && self
                    .retained
                    .as_ref()
                    .is_none_or(|record| record.sid != work.sid)
            {
                self.terminal = Some((work.sid, Phase::Invalid));
            }
            if error == PairingError::CandidateStale
                && work.foreground_epoch.is_some()
                && matches!(
                    self.foreground.authorize(work.foreground_epoch),
                    Err(PairingError::CandidateStale)
                )
            {
                // UI departure drops transient pairing only; durable trust and Files remain.
                return;
            }
            if matches!(
                error,
                PairingError::StorageFailure
                    | PairingError::OutcomeUnknown
                    | PairingError::ContinuityLost
            ) {
                self.fail_all(error);
            } else {
                let durable = self
                    .retained
                    .as_ref()
                    .is_some_and(|record| record.sid == work.sid);
                let complete = self.retained.as_ref().is_some_and(|record| {
                    record.sid == work.sid && record.state == RecordState::Complete
                });
                if !(complete && error == PairingError::ConnectionClosed) {
                    self.error = Some(if durable && error == PairingError::ConnectionClosed {
                        PairingError::OutcomeUnknown
                    } else {
                        error
                    });
                }
            }
        }
        self.phone = Some(work);
    }

    fn phone_step(&mut self, work: &mut PhoneWork, _now: u64) -> Result<()> {
        let foreground = self.foreground.clone();
        drop(foreground.authorize(work.foreground_epoch)?);
        if work.io.is_none() {
            if work.source.is_none() {
                return Ok(());
            }
            let route = work.route.as_ref().ok_or(PairingError::LanUnavailable)?;
            route.check(work.hint.ip)?;
            let start = self.now()?;
            let socket = route.connect(&work.hint, Duration::from_millis(10_000))?;
            route.check(
                socket
                    .peer_addr()
                    .map_err(|_| PairingError::ConnectionClosed)?
                    .ip(),
            )?;
            let generation = self.next_generation()?;
            let tls = Session::client(
                socket,
                self.installation.certified_key.clone(),
                generation,
                start,
                work.expected,
                work.hint.ip,
            )?;
            work.io = Some(Io::new(tls, start)?);
            return Ok(());
        }
        let io = work.io.as_mut().ok_or(PairingError::ConnectionClosed)?;
        work.route
            .as_ref()
            .ok_or(PairingError::LanUnavailable)?
            .check(io.tls.peer_ip()?)?;
        let now = self.now()?;
        io.check_handshake(now)?;
        io.tls.check_deadline(now, work.approval_wait)?;
        if io.pump_next {
            io.tls.pump(now)?;
            io.pump_next = false;
            return Ok(());
        }
        io.pump_next = true;
        if !io.tls.established() {
            return Ok(());
        }
        io.bind(work.sid, self.installation.store.local())?;
        if work.engine.is_none() {
            if work.repair.is_some() {
                return Ok(());
            }
            let channel = io.channel.as_ref().ok_or(PairingError::TlsRejected)?;
            if let Some(PhoneSource::Scan(payload)) = &work.source {
                if let Some(old) =
                    Phone::repair_required(&self.installation.store, payload, channel)?
                {
                    work.repair = Some(old);
                    return Ok(());
                }
            }
            let _authorization = foreground.authorize(work.foreground_epoch)?;
            let (engine, frame) = match work.source.take().ok_or(PairingError::CandidateStale)? {
                PhoneSource::Scan(payload) => {
                    Phone::start(&mut self.installation.store, payload, channel)?
                }
                PhoneSource::Resume => Phone::resume(&self.installation.store, work.sid, channel)?,
            };
            work.engine = Some(engine);
            io.queue(frame, SentKind::Request, true)?;
            io.tls.progress(now)?;
            self.refresh(&work.sid)?;
            return Ok(());
        }
        if io.has_output() {
            if let Some(sent) = io.flush()? {
                let engine = work.engine.as_mut().ok_or(PairingError::CandidateStale)?;
                let channel = io.channel.as_ref().ok_or(PairingError::TlsRejected)?;
                match sent.kind {
                    SentKind::Request => {
                        engine.request_sent(channel)?;
                        work.approval_wait = work.initial;
                    }
                    SentKind::Ack => engine.ack_sent(channel)?,
                    _ => return Err(PairingError::TlsRejected),
                }
                if sent.advances {
                    io.tls.progress(now)?;
                }
            }
            return Ok(());
        }
        let Some(frame) = io.tls.next_frame(now)? else {
            return Ok(());
        };
        if frame.sid() != &work.sid {
            return Err(PairingError::TlsRejected);
        }
        let channel = io.channel.as_ref().ok_or(PairingError::TlsRejected)?;
        let engine = work.engine.as_mut().ok_or(PairingError::CandidateStale)?;
        match &frame {
            Frame::Commit { .. } => {
                let advances = !work.commit_seen;
                let _authorization = foreground.authorize(work.foreground_epoch)?;
                let ack = engine.commit(&mut self.installation.store, channel, &frame)?;
                work.commit_seen = true;
                work.approval_wait = false;
                io.queue(ack, SentKind::Ack, advances)?;
                if advances {
                    io.tls.progress(now)?;
                }
            }
            Frame::Complete { .. } => {
                let advances = !work.complete_seen;
                let _authorization = foreground.authorize(work.foreground_epoch)?;
                engine.complete(&mut self.installation.store, channel, &frame)?;
                work.complete_seen = true;
                if advances {
                    io.tls.progress(now)?;
                }
            }
            _ => return Err(PairingError::TlsRejected),
        }
        self.refresh(&work.sid)?;
        Ok(())
    }
}
