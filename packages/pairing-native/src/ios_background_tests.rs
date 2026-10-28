use super::*;
use crate::{file_sender_command::Task, foreground::Foreground};

const RECORD: &str = "AAAAAAAAAAAAAAAAAAAAAA";
const OTHER: &str = "AQAAAAAAAAAAAAAAAAAAAA";

#[test]
fn native_file_lease_is_owner_and_record_scoped_and_never_reactivates_foreground() {
    let first = Leases::default();
    let second = Leases::default();
    let closing = AtomicBool::new(false);
    let foreground = Foreground::default();
    foreground.set_active(false).unwrap();
    let lease = first.begin(RECORD, &closing).unwrap();
    assert_eq!(crate::qr_base64::fixed::<16>(&lease).unwrap().len(), 16);
    assert!(first.guard(RECORD, &lease).is_ok());
    assert!(first.guard(OTHER, &lease).is_err());
    assert!(second.guard(RECORD, &lease).is_err());
    assert!(first.guard(RECORD, OTHER).is_err());
    assert!(first.guard(RECORD, "01").is_err());
    assert!(first.begin(RECORD, &closing).is_err());
    assert!(foreground.capture().is_err());
    assert!(foreground.authorize(None).is_err());
    first.end(&lease).unwrap();
    assert!(foreground.capture().is_err());
}

#[test]
fn expiration_and_close_cancel_queued_and_inflight_file_boundaries_without_adoption() {
    let leases = Leases::default();
    let closing = AtomicBool::new(false);
    let foreground = Foreground::default();
    foreground.set_active(false).unwrap();
    let old = leases.begin(RECORD, &closing).unwrap();
    let active = leases.guard(RECORD, &old).unwrap();
    assert!(foreground
        .check_transfer_cancel(None, Some(&active))
        .is_ok());
    leases.end(&old).unwrap();
    assert_eq!(
        foreground.check_transfer_cancel(None, Some(&active)),
        Err(PairingError::Cancelled)
    );
    let current = leases.begin(RECORD, &closing).unwrap();
    assert!(leases.end(&old).is_err());
    assert!(leases.guard(RECORD, &current).is_ok());
    assert_eq!(
        foreground.check_transfer_cancel(None, Some(&active)),
        Err(PairingError::Cancelled)
    );
    let active = leases.guard(RECORD, &current).unwrap();
    let started = std::sync::Barrier::new(2);
    std::thread::scope(|scope| {
        scope.spawn(|| {
            foreground
                .check_transfer_cancel(None, Some(&active))
                .unwrap();
            started.wait();
            started.wait();
            // The same guard is polled by the existing sender's TLS/HTTP I/O callback.
            assert_eq!(
                foreground.check_transfer_cancel(None, Some(&active)),
                Err(PairingError::Cancelled)
            );
        });
        started.wait();
        closing.store(true, Ordering::Release);
        leases.cancel_all().unwrap();
        started.wait();
    });
    assert!(leases.guard(RECORD, &current).is_err());
    assert!(leases.begin(RECORD, &closing).is_err());
    assert!(foreground.check_transfer_cancel(None, None).is_ok());
    assert!(foreground.check_transfer_cancel(Some(0), None).is_err());
}

#[test]
fn background_parser_refuses_list_restore_and_trust_before_descriptor_duplication() {
    for command in [
        r#"{"kind":"list","after":null}"#,
        r#"{"kind":"restore","id":"AAAAAAAAAAAAAAAAAAAAAA","offset":0}"#,
        r#"{"kind":"scan","wire":"fixture"}"#,
        r#"{"kind":"approve","operation":"AAAAAAAAAAAAAAAAAAAAAA","generation":"1"}"#,
    ] {
        assert!(matches!(
            Task::parse_background(command, i32::MAX),
            Err(PairingError::InvalidRequest)
        ));
    }
    for command in [
        r#"{"kind":"status","id":"AAAAAAAAAAAAAAAAAAAAAA"}"#,
        r#"{"kind":"finalize","id":"AAAAAAAAAAAAAAAAAAAAAA"}"#,
        r#"{"kind":"create","upload":{"requestId":"AAAAAAAAAAAAAAAAAAAAAA","sourceId":"AAAAAAAAAAAAAAAAAAAAAA","sourceRevision":"revision","name":"test.bin","sha256":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","size":0}}"#,
    ] {
        assert!(Task::parse_background(command, -1).is_ok());
    }
    // Foreground/Android parsing keeps its existing list surface.
    assert!(Task::parse(r#"{"kind":"list","after":null}"#, -1).is_ok());
}

#[test]
fn malformed_and_poisoned_lease_state_never_yields_an_active_admission() {
    let leases = Leases::default();
    let closing = AtomicBool::new(false);
    assert!(leases.begin("bad", &closing).is_err());
    let lease = leases.begin(RECORD, &closing).unwrap();
    let active = leases.guard(RECORD, &lease).unwrap();
    let _ = std::panic::catch_unwind(|| {
        let _guard = leases.0.lock().unwrap();
        panic!("synthetic lease poison");
    });
    assert!(leases.cancel_all().is_err());
    assert!(!active.load(Ordering::Acquire));
    assert!(leases.guard(RECORD, &lease).is_err());
}
