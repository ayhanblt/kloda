# Step16a — SMB native engine decision

Status: user selected A on 2026-10-30: shared Rust SMB for Android/iOS, native platform work in Kotlin/Swift, SMB-only initial scope, capability blocked until security/platform validation. Binding [ADR0026](../decisions/0026-shared-rust-smb-engine.md). Initial comparison below is historical read-only preflight; no product SDK dependency, transport, server or product
capability has been added. Step15 source/automated/isolated pipeline is implemented;
its product/platform acceptance limits remain explicit in the current handoff.
User owns new architecture decisions. ADR0022's approved SMB3 encryption+signing,
LAN-only and no downgrade profile is unchanged by this engine choice.

## Existing code and candidate evidence

There is no existing SMB adapter to extend in apps/packages. Native mobile DAV
journal/snapshot/credential/lifecycle mechanisms exist, but DAV MOVE ACKs and PC
operation IDs cannot be reused as SMB receipts. Pairing/PC authority stays separate.

- libsmb2's [own COPYING](https://raw.githubusercontent.com/sahlberg/libsmb2/master/COPYING)
  assigns LGPL-2.1-or-later to the SMB client; examples or separate DCE/RPC BSD
  licenses do not relicense it. Its [README](https://github.com/sahlberg/libsmb2)
  documents SMB3 encryption and signing options. Mobile linkage/distribution,
  notices and exact pinned transitive dependencies need an explicit plan.
- Context7 resolved `/amosavian/amsmb2`, a Swift wrapper, rather than libsmb2
  directly. Its [license note](https://github.com/amosavian/AMSMB2#license) calls
  for dynamic App Store linking. Its default `encrypted=false` and enabled-only
  signing setup cannot be treated as the approved strict Kloda profile. Wrapper
  documentation does not prove every C/API or Android platform requirement.
- MIT Rust candidate `afiffon/smb-rs`, workspace `smb`0.12.1, inspected revision
  `f4524d032c8951cc288e1c8231ad68588583abda`:
  [manifest](https://github.com/afiffon/smb-rs/blob/f4524d032c8951cc288e1c8231ad68588583abda/Cargo.toml),
  [configuration](https://github.com/afiffon/smb-rs/blob/f4524d032c8951cc288e1c8231ad68588583abda/crates/smb/src/connection/config.rs),
  [session enforcement](https://github.com/afiffon/smb-rs/blob/f4524d032c8951cc288e1c8231ad68588583abda/crates/smb/src/session/state.rs),
  [frame verification](https://github.com/afiffon/smb-rs/blob/f4524d032c8951cc288e1c8231ad68588583abda/crates/smb/src/connection/transformer.rs).
  Config exposes min/max dialect, EncryptionMode::Required and unsigned-guest
  control. Session code forces encryption or rejects unavailable encryption;
  frame verifier has encrypted/signature checks. These are source observations,
  not packet/security/runtime proof. DFS defaults on in high-level client and
  must be explicitly disabled; default features also include compression/NetBIOS.
  Required signing negotiation/enforcement must be proved, not inferred from
  compiled `sign` features. Crypto/auth transitive license/advisory and platform
  compilation are NOT_VERIFIED. Host rustc1.98.1 exceeds declared1.89 minimum;
  this is not an iOS/Android compatibility test.
- `vdavid/smb2` is another permissive-license candidate. Its own README describes
  transparent DFS failover and reconnect; defaults are not Kloda authorization.
  No deeper audit or selection was made.

No external source was executed. Targeted text reads only under /tmp. Python's
local CA chain failed; system curl with normal verification succeeded; TLS
verification was never disabled. No credentials or private endpoints transmitted.

## Concrete decision D4

A — Preferred direction: a separate small Rust storage boundary, initially SMB
only, using the MIT `smb` candidate at an exact reviewed version/revision. Reuse
native mobile credential/source/context/journal owners; do not put storage auth
inside the pairing identity core. First prove the candidate in an isolated
fixture and existing platform toolchains; production capability remains blocked
until those gates pass. This is an architecture/engine direction, not evidence
that the candidate is already fit or permission for silent dependency upgrades.

B — Use libsmb2 through separate platform-native adapters, with an explicit mobile
linkage/distribution and license-compliance plan before adoption. No legal
compliance guarantee is inferred from this technical source review.

Neither option permits new brokers, OS network mounts, current NAS/archive probes,
WAN/DFS/QUIC/NetBIOS fallback, guest/anonymous access, plaintext fallback or a new
application identity/key. Unsupported servers remain visible and blocked.

## Smallest validation after the decision

One disposable LAN fixture first: SMB3+mandatory encryption/signing, exact user/
share/path binding, create-exclusive staging, received no-clobber publish ACK,
full final byte hash/size and own-receipt restore. Reject SMB2/unsigned/unencrypted,
wrong credentials, outside-LAN and referral targets. Test lost create/write/rename
responses and foreign-final races without adopting by hash or overwriting. Use
existing immutable snapshot and current-generation/cancellation fences, then
minimum mobile ABI build proof. Server environment/package availability remains
unverified; no container/service was installed or started by this preflight.

Only then expand Files/Photos/source/schedule/UI in roadmap order. SMB rename,
file identity and durability must be checked against SMB semantics; DAV receipt
or durability claims are not copied. Step16b/16c are not skipped. Physical tests
remain step21 with separate explicit permission. Same-main-agent review only.
