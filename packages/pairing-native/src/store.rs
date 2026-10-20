use crate::error::{PairingError, Result};
use crate::key::Spki;
#[cfg(test)]
use crate::store_rows::validate_all;
pub(crate) use crate::store_rows::Record;
use crate::store_rows::{load, visit};
use rusqlite::{params, Connection, OpenFlags, Transaction, TransactionBehavior};
use std::path::Path;
use std::time::Duration;

/// Owned by the native serialized worker; never shared with managed callers.
pub(crate) struct Store {
    pub(super) conn: Connection,
    pub(super) local: Spki,
    pub(super) epoch: [u8; 16],
    pub(super) poisoned: bool,
}

impl Store {
    pub(crate) fn open(directory: &Path, local: Spki, epoch: [u8; 16]) -> Result<Self> {
        let path = directory.join("pairing.sqlite3");
        let existed = path
            .try_exists()
            .map_err(|_| PairingError::StorageFailure)?;
        let mut conn = Connection::open_with_flags(
            &path,
            OpenFlags::SQLITE_OPEN_READ_WRITE
                | OpenFlags::SQLITE_OPEN_CREATE
                | OpenFlags::SQLITE_OPEN_NO_MUTEX,
        )
        .map_err(storage)?;
        conn.busy_timeout(Duration::from_secs(5)).map_err(storage)?;
        conn.execute_batch(
            "PRAGMA foreign_keys=ON; PRAGMA trusted_schema=OFF;
            PRAGMA synchronous=FULL; PRAGMA fullfsync=ON; PRAGMA checkpoint_fullfsync=ON;",
        )
        .map_err(storage)?;
        let journal: String = conn
            .query_row("PRAGMA journal_mode=WAL", [], |r| r.get(0))
            .map_err(storage)?;
        if journal != "wal" {
            return Err(PairingError::StorageFailure);
        }
        for (name, expected) in [
            ("synchronous", 2),
            ("foreign_keys", 1),
            ("fullfsync", 1),
            ("checkpoint_fullfsync", 1),
        ] {
            let actual: i64 = conn
                .pragma_query_value(None, name, |r| r.get(0))
                .map_err(storage)?;
            if actual != expected {
                return Err(PairingError::StorageFailure);
            }
        }
        let version: i64 = conn
            .pragma_query_value(None, "user_version", |r| r.get(0))
            .map_err(storage)?;
        if version == 0 && !existed {
            let tx = conn
                .transaction_with_behavior(TransactionBehavior::Immediate)
                .map_err(storage)?;
            tx.execute_batch(crate::store_schema::SCHEMA)
                .map_err(storage)?;
            tx.execute(
                "INSERT INTO installation(id,version,local,epoch) VALUES(1,1,?1,?2)",
                params![local.as_bytes().as_slice(), epoch.as_slice()],
            )
            .map_err(storage)?;
            tx.commit().map_err(|_| PairingError::OutcomeUnknown)?;
        } else if !matches!(version, 1..=4) {
            return Err(PairingError::StorageFailure);
        }
        let mut integrity = conn.prepare("PRAGMA integrity_check").map_err(storage)?;
        let mut rows = integrity.query([]).map_err(storage)?;
        let first: String = rows
            .next()
            .map_err(storage)?
            .ok_or(PairingError::StorageFailure)?
            .get(0)
            .map_err(storage)?;
        if first != "ok" || rows.next().map_err(storage)?.is_some() {
            return Err(PairingError::StorageFailure);
        }
        drop(rows);
        drop(integrity);
        check_installation(&conn, &local, &epoch)?;
        visit(&conn, &local, &epoch, |_| Ok(()))?;
        if !matches!(version, 2..=4) {
            let tx = conn
                .transaction_with_behavior(TransactionBehavior::Immediate)
                .map_err(storage)?;
            tx.execute_batch(crate::store_acl_schema::SCHEMA)
                .map_err(|_| PairingError::AclUnavailable)?;
            tx.commit().map_err(|_| PairingError::OutcomeUnknown)?;
        }
        crate::file_schema::migrate(&mut conn, version)?;
        crate::backup_retention_schema::migrate(&mut conn, version)?;
        Ok(Self {
            conn,
            local,
            epoch,
            poisoned: false,
        })
    }

