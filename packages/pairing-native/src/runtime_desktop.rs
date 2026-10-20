use super::*;
use crate::status::ReceiverStatus;

impl Actor {
    pub(super) fn suspend_pairing(&mut self) -> Result<()> {
        if self.context.role != OwnerRole::Pc {
            return Err(PairingError::NativeUnsupported);
        }
        if let Some(sid) = suspend_invitation(self.pc.as_mut()) {
            self.pc = None;
            // Keep independent recovery, FILE handshakes and established file channels.
            self.peers.retain(|peer| peer.io.sid != Some(sid));
        }
        Ok(())
    }

    pub(super) fn receiver_activity(
        &mut self,
        after: Option<&str>,
    ) -> Result<crate::receiver_activity::Activity> {
        if self.context.role != OwnerRole::Pc {
            return Err(PairingError::NativeUnsupported);
        }
        self.guard()?;
        let status = self.receiver_status();
        self.guard()?;
        let mut activity = crate::receiver_activity::read(&self.installation.store, after)?;
        activity.receiver_available = status.available;
        activity.error_code = status.error_code;
        Ok(activity)
    }

    pub(super) fn paired_devices(
        &mut self,
        after: Option<&str>,
    ) -> Result<crate::paired_devices::Devices> {
        if self.context.role != OwnerRole::Pc {
            return Err(PairingError::NativeUnsupported);
        }
        self.guard()?;
        crate::paired_devices::read(&self.installation.store, after, |record| {
            self.backup_status(record)
        })
    }

    pub(super) fn paired_device(&mut self, record: &str) -> Result<crate::paired_devices::Device> {
        if self.context.role != OwnerRole::Pc {
            return Err(PairingError::NativeUnsupported);
        }
        self.guard()?;
        crate::paired_devices::read_one(&self.installation.store, record, |record| {
            self.backup_status(record)
        })
    }

    pub(super) fn receiver_status(&mut self) -> ReceiverStatus {
        let checked = self.guard().and_then(|_| self.ensure_listener());
        if let Err(error) = checked {
            self.fail_all(error);
        }
        let error = self.fatal.or_else(|| checked.err());
        let scope_error = self
            .retained
            .as_ref()
            .and_then(|record| self.backup_status(record).error_code);
        ReceiverStatus {
            available: error.is_none() && self.listener.is_some(),
            active_transfers: self.file_transport.live_count(),
            error_code: error.map(PairingError::code).or(scope_error).or_else(|| {
                self.receiver_errors
                    .values()
                    .next()
                    .map(|error| error.code())
            }),
        }
    }
}

// UI disappearance is neither revocation nor cancellation of an approved consume.
fn suspend_invitation(pc: Option<&mut Pc>) -> Option<[u8; 16]> {
    let pc = pc?;
    if !matches!(pc.phase(), Phase::Open | Phase::Reserved) {
        return None;
    }
    let sid = *pc.sid();
    pc.invalidate();
    Some(sid)
}

pub(super) fn target_error(error: &crate::file_protocol::Error) -> Option<PairingError> {
    use crate::file_protocol::Error as E;
    match error {
        E::AclBusy => Some(PairingError::AclBusy),
        E::AclUnavailable => Some(PairingError::AclUnavailable),
        E::BackupUnavailable => Some(PairingError::BackupUnavailable),
        E::BackupFull => Some(PairingError::BackupFull),
        E::BackupBusy => Some(PairingError::BackupBusy),
        E::BackupPermissionDenied => Some(PairingError::BackupPermissionDenied),
        E::BackupPathRejected => Some(PairingError::BackupPathRejected),
        E::BackupScopeChanged => Some(PairingError::BackupScopeChanged),
        E::OutcomeUnknown => Some(PairingError::OutcomeUnknown),
        _ => None,
    }
}

pub(super) fn request_kind(request: &crate::file_protocol::Request) -> u8 {
    use crate::file_protocol::Request as R;
    match request {
        R::Create(_) => 0,
        R::Chunk { .. } => 1,
        R::Finalize { .. } => 2,
        R::Status { .. } => 3,
        R::List { .. } => 4,
        R::Restore { .. } => 5,
        R::RevokePair => 6,
    }
}

pub(super) fn observe_file_result(
    errors: &mut std::collections::BTreeMap<([u8; 16], u8), PairingError>,
    sid: [u8; 16],
    kind: u8,
    result: &crate::file_protocol::Result<crate::file_protocol::Response>,
) {
    if let Some(error) = result.as_ref().err().and_then(target_error) {
        errors.insert((sid, kind), error);
    } else if result.is_ok() {
        if kind == 6 {
            errors.retain(|(peer, _), _| peer != &sid);
        } else {
            errors.remove(&(sid, kind));
        }
    }
}

#[cfg(test)]
#[path = "runtime_desktop_tests.rs"]
mod tests;
