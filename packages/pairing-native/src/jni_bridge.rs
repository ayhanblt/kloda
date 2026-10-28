use crate::{
    android_context::AndroidContext,
    error::{PairingError, Result},
    handle::{Action, NativeContext, OwnerRole},
    owner::PairingOwner,
};
use jni::{
    objects::{JClass, JObject, JString},
    sys::{jboolean, jint, jlong, jstring},
    JNIEnv,
};
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{
        atomic::{AtomicI64, Ordering},
        Arc, LazyLock, Mutex,
    },
};
use zeroize::Zeroizing;

static OWNERS: LazyLock<Mutex<HashMap<i64, Arc<PairingOwner>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
static NEXT: AtomicI64 = AtomicI64::new(1);
fn owners() -> &'static Mutex<HashMap<i64, Arc<PairingOwner>>> {
    &OWNERS
}
fn allocate_id() -> Result<i64> {
    let mut current = NEXT.load(Ordering::Acquire);
    loop {
        let next = current
            .checked_add(1)
            .ok_or(PairingError::NativeUnsupported)?;
        match NEXT.compare_exchange_weak(current, next, Ordering::AcqRel, Ordering::Acquire) {
            Ok(_) => return Ok(current),
            Err(observed) => current = observed,
        }
    }
}
fn failure(env: &mut JNIEnv<'_>, error: PairingError) {
    let _ = env.exception_clear();
    let _ = env.throw_new("java/lang/IllegalStateException", error.code());
}
fn reference(id: i64) -> Result<Arc<PairingOwner>> {
    owners()
        .lock()
        .map_err(|_| PairingError::OutcomeUnknown)?
        .get(&id)
        .cloned()
        .ok_or(PairingError::CandidateStale)
}
fn text(env: &mut JNIEnv<'_>, value: &JString<'_>, limit: i32) -> Result<String> {
    let length = env
        .call_method(value, "length", "()I", &[])
        .and_then(|v| v.i())
        .map_err(|_| PairingError::InvalidQr)?;
    if length < 0 || length > limit {
        return Err(PairingError::InvalidQr);
    }
    let text: String = env
        .get_string(value)
        .map_err(|_| PairingError::InvalidQr)?
        .into();
    if !text.is_ascii() {
        return Err(PairingError::InvalidQr);
    }
    Ok(text)
}
fn json_text(env: &mut JNIEnv<'_>, value: &JString<'_>, limit: i32) -> Result<String> {
    let length = env
        .call_method(value, "length", "()I", &[])
        .and_then(|v| v.i())
        .map_err(|_| PairingError::InvalidRequest)?;
    if length < 0 || length > limit {
        return Err(PairingError::InvalidRequest);
    }
    env.get_string(value)
        .map(|text| text.into())
        .map_err(|_| PairingError::InvalidRequest)
}
fn reply(env: &mut JNIEnv<'_>, id: i64, action: Result<Action>) -> jstring {
    let result = action
        .and_then(|action| {
            let owner = reference(id)?;
            let action = if matches!(
                &action,
                Action::Scan(_) | Action::Approve { .. } | Action::Resume { .. }
            ) {
                owner.foreground_action(action)?
            } else {
                action
            };
            owner.invoke(action)
        })
        .and_then(|status| status.json());
    match result {
        Ok(json) => match env.new_string(json.as_str()) {
            Ok(value) => value.into_raw(),
            Err(_) => {
                failure(env, PairingError::OutcomeUnknown);
                std::ptr::null_mut()
            }
        },
        Err(error) => {
            failure(env, error);
            std::ptr::null_mut()
        }
    }
}

#[no_mangle]
pub extern "system" fn Java_com_kloda_sync_KlodaPairingJni_setForeground(
    mut env: JNIEnv<'_>,
    _: JClass<'_>,
    id: jlong,
    active: jboolean,
) {
    if let Err(error) = reference(id).and_then(|owner| owner.set_foreground(active != 0)) {
        failure(&mut env, error);
    }
}

