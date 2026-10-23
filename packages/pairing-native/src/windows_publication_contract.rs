//! Test-only candidate rules. Host checks do not exercise a Windows ABI or filesystem.
use crate::error::{PairingError, Result};

pub(crate) fn native_user_context(
    app_container: u32,
    restrictions: u32,
    elevated: u32,
    elevation_type: u32,
) -> bool {
    // TOKEN_ELEVATION_TYPE Default=1: no linked full/limited administrator token.
    [app_container, restrictions, elevated, elevation_type] == [0, 0, 0, 1]
}

#[test]
fn native_user_context_rejects_container_restricted_admin_and_unknown_values() {
    assert!(native_user_context(0, 0, 0, 1));
    for flags in [
        [1, 0, 0, 1],
        [0, 1, 0, 1],
        [0, 0, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 2],
        [0, 0, 0, 3],
        [2, 0, 0, 1],
        [0, 2, 0, 1],
        [0, 0, 2, 1],
    ] {
        assert!(!native_user_context(flags[0], flags[1], flags[2], flags[3]));
    }
}

pub(crate) use crate::windows_publication_name::{buffer_size, Target};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum Observation {
    Unconfirmed,
    NamespaceObservedDurabilityUnproven,
}

impl Observation {
    pub(crate) fn require_durable_authority(self) -> Result<()> {
        // Neither observation proves that content AND the final name are persistent.
        // Keep the existing closed error vocabulary; no success witness exists yet.
        Err(PairingError::OutcomeUnknown)
    }
}

pub(crate) fn completion(status: i32, io_status: i32, post_verified: bool) -> Observation {
    if status == 0 && io_status == 0 && post_verified {
        Observation::NamespaceObservedDurabilityUnproven
    } else {
        Observation::Unconfirmed
    }
}

#[test]
fn only_compiled_final_leaves_are_accepted_with_the_real_staged_names() {
    for target in [
        Target::Epoch,
        Target::Initialized,
        Target::ListenerPort,
        Target::Certificate,
    ] {
        assert_eq!(Target::from_name(target.name()), Ok(target));
        assert_eq!(
            std::path::Path::new(target.name()).with_extension("pending"),
            std::path::Path::new(target.pending_name())
        );
        assert_eq!(
            Target::from_name(target.pending_name()),
            Err(PairingError::StorageFailure)
        );
    }
    for name in [
        "",
        "..",
        ".",
        "Epoch",
        "/epoch",
        "../epoch",
        "sub/epoch",
        "sub\\epoch",
        "C:epoch",
        "C:\\epoch",
        "\\\\server\\epoch",
        "epoch:stream",
        "epoch\0",
        "epoch.",
        "epoch ",
        "ｅpoch",
        "époch",
        "pairing.sqlite3",
        "owner.lock",
        "certificate.der.pending",
    ] {
        assert_eq!(
            Target::from_name(name),
            Err(PairingError::StorageFailure),
            "{name:?}"
        );
    }
}

#[test]
fn buffer_capacity_is_checked_for_each_target_and_host_layout_model() {
    // Models only: the Windows candidate uses size_of/align_of/offset_of on SDK types.
    for (header, offset, alignment) in [(24, 20, 8), (16, 12, 4)] {
        for target in [
            Target::Epoch,
            Target::Initialized,
            Target::ListenerPort,
            Target::Certificate,
        ] {
            let units = target.name().encode_utf16().count();
            let capacity = buffer_size(header, offset, alignment, units).unwrap();
            assert!(capacity >= header + units * 2);
            assert!(capacity >= offset + units * 2);
            assert_eq!(capacity % alignment, 0);
            assert!(u32::try_from(capacity).is_ok());
        }
    }
}

#[test]
fn invalid_layouts_and_length_overflow_are_rejected_before_allocation() {
    for args in [
        (0, 0, 8, 5),
        (24, 20, 8, 0),
        (24, 26, 8, 5),
        (24, 19, 8, 5),
        (24, 20, 0, 5),
        (24, 20, 1, 5),
        (24, 20, 3, 5),
        (23, 20, 8, 5),
        (24, 20, 8, usize::MAX),
        (24, 20, 8, usize::MAX / 2),
        (24, 20, 8, u32::MAX as usize),
        (24, 20, 8, (u32::MAX as usize - 24) / 2),
    ] {
        assert_eq!(
            buffer_size(args.0, args.1, args.2, args.3),
            Err(PairingError::StorageFailure)
        );
    }
}

#[test]
fn pending_warning_error_and_unverified_postconditions_are_never_success() {
    // STATUS_PENDING is positive and must not be mistaken for completed NT_SUCCESS.
    for status in [0, 0x103, 1, i32::MIN, -1] {
        for io_status in [0, 0x103, 1, i32::MIN, -1] {
            for verified in [false, true] {
                let observed = completion(status, io_status, verified);
                assert_eq!(
                    observed.require_durable_authority(),
                    Err(PairingError::OutcomeUnknown)
                );
                assert_eq!(
                    observed == Observation::NamespaceObservedDurabilityUnproven,
                    status == 0 && io_status == 0 && verified
                );
            }
        }
    }
    assert_eq!(
        completion(0, 0, true),
        Observation::NamespaceObservedDurabilityUnproven
    );
}
