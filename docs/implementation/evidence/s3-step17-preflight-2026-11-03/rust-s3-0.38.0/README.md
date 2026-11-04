# Disposable candidate probe

Exact published rust-s30.38.0, MIT. No product dependency added.
Extract rust-s3-0.38.0.crate into a disposable directory. Create sibling probe/src, copy probe.rs to probe/src/main.rs, probe-Cargo.toml to probe/Cargo.toml and probe-Cargo.lock to probe/Cargo.lock. Run cargo run --locked --manifest-path probe/Cargo.toml. Uses only synthetic credentials and ephemeral loopback listeners; no provider/account/TLS acceptance. All listeners close on process completion. The probe asserts observed candidate behavior, including the unsafe redirect; exit0 does not mean candidate accepted.

Results: HTTP200 Error XML,412,409 and dropped completion response rejected with no second connection during1.5s observation (default retry budget1). Cross-port307 forwards signed Authorization and explicit synthetic session-token header. sync-rustls-tls+fail-on-err rejected for product adoption. Token was injected as a header; native temporary-credential flow was not tested. No real credential involved.

Upstream filtered cargo test compiled but selected0 tests: not a test PASS. The separate new wire probe ran4 negative completion cases and1 redirect reproduction.

OSV querybatch:117 exact registry packages including rust-s3,0 advisory matches on03.11.2026. Lock includes target-specific packages; not all compiled on host. This is not full license/platform/security acceptance. rustc1.98.1/aarch64-apple-darwin only; mobile targets not built. Registry API403; exact static.crates.io archive downloaded successfully. Docker29.8.0 ready; no S3 image present, no image pulled or server started.
