use super::*;

fn observed() -> Failure {
    STATE.with(|s| s.get().unwrap().failure.unwrap())
}

#[test]
fn innermost_failure_and_original_result_survive_outer_context() {
    let result = run(|| {
        at(Stage::Storage, || {
            at(Stage::Epoch, || {
                record(
                    Some(Operation::Publish),
                    PairingError::StorageFailure,
                    Some(32),
                );
                Err::<(), _>(PairingError::StorageFailure)
            })
        })
    });
    assert_eq!(result, Err(PairingError::StorageFailure));
    assert!(STATE.with(|state| state.get().is_none()));
    run(|| {
        let result = at(Stage::Epoch, || {
            record(
                Some(Operation::CreateNew),
                PairingError::StorageFailure,
                Some(183),
            );
            Err::<(), _>(PairingError::StorageFailure)
        });
        let text = line(observed());
        assert!(text.contains("stage=Epoch operation=Some(CreateNew)"));
        assert!(text.contains("code=storage_failure win32=Some(183)"));
        record(
            Some(Operation::Flush),
            PairingError::StorageFailure,
            Some(5),
        );
        assert_eq!(line(observed()), text);
        result
    })
    .unwrap_err();
}

#[test]
fn validation_has_no_fabricated_os_error_and_attempts_do_not_leak() {
    run(|| {
        let result = at(Stage::Storage, || {
            record(
                Some(Operation::SecurityValidation),
                PairingError::StorageFailure,
                None,
            );
            Err::<(), _>(PairingError::StorageFailure)
        });
        assert!(line(observed()).contains("win32=None"));
        result
    })
    .unwrap_err();
    run(|| {
        assert!(STATE.with(|state| state.get().unwrap().failure.is_none()));
        at(Stage::Identity, || Ok(42))
    })
    .map(|v| assert_eq!(v, 42))
    .unwrap();
    record(
        Some(Operation::Flush),
        PairingError::StorageFailure,
        Some(5),
    );
    assert!(STATE.with(|state| state.get().is_none()));
}

#[test]
fn every_startup_stage_preserves_its_closed_error() {
    for stage in [
        Stage::Directory,
        Stage::Storage,
        Stage::OwnerLock,
        Stage::Epoch,
        Stage::Continuity,
        Stage::Identity,
        Stage::Certificate,
        Stage::Database,
        Stage::Initialized,
    ] {
        run(|| {
            let result = at(stage, || Err::<(), _>(PairingError::ContinuityLost));
            assert_eq!(observed().code, PairingError::ContinuityLost);
            assert_eq!(format!("{:?}", observed().stage), format!("{stage:?}"));
            assert!(observed().win32.is_none());
            result
        })
        .unwrap_err();
    }
}

#[test]
fn operation_labels_cannot_include_paths_or_native_payloads() {
    for operation in [
        Operation::OpenFile,
        Operation::CreateNew,
        Operation::FileInformation,
        Operation::FileValidation,
        Operation::FinalPath,
        Operation::FinalPathValidation,
        Operation::VolumeInformation,
        Operation::VolumeValidation,
        Operation::Flush,
        Operation::Publish,
        Operation::CreateDirectory,
        Operation::KnownFolder,
        Operation::SecurityInfo,
        Operation::SecurityValidation,
        Operation::Io,
        Operation::OpenProcessToken,
        Operation::TokenInformation,
        Operation::CopySid,
        Operation::WellKnownSid,
        Operation::InitializeAcl,
        Operation::AddAce,
        Operation::InitializeDescriptor,
        Operation::SetOwner,
        Operation::SetDacl,
        Operation::SetControl,
        Operation::GetControl,
        Operation::GetAce,
    ] {
        let value = line(Failure {
            stage: Stage::Epoch,
            operation: Some(operation),
            code: PairingError::StorageFailure,
            win32: Some(32),
        });
        assert!(value.len() < 150);
        assert!(!value.contains(['/', '\\', ':', '\n', '\r']));
    }
}

