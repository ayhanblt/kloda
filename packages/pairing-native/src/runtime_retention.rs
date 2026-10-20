use super::*;

impl Actor {
    pub(super) fn backup_versions(&mut self, after: Option<&str>, trash: bool) -> Result<String> {
        self.guard()?;
        if self.context.role != OwnerRole::Pc {
            return Err(PairingError::NativeUnsupported);
        }
        crate::backup_retention::list(&self.installation.store, after, trash).map_err(local_error)
    }
    pub(super) fn mutate_backups(
        &mut self,
        ids: &str,
        restore: bool,
        epoch: u64,
    ) -> Result<String> {
        self.guard()?;
        if self.context.role != OwnerRole::Pc {
            return Err(PairingError::NativeUnsupported);
        }
        let foreground = self.foreground.clone();
        crate::backup_retention::mutate(&mut self.installation.store, ids, restore, || {
            foreground.authorize(Some(epoch))
        })
        .map_err(local_error)
    }
    pub(super) fn maintain_backups(&mut self) {
        if self.context.role != OwnerRole::Pc {
            return;
        }
        if let Err(error) = crate::backup_retention::maintenance(&mut self.installation.store) {
            self.receiver_errors
                .insert(([0; 16], 255), local_error(error));
        } else {
            self.receiver_errors.remove(&([0; 16], 255));
        }
    }
}
fn local_error(error: crate::file_protocol::Error) -> PairingError {
    use crate::file_protocol::Error as E;
    match error {
        E::InvalidRequest => PairingError::InvalidRequest,
        E::BackupScopeChanged => PairingError::BackupScopeChanged,
        E::BackupPathRejected | E::Conflict | E::HashMismatch => PairingError::BackupPathRejected,
        E::BackupBusy => PairingError::BackupBusy,
        E::BackupFull => PairingError::BackupFull,
        E::BackupPermissionDenied => PairingError::BackupPermissionDenied,
        E::BackupUnavailable | E::NotFound => PairingError::BackupUnavailable,
        E::AclBusy => PairingError::AclBusy,
        E::AclUnavailable => PairingError::AclUnavailable,
        _ => PairingError::OutcomeUnknown,
    }
}
