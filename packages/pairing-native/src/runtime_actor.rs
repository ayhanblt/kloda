use super::*;
use crate::store_rows::RecordRole;
use std::io::ErrorKind;

impl Actor {
    pub(super) fn open(context: NativeContext) -> Result<Self> {
        let installation = crate::initialization::open(&context)?;
        installation.check()?;
        let now = crate::route::elapsed_ms()?;
        let role = match context.role {
            #[cfg(not(target_os = "android"))]
            OwnerRole::Pc => RecordRole::Pc,
            OwnerRole::Phone => RecordRole::Phone,
        };
        let retained = installation.store.retained_record(role)?;
        let file_transport =
            crate::file_transport::Managed::new(!matches!(context.role, OwnerRole::Phone))?;
        let mut owner = Self {
            context,
            installation,
            listener: None,
            pc: None,
            peers: Vec::with_capacity(MAX_PEERS),
            cursor: 0,
            phone: None,
            retained,
            terminal: None,
            generation: 0,
            last_now: now,
            error: None,
            fatal: None,
            file_transport,
            file_sender: None,
            #[cfg(not(target_os = "android"))]
            file_receiver: crate::file_receiver::Receiver::new(),
            unpair_result: None,
        };
        if !matches!(owner.context.role, OwnerRole::Phone) {
            if let Err(error) = owner.ensure_listener() {
                owner.observe(error);
            }
        }
        Ok(owner)
    }

    pub(super) fn now(&mut self) -> Result<u64> {
        let result = crate::route::elapsed_ms().and_then(|now| {
            if now < self.last_now {
                Err(PairingError::NativeUnsupported)
            } else {
                Ok(now)
            }
        });
        match result {
            Ok(now) => {
                self.last_now = now;
                Ok(now)
            }
            Err(error) => {
                self.fail_all(error);
                Err(error)
            }
        }
    }

    pub(super) fn guard(&mut self) -> Result<u64> {
        if let Some(error) = self.fatal {
            return Err(error);
        }
        if let Err(error) = self.installation.check() {
            self.fail_all(error);
            return Err(error);
        }
        self.now()
    }

    pub(super) fn next_generation(&mut self) -> Result<u64> {
        match self.generation.checked_add(1) {
            Some(generation) => {
                self.generation = generation;
                Ok(generation)
            }
            None => {
                self.fail_all(PairingError::NativeUnsupported);
                self.fatal = Some(PairingError::NativeUnsupported);
                Err(PairingError::NativeUnsupported)
            }
        }
    }

    pub(super) fn ensure_listener(&mut self) -> Result<()> {
        if let Some(listener) = &self.listener {
            return listener.route.check_local();
        }
        let port = self.installation.listener_port()?;
        #[cfg(target_os = "android")]
        let (route, socket, hint) = crate::route::listener(port, &self.context.platform)?;
        #[cfg(not(target_os = "android"))]
        let (route, socket, hint) = crate::route::listener(port)?;
        socket
            .set_nonblocking(true)
            .map_err(|_| PairingError::LanUnavailable)?;
        // Persist the actual stable bound port before any secret or QR can be generated.
        self.installation.save_listener_port(hint.port)?;
        route.check_local()?;
        self.listener = Some(Listener {
            route,
            socket,
            hint,
        });
        Ok(())
    }

    pub(super) fn wait_duration(&self) -> Duration {
        let active = self.file_transport.live_count() != 0
            || !self.peers.is_empty()
            || self
                .phone
                .as_ref()
                .is_some_and(|work| work.source.is_some() || work.io.is_some())
            || self
                .pc
                .as_ref()
                .is_some_and(|pc| matches!(pc.phase(), Phase::Open | Phase::Reserved));
        Duration::from_millis(if active {
            10
        } else if self.listener.is_some() {
            100
        } else {
            1_000
        })
    }

