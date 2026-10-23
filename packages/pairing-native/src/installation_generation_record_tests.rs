use super::*;

fn sample(kind: Kind, role: NamespaceRole, revision: u64) -> Record {
    let claims = if kind == Kind::Intent {
        [0; 32]
    } else {
        [5; 32]
    };
    Record::new(
        kind,
        role,
        revision,
        Bindings {
            generation: [3; 16],
            epoch_commitment: [4; 32],
            predecessor_digest: genesis(role),
        },
        claims,
        claims,
    )
    .unwrap()
}

#[test]
fn canonical_roundtrip_preserves_all_fields_and_domains() {
    for role in [NamespaceRole::Development, NamespaceRole::Production] {
        for kind in [Kind::Intent, Kind::Activation] {
            for revision in [1, u64::MAX] {
                let record = sample(kind, role, revision);
                let bytes = record.encode();
                assert!(Record::decode(&bytes).unwrap() == record);
                assert!(bytes[12..20] == revision.to_be_bytes());
                assert!(record.digest() != genesis(role));
                for index in 20..100 {
                    let mut altered = bytes;
                    altered[index] ^= 1;
                    let decoded = Record::decode(&altered).unwrap();
                    assert!(decoded.digest() != record.digest());
                }
            }
        }
    }
    assert!(genesis(NamespaceRole::Development) != genesis(NamespaceRole::Production));
}

#[test]
fn malformed_schema_truncation_extension_and_zero_identity_are_rejected() {
    let bytes = sample(Kind::Activation, NamespaceRole::Production, 1).encode();
    for length in 0..LEN {
        assert!(Record::decode(&bytes[..length]).is_err());
    }
    let mut extended = bytes.to_vec();
    extended.push(0);
    assert!(Record::decode(&extended).is_err());
    for index in 0..10 {
        let mut altered = bytes;
        altered[index] ^= 1;
        assert!(Record::decode(&altered).is_err());
    }
    for index in [10, 11] {
        for value in [0, 3, 255] {
            let mut altered = bytes;
            altered[index] = value;
            assert!(Record::decode(&altered).is_err());
        }
    }
    for range in [12..20, 20..36, 36..68] {
        let mut altered = bytes;
        altered[range].fill(0);
        assert!(Record::decode(&altered).is_err());
    }
}

#[test]
fn intent_cannot_claim_activation_and_activation_requires_both_claims() {
    let intent = sample(Kind::Intent, NamespaceRole::Development, 1).encode();
    let mut wrong_kind = intent;
    wrong_kind[10] = Kind::Activation as u8;
    assert!(Record::decode(&wrong_kind).is_err());
    for index in 100..164 {
        let mut altered = intent;
        altered[index] = 1;
        assert!(Record::decode(&altered).is_err());
    }
    let activation = sample(Kind::Activation, NamespaceRole::Development, 1).encode();
    let mut wrong_kind = activation;
    wrong_kind[10] = Kind::Intent as u8;
    assert!(Record::decode(&wrong_kind).is_err());
    for range in [100..132, 132..164] {
        let mut altered = activation;
        altered[range].fill(0);
        assert!(Record::decode(&altered).is_err());
    }
}

#[test]
fn names_are_exact_lowercase_bounded_leaf_components() {
    for kind in [Kind::Intent, Kind::Activation] {
        for revision in [1, 15, u64::MAX] {
            for pending in [false, true] {
                let name = leaf_name(kind, revision, pending).unwrap();
                assert!(parse_leaf_name(&name).unwrap() == (kind, revision, pending));
            }
        }
    }
    for hostile in ["intent-0000000000000000", "intent-000000000000000A",
        "Intent-0000000000000001", "intent-1", "intent-00000000000000001",
        "intent-0000000000000001.", "intent-0000000000000001 ",
        "intent-0000000000000001:stream", "intent-0000000000000001\0",
        "../intent-0000000000000001", "x\\intent-0000000000000001",
        "intent-0000000000000001.pending.pending", "intent-0000000000000001.PENDING",
        "activation-0000000000000001/", "intent-000000000000000é"] {
        assert!(parse_leaf_name(hostile).is_err());
    }
    assert!(leaf_name(Kind::Intent, 0, false).is_err());
}
