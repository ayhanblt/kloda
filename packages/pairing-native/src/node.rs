use crate::{
    error::PairingError,
    handle::Action,
    owner::{PairingOwner, PairingSnapshot},
};
use napi::{bindgen_prelude::AsyncTask, Env, JsString, ScopedTask, Task};
use napi_derive::napi;
use std::{path::PathBuf, sync::Arc};

#[napi]
pub struct NativePairing {
    owner: Arc<PairingOwner>,
}

pub struct OpenTask {
    directory: PathBuf,
}
impl Task for OpenTask {
    type Output = Arc<PairingOwner>;
    type JsValue = NativePairing;
    fn compute(&mut self) -> napi::Result<Self::Output> {
        PairingOwner::open_pc(std::mem::take(&mut self.directory))
            .map(Arc::new)
            .map_err(native_error)
    }
    fn resolve(&mut self, _: Env, owner: Self::Output) -> napi::Result<NativePairing> {
        Ok(NativePairing { owner })
    }
}
#[napi]
pub fn open_pairing(directory: String) -> AsyncTask<OpenTask> {
    AsyncTask::new(OpenTask {
        directory: PathBuf::from(directory),
    })
}

pub struct RequestTask {
    owner: Arc<PairingOwner>,
    action: Option<Action>,
}
impl<'task> ScopedTask<'task> for RequestTask {
    type Output = PairingSnapshot;
    type JsValue = JsString<'task>;
    fn compute(&mut self) -> napi::Result<PairingSnapshot> {
        let action = self
            .action
            .take()
            .ok_or_else(|| native_error(PairingError::CandidateStale))?;
        self.owner.invoke(action).map_err(native_error)
    }
    fn resolve(
        &mut self,
        env: &'task Env,
        status: PairingSnapshot,
    ) -> napi::Result<JsString<'task>> {
        let json = status.json().map_err(native_error)?;
        env.create_string(json.as_str())
    }
}
#[napi]
impl NativePairing {
    #[napi]
    pub fn status(&self) -> AsyncTask<RequestTask> {
        self.submit(Action::Status)
    }
    #[napi]
    pub fn create_invitation(&self) -> AsyncTask<RequestTask> {
        self.submit(Action::CreateInvitation)
    }
    #[napi]
    pub fn approve(&self, operation: String, generation: String) -> AsyncTask<RequestTask> {
        self.submit(Action::Approve {
            operation,
            generation,
        })
    }
    #[napi]
    pub fn deny(&self, operation: String, generation: String) -> AsyncTask<RequestTask> {
        self.submit(Action::Deny {
            operation,
            generation,
        })
    }
    #[napi]
    pub fn cancel(&self, operation: String) -> AsyncTask<RequestTask> {
        self.submit(Action::Cancel { operation })
    }
    #[napi]
    pub fn resume(&self, record: String) -> AsyncTask<RequestTask> {
        self.submit(Action::Resume { record })
    }
    #[napi]
    pub fn remove_pairing(&self, record: String, online: bool) -> AsyncTask<RequestTask> {
        self.submit(Action::RemovePairing { record, online })
    }
    #[napi]
    pub fn approve_backup(
        &self,
        record: String,
        folder: String,
        revision: Option<String>,
    ) -> AsyncTask<RequestTask> {
        self.submit(Action::ApproveBackup {
            record,
            folder,
            revision,
        })
    }
    #[napi]
    pub fn revoke_backup(&self, record: String) -> AsyncTask<RequestTask> {
        self.submit(Action::RevokeBackup { record })
    }
    #[napi]
    pub fn close(&self) -> AsyncTask<RequestTask> {
        self.submit(Action::Close)
    }
}
impl NativePairing {
    fn submit(&self, action: Action) -> AsyncTask<RequestTask> {
        AsyncTask::new(RequestTask {
            owner: self.owner.clone(),
            action: Some(action),
        })
    }
}
fn native_error(error: PairingError) -> napi::Error {
    napi::Error::new(napi::Status::GenericFailure, error.code())
}
