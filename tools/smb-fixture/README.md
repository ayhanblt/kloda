# Owned Samba candidate fixture

Only local disposable containers, no host mounts or personal NAS. Dockerfile uses
an immutable official Ubuntu base; distribution Samba packages are installed
inside the image. Capture actual image ID/package versions for each run (this
record used Samba2:4.19.5+dfsg-4ubuntu9.8). No shipping server dependency.
The `owned` account/password are fixed fictional test credentials only.

Build with `docker build -t kloda-smb16-owned:probe tools/smb-fixture`. Use a new
labelled `kloda.fixture=smb16` bridge/network/container identity for each run,
IP masquerade off, and publish only127.0.0.1 ports27445(strict),27446(smb2),27447
(no-encrypt) to container445. No physical interface port or host directory mount.
Docker internal networks did not publish ports on the tested host; they are not
the working fixture. Capture/assert loopback HostIp and empty HostConfig.Binds.

Run `python3 tools/test-smb-wire-proxy.py` for two loopback-only fault proxies:
27448 strips the successful final SessionSetup response signature;27449 corrupts
an encrypted response. Mutation counters must advance during the corresponding
rejection test; a disconnected server is not a successful adversarial check.
No credential or payload bytes are logged.

Set RUSTC and RUSTDOC from `rustup which --toolchain 1.99.0 rustc/rustdoc`, then
`KLODA_SMB16_FIXTURE=owned-loopback cargo test --locked --manifest-path
packages/storage-native/Cargo.toml -- --include-ignored --nocapture`. Use the
1.99.0 cargo binary. Default test runs ignore network tests; no arbitrary server
argument is accepted. Native LAN route/credential/context admission, durable SMB
receipt/recovery and mobile app runtime remain separate gates.

Record every created container/network ID. Inspect the fixture label before
stopping/removing only those IDs; never use daemon-wide prune or name/hash scans.
Fixture foreign/staging/final files exist only in new container layers; no remote
user path is deleted. Do not remove unrelated images, containers or volumes.
