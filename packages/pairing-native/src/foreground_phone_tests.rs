use super::*;
use crate::{
    frame::Frame,
    phone::Phone,
    qr::QrPayload,
    state::test_support::{hint, key, Directory},
    store_rows::RecordState,
    tls::Channel,
};

fn payload() -> QrPayload {
    QrPayload {
        sid: [7; 16],
        pc_fingerprint: key("pc").fingerprint(),
        secret: zeroize::Zeroizing::new([3; 32]),
        hint: hint(),
    }
}

#[test]
fn mobile_foreground_defaults_inactive_without_changing_desktop_default() {
    let foreground = Foreground::default();
    let mobile = cfg!(any(target_os = "android", target_os = "ios"));
    assert_eq!(foreground.capture().is_err(), mobile);
    assert_eq!(foreground.authorize(None).is_err(), mobile);
}

#[test]
fn inactive_phone_ui_cannot_capture_or_authorize_and_reactivation_keeps_old_work_stale() {
    let foreground = Foreground::default();
    foreground.set_active(true).unwrap();
    let epoch = foreground.capture().unwrap();
    foreground.set_active(false).unwrap();
    assert!(foreground.capture().is_err());
    assert!(foreground.authorize(Some(epoch)).is_err());
    assert!(foreground.authorize(None).is_err());
    foreground.set_active(true).unwrap();
    assert!(foreground.authorize(Some(epoch)).is_err());
    let current = foreground.capture().unwrap();
    assert!(foreground.authorize(Some(current)).is_ok());
    foreground.set_active(true).unwrap();
    assert_eq!(foreground.capture().unwrap(), current);
}

#[test]
fn suspend_before_each_phone_trust_write_preserves_last_durable_state() {
    for cut in 0..3 {
        let directory = Directory::new();
        let mut store = directory.store(key("phone"));
        let foreground = Foreground::default();
        foreground.set_active(true).unwrap();
        let epoch = foreground.capture().unwrap();
        let channel = Channel::for_state_test(1, key("pc"), [1; 32]);
        if cut == 0 {
            foreground.set_active(false).unwrap();
        }
        let started = foreground
            .authorize(Some(epoch))
            .and_then(|_authorization| Phone::start(&mut store, payload(), &channel));
        if cut == 0 {
            assert!(matches!(started, Err(PairingError::CandidateStale)));
            assert!(store.record(&[7; 16]).unwrap().is_none());
            continue;
        }
        let (mut phone, _) = started.unwrap();
        phone.request_sent(&channel).unwrap();
        if cut == 1 {
            foreground.set_active(false).unwrap();
        }
        let pinned = foreground
            .authorize(Some(epoch))
            .and_then(|_authorization| {
                phone.commit(&mut store, &channel, &Frame::Commit { sid: [7; 16] })
            });
        if cut == 1 {
            assert!(matches!(pinned, Err(PairingError::CandidateStale)));
        } else {
            pinned.unwrap();
            phone.ack_sent(&channel).unwrap();
            foreground.set_active(false).unwrap();
            let completed = foreground
                .authorize(Some(epoch))
                .and_then(|_authorization| {
                    phone.complete(&mut store, &channel, &Frame::Complete { sid: [7; 16] })
                });
            assert!(matches!(completed, Err(PairingError::CandidateStale)));
        }
        drop(store);
        let store = directory.store(key("phone"));
        let record = store.record(&[7; 16]).unwrap().unwrap();
        assert_eq!(
            record.state,
            if cut == 1 {
                RecordState::Pending
            } else {
                RecordState::PinnedPendingAck
            }
        );
        assert_eq!(record.peer.is_some(), cut == 2);
    }
}

#[test]
fn synchronous_phone_suspend_waits_for_authorized_durable_section_then_fences_it() {
    let foreground = std::sync::Arc::new(Foreground::default());
    foreground.set_active(true).unwrap();
    let epoch = foreground.capture().unwrap();
    let authorization = foreground.authorize(Some(epoch)).unwrap();
    let (ready, receiver) = std::sync::mpsc::channel();
    let suspended = foreground.clone();
    let worker = std::thread::spawn(move || {
        ready.send(()).unwrap();
        suspended.set_active(false).unwrap();
    });
    receiver.recv().unwrap();
    // The held guard is the same guard retained over phone_pending/pin/complete writes.
    assert!(foreground.0.try_lock().is_err());
    drop(authorization);
    worker.join().unwrap();
    assert!(foreground.authorize(Some(epoch)).is_err());
}
