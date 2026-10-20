use super::*;
use crate::store_rows::{RecordRole, RecordState};

impl Actor {
    pub(super) fn action(&mut self, action: Action) -> Result<PairingStatus> {
        #[cfg(not(target_os = "android"))]
        if let Action::Foreground { epoch, action } = action {
            drop(self.foreground.authorize(Some(epoch))?);
            self.action_epoch = Some(epoch);
            let result = self.action(*action);
            self.action_epoch = None;
            return result;
        }
        if matches!(&action, Action::Status) {
            let _ = self.guard();
            self.expire_status();
            return Ok(self.status());
        }
        let now = self.guard()?;
        if !matches!(&action, Action::RemovePairing { .. }) {
            self.unpair_result = None;
        }
        let result = match action {
            Action::CreateInvitation => self.create(now),
            #[cfg(not(target_os = "android"))]
            Action::SuspendPairing => self.suspend_pairing(),
            Action::Scan(qr) => self.scan(qr),
            Action::Approve {
                operation,
                generation,
            } => self.approve(&operation, &generation, now),
            Action::Deny {
                operation,
                generation,
            } => self.deny(&operation, &generation),
            Action::Cancel { operation } => self.cancel(&operation),
            Action::Resume { record } => self.resume(&record),
            Action::RemovePairing { record, online } => self.remove_pairing(&record, online),
            #[cfg(not(target_os = "android"))]
            Action::ApproveBackup {
                record,
                folder,
                revision,
            } => self.approve_backup(&record, &folder, revision.as_deref()),
            #[cfg(not(target_os = "android"))]
            Action::RevokeBackup { record } => self.revoke_backup(&record),
            #[cfg(not(target_os = "android"))]
            Action::RemoveDevice { record } => self.remove_device(&record),
            #[cfg(not(target_os = "android"))]
            Action::Foreground { .. } => Err(PairingError::CandidateStale),
            Action::Status | Action::Close => Err(PairingError::CandidateStale),
        };
        if let Err(error) = result {
            if matches!(
                error,
                PairingError::AclBusy
                    | PairingError::AclUnavailable
                    | PairingError::BackupUnavailable
                    | PairingError::BackupFull
                    | PairingError::BackupBusy
                    | PairingError::BackupPermissionDenied
                    | PairingError::BackupPathRejected
                    | PairingError::BackupScopeChanged
            ) {
                self.error = Some(error);
            }
            if matches!(
                error,
                PairingError::StorageFailure
                    | PairingError::OutcomeUnknown
                    | PairingError::ContinuityLost
            ) {
                self.fail_all(error);
            }
            return Err(error);
        }
        Ok(self.status())
    }

    fn create(&mut self, now: u64) -> Result<()> {
        if matches!(self.context.role, OwnerRole::Phone) {
            return Err(PairingError::NativeUnsupported);
        }
        self.ensure_listener()?;
        if let Some(mut old) = self.pc.take() {
            if matches!(old.phase(), Phase::Open | Phase::Reserved) {
                let sid = *old.sid();
                old.cancel(&mut self.installation.store)?;
                self.drop_sid(&sid);
            } else if let Some(peer) = self
                .peers
                .iter_mut()
                .find(|peer| Some(peer.io.tls.generation()) == old.generation())
            {
                // A new invitation never destroys an independently durable old flow.
                peer.recovery = Some(old);
            }
        }
        self.peers.retain(|peer| peer.io.sid.is_some());
        let hint = self
            .listener
            .as_ref()
            .ok_or(PairingError::LanUnavailable)?
            .hint
            .clone();
        let pc = Pc::create(&self.installation.store, hint, now)?;
        #[cfg(not(target_os = "android"))]
        let foreground = self.foreground.clone();
        #[cfg(not(target_os = "android"))]
        let _authorization = foreground.authorize(self.action_epoch)?;
        self.pc = Some(pc);
        self.terminal = None;
        self.error = None;
        Ok(())
    }

    fn approve(&mut self, operation: &str, generation: &str, now: u64) -> Result<()> {
        let sid = reference(operation)?;
        let generation = candidate(generation)?;
        if matches!(self.context.role, OwnerRole::Phone) {
            return self.approve_phone(sid, generation, now);
        }
        if !self.pc.as_ref().is_some_and(|pc| {
            pc.sid() == &sid && pc.generation() == Some(generation) && pc.phase() == Phase::Reserved
        }) {
            return Err(PairingError::CandidateStale);
        }
        let index = self
            .peers
            .iter()
            .position(|peer| peer.io.tls.generation() == generation && peer.io.sid == Some(sid))
            .ok_or(PairingError::CandidateStale)?;
        self.listener
            .as_ref()
            .ok_or(PairingError::LanUnavailable)?
            .route
            .check(self.peers[index].io.tls.peer_ip()?)?;
        // Reobserve the established socket before the authorization fence; an observed
        // EOF cannot turn a disconnected reservation into durable trust.
        if let Err(error) = self.peers[index]
            .io
            .tls
            .pump(now)
            .and_then(|()| self.peers[index].io.tls.authorize_live())
        {
            let peer = self.peers.swap_remove(index);
            self.pc_failure(&peer, error);
            return Err(error);
        }
        let now = self.now()?;
        let peer = &mut self.peers[index];
        peer.io.tls.check_deadline(now, true)?;
        let channel = peer
            .io
            .channel
            .as_ref()
            .ok_or(PairingError::CandidateStale)?;
        #[cfg(not(target_os = "android"))]
        let foreground = self.foreground.clone();
        #[cfg(not(target_os = "android"))]
        let _authorization = foreground.authorize(self.action_epoch)?;
        let pc = self.pc.as_mut().ok_or(PairingError::CandidateStale)?;
        let frame = match pc.approve(&mut self.installation.store, &sid, generation, channel, now) {
            Ok(frame) => frame,
            Err(error) => {
                if error == PairingError::InvitationExpired {
                    self.drop_sid(&sid);
                    self.error = Some(error);
                }
                return Err(error);
            }
        };
        peer.io.queue(frame, SentKind::Commit, true)?;
        peer.io.tls.progress(now)?;
        self.refresh(&sid)?;
        self.error = None;
        Ok(())
    }