#[test]
fn nested_scopes_and_unwinding_restore_the_previous_thread_state() {
    let result = std::panic::catch_unwind(|| run::<()>(|| panic!("public fixture panic")));
    assert!(result.is_err());
    assert!(STATE.with(|state| state.get().is_none()));
    run(|| {
        at(Stage::Database, || {
            run(|| {
                at(Stage::Identity, || {
                    Err::<(), _>(PairingError::IdentityUnavailable)
                })
            })
            .unwrap_err();
            assert!(STATE.with(|state| state.get().unwrap().failure.is_none()));
            Err::<(), _>(PairingError::AclUnavailable)
        })
        .unwrap_err();
        assert!(matches!(observed().stage, Stage::Database));
        Ok(())
    })
    .unwrap();
}

#[test]
fn concurrent_owner_threads_keep_their_own_diagnostic() {
    let barrier = std::sync::Arc::new(std::sync::Barrier::new(2));
    let workers: Vec<_> = [32, 5]
        .into_iter()
        .map(|code| {
            let barrier = barrier.clone();
            std::thread::spawn(move || {
                run(|| {
                    at(Stage::Epoch, || {
                        record(
                            Some(Operation::Publish),
                            PairingError::StorageFailure,
                            Some(code),
                        );
                        barrier.wait();
                        assert_eq!(observed().win32, Some(code));
                        Err::<(), _>(PairingError::StorageFailure)
                    })
                })
            })
        })
        .collect();
    for worker in workers {
        assert_eq!(worker.join().unwrap(), Err(PairingError::StorageFailure));
    }
}

#[test]
fn isolated_process_fixture_and_existing_pending_preservation() {
    const ENV: &str = "KLODA_STARTUP_DIAGNOSTIC_PUBLIC_FIXTURE";
    if let Ok(mode) = std::env::var(ENV) {
        let directory = crate::state::test_support::Directory::new();
        let pending = directory.path().join("epoch.pending");
        std::fs::write(&pending, [7u8; 16]).unwrap();
        let result = run(|| {
            at(Stage::Epoch, || {
                match mode.as_str() {
                    "publish32" => record(
                        Some(Operation::Publish),
                        PairingError::StorageFailure,
                        Some(32),
                    ),
                    "pending183" => {
                        let error = std::fs::OpenOptions::new()
                            .write(true)
                            .create_new(true)
                            .open(&pending)
                            .unwrap_err();
                        assert_eq!(error.kind(), std::io::ErrorKind::AlreadyExists);
                        // Inject the Windows classification; this host file error is not a Windows API test.
                        record(
                            Some(Operation::CreateNew),
                            PairingError::StorageFailure,
                            Some(183),
                        );
                    }
                    "validation" => record(
                        Some(Operation::SecurityValidation),
                        PairingError::StorageFailure,
                        None,
                    ),
                    _ => panic!("unknown public fixture mode"),
                }
                println!("{}", line(observed()));
                Err::<(), _>(PairingError::StorageFailure)
            })
        });
        assert_eq!(result, Err(PairingError::StorageFailure));
        assert_eq!(std::fs::read(pending).unwrap(), [7u8; 16]);
        return;
    }
    let exe = std::env::current_exe().unwrap();
    for (mode, expected) in [
        (
            "publish32",
            "operation=Some(Publish) code=storage_failure win32=Some(32)",
        ),
        (
            "pending183",
            "operation=Some(CreateNew) code=storage_failure win32=Some(183)",
        ),
        (
            "validation",
            "operation=Some(SecurityValidation) code=storage_failure win32=None",
        ),
    ] {
        let output = std::process::Command::new(&exe).args(["--exact",
            "startup_diagnostics::tests::isolated_process_fixture_and_existing_pending_preservation", "--nocapture"])
            .env(ENV, mode).output().unwrap();
        assert!(output.status.success(), "fixture process failed");
        let text = String::from_utf8(output.stdout).unwrap();
        let lines: Vec<_> = text
            .lines()
            .filter(|line| line.starts_with("KLODA_STARTUP "))
            .collect();
        assert_eq!(lines.len(), 1);
        assert!(lines[0].contains(expected));
        assert!(lines[0].contains("stage=Epoch"));
    }
}
