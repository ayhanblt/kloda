use crate::error::{PairingError, Result};
use jni::{
    objects::{GlobalRef, JByteArray, JObject, JString, JValue},
    JavaVM,
};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

/// The root JNI adapter constructs this only from its Kotlin-created application wrapper.
/// GlobalRef and JavaVM are JNI's cross-thread ownership types; each call attaches
/// the current native worker, and its guard detaches only after local references drain.
#[derive(Clone)]
pub(crate) struct AndroidContext {
    platform: Arc<Platform>,
}
struct Platform {
    vm: JavaVM,
    object: GlobalRef,
    closed: AtomicBool,
}
impl AndroidContext {
    pub(crate) fn new(vm: JavaVM, platform: GlobalRef) -> Self {
        Self {
            platform: Arc::new(Platform {
                vm,
                object: platform,
                closed: AtomicBool::new(false),
            }),
        }
    }
    /// Called by the worker only after dropping its actor and every signer/route clone.
    pub(crate) fn close(&self) -> Result<()> {
        self.platform.close()
    }
    pub(crate) fn call_string(&self, name: &str, argument: &str) -> Result<String> {
        self.platform.call_string(name, argument)
    }
    pub(crate) fn call_bytes(&self, name: &str, argument: &[u8]) -> Result<Vec<u8>> {
        self.platform.call_bytes(name, argument)
    }
}
impl Platform {
    fn close(&self) -> Result<()> {
        if self.closed.load(Ordering::Acquire) {
            return Ok(());
        }
        match self.call_string("nativeClose", "") {
            Ok(value) if value == "closed" => {
                self.closed.store(true, Ordering::Release);
                Ok(())
            }
            _ => Err(PairingError::OutcomeUnknown),
        }
    }
    pub(crate) fn call_string(&self, name: &str, argument: &str) -> Result<String> {
        let mut env = self
            .vm
            .attach_current_thread()
            .map_err(|_| PairingError::NativeUnsupported)?;
        let result = env.with_local_frame(16, |env| -> jni::errors::Result<String> {
            let arg = JObject::from(env.new_string(argument)?);
            let value = env
                .call_method(
                    self.object.as_obj(),
                    name,
                    "(Ljava/lang/String;)Ljava/lang/String;",
                    &[JValue::Object(&arg)],
                )?
                .l()?;
            let value = JString::from(value);
            let text: String = env.get_string(&value)?.into();
            Ok(text)
        });
        result.map_err(|_| {
            let _ = env.exception_clear();
            PairingError::IdentityUnavailable
        })
    }
    pub(crate) fn call_bytes(&self, name: &str, argument: &[u8]) -> Result<Vec<u8>> {
        let mut env = self
            .vm
            .attach_current_thread()
            .map_err(|_| PairingError::NativeUnsupported)?;
        let result = env.with_local_frame(16, |env| -> jni::errors::Result<Vec<u8>> {
            let arg = JObject::from(env.byte_array_from_slice(argument)?);
            let value = env
                .call_method(
                    self.object.as_obj(),
                    name,
                    "([B)[B",
                    &[JValue::Object(&arg)],
                )?
                .l()?;
            env.convert_byte_array(JByteArray::from(value))
        });
        result.map_err(|_| {
            let _ = env.exception_clear();
            PairingError::IdentityUnavailable
        })
    }
}

impl Drop for Platform {
    fn drop(&mut self) {
        // Last JNI reference: startup/spawn errors and worker unwinding also drain
        // all callback-owning clones before unregistering the OS route observer.
        let _ = self.close();
    }
}
