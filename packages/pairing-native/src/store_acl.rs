use crate::backup_root::{self, Binding};
use crate::error::{PairingError, Result};
use crate::store::Store;
use crate::store_rows::{load, Record, RecordRole, RecordState};
use rusqlite::{params, ErrorCode, OptionalExtension, Transaction, TransactionBehavior};

pub(crate) struct Scope {
    pub(crate) folder: String,
    pub(crate) binding: Binding,
    pub(crate) revision: i64,
    pub(crate) approved: bool,
    pub(crate) peer_folder: Option<String>,
}

impl Store {
    pub(crate) fn backup_scope(&self, sid: &[u8; 16]) -> Result<Option<Scope>> {
        self.ready()?;
        let record = self.record(sid)?.ok_or(PairingError::CandidateStale)?;
        if record.role != RecordRole::Pc {
            return Err(PairingError::CandidateStale);
        }
        let mut statement = self.conn.prepare(
            "SELECT s.folder,s.root,s.peer_root,s.revision,s.state,s.permissions,sf.peer_folder
             FROM backup_scopes s LEFT JOIN scope_folders sf ON sf.sid=s.sid WHERE s.sid=?1",
        ).map_err(acl_storage)?;
        let mut rows = statement.query([sid.as_slice()]).map_err(acl_storage)?;
        let Some(row) = rows.next().map_err(acl_storage)? else {
            return Ok(None);
        };
        let folder: String = row.get(0).map_err(acl_storage)?;
        let root =
            crate::store_rows::blob::<24>(row, 1).map_err(|_| PairingError::AclUnavailable)?;
        let peer =
            crate::store_rows::blob::<24>(row, 2).map_err(|_| PairingError::AclUnavailable)?;
        let revision: i64 = row.get(3).map_err(acl_storage)?;
        let state: i64 = row.get(4).map_err(acl_storage)?;
        let permissions: i64 = row.get(5).map_err(acl_storage)?;
        let peer_folder: Option<String> = row.get(6).map_err(acl_storage)?;
        if revision <= 0
            || !matches!(state, 1 | 2)
            || permissions != 31
            || (state == 1 && record.state != RecordState::Complete)
        {
            return Err(PairingError::AclUnavailable);
        }
        Ok(Some(Scope {
            folder,
            binding: Binding { root, peer },
            revision,
            approved: state == 1,
            peer_folder,
        }))
    }

    #[cfg(test)]
    pub(crate) fn approve_backup(
        &mut self,
        sid: &[u8; 16],
        folder: &str,
        expected_revision: Option<i64>,
    ) -> Result<()> {
        self.approve_backup_guarded(sid, folder, expected_revision, || Ok(()))
    }

