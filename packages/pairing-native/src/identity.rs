use crate::{
    certificate::CertificateSigner,
    error::{PairingError, Result},
    key::Spki,
};
use rustls::{
    pki_types::SubjectPublicKeyInfoDer,
    sign::{Signer, SigningKey},
    SignatureAlgorithm, SignatureScheme,
};
use std::{path::Path, sync::Arc};

#[cfg(any(target_os = "macos", target_os = "ios"))]
#[path = "identity_macos.rs"]
mod platform;
#[cfg(target_os = "android")]
#[path = "identity_android.rs"]
mod platform;
#[cfg(target_os = "windows")]
#[path = "identity_windows.rs"]
mod platform;
#[cfg(any(target_os = "windows", test))]
#[path = "identity_windows_encoding.rs"]
mod windows_encoding;

pub(crate) struct Identity {
    spki: Spki,
    key: Arc<HardwareKey>,
    class: &'static str,
}
impl Identity {
    pub(crate) fn spki(&self) -> &Spki {
        &self.spki
    }
    pub(crate) fn signing_key(&self) -> Arc<dyn SigningKey> {
        self.key.clone()
    }
    pub(crate) fn certificate_signer(&self) -> Arc<dyn CertificateSigner> {
        self.key.clone()
    }
    pub(crate) fn hardware_class(&self) -> &'static str {
        self.class
    }
}

#[cfg(any(
    target_os = "macos",
    target_os = "ios",
    target_os = "android",
    target_os = "windows"
))]
pub(crate) fn alias(directory: &Path, epoch: [u8; 16]) -> Result<String> {
    let path = directory
        .canonicalize()
        .map_err(|_| PairingError::IdentityUnavailable)?;
    let mut context = ring::digest::Context::new(&ring::digest::SHA256);
    #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
    {
        use std::os::unix::ffi::OsStrExt;
        context.update(path.as_os_str().as_bytes());
    }
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::ffi::OsStrExt;
        for unit in path.as_os_str().encode_wide() {
            context.update(&unit.to_le_bytes());
        }
    }
    context.update(&epoch);
    let mut tag = String::from("com.kloda.pairing.v1.");
    for byte in context.finish().as_ref() {
        use std::fmt::Write;
        write!(&mut tag, "{byte:02x}").unwrap();
    }
    Ok(tag)
}

#[cfg(any(target_os = "macos", target_os = "ios", target_os = "windows"))]
pub(crate) fn open(directory: &Path, epoch: [u8; 16], create: bool) -> Result<Identity> {
    platform::open(&alias(directory, epoch)?, create)
}
#[cfg(target_os = "android")]
pub(crate) fn open(
    directory: &Path,
    epoch: [u8; 16],
    create: bool,
    context: crate::android_context::AndroidContext,
) -> Result<Identity> {
    platform::open(&alias(directory, epoch)?, create, context)
}
#[cfg(not(any(
    target_os = "macos",
    target_os = "ios",
    target_os = "android",
    target_os = "windows"
)))]
pub(crate) fn open(_: &Path, _: [u8; 16], _: bool) -> Result<Identity> {
    Err(PairingError::NativeUnsupported)
}

trait HardwareSigner: Send + Sync {
    fn sign_native(&self, message: &[u8]) -> Result<Vec<u8>>;
}
struct HardwareKey {
    provider: Arc<dyn HardwareSigner>,
    public: Spki,
}
impl std::fmt::Debug for HardwareKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("HardwareP256")
    }
}
impl SigningKey for HardwareKey {
    fn choose_scheme(&self, offered: &[SignatureScheme]) -> Option<Box<dyn Signer>> {
        offered
            .contains(&SignatureScheme::ECDSA_NISTP256_SHA256)
            .then(|| Box::new(HardwareSignature(self.provider.clone())) as Box<dyn Signer>)
    }
    fn algorithm(&self) -> SignatureAlgorithm {
        SignatureAlgorithm::ECDSA
    }
    fn public_key(&self) -> Option<SubjectPublicKeyInfoDer<'_>> {
        Some(SubjectPublicKeyInfoDer::from(
            self.public.as_bytes().as_slice(),
        ))
    }
}
struct HardwareSignature(Arc<dyn HardwareSigner>);
impl std::fmt::Debug for HardwareSignature {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("HardwareP256Signature")
    }
}
impl Signer for HardwareSignature {
    fn sign(&self, message: &[u8]) -> std::result::Result<Vec<u8>, rustls::Error> {
        self.0
            .sign_native(message)
            .map_err(|_| rustls::Error::General("identity_unavailable".into()))
    }
    fn scheme(&self) -> SignatureScheme {
        SignatureScheme::ECDSA_NISTP256_SHA256
    }
}
impl CertificateSigner for HardwareKey {
    fn sign_certificate_tbs(&self, tbs: &[u8]) -> Result<Vec<u8>> {
        self.provider.sign_native(tbs)
    }
}
#[cfg(any(
    target_os = "macos",
    target_os = "ios",
    target_os = "android",
    target_os = "windows"
))]
fn identity(public: Spki, provider: Arc<dyn HardwareSigner>, class: &'static str) -> Identity {
    Identity {
        spki: public.clone(),
        key: Arc::new(HardwareKey { provider, public }),
        class,
    }
}
