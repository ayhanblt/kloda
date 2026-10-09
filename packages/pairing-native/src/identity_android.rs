use super::{identity, HardwareSigner, Identity};
use crate::{
    android_context::AndroidContext,
    error::{PairingError, Result},
    key::Spki,
};
use std::sync::Arc;
struct AndroidKey {
    context: AndroidContext,
}
impl HardwareSigner for AndroidKey {
    fn sign_native(&self, message: &[u8]) -> Result<Vec<u8>> {
        self.context.call_bytes("nativeSign", message)
    }
}
pub(super) fn open(alias: &str, create: bool, context: AndroidContext) -> Result<Identity> {
    let class = context.call_string(
        if create {
            "nativeCreateIdentity"
        } else {
            "nativeOpenIdentity"
        },
        alias,
    )?;
    let class = match class.as_str() {
        "strongbox" => "strongbox",
        "hardware_tee" => "hardware_tee",
        "secure_hardware" => "secure_hardware",
        "native_unsupported" => return Err(PairingError::NativeUnsupported),
        "continuity_lost" => return Err(PairingError::ContinuityLost),
        _ => return Err(PairingError::IdentityUnavailable),
    };
    let public = Spki::parse(&context.call_bytes("nativePublicSpki", &[])?)?;
    Ok(identity(public, Arc::new(AndroidKey { context }), class))
}
