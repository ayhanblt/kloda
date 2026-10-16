use super::{checked_file, finalize, io_error, rows, scope_matches, temp_name, Entry, Receiver};
use crate::backup_root::{self, Directories};
use crate::file_protocol::{Error, OperationState, Response, Result, Upload, CHUNK_LIMIT};
use crate::key::Spki;
use crate::store::Store;
use crate::store_acl::Scope;
use crate::store_rows::{RecordRole, RecordState};
use ring::rand::{SecureRandom, SystemRandom};
use std::io::{Read, Seek, SeekFrom, Write};

impl Receiver {
    pub(super) fn create(
        &mut self,
        store: &mut Store,
        sid: &[u8; 16],
        peer: &Spki,
        scope: &Scope,
        directories: &Directories,
        upload: Upload,
    ) -> Result<Response> {
        validate_upload(&upload)?;
        if let Some(mut old) = rows::by_request(&store.conn, sid, &upload.request_id)? {
            scope_matches(&old, scope)?;
            let operation = &old.operation;
            if operation.source_id != upload.source_id
                || operation.source_revision != upload.source_revision
                || operation.name != upload.name
                || operation.sha256 != upload.sha256
                || operation.size != upload.size
            {
                return Err(Error::Conflict);
            }
            if old.operation.state == OperationState::Publishing {
                finalize::publish(store, sid, peer, directories, &mut old)?;
            }
            checked_file(
                directories,
                &old,
                old.operation.state == OperationState::Completed,
                false,
            )?;
            return Ok(Response::Operation(old.operation));
        }
        let random = SystemRandom::new();
        let (id, file) = loop {
            let mut id = [0; 16];
            random.fill(&mut id).map_err(|_| Error::BackupUnavailable)?;
            let id = crate::qr_base64::encode(&id);
            let exists: bool = store
                .conn
                .query_row(
                    "SELECT EXISTS(SELECT 1 FROM file_operations WHERE id=?1)",
                    [&id],
                    |r| r.get(0),
                )
                .map_err(rows::storage)?;
            if exists {
                continue;
            }
            let name = temp_name(&id);
            match directories.peer.symlink_metadata(&name) {
                Ok(_) => continue,
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => (),
                Err(error) => return Err(io_error(error)),
            }
            let file = backup_root::open_file(&directories.peer, &name, true, true)?;
            break (id, file);
        };
        let identity = backup_root::file_identity(&file)?;
        file.sync_all().map_err(io_error)?;
        directories.sync()?;
        let entry = rows::insert(store, sid, &id, upload, scope, &identity)?;
        Ok(Response::Operation(entry.operation))
    }
    pub(super) fn chunk(
        &mut self,
        store: &mut Store,
        sid: &[u8; 16],
        directories: &Directories,
        entry: &mut Entry,
        offset: u64,
        bytes: &[u8],
    ) -> Result<()> {
        if bytes.is_empty() || bytes.len() > CHUNK_LIMIT {
            return Err(Error::InvalidRequest);
        }
        if entry.operation.state != OperationState::Receiving {
            return Err(Error::BackupBusy);
        }
        let end = offset
            .checked_add(bytes.len() as u64)
            .ok_or(Error::InvalidRequest)?;
        if offset > entry.operation.offset
            || end > entry.operation.size
            || (offset < entry.operation.offset && end > entry.operation.offset)
        {
            return Err(Error::Conflict);
        }
        let mut file = checked_file(directories, entry, false, true)?;
        let length = file.metadata().map_err(io_error)?.len();
        if length < entry.operation.offset || length > entry.operation.size {
            return Err(Error::OutcomeUnknown);
        }
        let overlap = length.saturating_sub(offset).min(bytes.len() as u64) as usize;
        file.seek(SeekFrom::Start(offset)).map_err(io_error)?;
        let mut existing = [0; CHUNK_LIMIT];
        file.read_exact(&mut existing[..overlap])
            .map_err(io_error)?;
        if existing[..overlap] != bytes[..overlap] {
            return Err(Error::Conflict);
        }
        if offset < entry.operation.offset {
            return Ok(());
        }
        // A crash tail is adopted only by explicit same-byte retry; nothing is truncated.
        file.write_all(&bytes[overlap..]).map_err(io_error)?;
        file.sync_all().map_err(io_error)?;
        rows::advance(store, sid, entry, end, OperationState::Receiving)
    }
    pub(super) fn revoke(
        &mut self,
        store: &mut Store,
        sid: &[u8; 16],
        peer: &Spki,
    ) -> Result<Response> {
        let record = store.record(sid)?.ok_or(Error::Denied)?;
        if record.role != RecordRole::Pc
            || record.expected != peer.fingerprint()
            || record.peer.as_ref() != Some(peer)
            || !matches!(record.state, RecordState::Complete | RecordState::Revoked)
        {
            return Err(Error::Denied);
        }
        crate::file_schema::validate_acl(&store.conn)?;
        // Existing revoke_scope trigger commits the trust tombstone and ACL in the same transaction.
        rows::write(store, |tx, local, epoch| {
            let record = crate::store_rows::load(tx, sid, local, epoch)?.ok_or(Error::Denied)?;
            if record.role != RecordRole::Pc
                || record.peer.as_ref() != Some(peer)
                || !matches!(record.state, RecordState::Complete | RecordState::Revoked)
            {
                return Err(Error::Denied);
            }
            tx.execute(
                "UPDATE records SET state=3 WHERE sid=?1 AND state=2",
                [sid.as_slice()],
            )
            .map_err(rows::storage)?;
            Ok(())
        })?;
        self.hashes.revoke(sid);
        Ok(Response::PairRevoked)
    }
}
fn validate_upload(upload: &Upload) -> Result<()> {
    crate::qr_base64::fixed::<16>(&upload.request_id).map_err(|_| Error::InvalidRequest)?;
    crate::qr_base64::fixed::<16>(&upload.source_id).map_err(|_| Error::InvalidRequest)?;
    crate::qr_base64::fixed::<32>(&upload.sha256).map_err(|_| Error::InvalidRequest)?;
    if upload.source_revision.is_empty()
        || upload.source_revision.len() > 1024
        || !crate::file_schema::safe_name(&upload.name)
        || upload.size > i64::MAX as u64
    {
        return Err(Error::InvalidRequest);
    }
    Ok(())
}
