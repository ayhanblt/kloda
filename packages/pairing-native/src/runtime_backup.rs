use super::*;
use crate::status::BackupScopeStatus;
use crate::store_rows::{RecordRole, RecordState};

impl Actor {
    pub(super) fn approve_backup(
        &mut self,
        record: &str,
        folder: &str,
        revision: Option<&str>,
    ) -> Result<()> {
        let sid = self.backup_reference(record)?;
        let revision = revision
            .map(super::actions::candidate)
            .transpose()?
            .map(i64::try_from)
            .transpose()
            .map_err(|_| PairingError::CandidateStale)?;
        let foreground = self.foreground.clone();
        let epoch = self.action_epoch;
        self.installation
            .store
            .approve_backup_guarded(&sid, folder, revision, || foreground.authorize(epoch))?;
        self.close_file_sid(&sid)?;
        self.receiver_errors.retain(|(peer, _), _| peer != &sid);
        self.error = None;
        Ok(())
    }

    pub(super) fn revoke_backup(&mut self, record: &str) -> Result<()> {
        let sid = self.backup_reference(record)?;
        let foreground = self.foreground.clone();
        let epoch = self.action_epoch;
        self.installation
            .store
            .revoke_backup_guarded(&sid, || foreground.authorize(epoch))?;
        self.close_file_sid(&sid)?;
        self.receiver_errors.retain(|(peer, _), _| peer != &sid);
        self.error = None;
        Ok(())
    }

    pub(super) fn remove_device(&mut self, reference: &str) -> Result<()> {
        if self.context.role != OwnerRole::Pc {
            return Err(PairingError::NativeUnsupported);
        }
        let sid = super::actions::reference(reference)?;
        let foreground = self.foreground.clone();
        let epoch = self.action_epoch;
        let revoked = self
            .installation
            .store
            .remove_device_guarded(&sid, || foreground.authorize(epoch))?;
        self.close_file_sid(&sid)?;
        self.peers.retain(|peer| peer.io.sid != Some(sid));
        if self.pc.as_ref().is_some_and(|pc| pc.sid() == &sid) {
            self.pc = None;
        }
        if self
            .retained
            .as_ref()
            .is_some_and(|record| record.sid == sid)
        {
            self.retained = Some(revoked);
        }
        self.receiver_errors.retain(|(peer, _), _| peer != &sid);
        self.error = None;
        Ok(())
    }

    fn backup_reference(&self, record: &str) -> Result<[u8; 16]> {
        if self.context.role != OwnerRole::Pc {
            return Err(PairingError::NativeUnsupported);
        }
        let sid = super::actions::reference(record)?;
        if !self.installation.store.record(&sid)?.is_some_and(|record| {
            record.role == RecordRole::Pc && record.state == RecordState::Complete
        }) {
            return Err(PairingError::CandidateStale);
        }
        Ok(sid)
    }

    pub(super) fn backup_status(&self, record: &Record) -> BackupScopeStatus {
        crate::paired_devices::backup_status(&self.installation.store, record, self.fatal)
    }
}
