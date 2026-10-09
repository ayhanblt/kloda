use crate::{
    certificate::{self, Role},
    error::{PairingError, Result},
    handle::{NativeContext, OwnerRole},
    identity, installation_files as files, route,
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
    if !context.directory.is_absolute() {
        return Err(PairingError::StorageFailure);
    }
    let lock = files::prepare(&context.directory)?;
    let (epoch, create) = files::epoch(&context.directory)?;
    let initialized = context.directory.join("initialized");
    if files::exists(&initialized)?
        && (files::read_exact::<1>(&initialized)? != [1]
            || !files::exists(&context.directory.join("pairing.sqlite3"))?)
    {
        return Err(PairingError::ContinuityLost);
    }
    #[cfg(target_os = "android")]
    let identity = identity::open(&context.directory, epoch, create, context.platform.clone())?;
    #[cfg(not(target_os = "android"))]
    let identity = identity::open(&context.directory, epoch, create)?;
    let role = match context.role {
        #[cfg(not(target_os = "android"))]
        OwnerRole::Pc => Role::Pc,
        OwnerRole::Phone => Role::Phone,
    };
    let der = certificate_for(&context.directory, &identity, role, route::unix_seconds()?)?;
    let certified_key = Arc::new(CertifiedKey::new(
        vec![CertificateDer::from(der)],
        identity.signing_key(),
    ));
    let store = Store::open(&context.directory, identity.spki().clone(), epoch)?;
    if !files::exists(&initialized)? {
        files::write_new(&initialized, &[1])?
    }
    Ok(Installation {
        store,
        identity,
        certified_key,
        directory: context.directory.clone(),
        epoch,
        _owner_lock: lock,
    })
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
            None => files::write_new(&self.directory.join("listener-port"), &port.to_be_bytes()),
        }
    }
}
fn certificate_for(
    directory: &std::path::Path,
    identity: &identity::Identity,
    role: Role,
    now: u64,
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
        if now >= before
            && after
                .checked_sub(now)
                .is_some_and(|left| left >= 30 * 86_400)
        {
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
    files::replace(&path, &der)?;
    Ok(der)
}
