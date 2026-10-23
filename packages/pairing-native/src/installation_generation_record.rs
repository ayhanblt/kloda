//! Canonical generation records. Admission and filesystem validation are separate gates.
use crate::error::{PairingError, Result};
use ring::digest::{Context, SHA256};

pub(crate) const LEN: usize = 164;
const MAGIC: &[u8; 8] = b"KLDAGEN1";
const RECORD_DOMAIN: &[u8] = b"Kloda.Windows.Generation.Record.v1\0";
const GENESIS_DOMAIN: &[u8] = b"Kloda.Windows.Generation.Genesis.v1\0";

#[derive(Clone, Copy, Eq, PartialEq)]
pub(crate) enum NamespaceRole {
    Development = 1,
    Production = 2,
}
#[derive(Clone, Copy, Eq, PartialEq)]
pub(crate) enum Kind {
    Intent = 1,
    Activation = 2,
}

pub(crate) struct Bindings {
    pub(crate) generation: [u8; 16],
    pub(crate) epoch_commitment: [u8; 32],
    pub(crate) predecessor_digest: [u8; 32],
}

#[derive(Clone, Eq, PartialEq)]
pub(crate) struct Record {
    kind: Kind,
    role: NamespaceRole,
    revision: u64,
    generation: [u8; 16],
    epoch_commitment: [u8; 32],
    predecessor_digest: [u8; 32],
    intent_digest: [u8; 32],
    spki_commitment: [u8; 32],
}

impl Record {
    pub(crate) fn new(
        kind: Kind,
        role: NamespaceRole,
        revision: u64,
        bindings: Bindings,
        intent_digest: [u8; 32],
        spki_commitment: [u8; 32],
    ) -> Result<Self> {
        let claims_valid = match kind {
            Kind::Intent => intent_digest == [0; 32] && spki_commitment == [0; 32],
            Kind::Activation => intent_digest != [0; 32] && spki_commitment != [0; 32],
        };
        if revision == 0
            || bindings.generation == [0; 16]
            || bindings.epoch_commitment == [0; 32]
            || !claims_valid
        {
            return Err(PairingError::ContinuityLost);
        }
        Ok(Self {
            kind,
            role,
            revision,
            generation: bindings.generation,
            epoch_commitment: bindings.epoch_commitment,
            predecessor_digest: bindings.predecessor_digest,
            intent_digest,
            spki_commitment,
        })
    }

    pub(crate) fn encode(&self) -> [u8; LEN] {
        let mut bytes = [0; LEN];
        bytes[..8].copy_from_slice(MAGIC);
        bytes[8..10].copy_from_slice(&1u16.to_be_bytes());
        bytes[10] = self.kind as u8;
        bytes[11] = self.role as u8;
        bytes[12..20].copy_from_slice(&self.revision.to_be_bytes());
        bytes[20..36].copy_from_slice(&self.generation);
        bytes[36..68].copy_from_slice(&self.epoch_commitment);
        bytes[68..100].copy_from_slice(&self.predecessor_digest);
        bytes[100..132].copy_from_slice(&self.intent_digest);
        bytes[132..164].copy_from_slice(&self.spki_commitment);
        bytes
    }

    pub(crate) fn decode(bytes: &[u8]) -> Result<Self> {
        if bytes.len() != LEN || &bytes[..8] != MAGIC || bytes[8..10] != [0, 1] {
            return Err(PairingError::ContinuityLost);
        }
        let kind = match bytes[10] {
            1 => Kind::Intent,
            2 => Kind::Activation,
            _ => return Err(PairingError::ContinuityLost),
        };
        let role = match bytes[11] {
            1 => NamespaceRole::Development,
            2 => NamespaceRole::Production,
            _ => return Err(PairingError::ContinuityLost),
        };
        // Exact length above proves every fixed-width conversion below.
        Self::new(
            kind,
            role,
            u64::from_be_bytes(bytes[12..20].try_into().unwrap()),
            Bindings {
                generation: bytes[20..36].try_into().unwrap(),
                epoch_commitment: bytes[36..68].try_into().unwrap(),
                predecessor_digest: bytes[68..100].try_into().unwrap(),
            },
            bytes[100..132].try_into().unwrap(),
            bytes[132..164].try_into().unwrap(),
        )
    }

    pub(crate) fn digest(&self) -> [u8; 32] {
        hash(RECORD_DOMAIN, &self.encode())
    }
    pub(crate) fn kind(&self) -> Kind {
        self.kind
    }
    pub(crate) fn role(&self) -> NamespaceRole {
        self.role
    }
    pub(crate) fn revision(&self) -> u64 {
        self.revision
    }
    pub(crate) fn generation(&self) -> [u8; 16] {
        self.generation
    }
    pub(crate) fn epoch_commitment(&self) -> [u8; 32] {
        self.epoch_commitment
    }
    pub(crate) fn predecessor_digest(&self) -> [u8; 32] {
        self.predecessor_digest
    }
    pub(crate) fn intent_digest(&self) -> [u8; 32] {
        self.intent_digest
    }
    pub(crate) fn spki_commitment(&self) -> [u8; 32] {
        self.spki_commitment
    }
}

fn hash(domain: &[u8], bytes: &[u8]) -> [u8; 32] {
    let mut context = Context::new(&SHA256);
    context.update(domain);
    context.update(bytes);
    context.finish().as_ref().try_into().unwrap()
}

pub(crate) fn genesis(role: NamespaceRole) -> [u8; 32] {
    hash(GENESIS_DOMAIN, &[role as u8])
}

pub(crate) fn leaf_name(kind: Kind, revision: u64, pending: bool) -> Result<String> {
    if revision == 0 {
        return Err(PairingError::ContinuityLost);
    }
    let prefix = match kind {
        Kind::Intent => "intent-",
        Kind::Activation => "activation-",
    };
    let suffix = if pending { ".pending" } else { "" };
    Ok(format!("{prefix}{revision:016x}{suffix}"))
}

pub(crate) fn parse_leaf_name(name: &str) -> Result<(Kind, u64, bool)> {
    let (base, pending) = match name.strip_suffix(".pending") {
        Some(base) => (base, true),
        None => (name, false),
    };
    let (kind, revision) = if let Some(value) = base.strip_prefix("intent-") {
        (Kind::Intent, value)
    } else if let Some(value) = base.strip_prefix("activation-") {
        (Kind::Activation, value)
    } else {
        return Err(PairingError::ContinuityLost);
    };
    if revision.len() != 16
        || !revision.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
    {
        return Err(PairingError::ContinuityLost);
    }
    let revision = u64::from_str_radix(revision, 16)
        .map_err(|_| PairingError::ContinuityLost)?;
    if revision == 0 {
        return Err(PairingError::ContinuityLost);
    }
    Ok((kind, revision, pending))
}

#[cfg(test)]
#[path = "installation_generation_record_tests.rs"]
mod tests;
