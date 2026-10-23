use super::*;
use crate::installation_generation_record::{leaf_name, Bindings, LEN};

fn pair(role: NamespaceRole, revision: u64, predecessor: [u8; 32]) -> [Record; 2] {
    let mut generation = [0; 16];
    generation[..8].copy_from_slice(&revision.to_be_bytes());
    let mut epoch = [0x21; 32];
    epoch[..8].copy_from_slice(&revision.to_be_bytes());
    let mut spki = [0x43; 32];
    spki[..8].copy_from_slice(&revision.to_be_bytes());
    let intent = Record::new(
        Kind::Intent, role, revision,
        Bindings { generation, epoch_commitment: epoch, predecessor_digest: predecessor },
        [0; 32], [0; 32],
    ).unwrap();
    let activation = Record::new(
        Kind::Activation, role, revision,
        Bindings { generation, epoch_commitment: epoch, predecessor_digest: predecessor },
        intent.digest(), spki,
    ).unwrap();
    [intent, activation]
}

fn chain(role: NamespaceRole, count: usize) -> Vec<Record> {
    let mut predecessor = genesis(role);
    let mut records = Vec::new();
    for revision in 1..=count {
        let pair = pair(role, revision as u64, predecessor);
        predecessor = pair[1].digest();
        records.extend(pair);
    }
    records
}

fn encoded(records: &[Record]) -> Vec<(String, [u8; LEN])> {
    records.iter().map(|record| (
        leaf_name(record.kind(), record.revision(), false).unwrap(), record.encode()
    )).collect()
}

fn validate(role: NamespaceRole, values: &[(String, [u8; LEN])]) -> Result<Inventory> {
    let entries: Vec<_> = values.iter().map(|(name, bytes)| Entry { name, bytes }).collect();
    validate_inventory(role, &entries)
}

#[test]
fn complete_chain_uses_bound_revision_not_enumeration_order() {
    let role = NamespaceRole::Production;
    let records = chain(role, 3);
    let mut entries = encoded(&records);
    entries.reverse();
    let Inventory::Selected(head) = validate(role, &entries).unwrap() else { panic!("head required") };
    assert_eq!(head.revision, 3);
    assert_eq!(head.generation, records[5].generation());
    assert_eq!(head.epoch_commitment, records[5].epoch_commitment());
    assert_eq!(head.spki_commitment, records[5].spki_commitment());
    assert_eq!(head.activation_digest, records[5].digest());
    assert!(matches!(validate_inventory(role, &[]), Ok(Inventory::Empty)));
}

#[test]
fn incomplete_or_unknown_inventory_never_falls_back_to_valid_prefix() {
    let role = NamespaceRole::Development;
    let records = chain(role, 2);
    let base = encoded(&records);
    for indices in [vec![0], vec![1], vec![2, 3], vec![0, 1, 2]] {
        let entries: Vec<_> = indices.iter().map(|&index| base[index].clone()).collect();
        assert!(validate(role, &entries).is_err());
    }
    let mut duplicate = base.clone();
    duplicate.push(base[0].clone());
    assert!(validate(role, &duplicate).is_err());
    for name in ["unknown", "owner.lock", "activation-0000000000000003.pending"] {
        let mut entries = base.clone();
        entries.push((name.into(), records[3].encode()));
        assert!(validate(role, &entries).is_err());
    }
    let future = pair(role, 3, records[3].digest());
    let mut incomplete = base;
    incomplete.push(encoded(&future)[0].clone());
    assert!(validate(role, &incomplete).is_err());
}

#[test]
fn role_leaf_predecessor_intent_and_generation_bindings_are_mandatory() {
    let role = NamespaceRole::Production;
    let records = chain(role, 2);
    let base = encoded(&records);
    assert!(validate(NamespaceRole::Development, &base).is_err());
    for index in [20, 36, 68, 100] {
        let mut entries = base.clone();
        entries[3].1[index] ^= 1;
        assert!(validate(role, &entries).is_err());
    }
    let mut wrong_leaf = base.clone();
    wrong_leaf[3].0 = leaf_name(Kind::Activation, 3, false).unwrap();
    assert!(validate(role, &wrong_leaf).is_err());
    // Changing a final SPKI alone is structurally valid: native identity must bind it.
    let mut unproven_key = base;
    unproven_key[3].1[132] ^= 1;
    let Inventory::Selected(head) = validate(role, &unproven_key).unwrap() else { panic!("head") };
    assert_ne!(head.spki_commitment, records[3].spki_commitment());
}

#[test]
fn subsequent_activation_cannot_reuse_generation_epoch_or_key() {
    let role = NamespaceRole::Development;
    let first = pair(role, 1, genesis(role));
    let second = pair(role, 2, first[1].digest());
    for reused in 0..3 {
        let intent = Record::new(
            Kind::Intent, role, 2,
            Bindings {
                generation: if reused == 0 { first[0].generation() } else { second[0].generation() },
                epoch_commitment: if reused == 1 { first[0].epoch_commitment() } else { second[0].epoch_commitment() },
                predecessor_digest: first[1].digest(),
            }, [0; 32], [0; 32],
        ).unwrap();
        let activation = Record::new(
            Kind::Activation, role, 2,
            Bindings { generation: intent.generation(), epoch_commitment: intent.epoch_commitment(), predecessor_digest: first[1].digest() },
            intent.digest(),
            if reused == 2 { first[1].spki_commitment() } else { second[1].spki_commitment() },
        ).unwrap();
        let records = [first[0].clone(), first[1].clone(), intent, activation];
        assert!(validate(role, &encoded(&records)).is_err());
    }
}

#[test]
fn inventory_capacity_and_record_lengths_are_bounded() {
    let role = NamespaceRole::Production;
    let maximum = encoded(&chain(role, MAX_ACTIVATIONS));
    assert!(validate(role, &maximum).is_ok());
    assert!(validate(role, &encoded(&chain(role, MAX_ACTIVATIONS + 1))).is_err());
    // A tiny hostile inventory must not drive allocation from an unbounded revision.
    assert!(validate(role, &encoded(&pair(role, u64::MAX, genesis(role)))).is_err());
    let mut too_many = maximum.clone();
    too_many.push(maximum[0].clone());
    assert!(validate(role, &too_many).is_err());
    let sample = &maximum[0];
    for length in [0, LEN - 1] {
        let entries = [Entry { name: &sample.0, bytes: &sample.1[..length] }];
        assert!(validate_inventory(role, &entries).is_err());
    }
}
