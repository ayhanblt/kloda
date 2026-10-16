use super::*;
use crate::store_rows::RecordState;
use zeroize::Zeroizing;

impl Actor {
    pub(super) fn status(&self) -> PairingStatus {
        let mut status = PairingStatus {
            hardware_class: Some(self.installation.identity.hardware_class()),
            error_code: self.error.map(|error| error.code()),
            unpair_result: self.unpair_result.clone(),
            ..PairingStatus::default()
        };
        if matches!(self.context.role, OwnerRole::Phone) {
            if let Some(work) = &self.phone {
                status.operation_id = Some(id(&work.sid));
                if work.source.is_some() || (work.engine.is_none() && work.io.is_some()) {
                    status.phase = "connecting";
                    status.repair_required = work.repair.is_some();
                    if work.repair.is_some() {
                        if let Some(io) = &work.io {
                            status.candidate_generation = Some(io.tls.generation().to_string());
                            status.peer_fingerprint = io
                                .channel
                                .as_ref()
                                .map(|channel| id(&channel.peer().fingerprint()));
                        }
                    }
                    if !work.initial {
                        status.record_id = Some(id(&work.sid));
                    }
                } else if let Some(engine) = &work.engine {
                    status.phase = phase(engine.phase());
                    status.record_id = Some(id(&work.sid));
                    status.peer_fingerprint = self
                        .retained
                        .as_ref()
                        .filter(|record| record.sid == work.sid)
                        .map(|record| id(&record.expected));
                } else if let Some(record) = self
                    .retained
                    .as_ref()
                    .filter(|record| record.sid == work.sid)
                {
                    record_status(&mut status, record);
                } else {
                    status.phase = "invalid";
                }
            } else if let Some((sid, state)) = self.terminal {
                status.operation_id = Some(id(&sid));
                status.phase = phase(state);
            } else if let Some(record) = &self.retained {
                record_status(&mut status, record);
            }
        } else if let Some(pc) = &self.pc {
            status.operation_id = Some(id(pc.sid()));
            status.phase = phase(pc.phase());
            if matches!(pc.phase(), Phase::Open | Phase::Reserved) {
                status.remaining_ms = pc.remaining_ms(self.last_now).ok();
                status.qr = pc.qr().map(|qr| Zeroizing::new(qr.to_owned()));
                status.candidate_generation =
                    pc.generation().map(|generation| generation.to_string());
                status.peer_fingerprint = pc.peer_fingerprint().map(|fingerprint| id(&fingerprint));
                status.repair_required = pc.repair_required();
            } else if let Some(record) = self
                .retained
                .as_ref()
                .filter(|record| &record.sid == pc.sid())
            {
                record_status(&mut status, record);
            }
        } else if let Some(record) = &self.retained {
            record_status(&mut status, record);
        }
        #[cfg(not(target_os = "android"))]
        if self.context.role == OwnerRole::Pc {
            if let Some(record) = &self.retained {
                if status.record_id.is_some() {
                    status.backup_scope = Some(self.backup_status(record));
                }
            }
        }
        if self.fatal.is_some() {
            // A poisoned/unreadable store is not affirmative evidence that the preceding
            // write completed. Keep its native reference but expose no successful phase.
            status.phase = "invalid";
            status.qr = None;
            status.remaining_ms = None;
            status.candidate_generation = None;
            status.repair_required = false;
        }
        status
    }
}

fn record_status(status: &mut PairingStatus, record: &Record) {
    status.operation_id = Some(id(&record.sid));
    status.record_id = Some(id(&record.sid));
    status.peer_fingerprint = Some(id(&record.expected));
    status.phase = match record.state {
        RecordState::Consumed | RecordState::PinnedPendingAck => "consumed_pending_ack",
        RecordState::Pending => "pending",
        RecordState::Complete => "complete",
        RecordState::Revoked => "revoked",
    };
}
fn phase(state: Phase) -> &'static str {
    match state {
        Phase::Open => "open",
        Phase::Reserved => "reserved",
        Phase::ConsumedPendingAck | Phase::PinnedPendingAck => "consumed_pending_ack",
        Phase::Pending => "pending",
        Phase::Complete => "complete",
        Phase::Invalid => "invalid",
        Phase::Revoked => "revoked",
    }
}
fn id(bytes: &[u8]) -> String {
    crate::qr_base64::encode(bytes)
}
