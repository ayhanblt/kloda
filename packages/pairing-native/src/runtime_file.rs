use super::*;
use crate::status::UnpairResult;
use crate::store_rows::{RecordRole, RecordState};

impl Actor {
    #[cfg(not(target_os = "android"))]
    pub(super) fn file_step(&mut self) {
        let route = self
            .listener
            .as_ref()
            .ok_or(PairingError::LanUnavailable)
            .and_then(|listener| self.file_transport.check_routes(&listener.route));
        if let Err(error) = route {
            self.fail_all(error);
            return;
        }
        self.file_transport.poll();
        let Some(command) = self.file_transport.next() else {
            return;
        };
        if command.reply.is_closed() {
            return;
        }
        let authorized = self.guard().and_then(|_| {
            command.evidence.check_live()?;
            self.listener
                .as_ref()
                .ok_or(PairingError::LanUnavailable)?
                .route
                .check(command.evidence.ip)
        });
        let revoke = matches!(&command.request, crate::file_protocol::Request::RevokePair);
        let result = match authorized {
            Ok(()) => self.file_receiver.execute(
                &mut self.installation.store,
                &command.sid,
                &command.evidence.peer,
                command.request,
            ),
            Err(error) => Err(crate::file_protocol::Error::from(error)),
        };
        if self.retained.as_ref().is_some_and(|record| {
            record.sid == command.sid && record.peer.as_ref() == Some(&command.evidence.peer)
        }) {
            use crate::file_protocol::Error as FileError;
            let target_error = match result.as_ref().err() {
                Some(FileError::AclBusy) => Some(PairingError::AclBusy),
                Some(FileError::AclUnavailable) => Some(PairingError::AclUnavailable),
                Some(FileError::BackupUnavailable) => Some(PairingError::BackupUnavailable),
                Some(FileError::BackupFull) => Some(PairingError::BackupFull),
                Some(FileError::BackupBusy) => Some(PairingError::BackupBusy),
                Some(FileError::BackupPermissionDenied) => {
                    Some(PairingError::BackupPermissionDenied)
                }
                Some(FileError::BackupPathRejected) => Some(PairingError::BackupPathRejected),
                Some(FileError::BackupScopeChanged) => Some(PairingError::BackupScopeChanged),
                _ => None,
            };
            if let Some(error) = target_error {
                self.error = Some(error);
            } else if result.is_ok()
                && matches!(
                    self.error,
                    Some(
                        PairingError::AclBusy
                            | PairingError::AclUnavailable
                            | PairingError::BackupUnavailable
                            | PairingError::BackupFull
                            | PairingError::BackupBusy
                            | PairingError::BackupPermissionDenied
                            | PairingError::BackupPathRejected
                            | PairingError::BackupScopeChanged
                    )
                )
            {
                self.error = None;
            }
        }
        if revoke && result.is_ok() {
            self.file_transport
                .close_peer(&command.evidence.peer, Some(&command.evidence));
            self.drop_sid(&command.sid);
            if self.focuses(&command.sid) {
                if let Err(error) = self.refresh(&command.sid) {
                    self.observe(error);
                }
            }
        }
        let _ = command.reply.send(result);
        // The reply is pumped on the next tick, after management commands get their turn.
    }

    pub(super) fn close_file_sid(&mut self, sid: &[u8; 16]) -> Result<()> {
        if let Some(peer) = self
            .installation
            .store
            .record(sid)?
            .and_then(|record| record.peer)
        {
            self.file_transport.close_peer(&peer, None);
        }
        Ok(())
    }

    pub(super) fn remove_pairing(&mut self, text: &str, online: bool) -> Result<()> {
        if !matches!(self.context.role, OwnerRole::Phone) {
            return Err(PairingError::NativeUnsupported);
        }
        let sid = super::actions::reference(text)?;
        if !self
            .retained
            .as_ref()
            .is_some_and(|record| record.sid == sid && record.role == RecordRole::Phone)
        {
            return Err(PairingError::CandidateStale);
        }
        let record = self
            .installation
            .store
            .record(&sid)?
            .ok_or(PairingError::CandidateStale)?;
        if record.role != RecordRole::Phone {
            return Err(PairingError::CandidateStale);
        }
        if self.phone.as_ref().is_some_and(|work| work.sid != sid)
            || (online && record.state != RecordState::Complete)
        {
            return Err(PairingError::CandidateStale);
        }
        self.drop_sid(&sid);
        self.unpair_result = None;
        if online {
            self.phone = None;
            self.terminal = None;
            self.retained = Some(record.clone());
            let confirmed = self.confirm_pc_revoke(&record);
            if let Err(error) = confirmed {
                self.unpair_result = Some(UnpairResult {
                    state: "pc_unconfirmed",
                    error_code: Some(error.code()),
                });
                self.error = Some(error);
                return Ok(());
            }
            // An ACK for a stale native binding cannot remove a newer pairing.
            self.guard()?;
            let current = self
                .installation
                .store
                .record(&sid)?
                .ok_or(PairingError::ContinuityLost)?;
            if current.role != RecordRole::Phone
                || current.state != RecordState::Complete
                || current.expected != record.expected
                || current.peer != record.peer
            {
                return Err(PairingError::ContinuityLost);
            }
        }
        let revoked = self.installation.store.phone_revoke(&sid)?;
        self.phone = None;
        self.terminal = None;
        self.retained = Some(revoked);
        self.unpair_result = Some(UnpairResult {
            state: if online { "pc_confirmed" } else { "local_only" },
            error_code: None,
        });
        self.error = None;
        Ok(())
    }

    fn confirm_pc_revoke(&mut self, record: &Record) -> Result<()> {
        if record.state != RecordState::Complete || record.peer.is_none() {
            return Err(PairingError::TlsRejected);
        }
        let hint = record.hint.as_ref().ok_or(PairingError::ContinuityLost)?;
        #[cfg(target_os = "android")]
        let route = crate::route::for_peer(hint, &self.context.platform)?;
        #[cfg(not(target_os = "android"))]
        let route = crate::route::for_peer(hint)?;
        route.check(hint.ip)?;
        let socket = route.connect(hint, Duration::from_millis(250))?;
        let key = self.installation.certified_key.clone();
        self.file_transport.runtime().block_on(async {
            tokio::time::timeout(
                Duration::from_secs(10),
                crate::file_transport_client::revoke(socket, key, record, &route),
            )
            .await
            .map_err(|_| PairingError::ConnectionClosed)?
        })
    }
}
