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
        self.installation
            .store
            .approve_backup(&sid, folder, revision)?;
        self.close_file_sid(&sid)?;
        self.error = None;
        Ok(())
    }

    pub(super) fn revoke_backup(&mut self, record: &str) -> Result<()> {
        let sid = self.backup_reference(record)?;
        self.installation.store.revoke_backup(&sid)?;
        self.close_file_sid(&sid)?;
        self.error = None;
        Ok(())
    }

    fn backup_reference(&self, record: &str) -> Result<[u8; 16]> {
        if self.context.role != OwnerRole::Pc {
            return Err(PairingError::NativeUnsupported);
        }
        let sid = super::actions::reference(record)?;
        if !self.retained.as_ref().is_some_and(|record| {
            record.sid == sid
                && record.role == RecordRole::Pc
                && record.state == RecordState::Complete
        }) || self
            .pc
            .as_ref()
            .is_some_and(|pc| pc.sid() != &sid || pc.phase() != Phase::Complete)
        {
            return Err(PairingError::CandidateStale);
        }
        Ok(sid)
    }

    pub(super) fn backup_status(&self, record: &Record) -> BackupScopeStatus {
        let mut status = BackupScopeStatus {
            state: "not_approved",
            folder: None,
            revision: None,
            error_code: None,
        };
        if let Some(error) = self.fatal {
            status.state = "unavailable";
            status.error_code = Some(error.code());
            return status;
        }
        let scope = match self.installation.store.backup_scope(&record.sid) {
            Ok(Some(scope)) => scope,
            Ok(None) => return status,
            Err(error) => {
                status.state = "unavailable";
                status.error_code = Some(error.code());
                return status;
            }
        };
        status.revision = Some(scope.revision.to_string());
        if !scope.approved {
            status.state = "revoked";
        } else {
            match crate::backup_root::verify(&scope.folder, &record.expected, scope.binding) {
                Ok(()) => status.state = "approved",
                Err(error) => {
                    status.state = "unavailable";
                    status.error_code = Some(error.code());
                }
            }
        }
        status.folder = Some(scope.folder);
        status
    }
}
