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
    pub(crate) owner: Arc<PairingOwner>,
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
    submission_error: Option<PairingError>,
}
impl<'task> ScopedTask<'task> for RequestTask {
    type Output = PairingSnapshot;
    type JsValue = JsString<'task>;
    fn compute(&mut self) -> napi::Result<PairingSnapshot> {
        if let Some(error) = self.submission_error.take() {
            return Err(native_error(error));
        }
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
    pub fn suspend_pairing(&self) -> AsyncTask<RequestTask> {
        let result = self
            .owner
            .suspend_foreground()
            .map(|_| Action::SuspendPairing);
        self.task(result)
    }
    #[napi]
    pub fn receiver_status(&self) -> AsyncTask<ReceiverTask> {
        AsyncTask::new(ReceiverTask {
            owner: self.owner.clone(),
        })
    }
    #[napi]
    pub fn receiver_activity(&self, after: Option<String>) -> AsyncTask<ActivityTask> {
        AsyncTask::new(ActivityTask {
            owner: self.owner.clone(),
            after,
        })
    }
    #[napi]
    pub fn paired_devices(&self, after: Option<String>) -> AsyncTask<DevicesTask> {
        AsyncTask::new(DevicesTask {
            owner: self.owner.clone(),
            after,
        })
    }
    #[napi]
    pub fn paired_device(&self, record: String) -> AsyncTask<DeviceTask> {
        AsyncTask::new(DeviceTask {
            owner: self.owner.clone(),
            record,
        })
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
    pub fn remove_device(&self, record: String) -> AsyncTask<RequestTask> {
        self.submit(Action::RemoveDevice { record })
    }
    #[napi]
    pub fn close(&self) -> AsyncTask<RequestTask> {
        self.submit(Action::Close)
    }
}
impl NativePairing {
    fn submit(&self, action: Action) -> AsyncTask<RequestTask> {
        let foreground = matches!(
            &action,
            Action::CreateInvitation
                | Action::Approve { .. }
                | Action::ApproveBackup { .. }
                | Action::RevokeBackup { .. }
                | Action::RemoveDevice { .. }
                | Action::Resume { .. }
        );
        let result = if foreground {
            self.owner.foreground_action(action)
        } else {
            Ok(action)
        };
        self.task(result)
    }
    fn task(&self, result: crate::error::Result<Action>) -> AsyncTask<RequestTask> {
        let (action, submission_error) = match result {
            Ok(action) => (Some(action), None),
            Err(error) => (None, Some(error)),
        };
        AsyncTask::new(RequestTask {
            owner: self.owner.clone(),
            action,
            submission_error,
        })
    }
}
pub(crate) fn native_error(error: PairingError) -> napi::Error {
    napi::Error::new(napi::Status::GenericFailure, error.code())
}

pub struct ReceiverTask {
    owner: Arc<PairingOwner>,
}
impl Task for ReceiverTask {
    type Output = String;
    type JsValue = String;
    fn compute(&mut self) -> napi::Result<String> {
        self.owner.receiver_status().map_err(native_error)
    }
    fn resolve(&mut self, _: Env, status: String) -> napi::Result<String> {
        Ok(status)
    }
}

pub struct ActivityTask {
    owner: Arc<PairingOwner>,
    after: Option<String>,
}
impl Task for ActivityTask {
    type Output = String;
    type JsValue = String;
    fn compute(&mut self) -> napi::Result<String> {
        self.owner
            .receiver_activity(self.after.take())
            .map_err(native_error)
    }
    fn resolve(&mut self, _: Env, activity: String) -> napi::Result<String> {
        Ok(activity)
    }
}

pub struct DevicesTask {
    owner: Arc<PairingOwner>,
    after: Option<String>,
}
impl Task for DevicesTask {
    type Output = String;
    type JsValue = String;
    fn compute(&mut self) -> napi::Result<String> {
        self.owner
            .paired_devices(self.after.take())
            .map_err(native_error)
    }
    fn resolve(&mut self, _: Env, devices: String) -> napi::Result<String> {
        Ok(devices)
    }
}

pub struct DeviceTask {
    owner: Arc<PairingOwner>,
    record: String,
}
impl Task for DeviceTask {
    type Output = String;
    type JsValue = String;
    fn compute(&mut self) -> napi::Result<String> {
        self.owner
            .paired_device(std::mem::take(&mut self.record))
            .map_err(native_error)
    }
    fn resolve(&mut self, _: Env, device: String) -> napi::Result<String> {
        Ok(device)
    }
}
