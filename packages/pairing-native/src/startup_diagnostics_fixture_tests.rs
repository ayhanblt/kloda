use super::*;

#[test]
fn fixture_steps_preserve_first_failure_without_paths_or_fabricated_os_codes() {
    use FixtureStep::*;
    for step in [
        Base,
        VolumeRootOpen,
        AncestorOpen,
        BaseOpen,
        Volume,
        BaseSecurity,
        Nonce,
        RootCreate,
        PairingCreate,
        RootOpen,
        PairingOpen,
        RootSecurity,
        PairingSecurity,
        OwnerCreate,
        OwnerSecurity,
        OwnerFlush,
    ] {
        for os_code in [None, Some(5)] {
            let result = run(|| {
                at(Stage::Fixture(step), || {
                    if os_code.is_some() {
                        record(
                            Some(Operation::OpenFile),
                            PairingError::StorageFailure,
                            os_code,
                        );
                    }
                    Err::<(), _>(PairingError::StorageFailure)
                })
                .unwrap_err();
                let text = line(observed());
                assert!(matches!(observed().stage, Stage::Fixture(actual)
                    if std::mem::discriminant(&actual) == std::mem::discriminant(&step)));
                assert!(text.contains(&format!("stage=Fixture({step:?})")));
                assert_eq!(observed().win32, os_code);
                assert!(!text.contains(['/', '\\', ':', '\n', '\r']));
                at(Stage::Fixture(OwnerFlush), || {
                    Err::<(), _>(PairingError::StorageFailure)
                })
                .unwrap_err();
                assert_eq!(line(observed()), text);
                Err::<(), _>(PairingError::StorageFailure)
            });
            assert_eq!(result, Err(PairingError::StorageFailure));
            assert!(STATE.with(|state| state.get().is_none()));
        }
    }
}

fn observed() -> Failure {
    STATE.with(|s| s.get().unwrap().failure.unwrap())
}

#[test]
fn security_rules_preserve_the_actual_failure_and_restore_fixture_context() {
    use SecurityRule::*;
    for rule in [
        Principals,
        DescriptorPresence,
        OwnerSidValidity,
        AclValidity,
        AceType,
        AceHeaderSize,
        AceSidBounds,
        AceSidValidity,
        UserDirectoryOwner,
        UnexpectedDirectoryWriter,
        ProtectedOwnerAndInheritance,
        ProtectedAceCount,
        ProtectedAceMaskAndFlags,
        ProtectedAcePrincipal,
        ProtectedDuplicatePrincipal,
    ] {
        for os_code in [None, Some(5)] {
            let result = run(|| {
                at(Stage::Fixture(FixtureStep::BaseSecurity), || {
                    let result = at(Stage::SecurityRule(rule), || {
                        if let Some(code) = os_code {
                            record(
                                Some(Operation::SecurityInfo),
                                PairingError::StorageFailure,
                                Some(code),
                            );
                        }
                        Err::<(), _>(PairingError::StorageFailure)
                    });
                    assert!(matches!(observed().stage, Stage::SecurityRule(actual)
                        if std::mem::discriminant(&actual) == std::mem::discriminant(&rule)));
                    assert!(STATE.with(|s| matches!(
                        s.get().unwrap().stage,
                        Stage::Fixture(FixtureStep::BaseSecurity)
                    )));
                    let text = line(observed());
                    assert!(text.contains(&format!("stage=SecurityRule({rule:?})")));
                    assert_eq!(observed().win32, os_code);
                    assert!(!text.contains(['/', '\\', ':', '\n', '\r']));
                    record(
                        Some(Operation::SecurityValidation),
                        PairingError::StorageFailure,
                        None,
                    );
                    assert_eq!(line(observed()), text);
                    result
                })
            });
            assert_eq!(result, Err(PairingError::StorageFailure));
            assert!(STATE.with(|s| s.get().is_none()));
        }
    }
}
