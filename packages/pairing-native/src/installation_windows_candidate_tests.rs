use super::*;

#[test]
#[ignore = "D1 Windows fixture needs explicit runtime authorization"]
fn absent_targets_use_one_object_and_never_claim_durability() {
    for name in ["epoch", "initialized", "listener-port", "certificate.der"] {
        let fixture = Fixture::new().unwrap();
        let target = Target::from_name(name).unwrap();
        let unrelated = fixture.directory().join("unrelated.txt");
        std::fs::write(&unrelated, b"keep").unwrap();
        assert_eq!(
            publish(&fixture, target, b"disposable", Cut::None).unwrap(),
            Observation::NamespaceObservedDurabilityUnproven
        );
        assert_eq!(
            std::fs::read(fixture.directory().join(name)).unwrap(),
            b"disposable"
        );
        assert!(!fixture.directory().join(target.pending_name()).exists());
        assert_eq!(std::fs::read(unrelated).unwrap(), b"keep");
    }
}

#[test]
#[ignore = "D1 Windows fixture needs explicit runtime authorization"]
fn rename_atomically_refuses_existing_target_and_preserves_pending() {
    let fixture = Fixture::new().unwrap();
    let target = Target::Epoch;
    std::fs::write(fixture.directory().join(target.name()), b"existing").unwrap();
    let error = publish(&fixture, target, b"new", Cut::None).unwrap_err();
    let Failure::Native { status, io_status } = error else {
        panic!("native refusal expected");
    };
    assert_ne!(status, 0);
    assert!(io_status.is_some());
    assert_eq!(
        std::fs::read(fixture.directory().join(target.name())).unwrap(),
        b"existing"
    );
    assert_eq!(
        std::fs::read(fixture.directory().join(target.pending_name())).unwrap(),
        b"new"
    );
}

#[test]
#[ignore = "D1 Windows fixture needs explicit runtime authorization"]
fn existing_pending_is_not_adopted_deleted_or_overwritten() {
    let fixture = Fixture::new().unwrap();
    let target = Target::Epoch;
    std::fs::write(fixture.directory().join(target.pending_name()), b"preserve").unwrap();
    assert!(matches!(
        publish(&fixture, target, b"replacement", Cut::None),
        Err(Failure::Storage(PairingError::StorageFailure))
    ));
    assert_eq!(
        std::fs::read(fixture.directory().join(target.pending_name())).unwrap(),
        b"preserve"
    );
    assert!(!fixture.directory().join(target.name()).exists());
}

#[test]
#[ignore = "D1 Windows fixture needs explicit runtime authorization"]
fn injected_cut_points_and_lost_reply_never_ack_or_regenerate() {
    for cut in [
        Cut::Created,
        Cut::Written,
        Cut::PreFlushed,
        Cut::Renamed,
        Cut::PostFlushed,
        Cut::Verified,
    ] {
        let fixture = Fixture::new().unwrap();
        let target = Target::Epoch;
        let result = publish(&fixture, target, &[7u8; 16], cut);
        assert!(matches!(result, Err(Failure::Interrupted(at)) if at == cut));
        let pending = fixture.directory().join(target.pending_name());
        let final_name = fixture.directory().join(target.name());
        let renamed = matches!(cut, Cut::Renamed | Cut::PostFlushed | Cut::Verified);
        assert_eq!(final_name.exists(), renamed);
        assert_eq!(pending.exists(), !renamed);
        let bytes = if cut == Cut::Created {
            vec![]
        } else {
            vec![7u8; 16]
        };
        assert_eq!(
            std::fs::read(if renamed { &final_name } else { &pending }).unwrap(),
            bytes
        );
        assert!(publish(&fixture, target, &[8u8; 16], Cut::None).is_err());
        if renamed {
            assert_eq!(std::fs::read(final_name).unwrap(), [7u8; 16]);
        } else {
            assert_eq!(std::fs::read(pending).unwrap(), bytes);
        }
    }
}

#[test]
#[ignore = "D1 Windows fixture needs explicit runtime authorization"]
fn target_appearing_after_preflush_is_not_replaced() {
    let fixture = Fixture::new().unwrap();
    let target = Target::Certificate;
    let destination = fixture.directory().join(target.name());
    let result = publish_before_rename(&fixture, target, b"new", Cut::None, || {
        std::fs::write(&destination, b"racing-target").map_err(super::super::super::storage)
    });
    assert!(matches!(result, Err(Failure::Native { .. })));
    assert_eq!(std::fs::read(destination).unwrap(), b"racing-target");
    assert_eq!(
        std::fs::read(fixture.directory().join(target.pending_name())).unwrap(),
        b"new"
    );
}

#[test]
fn publication_failures_preserve_uncertainty_and_original_diagnostics() {
    for cut in [Cut::Created, Cut::Written, Cut::PreFlushed] {
        assert_eq!(
            Failure::Interrupted(cut).outcome(),
            PairingError::StorageFailure
        );
    }
    for cut in [Cut::Renamed, Cut::PostFlushed, Cut::Verified] {
        assert_eq!(
            Failure::Interrupted(cut).outcome(),
            PairingError::OutcomeUnknown
        );
    }
    for status in [0, 0x103, -1, i32::MIN] {
        let failure = Failure::Native {
            status,
            io_status: Some(status),
        };
        assert_eq!(failure.outcome(), PairingError::OutcomeUnknown);
        let text = failure.to_string();
        assert!(text.contains(&format!("ntstatus={status}")));
        assert!(text.contains(&format!("io=Some({status})")));
    }
    let error = PairingError::ContinuityLost;
    assert_eq!(Failure::Storage(error).outcome(), error);
    let failure = Failure::UncertainAfterRename(error);
    assert_eq!(failure.outcome(), PairingError::OutcomeUnknown);
    assert!(failure.to_string().contains(error.code()));
    assert!(failure.to_string().starts_with("outcome_unknown "));
}