#[no_mangle]
pub extern "system" fn Java_com_kloda_sync_KlodaPairingJni_open(
    mut env: JNIEnv<'_>,
    _: JClass<'_>,
    platform: JObject<'_>,
) -> jlong {
    let result = (|| {
        let vm = env
            .get_java_vm()
            .map_err(|_| PairingError::NativeUnsupported)?;
        let object = env
            .new_global_ref(platform)
            .map_err(|_| PairingError::NativeUnsupported)?;
        let platform = AndroidContext::new(vm, object);
        let directory = platform.call_string("nativeDirectory", "")?;
        let handle = Arc::new(PairingOwner::open(NativeContext {
            directory: PathBuf::from(directory),
            role: OwnerRole::Phone,
            platform,
        })?);
        let id = allocate_id()?;
        owners()
            .lock()
            .map_err(|_| PairingError::OutcomeUnknown)?
            .insert(id, handle);
        Ok(id)
    })();
    match result {
        Ok(id) => id,
        Err(error) => {
            failure(&mut env, error);
            0
        }
    }
}
#[no_mangle]
pub extern "system" fn Java_com_kloda_sync_KlodaPairingJni_status(
    mut env: JNIEnv<'_>,
    _: JClass<'_>,
    id: jlong,
) -> jstring {
    reply(&mut env, id, Ok(Action::Status))
}
#[no_mangle]
pub extern "system" fn Java_com_kloda_sync_KlodaPairingJni_scan(
    mut env: JNIEnv<'_>,
    _: JClass<'_>,
    id: jlong,
    wire: JString<'_>,
) -> jstring {
    let action = text(&mut env, &wire, 512).map(|wire| Action::Scan(Zeroizing::new(wire)));
    reply(&mut env, id, action)
}
#[no_mangle]
pub extern "system" fn Java_com_kloda_sync_KlodaPairingJni_approve(
    mut env: JNIEnv<'_>,
    _: JClass<'_>,
    id: jlong,
    operation: JString<'_>,
    generation: JString<'_>,
) -> jstring {
    let action = (|| {
        Ok(Action::Approve {
            operation: text(&mut env, &operation, 22)?,
            generation: text(&mut env, &generation, 20)?,
        })
    })();
    reply(&mut env, id, action)
}
#[no_mangle]
pub extern "system" fn Java_com_kloda_sync_KlodaPairingJni_deny(
    mut env: JNIEnv<'_>,
    _: JClass<'_>,
    id: jlong,
    operation: JString<'_>,
    generation: JString<'_>,
) -> jstring {
    let action = (|| {
        Ok(Action::Deny {
            operation: text(&mut env, &operation, 22)?,
            generation: text(&mut env, &generation, 20)?,
        })
    })();
    reply(&mut env, id, action)
}
#[no_mangle]
pub extern "system" fn Java_com_kloda_sync_KlodaPairingJni_cancel(
    mut env: JNIEnv<'_>,
    _: JClass<'_>,
    id: jlong,
    operation: JString<'_>,
) -> jstring {
    let action = text(&mut env, &operation, 22).map(|operation| Action::Cancel { operation });
    reply(&mut env, id, action)
}
#[no_mangle]
pub extern "system" fn Java_com_kloda_sync_KlodaPairingJni_resume(
    mut env: JNIEnv<'_>,
    _: JClass<'_>,
    id: jlong,
    record: JString<'_>,
) -> jstring {
    let action = text(&mut env, &record, 22).map(|record| Action::Resume { record });
    reply(&mut env, id, action)
}
#[no_mangle]
pub extern "system" fn Java_com_kloda_sync_KlodaPairingJni_removePairing(
    mut env: JNIEnv<'_>,
    _: JClass<'_>,
    id: jlong,
    record: JString<'_>,
    online: jboolean,
) -> jstring {
    let action = text(&mut env, &record, 22).map(|record| Action::RemovePairing {
        record,
        online: online != 0,
    });
    reply(&mut env, id, action)
}
#[no_mangle]
pub extern "system" fn Java_com_kloda_sync_KlodaPairingJni_transfer(
    mut env: JNIEnv<'_>,
    _: JClass<'_>,
    id: jlong,
    record: JString<'_>,
    command: JString<'_>,
    descriptor: jint,
) -> jstring {
    let result = (|| {
        let record = text(&mut env, &record, 22)?;
        let command = json_text(
            &mut env,
            &command,
            crate::file_protocol::METADATA_LIMIT as i32,
        )?;
        reference(id)?.transfer(record, &command, descriptor)
    })();
    let result = result.or_else(|error| crate::file_sender_command::json(Err(error)));
    match result.and_then(|json| {
        env.new_string(json)
            .map_err(|_| PairingError::OutcomeUnknown)
    }) {
        Ok(value) => value.into_raw(),
        Err(error) => {
            failure(&mut env, error);
            std::ptr::null_mut()
        }
    }
}
#[no_mangle]
pub extern "system" fn Java_com_kloda_sync_KlodaPairingJni_close(
    mut env: JNIEnv<'_>,
    _: JClass<'_>,
    id: jlong,
) {
    let result = reference(id).and_then(|owner| owner.invoke(Action::Close));
    if let Err(error) = result {
        failure(&mut env, error)
    }
    if let Ok(mut owners) = owners().lock() {
        owners.remove(&id);
    }
}
