use super::*;

fn observed() -> Failure {
    STATE.with(|state| state.get().unwrap().failure.unwrap())
}

#[test]
fn native_publication_status_keeps_first_error_and_never_fakes_win32() {
    for io in [None, Some(0x103), Some(-1)] {
        run(|| {
            native_publish(-1, io);
            let text = line(observed());
            assert!(text.contains("code=outcome_unknown win32=None ntstatus=-1"));
            assert!(text.contains(&format!("io_status={io:?}")));
            record(
                Some(Operation::Flush),
                PairingError::StorageFailure,
                Some(5),
            );
            assert_eq!(line(observed()), text);
            Ok(())
        })
        .unwrap();
    }
    run(|| {
        record(
            Some(Operation::Flush),
            PairingError::StorageFailure,
            Some(5),
        );
        native_publish(-1, None);
        assert_eq!(observed().win32, Some(5));
        assert!(observed().native.is_none());
        Ok(())
    })
    .unwrap();
}