    fn deny(&mut self, operation: &str, generation: &str) -> Result<()> {
        let sid = reference(operation)?;
        let generation = candidate(generation)?;
        if matches!(self.context.role, OwnerRole::Phone) {
            let work = self.phone.as_ref().ok_or(PairingError::CandidateStale)?;
            if work.sid != sid
                || work.repair.is_none()
                || work.io.as_ref().map(|io| io.tls.generation()) != Some(generation)
            {
                return Err(PairingError::CandidateStale);
            }
            return self.cancel(operation);
        }
        let pc = self.pc.as_mut().ok_or(PairingError::CandidateStale)?;
        if pc.phase() != Phase::Reserved {
            return Err(PairingError::CandidateStale);
        }
        let result = pc.deny(&mut self.installation.store, &sid, generation);
        if result.is_ok() {
            self.drop_sid(&sid);
            self.error = Some(PairingError::Cancelled);
        }
        result
    }

    fn cancel(&mut self, operation: &str) -> Result<()> {
        let sid = reference(operation)?;
        if matches!(self.context.role, OwnerRole::Phone) {
            return self.cancel_phone(sid);
        }
        if self.pc.as_ref().is_some_and(|pc| pc.sid() == &sid) {
            let result = self
                .pc
                .as_mut()
                .ok_or(PairingError::CandidateStale)?
                .cancel(&mut self.installation.store);
            self.drop_sid(&sid); // Drain live I/O even if the durable write failed.
            result?;
            if self.installation.store.record(&sid)?.is_some() {
                self.refresh(&sid)?;
            }
        } else {
            let record = self
                .retained
                .as_ref()
                .filter(|record| record.sid == sid && record.role == RecordRole::Pc)
                .ok_or(PairingError::CandidateStale)?;
            let _ = record;
            let result = self.installation.store.pc_revoke(&sid);
            self.drop_sid(&sid);
            self.retained = Some(result?);
        }
        self.close_file_sid(&sid)?;
        self.error = Some(PairingError::Cancelled);
        Ok(())
    }

    fn resume(&mut self, reference_text: &str) -> Result<()> {
        let sid = reference(reference_text)?;
        let native_reference = self
            .retained
            .as_ref()
            .is_some_and(|record| record.sid == sid)
            || self.pc.as_ref().is_some_and(|pc| pc.sid() == &sid)
            || self
                .phone
                .as_ref()
                .is_some_and(|work| work.sid == sid && work.engine.is_some());
        if !native_reference {
            return Err(PairingError::CandidateStale);
        }
        let record = self
            .installation
            .store
            .record(&sid)?
            .ok_or(PairingError::CandidateStale)?;
        if record.state == RecordState::Revoked {
            return Err(PairingError::Revoked);
        }
        match self.context.role {
            OwnerRole::Phone if record.role == RecordRole::Phone => self.resume_phone(record)?,
            #[cfg(not(target_os = "android"))]
            OwnerRole::Pc if record.role == RecordRole::Pc => {
                self.ensure_listener()?;
                self.retained = Some(record);
            }
            _ => return Err(PairingError::CandidateStale),
        }
        self.terminal = None;
        self.error = None;
        Ok(())
    }

    fn expire_status(&mut self) {
        if let Some(pc) = &mut self.pc {
            if let Err(error) = pc.expire(self.last_now) {
                let sid = *pc.sid();
                self.drop_sid(&sid);
                self.error = Some(error);
            }
        }
    }
}

pub(super) fn reference(text: &str) -> Result<[u8; 16]> {
    crate::qr_base64::fixed(text).map_err(|_| PairingError::CandidateStale)
}
pub(super) fn candidate(text: &str) -> Result<u64> {
    if text.is_empty()
        || text.len() > 20
        || !text.bytes().all(|byte| byte.is_ascii_digit())
        || text.starts_with('0')
    {
        return Err(PairingError::CandidateStale);
    }
    text.parse().map_err(|_| PairingError::CandidateStale)
}
