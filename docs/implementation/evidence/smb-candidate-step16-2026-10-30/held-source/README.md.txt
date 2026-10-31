# Native storage — SMB candidate only

ADR0026 selects a shared Rust SMB engine; Kotlin/Swift retain platform owners.
This initial crate pins the candidate and strict configuration for isolated
validation. It has no JNI/C/Swift product exports, application linkage or enabled
SMB capability. No generic protocol framework or pairing-key dependency.

Defaults are disabled; only async, sign and encrypt are selected. Async is needed
for native cancellation without introducing a fixed overall timeout. The native
owner must supply its existing remaining I/O budget. Compiler/feature support is
not security acceptance. Socket LAN-route pinning, durable operation receipts,
no-clobber publication and unknown outcomes require dedicated validation before
native/product exposure. DFS, guest/null, Kerberos, compression, NetBIOS, QUIC,
RDMA and multichannel are outside this first scope.