    pub(crate) fn approve_backup_guarded<G>(
        &mut self,
        sid: &[u8; 16],
        folder: &str,
        expected_revision: Option<i64>,
        authorize: impl FnOnce() -> Result<G>,
    ) -> Result<()> {
        let record = approved_peer(self.record(sid)?)?;
        if self.backup_scope(sid)?.map(|scope| scope.revision) != expected_revision {
            return Err(PairingError::CandidateStale);
        }
        let peer_name = self.peer_name(sid).ok().flatten();
        let reusable_peer_root: Option<[u8; 24]> = self
            .conn
            .query_row(
                "SELECT s.peer_root FROM backup_scopes s JOIN records r ON r.sid=s.sid
                 WHERE r.expected=?1 AND s.folder=?2 ORDER BY s.revision DESC LIMIT 1",
                params![record.expected.as_slice(), folder],
                |row| row.get::<_, Vec<u8>>(0),
            )
            .optional()
            .ok()
            .flatten()
            .and_then(|bytes| bytes.try_into().ok());
        let (binding, chosen_folder) = backup_root::prepare_named(
            folder,
            &record.expected,
            peer_name.as_deref(),
            reusable_peer_root,
        )?;
        let _authorization = authorize()?;
        self.acl_write(|tx, local, epoch| {
            approved_peer(load(tx, sid, local, epoch)?)?;
            let revision: Option<i64> = tx
                .query_row(
                    "SELECT revision FROM backup_scopes WHERE sid=?1",
                    [sid.as_slice()],
                    |row| row.get(0),
                )
                .optional()
                .map_err(acl_storage)?;
            if revision != expected_revision {
                return Err(PairingError::CandidateStale);
            }
            tx.execute(
                "INSERT INTO backup_scopes(sid,folder,root,peer_root,permissions,revision,state)
                VALUES(?1,?2,?3,?4,31,1,1)
                ON CONFLICT(sid) DO UPDATE SET folder=excluded.folder,root=excluded.root,
                peer_root=excluded.peer_root,revision=backup_scopes.revision+1,state=1",
                params![
                    sid.as_slice(),
                    folder,
                    binding.root.as_slice(),
                    binding.peer.as_slice()
                ],
            )
            .map_err(acl_storage)?;
            if let Some(peer_folder) = chosen_folder.as_deref() {
                tx.execute(
                    "INSERT INTO scope_folders(sid,peer_folder) VALUES(?1,?2)
                    ON CONFLICT(sid) DO UPDATE SET peer_folder=excluded.peer_folder",
                    params![sid.as_slice(), peer_folder],
                )
                .map_err(acl_storage)?;
            } else {
                tx.execute(
                    "DELETE FROM scope_folders WHERE sid=?1",
                    [sid.as_slice()],
                )
                .map_err(acl_storage)?;
            }
            Ok(())
        })
    }

    #[cfg(test)]
    pub(crate) fn revoke_backup(&mut self, sid: &[u8; 16]) -> Result<()> {
        self.revoke_backup_guarded(sid, || Ok(()))
    }

    pub(crate) fn revoke_backup_guarded<G>(
        &mut self,
        sid: &[u8; 16],
        authorize: impl FnOnce() -> Result<G>,
    ) -> Result<()> {
        let _authorization = authorize()?;
        self.acl_write(|tx, local, epoch| {
            let record = load(tx, sid, local, epoch)?.ok_or(PairingError::CandidateStale)?;
            if record.role != RecordRole::Pc {
                return Err(PairingError::CandidateStale);
            }
            tx.execute(
                "UPDATE backup_scopes SET state=2,revision=revision+1 WHERE sid=?1 AND state=1",
                [sid.as_slice()],
            )
            .map_err(acl_storage)?;
            Ok(())
        })
    }

    fn acl_write<T>(
        &mut self,
        change: impl FnOnce(&Transaction<'_>, &crate::key::Spki, &[u8; 16]) -> Result<T>,
    ) -> Result<T> {
        self.ready()?;
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(acl_storage)?;
        let value = match change(&tx, &self.local, &self.epoch) {
            Ok(value) => value,
            Err(error) => {
                if tx.rollback().is_err() {
                    self.poisoned = true;
                    return Err(PairingError::OutcomeUnknown);
                }
                return Err(error);
            }
        };
        if tx.commit().is_err() {
            self.poisoned = true;
            return Err(PairingError::OutcomeUnknown);
        }
        Ok(value)
    }
}

fn approved_peer(record: Option<Record>) -> Result<Record> {
    let record = record.ok_or(PairingError::CandidateStale)?;
    if record.state == RecordState::Revoked {
        return Err(PairingError::Revoked);
    }
    if record.role != RecordRole::Pc || record.state != RecordState::Complete {
        return Err(PairingError::CandidateStale);
    }
    Ok(record)
}

fn acl_storage(error: rusqlite::Error) -> PairingError {
    match error {
        rusqlite::Error::SqliteFailure(error, _)
            if matches!(
                error.code,
                ErrorCode::DatabaseBusy | ErrorCode::DatabaseLocked
            ) =>
        {
            PairingError::AclBusy
        }
        _ => PairingError::AclUnavailable,
    }
}

#[cfg(test)]
#[path = "store_acl_tests.rs"]
mod tests;
