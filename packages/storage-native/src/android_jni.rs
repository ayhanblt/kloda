use jni::{
    JNIEnv,
    objects::{JClass, JObject, JString},
    sys::jint,
};
use std::{
    ffi::c_void,
    fs::File,
    os::fd::{FromRawFd, IntoRawFd},
};

struct Receipt<'local> {
    env: JNIEnv<'local>,
    callback: JObject<'local>,
}
unsafe extern "C" fn receipt(context: *mut c_void, event: i32, bytes: u64) -> i32 {
    let owner = unsafe { &mut *context.cast::<Receipt<'_>>() };
    match owner
        .env
        .call_method(
            &owner.callback,
            "onEvent",
            "(IJ)I",
            &[event.into(), (bytes as i64).into()],
        )
        .and_then(|v| v.i())
    {
        Ok(code) => code,
        Err(_) => {
            let _ = owner.env.exception_clear();
            1
        }
    }
}

#[unsafe(no_mangle)]
pub extern "system" fn Java_com_kloda_sync_SmbNativeEngine_publish<'local>(
    env: JNIEnv<'local>,
    _: JClass<'local>,
    json: JString<'local>,
    snapshot: jint,
    callback: JObject<'local>,
) -> jint {
    publish_native(env, json, snapshot, None, callback, false)
}

#[unsafe(no_mangle)]
pub extern "system" fn Java_com_kloda_sync_SmbNativeEngine_publishBound<'local>(
    env: JNIEnv<'local>,
    _: JClass<'local>,
    json: JString<'local>,
    snapshot: jint,
    socket: jint,
    callback: JObject<'local>,
) -> jint {
    publish_native(env, json, snapshot, Some(socket), callback, false)
}

#[unsafe(no_mangle)]
pub extern "system" fn Java_com_kloda_sync_SmbNativeEngine_readBound<'local>(
    env: JNIEnv<'local>,
    _: JClass<'local>,
    json: JString<'local>,
    output: jint,
    socket: jint,
    callback: JObject<'local>,
) -> jint {
    publish_native(env, json, output, Some(socket), callback, true)
}

fn publish_native<'local>(
    mut env: JNIEnv<'local>,
    json: JString<'local>,
    snapshot: jint,
    socket: Option<jint>,
    callback: JObject<'local>,
    reading: bool,
) -> jint {
    if snapshot < 0 {
        if let Some(fd) = socket.filter(|fd| *fd >= 0) {
            drop(unsafe { File::from_raw_fd(fd) });
        }
        return 1;
    }
    // JNI and C ABI both consume a transferred duplicate, never the original source FD.
    let file = unsafe { File::from_raw_fd(snapshot) };
    if socket.is_some_and(|fd| fd < 0 || fd == snapshot) {
        return 1;
    }
    let wire = socket.map(|fd| unsafe { File::from_raw_fd(fd) });
    if json.is_null() || callback.is_null() {
        return 1;
    }
    let json: String = match env.get_string(&json) {
        Ok(value) => value.into(),
        Err(_) => {
            let _ = env.exception_clear();
            return 1;
        }
    };
    let mut owner = Receipt { env, callback };
    unsafe {
        let context = (&mut owner as *mut Receipt<'_>).cast();
        if let Some(wire) = wire {
            let operation = if reading {
                crate::read_bound::kloda_smb_read_bound
            } else {
                crate::bridge_socket::kloda_smb_publish_bound
            };
            operation(
                json.as_ptr(),
                json.len(),
                file.into_raw_fd(),
                wire.into_raw_fd(),
                Some(receipt),
                context,
            )
        } else {
            crate::bridge::kloda_smb_publish(
                json.as_ptr(),
                json.len(),
                file.into_raw_fd(),
                Some(receipt),
                context,
            )
        }
    }
}
