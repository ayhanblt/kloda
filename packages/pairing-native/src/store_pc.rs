use crate::error::{PairingError, Result};
use crate::key::Spki;
use crate::store::{storage, Store};
use crate::store_rows::{load, new_peer, require, Record, RecordRole, RecordState};
use rusqlite::params;

impl Store {
    pub(crate) fn pc_consume(
        &mut self,
        sid: &[u8; 16],
        peer: &Spki,
        repair_consent: Option<[u8; 16]>,
    ) -> Result<Record> {
        self.write(|tx, local, epoch| {
            if let Some(existing) = load(tx, sid, local, epoch)? {
                return require(Some(existing), RecordRole::Pc, peer);
            }
            let expected = peer.fingerprint();
            new_peer(
                tx,
                local,
                epoch,
                RecordRole::Pc,
                sid,
                &expected,
                repair_consent,
            )?;
            tx.execute(
                "INSERT INTO records(sid,version,role,local,epoch,expected,peer,state)
                VALUES(?1,1,1,?2,?3,?4,?5,1)",
                params![
                    sid.as_slice(),
                    local.as_bytes().as_slice(),
                    epoch.as_slice(),
                    expected.as_slice(),
                    peer.as_bytes().as_slice()
                ],
            )
            .map_err(storage)?;
            require(load(tx, sid, local, epoch)?, RecordRole::Pc, peer)
        })
    }

    pub(crate) fn pc_recover(&self, sid: &[u8; 16], peer: &Spki) -> Result<Record> {
        require(self.record(sid)?, RecordRole::Pc, peer)
    }

    pub(crate) fn pc_complete(&mut self, sid: &[u8; 16], peer: &Spki) -> Result<Record> {
        self.write(|tx, local, epoch| {
            let mut record = require(load(tx, sid, local, epoch)?, RecordRole::Pc, peer)?;
            if record.state == RecordState::Consumed {
                let changed = tx
                    .execute(
                        "UPDATE records SET state=2 WHERE sid=?1 AND state=1",
                        [sid.as_slice()],
                    )
                    .map_err(storage)?;
                if changed != 1 {
                    return Err(PairingError::StorageFailure);
                }
                record.state = RecordState::Complete;
            } else if record.state != RecordState::Complete {
                return Err(PairingError::TlsRejected);
            }
            Ok(record)
        })
    }

    pub(crate) fn pc_revoke(&mut self, sid: &[u8; 16]) -> Result<Record> {
        self.revoke(sid, RecordRole::Pc)
    }

    #[cfg(not(target_os = "android"))]
    pub(crate) fn remove_device_guarded<G>(
        &mut self,
        sid: &[u8; 16],
        authorize: impl FnOnce() -> Result<G>,
    ) -> Result<Record> {
        let _authorization = authorize()?;
        self.pc_revoke(sid)?;
        let record = self.record(sid)?.ok_or(PairingError::OutcomeUnknown)?;
        if record.role != RecordRole::Pc
            || record.state != RecordState::Revoked
            || self.backup_scope(sid)?.is_some_and(|scope| scope.approved)
        {
            return Err(PairingError::OutcomeUnknown);
        }
        Ok(record)
    }

    pub(super) fn revoke(&mut self, sid: &[u8; 16], role: RecordRole) -> Result<Record> {
        self.write(|tx, local, epoch| {
            let mut record = load(tx, sid, local, epoch)?.ok_or(PairingError::CandidateStale)?;
            if record.role != role {
                return Err(PairingError::CandidateStale);
            }
            if record.state != RecordState::Revoked {
                let changed = tx
                    .execute(
                        "UPDATE records SET state=3 WHERE sid=?1 AND state!=3",
                        [sid.as_slice()],
                    )
                    .map_err(storage)?;
                if changed != 1 {
                    return Err(PairingError::StorageFailure);
                }
                record.state = RecordState::Revoked;
            }
            Ok(record)
        })
    }
}
