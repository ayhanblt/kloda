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
struct Owner<'a> {
    env: JNIEnv<'a>,
    callback: JObject<'a>,
}
unsafe extern "C" fn receipt(context: *mut c_void, event: i32, bytes: u64) -> i32 {
    let owner = unsafe { &mut *context.cast::<Owner<'_>>() };
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
        Ok(value) => value,
        Err(_) => {
            let _ = owner.env.exception_clear();
            1
        }
    }
}
unsafe extern "C" fn connect(
    context: *mut c_void,
    address: *const u8,
    length: usize,
    port: u16,
) -> i32 {
    if address.is_null() || length == 0 || length > 39 || port == 0 {
        return -1;
    }
    let owner = unsafe { &mut *context.cast::<Owner<'_>>() };
    let Ok(address) = std::str::from_utf8(unsafe { std::slice::from_raw_parts(address, length) })
    else {
        return -1;
    };
    let result: jni::errors::Result<i32> = {
        let callback = &owner.callback;
        owner.env.with_local_frame(4, |env| {
            let text = env.new_string(address)?;
            env.call_method(
                callback,
                "connect",
                "(Ljava/lang/String;I)I",
                &[(&text).into(), (port as i32).into()],
            )?
            .i()
        })
    };
    match result {
        Ok(fd) => fd,
        Err(_) => {
            let _ = owner.env.exception_clear();
            -1
        }
    }
}

fn run<'a>(
    mut env: JNIEnv<'a>,
    json: JString<'a>,
    file: i32,
    socket: i32,
    callback: JObject<'a>,
    writing: bool,
) -> i32 {
    if file >= 0 && file == socket {
        drop(unsafe { File::from_raw_fd(file) });
        return 1;
    }
    let file = if file >= 0 {
        Some(unsafe { File::from_raw_fd(file) })
    } else {
        None
    };
    let socket = if socket >= 0 {
        Some(unsafe { File::from_raw_fd(socket) })
    } else {
        None
    };
    let (Some(file), Some(socket)) = (file, socket) else {
        return 1;
    };
    let json: String = match env.get_string(&json) {
        Ok(value) => value.into(),
        Err(_) => {
            let _ = env.exception_clear();
            return 1;
        }
    };
    if json.is_empty() || json.len() > 16384 || callback.is_null() {
        return 1;
    }
    let mut owner = Owner { env, callback };
    let context = (&mut owner as *mut Owner<'_>).cast();
    if writing {
        unsafe {
            crate::bridge::kloda_ftps_publish_bound(
                json.as_ptr(),
                json.len(),
                file.into_raw_fd(),
                socket.into_raw_fd(),
                Some(receipt),
                Some(connect),
                context,
            )
        }
    } else {
        unsafe {
            crate::bridge::kloda_ftps_read_bound(
                json.as_ptr(),
                json.len(),
                file.into_raw_fd(),
                socket.into_raw_fd(),
                Some(receipt),
                Some(connect),
                context,
            )
        }
    }
}
#[unsafe(no_mangle)]
pub extern "system" fn Java_com_kloda_sync_FtpsNativeEngine_publishBound<'a>(
    env: JNIEnv<'a>,
    _: JClass<'a>,
    json: JString<'a>,
    file: jint,
    socket: jint,
    callback: JObject<'a>,
) -> jint {
    run(env, json, file, socket, callback, true)
}
#[unsafe(no_mangle)]
pub extern "system" fn Java_com_kloda_sync_FtpsNativeEngine_readBound<'a>(
    env: JNIEnv<'a>,
    _: JClass<'a>,
    json: JString<'a>,
    file: jint,
    socket: jint,
    callback: JObject<'a>,
) -> jint {
    run(env, json, file, socket, callback, false)
}