    pub(super) fn tick(&mut self) {
        if self.fatal.is_some() {
            return;
        }
        if self.listener.is_none()
            && self
                .phone
                .as_ref()
                .is_none_or(|work| work.source.is_none() && work.io.is_none())
            && self
                .pc
                .as_ref()
                .is_none_or(|pc| !matches!(pc.phase(), Phase::Open | Phase::Reserved))
        {
            return;
        }
        let now = match self.guard() {
            Ok(now) => now,
            Err(_) => return,
        };
        if let Some(pc) = &mut self.pc {
            if let Err(error) = pc.expire(now) {
                let sid = *pc.sid();
                self.drop_sid(&sid);
                self.observe(error);
            }
        }
        if matches!(self.context.role, OwnerRole::Phone) {
            self.phone_tick(now);
            return;
        }
        #[cfg(not(target_os = "android"))]
        self.file_step();
        if let Err(error) = self.accept(now) {
            self.fail_all(error);
            return;
        }
        if self.peers.is_empty() {
            return;
        }
        let index = self.cursor % self.peers.len();
        let mut peer = self.peers.swap_remove(index);
        self.cursor = (index + 1) % MAX_PEERS;
        match self.pc_step(&mut peer, now) {
            Ok(()) if peer.io.tls.is_file() => {
                let stream = {
                    let _entered = self.file_transport.enter();
                    peer.io.tls.into_file()
                };
                if let Err(error) = stream.and_then(|io| self.file_transport.accept(io)) {
                    self.observe(error);
                }
            }
            Ok(()) => self.peers.push(peer),
            Err(error) => self.pc_failure(&peer, error),
        }
        // pc_step's pump is one work unit: no state mutation follows a potentially
        // blocking CertificateVerify callback before the next command-queue drain.
    }

    fn accept(&mut self, now: u64) -> Result<()> {
        let Some(listener) = &self.listener else {
            return Ok(());
        };
        listener.route.check_local()?;
        let socket = match listener.socket.accept() {
            Ok((socket, _)) => socket,
            Err(error) if error.kind() == ErrorKind::WouldBlock => return Ok(()),
            Err(_) => return Err(PairingError::LanUnavailable),
        };
        if self.peers.len() + self.file_transport.live_count() >= MAX_PEERS {
            return Ok(());
        }
        // An invalid unproved contender affects only its own socket, not OPEN state.
        if listener.route.bind_accepted(&socket).is_err() {
            return Ok(());
        }
        let generation = self.next_generation()?;
        {
            let tls = Session::server(
                socket,
                self.installation.certified_key.clone(),
                generation,
                now,
            )?;
            self.peers.push(PcPeer {
                io: Io::new(tls, now)?,
                recovery: None,
            })
        }
        Ok(())
    }

    pub(super) fn refresh(&mut self, sid: &[u8; 16]) -> Result<()> {
        self.retained = self.installation.store.record(sid)?;
        Ok(())
    }

    pub(super) fn observe(&mut self, error: PairingError) {
        self.error = Some(error);
        if matches!(
            error,
            PairingError::ContinuityLost
                | PairingError::StorageFailure
                | PairingError::OutcomeUnknown
        ) {
            self.fatal = Some(error);
        }
    }

    pub(super) fn fail_all(&mut self, error: PairingError) {
        if let Some(pc) = &mut self.pc {
            if matches!(pc.phase(), Phase::Open | Phase::Reserved) {
                pc.invalidate();
            } else if let Some(generation) = pc.generation() {
                pc.disconnect(generation);
            }
        }
        if let Some(work) = &mut self.phone {
            if let (Some(engine), Some(io)) = (&mut work.engine, &work.io) {
                engine.disconnect(io.tls.generation());
            }
            work.source = None;
            work.io = None;
            work.route = None;
            work.repair = None;
            work.approval_wait = false;
            if work.engine.is_none() {
                self.terminal = Some((work.sid, Phase::Invalid));
            }
        }
        self.peers.clear();
        self.file_sender = None;
        self.file_transport.cancel();
        #[cfg(not(target_os = "android"))]
        self.file_receiver.cancel_all();
        self.listener = None;
        self.observe(error);
    }

    pub(super) fn drop_sid(&mut self, sid: &[u8; 16]) {
        if self
            .file_sender
            .as_ref()
            .is_some_and(|(_, channel)| &channel.record.sid == sid)
        {
            self.file_sender = None;
        }
        self.peers
            .retain(|peer| peer.io.sid.as_ref().is_some_and(|saved| saved != sid));
    }

    pub(super) fn shutdown(&mut self) {
        // Closing is not revocation: durable consumed/pending/pins survive explicitly.
        if let Some(pc) = &mut self.pc {
            if matches!(pc.phase(), Phase::Open | Phase::Reserved) {
                pc.invalidate();
            }
        }
        self.phone = None;
        self.file_sender = None;
        self.file_transport.close();
        #[cfg(not(target_os = "android"))]
        self.file_receiver.cancel_all();
        self.peers.clear();
        self.listener = None;
    }
}
