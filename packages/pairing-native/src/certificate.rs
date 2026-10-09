use crate::{
    error::{PairingError, Result},
    key::Spki,
};
use x509_parser::{
    extensions::ParsedExtension, oid_registry::OID_SIG_ECDSA_WITH_SHA256, prelude::*,
};
#[path = "certificate_create.rs"]
mod creation;
#[path = "certificate_der.rs"]
mod der;
pub(crate) use creation::{create, CertificateSigner};

#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) enum Role {
    Pc,
    Phone,
}

pub(crate) fn validate(bytes: &[u8], role: Role, unix_seconds: u64) -> Result<Spki> {
    let rejected = || PairingError::TlsRejected;
    if bytes.is_empty() || bytes.len() > 4096 {
        return Err(rejected());
    }
    der::certificate_shape(bytes)?;
    let (remaining, cert) = X509Certificate::from_der(bytes).map_err(|_| rejected())?;
    if !remaining.is_empty()
        || cert.version() != X509Version::V3
        || cert.issuer().as_raw() != cert.subject().as_raw()
        || cert.signature_algorithm.algorithm != OID_SIG_ECDSA_WITH_SHA256
        || cert.signature_algorithm.parameters.is_some()
        || cert.tbs_certificate.signature != cert.signature_algorithm
        || cert.signature_value.unused_bits != 0
    {
        return Err(rejected());
    }
    let now = i64::try_from(unix_seconds).map_err(|_| rejected())?;
    let validity = cert.validity();
    let before = validity.not_before.timestamp();
    let after = validity.not_after.timestamp();
    if before > after || now < before || now > after {
        return Err(rejected());
    }
    let serial = cert.raw_serial();
    if serial.is_empty()
        || serial[0] & 0x80 != 0
        || serial.iter().all(|b| *b == 0)
        || serial.len() > 20
    {
        return Err(rejected());
    }
    let mut basic = false;
    let mut usage = false;
    let mut eku = false;
    let extensions = cert.extensions();
    for (index, ext) in extensions.iter().enumerate() {
        if extensions[..index].iter().any(|other| other.oid == ext.oid) {
            return Err(rejected());
        }
        if matches!(
            ext.parsed_extension(),
            ParsedExtension::ParseError { .. } | ParsedExtension::Unparsed
        ) {
            return Err(rejected());
        }
        match ext.parsed_extension() {
            ParsedExtension::BasicConstraints(value) => {
                // CA:false is DEFAULT FALSE, so canonical DER omits that boolean.
                if !ext.critical
                    || value.ca
                    || value.path_len_constraint.is_some()
                    || ext.value != [0x30, 0]
                {
                    return Err(rejected());
                }
                basic = true;
            }
            ParsedExtension::KeyUsage(value) => {
                if !ext.critical || value.flags != 1 || ext.value != [3, 2, 7, 0x80] {
                    return Err(rejected());
                }
                usage = true;
            }
            ParsedExtension::ExtendedKeyUsage(value) => {
                der::single(ext.value)?;
                if !(match role {
                    Role::Pc => value.server_auth,
                    Role::Phone => value.client_auth,
                }) {
                    return Err(rejected());
                }
                eku = true;
            }
            ParsedExtension::UnsupportedExtension { .. } if !ext.critical => (),
            _ if ext.critical => return Err(rejected()),
            _ => {
                der::single(ext.value)?;
            }
        }
    }
    if !basic || !usage || !eku {
        return Err(rejected());
    }
    // The successful ring self-signature proves on-curve possession; no redundant ECDH.
    Spki::from_signed_certificate(
        cert.public_key().raw,
        cert.tbs_certificate.as_ref(),
        cert.signature_value.data.as_ref(),
    )
}

#[cfg(test)]
#[path = "certificate_tests.rs"]
mod tests;