    pub(crate) fn local(&self) -> &Spki {
        &self.local
    }
    pub(crate) fn epoch(&self) -> &[u8; 16] {
        &self.epoch
    }

    pub(crate) fn retained_record(
        &self,
        role: crate::store_rows::RecordRole,
    ) -> Result<Option<Record>> {
        use crate::store_rows::RecordState;
        self.ready()?;
        let priority = |state| match state {
            RecordState::Consumed | RecordState::Pending | RecordState::PinnedPendingAck => 0,
            RecordState::Complete => 1,
            RecordState::Revoked => 2,
        };
        let mut retained: Option<Record> = None;
        visit(&self.conn, &self.local, &self.epoch, |record| {
            if record.role == role
                && retained.as_ref().is_none_or(|old| {
                    (priority(record.state), record.sid) < (priority(old.state), old.sid)
                })
            {
                retained = Some(record);
            }
            Ok(())
        })?;
        Ok(retained)
    }
    pub(crate) fn record(&self, sid: &[u8; 16]) -> Result<Option<Record>> {
        self.ready()?;
        load(&self.conn, sid, &self.local, &self.epoch)
    }

    #[cfg(test)]
    pub(crate) fn records(&self) -> Result<Vec<Record>> {
        self.ready()?;
        validate_all(&self.conn, &self.local, &self.epoch)
    }

    pub(crate) fn sid_exists(&self, sid: &[u8; 16]) -> Result<bool> {
        self.ready()?;
        self.conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM records WHERE sid=?1)",
                [sid.as_slice()],
                |row| row.get(0),
            )
            .map_err(storage)
    }

    /// Native-derived metadata for an explicit, exact-candidate re-pair approval.
    pub(crate) fn repair_required(
        &self,
        role: crate::store_rows::RecordRole,
        expected: &[u8; 32],
    ) -> Result<Option<[u8; 16]>> {
        self.ready()?;
        crate::store_rows::repair_required(&self.conn, &self.local, &self.epoch, role, expected)
    }

    pub(super) fn ready(&self) -> Result<()> {
        if self.poisoned {
            return Err(PairingError::OutcomeUnknown);
        }
        check_installation(&self.conn, &self.local, &self.epoch)
    }

    pub(super) fn write<T>(
        &mut self,
        change: impl FnOnce(&Transaction<'_>, &Spki, &[u8; 16]) -> Result<T>,
    ) -> Result<T> {
        self.ready()?;
        let tx = match self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)
        {
            Ok(tx) => tx,
            Err(_) => {
                self.poisoned = true;
                return Err(PairingError::StorageFailure);
            }
        };
        let value = match change(&tx, &self.local, &self.epoch) {
            Ok(value) => value,
            Err(error) => {
                if tx.rollback().is_err() {
                    self.poisoned = true;
                    return Err(PairingError::OutcomeUnknown);
                }
                if matches!(
                    error,
                    PairingError::StorageFailure | PairingError::OutcomeUnknown
                ) {
                    self.poisoned = true;
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

pub(super) fn storage<E>(_: E) -> PairingError {
    PairingError::StorageFailure
}

fn check_installation(conn: &Connection, local: &Spki, epoch: &[u8; 16]) -> Result<()> {
    let mut statement = conn
        .prepare("SELECT id,version,local,epoch FROM installation")
        .map_err(storage)?;
    let mut rows = statement.query([]).map_err(storage)?;
    let row = rows
        .next()
        .map_err(storage)?
        .ok_or(PairingError::ContinuityLost)?;
    let id: i64 = row.get(0).map_err(storage)?;
    let version: i64 = row.get(1).map_err(storage)?;
    let key = row
        .get_ref(2)
        .map_err(storage)?
        .as_blob()
        .map_err(storage)?;
    let saved_epoch = row
        .get_ref(3)
        .map_err(storage)?
        .as_blob()
        .map_err(storage)?;
    if id != 1 || version != 1 || key != local.as_bytes() || saved_epoch != epoch {
        return Err(PairingError::ContinuityLost);
    }
    if rows.next().map_err(storage)?.is_some() {
        return Err(PairingError::StorageFailure);
    }
    Ok(())
}

#[cfg(test)]
#[path = "store_tests.rs"]
mod tests;
