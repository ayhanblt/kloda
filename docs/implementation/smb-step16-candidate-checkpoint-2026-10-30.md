> D5A kullanıcı tarafından onaylandı; [alternatif0.36.2 değerlendirmesi ve D6](smb2-step16-alternative-checkpoint-2026-10-30.md) güncel. Aşağıdaki ilk aday/karar kaydı tarihseldir.

# SMB16a — candidate checkpoint and next engine decision

ADR0026 A is approved: Android/iOS share a Rust SMB engine; platform-specific
work stays Kotlin/Swift; initial scope is SMB only. **16a is incomplete and SMB
remains unavailable in the product.** No JNI/C/Swift product export or app linkage
was added. Pairing/PC keys, ACL, codecs and native crate were not changed.

## Implemented and observed

Separate `packages/storage-native` pins `smb =0.12.1`; registry source commit
7c7d4a60c930e3780e95208967aa13b6346eaa25, crate checksum
b60b8c4d8566c3cf19d17837958e67acc0534e68f331e898a642f4f57e9ecc4c.
This is the published tag, not the different main revision in initial research.
Cargo.lock pins the complete resolution. Defaults are off; async/sign/encrypt
only. Strict config requires SMB3+, encryption and signed/authenticated session
responses; guest/null, DFS, compression, Kerberos, NetBIOS, QUIC/RDMA and
multichannel are disabled. Native remaining I/O budget is supplied explicitly;
zero fails, no new global timeout. The signature and encrypted-response gates
are enforced in upstream session/channel, not inferred from feature names.

The first /tmp single-threaded probe passed host/Android-arm64/iOS-Simulator
compilation. The separate actual storage crate uses async for future native
cancellation; its SSPI dependency requires Tokio>=1.52. Storage alone pins1.54.1;
existing pairing Tokio1.50.0 is unchanged. Actual async crate cross-link PASS:
Android API24 arm64/armv7/x86_64/x86, iOS16.4 arm64 device and arm64 Simulator,
Rust1.99.0 and NDK27.1.12297006. Device target is cross-compilation, not physical
runtime. No mobile ABI exports or SDK runtime acceptance is claimed.

Owned real Samba4.19.5, distro package2:4.19.5+dfsg-4ubuntu9.8, immutable Ubuntu
base and recorded image ID. New labelled containers, no host mounts, only127.0.0.1
published ports, dedicated bridge with IP masquerade off. Initial Docker internal
network did not publish ports; only own fixtures were replaced. No personal NAS,
physical device, source media, key or paid resource used. Fixture account is fake.

PASS real SMB3 encrypted/authenticated session;1MiB create-exclusive/write/flush,
no-clobber rename rejects foreign final and preserves its exact bytes, received
rename ACK plus complete final-byte equality. Wrong password, SMB2-only and
server encryption-off reject. Two bounded loopback proxies actually mutated final
SessionSetup signed flag/signature and encrypted ciphertext; both reject. Counter
advanced1→2 for each fault across the two successful runtime runs. A connection
failure alone was not counted as an adversarial PASS. Strict-config unit and
advisory-trigger regression pass; rustdoc completed with matching toolchain.

No SMB durable receipt or restore authority is produced by this test. Full-byte
equality is payload verification, not adoption after a lost ACK. Native LAN route/
DNS/credential/source-generation admission, bridge cancellation, lost create/
write/rename recovery, Files/Photos queue, own-receipt restore, app UI/schedule and
normal OS delivery remain NOT_IMPLEMENTED/NOT_RUN for SMB. WebDAV/PC mechanisms
must not be renamed into SMB authority. Desktop SMB is not accepted by mobile
cross-link results. The existing disabled provider page stays disabled.

## Dependency security gate — unresolved, no silent suppression

OSV matched the300 resolved registry versions, including inactive platform nodes;
this is not a claim all300 are shipped. Raw queries/results are evidence. Two
records matched:

- [GHSA-qwgh-2vcv-g2f7](https://github.com/advisories/GHSA-qwgh-2vcv-g2f7)
  reports pre0.12.1 block_buffer cursor corruption after a caught compression
  panic. Locked block-buffer0.10.4 uses a separate `pos:u8`, unlike the described
  inline cursor. A small regression reproduces the eager-buffer trigger: input
  containing0xff and caught compress panic; legacy cursor remains2 and remaining2.
  ReadBuffer is absent in that old API. This is source/trigger evidence, not Miri,
  an upstream-corrected advisory range, or blanket proof of every buffer path.
- [RUSTSEC-2023-0071](https://rustsec.org/advisories/RUSTSEC-2023-0071.html)
  matches compiled rsa0.10.0-rc.18 via SSPI0.21.3/Picky7.0.0-rc.25. RustSec has no
  patched release; it concerns RSA private-key timing. The tested SMB slice passes
  username/password with NTLM-only, exposes no RSA private-key input and disables
  Kerberos; no remote compromise of this slice was demonstrated. This does not
  remove RSA from the resolved/compiled graph or close the dependency gate.

No audit allowlist, ignored advisory, third-party fork, crypto patch or security
waiver was introduced. Capability remains blocked as the user required.

## Concrete D5: how to remove the dependency obstacle

A — Recommended: evaluate the other permissively licensed shared-Rust candidate
`vdavid/smb2` before adopting it. Its [current manifest](https://github.com/vdavid/smb2/blob/main/crates/smb2/Cargo.toml)
lists its own NTLM implementation and no direct RSA/SSPI dependency. This is only
a source observation; exact-version/transitive audit, mandatory security and
same fault/platform matrix must be repeated. Its transparent DFS/reconnect/name
mapping defaults are not accepted as Kloda policy. No alternative dependency has
been installed or selected. Keep the same separate storage/native-owner boundary.

B — Keep `smb` and prepare a minimal NTLM-only SSPI dependency-separation patch/
fork proposal, then validate it before adoption. This adds maintenance and a
security-sensitive third-party patch; no silent fork or upstream PR/message.

The user's architecture direction remains unchanged in either option. This new
choice concerns replacing the candidate versus maintaining third-party auth code;
we do not mark the present dependency gate PASS or choose that burden silently.

## Review and retained limits

Separate same-main-agent review: source/target ownership of fixture, literal
loopback allowlist, actual fault counters, strict config/defaults, no overwrite,
crate/pairing separation and disabled product path checked. Not independent-agent
review. Initial wrong compiler/rustdoc PATH and container UID/port errors were
corrected without target reset, cargo clean, TLS bypass or unrelated Docker edits.
Test fixtures were stopped after capturing evidence; no daemon-wide prune.
12/13 visual/a11y/landscape,15 product/runtime limits and20/21 acceptance remain
open. No physical test or Git add/commit/push/reset/clean/stash.
