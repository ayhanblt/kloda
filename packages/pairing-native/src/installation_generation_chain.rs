//! Prospective D3 inventory rules; a valid graph is NOT native readiness or authority.
use crate::error::{PairingError, Result};
use crate::installation_generation_record::{genesis, parse_leaf_name, Kind, NamespaceRole, Record};

// Bounded initial format capacity. Exhaustion refuses; there is no rotation/cleanup.
pub(crate) const MAX_ACTIVATIONS: usize = 256;

pub(crate) struct Entry<'a> {
    pub(crate) name: &'a str,
    pub(crate) bytes: &'a [u8],
}

pub(crate) struct ChainHead {
    pub(crate) revision: u64,
    pub(crate) generation: [u8; 16],
    pub(crate) epoch_commitment: [u8; 32],
    pub(crate) spki_commitment: [u8; 32],
    pub(crate) activation_digest: [u8; 32],
}

pub(crate) enum Inventory {
    // Empty never means permission to initialize/adopt a legacy namespace.
    Empty,
    Selected(ChainHead),
}

#[derive(Default)]
struct Slot {
    intent: Option<Record>,
    activation: Option<Record>,
}

pub(crate) fn validate_inventory(role: NamespaceRole, entries: &[Entry<'_>]) -> Result<Inventory> {
    let failure = PairingError::ContinuityLost;
    if entries.is_empty() {
        return Ok(Inventory::Empty);
    }
    if entries.len() > MAX_ACTIVATIONS * 2 {
        return Err(failure);
    }
    let mut slots = Vec::new();
    for entry in entries {
        let (kind, revision, pending) = parse_leaf_name(entry.name)?;
        if pending || revision > MAX_ACTIVATIONS as u64 {
            return Err(failure);
        }
        let record = Record::decode(entry.bytes)?;
        if record.role() != role || record.kind() != kind || record.revision() != revision {
            return Err(failure);
        }
        let index = usize::try_from(revision.checked_sub(1).ok_or(failure)?).map_err(|_| failure)?;
        slots.resize_with(slots.len().max(index + 1), Slot::default);
        let slot = match kind {
            Kind::Intent => &mut slots[index].intent,
            Kind::Activation => &mut slots[index].activation,
        };
        if slot.is_some() {
            return Err(failure);
        }
        *slot = Some(record);
    }
    let mut predecessor = genesis(role);
    let mut seen: Vec<ChainHead> = Vec::with_capacity(slots.len());
    for slot in slots {
        let intent = slot.intent.ok_or(failure)?;
        let activation = slot.activation.ok_or(failure)?;
        if intent.predecessor_digest() != predecessor
            || activation.predecessor_digest() != predecessor
            || activation.intent_digest() != intent.digest()
            || activation.generation() != intent.generation()
            || activation.epoch_commitment() != intent.epoch_commitment()
            || seen.iter().any(|prior| {
                prior.generation == activation.generation()
                    || prior.epoch_commitment == activation.epoch_commitment()
                    || prior.spki_commitment == activation.spki_commitment()
            })
        {
            return Err(failure);
        }
        predecessor = activation.digest();
        seen.push(ChainHead {
            revision: activation.revision(),
            generation: activation.generation(),
            epoch_commitment: activation.epoch_commitment(),
            spki_commitment: activation.spki_commitment(),
            activation_digest: predecessor,
        });
    }
    Ok(Inventory::Selected(seen.pop().ok_or(failure)?))
}

#[cfg(test)]
#[path = "installation_generation_chain_tests.rs"]
mod tests;
