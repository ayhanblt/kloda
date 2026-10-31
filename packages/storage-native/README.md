# Native storage — SMB only

ADR0026: shared Android/iOS Rust wire engine, Kotlin/Swift platform owners.
D6A permits the exact ENCRYPTION capability bit patch. Corrected D8A permits a
public Tokio ingress plus a crate-private runtime factory for a native-owned
connected socket. The original internal constructor stays private; crypto/auth/
framing algorithms are unchanged. The initial visibility-only attempt was rolled
back after an external consumer proved its private parameter was unusable.
The vendored published smb2 0.36.2 source preserves MIT/Apache notices. vendor/smb2-upstream.json
records provenance; vendor/smb2.sha256 is checked by every Cargo build. A source
or version change fails closed; remove the local patch once upstream supplies it
and revalidate instead of silently carrying it into an upgrade.

The low-level SDK API avoids automatic DFS/reconnect. Numeric SocketAddr pins the
socket; native LAN-route/context/credential admission is still required. The
negotiated cipher is checked before auth; encrypted frame markers are required
in both directions after auth; SDK verifies all cryptography. Native owners must
supply their current remaining I/O budget. No new global timeout.

Native-only C/JNI publication foundations exist, but no enabled SMB capability.
Actual route/source/credential owner integration and native
journal/recovery/restore, OS/UI and physical acceptance remain open. Previous
smb/SSPI candidate source is retained under its evidence directory, not used here.

Use Rust 1.99.0 compiler/rustdoc/Clippy consistently. Default cargo test ignores
network tests. Only KLODA_SMB16_FIXTURE=owned-loopback with the recorded Samba
fixture may run the ignored integration test. See tools/smb-fixture/README.md.

D8 native `runBound` / `publishBound` handoff consumes the exclusive connected
socket, verifies the exact peer before auth and never opens another connection.
Native OS route/current source/profile/vault generations remain required owners;
these are not established by a test callback or by the mere presence of a socket.
Product SMB remains disabled. See the current native publication checkpoint.
