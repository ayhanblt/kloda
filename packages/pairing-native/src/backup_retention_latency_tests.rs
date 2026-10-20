use super::*;
use std::time::Instant;

#[test]
fn disposable_large_file_protection_restore_and_cleanup_latency() {
    let (_directory, mut store, mut receiver, peer) = setup();
    // Host fixture timing only: no hardware/provider or receiver latency guarantee.
    let bytes = vec![0x5a; 64 * 1024 * 1024];
    let id = receive(
        &mut store,
        &mut receiver,
        upload(40, 41, "large-v1", "disposable-large.bin", &bytes),
        &bytes,
    );
    let manual = peer.join("unrelated.txt");
    fs::write(&manual, b"preserve").unwrap();
    let start = Instant::now();
    actions::change(&mut store, &id, false, 1000).unwrap();
    let trash_ms = start.elapsed().as_millis();
    assert!(!peer.join(format!("{id}.media")).exists());
    let start = Instant::now();
    actions::change(&mut store, &id, true, 2000).unwrap();
    let restore_ms = start.elapsed().as_millis();
    assert_eq!(fs::read(peer.join(format!("{id}.media"))).unwrap(), bytes);
    actions::change(&mut store, &id, false, 3000).unwrap();
    let deadline = deleted(&store, &id).unwrap().unwrap().expires;
    let start = Instant::now();
    actions::maintain(&mut store, deadline + 1).unwrap();
    let purge_ms = start.elapsed().as_millis();
    assert_eq!(fs::read(manual).unwrap(), b"preserve");
    assert!(!peer.join(format!(".kloda-{id}.keep")).exists());
    assert_eq!(deleted(&store, &id).unwrap().unwrap().phase, 6);
    println!(
        "KLODA_LATENCY_FIXTURE bytes={} trash_ms={} restore_ms={} purge_ms={}",
        bytes.len(),
        trash_ms,
        restore_ms,
        purge_ms
    );
}
