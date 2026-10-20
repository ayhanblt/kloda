use crate::{
    error::Result,
    node::{native_error, NativePairing},
    owner::PairingOwner,
};
use napi::{bindgen_prelude::AsyncTask, Env, Task};
use napi_derive::napi;
use std::sync::Arc;
pub struct BackupTask {
    owner: Arc<PairingOwner>,
    query: Option<(Option<String>, bool)>,
    mutation: Option<(String, bool, Result<u64>)>,
}
impl Task for BackupTask {
    type Output = String;
    type JsValue = String;
    fn compute(&mut self) -> napi::Result<String> {
        if let Some((after, trash)) = self.query.take() {
            return self
                .owner
                .backup_versions(after, trash)
                .map_err(native_error);
        }
        let (ids, restore, epoch) = self
            .mutation
            .take()
            .ok_or_else(|| native_error(crate::PairingError::InvalidRequest))?;
        self.owner
            .mutate_backups(ids, restore, epoch.map_err(native_error)?)
            .map_err(native_error)
    }
    fn resolve(&mut self, _: Env, value: String) -> napi::Result<String> {
        Ok(value)
    }
}
#[napi]
impl NativePairing {
    #[napi]
    pub fn backup_versions(&self, after: Option<String>, trash: bool) -> AsyncTask<BackupTask> {
        AsyncTask::new(BackupTask {
            owner: self.owner.clone(),
            query: Some((after, trash)),
            mutation: None,
        })
    }
    #[napi]
    pub fn trash_backups(&self, ids: String) -> AsyncTask<BackupTask> {
        self.backup_mutation(ids, false)
    }
    #[napi]
    pub fn restore_backups(&self, ids: String) -> AsyncTask<BackupTask> {
        self.backup_mutation(ids, true)
    }
}
impl NativePairing {
    fn backup_mutation(&self, ids: String, restore: bool) -> AsyncTask<BackupTask> {
        // Capture synchronously before AsyncTask enters the pool, like existing grant actions.
        AsyncTask::new(BackupTask {
            owner: self.owner.clone(),
            query: None,
            mutation: Some((ids, restore, self.owner.backup_epoch())),
        })
    }
}
