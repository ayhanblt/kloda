use crate::{
    certificate::{self, Role},
    error::{PairingError, Result},
    handle::{NativeContext, OwnerRole},
    identity, installation_files as files, route,
    startup_diagnostics::{self as diagnostic, Stage},
    store::Store,
};
use rustls::{pki_types::CertificateDer, sign::CertifiedKey};
use std::{path::PathBuf, sync::Arc};
use x509_parser::prelude::{FromDer, X509Certificate};

pub(crate) struct Installation {
    pub(crate) store: Store,
    pub(crate) identity: identity::Identity,
    pub(crate) certified_key: Arc<CertifiedKey>,
    pub(crate) directory: PathBuf,
    epoch: [u8; 16],
    _owner_lock: files::OwnerLock,
}
pub(crate) fn open(context: &NativeContext) -> Result<Installation> {
    diagnostic::run(|| open_inner(context))
}
#[cfg(not(target_os = "windows"))]
fn open_inner(context: &NativeContext) -> Result<Installation> {
    if !context.directory.is_absolute() {
        return diagnostic::at(Stage::Directory, || Err(PairingError::StorageFailure));
    }
    let lock = diagnostic::at(Stage::Storage, || files::prepare(&context.directory))?;
    let (epoch, create) = diagnostic::at(Stage::Epoch, || files::epoch(&context.directory, &lock))?;
    let initialized = context.directory.join("initialized");
    diagnostic::at(Stage::Continuity, || {
        if files::exists(&initialized)?
            && (files::read_exact::<1>(&initialized)? != [1]
                || !files::exists(&context.directory.join("pairing.sqlite3"))?)
        {
            return Err(PairingError::ContinuityLost);
        }
        Ok(())
    })?;
    #[cfg(target_os = "android")]
    let identity = diagnostic::at(Stage::Identity, || {
        identity::open(&context.directory, epoch, create, context.platform.clone())
    })?;
    #[cfg(not(target_os = "android"))]
    let identity = diagnostic::at(Stage::Identity, || {
        identity::open(&context.directory, epoch, create)
    })?;
    let role = match context.role {
        #[cfg(not(target_os = "android"))]
        OwnerRole::Pc => Role::Pc,
        OwnerRole::Phone => Role::Phone,
    };
    let der = diagnostic::at(Stage::Certificate, || {
        certificate_for(
            &context.directory,
            &identity,
            role,
            route::unix_seconds()?,
            &lock,
        )
    })?;
    let certified_key = Arc::new(CertifiedKey::new(
        vec![CertificateDer::from(der)],
        identity.signing_key(),
    ));
    let store = diagnostic::at(Stage::Database, || {
        Store::open(&context.directory, identity.spki().clone(), epoch)
    })?;
    diagnostic::at(Stage::Initialized, || {
        if !files::exists(&initialized)? {
            files::write_new(&initialized, &[1], &lock)?;
        }
        Ok(())
    })?;
    Ok(Installation {
        store,
        identity,
        certified_key,
        directory: context.directory.clone(),
        epoch,
        _owner_lock: lock,
    })
}
#[cfg(target_os = "windows")]
#[path = "initialization_windows_generation.rs"]
mod windows_generation;
#[cfg(target_os = "windows")]
fn open_inner(context: &NativeContext) -> Result<Installation> {
    windows_generation::open(context)
}
impl Installation {
    pub(crate) fn check(&self) -> Result<()> {
        if files::read_exact::<16>(&self.directory.join("epoch"))? != self.epoch
            || files::read_exact::<1>(&self.directory.join("initialized"))? != [1]
            || !files::exists(&self.directory.join("pairing.sqlite3"))?
        {
            return Err(PairingError::ContinuityLost);
        }
        self.store.ready()
    }
    pub(crate) fn listener_port(&self) -> Result<Option<u16>> {
        let path = self.directory.join("listener-port");
        if !files::exists(&path)? {
            return Ok(None);
        }
        let port = u16::from_be_bytes(files::read_exact::<2>(&path)?);
        if port == 0 {
            return Err(PairingError::StorageFailure);
        }
        Ok(Some(port))
    }
    pub(crate) fn save_listener_port(&self, port: u16) -> Result<()> {
        if port == 0 {
            return Err(PairingError::StorageFailure);
        }
        match self.listener_port()? {
            Some(saved) if saved != port => Err(PairingError::StorageFailure),
            Some(_) => Ok(()),
            None => files::write_new(
                &self.directory.join("listener-port"),
                &port.to_be_bytes(),
                &self._owner_lock,
            ),
        }
    }
}
fn certificate_for(
    directory: &std::path::Path,
    identity: &identity::Identity,
    role: Role,
    now: u64,
    owner: &files::OwnerLock,
) -> Result<Vec<u8>> {
    let path = directory.join("certificate.der");
    if files::exists(&path)? {
        let der = files::read_certificate(&path)?;
        let (remaining, cert) =
            X509Certificate::from_der(&der).map_err(|_| PairingError::TlsRejected)?;
        if !remaining.is_empty() {
            return Err(PairingError::TlsRejected);
        }
        let before = u64::try_from(cert.validity().not_before.timestamp())
            .map_err(|_| PairingError::TlsRejected)?;
        let after = u64::try_from(cert.validity().not_after.timestamp())
            .map_err(|_| PairingError::TlsRejected)?;
        // Validate persisted shape/key/self-signature independently of whether renewal is due.
        if certificate::validate(&der, role, before)? != *identity.spki() {
            return Err(PairingError::ContinuityLost);
        }
        if reuse_certificate(now, before, after)? {
            return Ok(der);
        }
    }
    let after = now
        .checked_add(365 * 86_400)
        .ok_or(PairingError::TlsRejected)?;
    let der = certificate::create(
        role,
        identity.spki(),
        now,
        after,
        identity.certificate_signer(),
    )?;
    files::replace(&path, &der, owner)?;
    Ok(der)
}

fn reuse_certificate(now: u64, before: u64, after: u64) -> Result<bool> {
    if now >= before
        && after
            .checked_sub(now)
            .is_some_and(|left| left >= 30 * 86_400)
    {
        return Ok(true);
    }
    // Only reached after persisted DER/key/profile validation, before signing or writes.
    #[cfg(target_os = "windows")]
    {
        Err(PairingError::NativeUnsupported)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(false)
    }
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    use super::*;

    #[test]
    fn persisted_certificate_reuses_only_when_renewal_is_unnecessary() {
        let now = 100;
        let remaining = 30 * 86_400;
        assert_eq!(reuse_certificate(now, now, now + remaining), Ok(true));
        assert_eq!(reuse_certificate(now, 0, u64::MAX), Ok(true));
        for (before, after) in [
            (0, now + remaining - 1),
            (0, now),
            (0, now - 1),
            (now + 1, u64::MAX),
        ] {
            assert_eq!(
                reuse_certificate(now, before, after),
                Err(PairingError::NativeUnsupported)
            );
        }
    }
}
