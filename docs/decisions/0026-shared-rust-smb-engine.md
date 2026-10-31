# ADR0026 — Shared Rust SMB engine with native platform owners

- Date: 2026-10-30.
- Status: approved by the user, step16a D4 optionA with explicit constraints.
- Scope: SMB engine direction; not candidate/security/platform acceptance.

Use one shared Rust SMB engine for Android and iOS. Platform-specific work remains
in Kotlin/Swift. The initial storage engine scope is SMB only. Keep its boundary
separate from pairing identity and PC-local authority; no fake PC operation/grant
or reuse/export of Kloda device keys. This decision does not authorize a generic
multi-protocol storage framework, new broker or OS network mount.

Evaluate the MIT `smb` candidate at an exact fixed version/revision. Do not enable
SMB before necessary security and platform checks pass. Dependency feature flags,
README capabilities or host compilation alone are not proof. Retain visibly
blocked status for unsupported servers and unverified platforms. Replacing the
candidate with an incompatible engine or weakening a gate requires a new decision.

ADR0022 remains binding: LAN-only, SMB3+, encryption and signing required; no
older dialect, guest/anonymous, plaintext or downgrade fallback. Transport socket
routing, DFS/referrals/reconnect and uncertain-write recovery must respect the
same target/source/credential generation and current native authority fences.
Do not infer SMB create/rename/file identity/durability from WebDAV receipts.

Native owners retain secure credential storage, user-selected source handles,
Photos/SAF/PhotoKit, scheduling/lifecycle/foreground admission and durable local
job/recovery context. Rust handles the SMB wire/session and bounded byte I/O;
exact bridge ownership/cancellation rules must be checked before product exposure.
No personal NAS/archive, production key, physical device, provider account or
paid resource is authorized as a fixture by this decision. Physical acceptance
stays at step21 with separate explicit permission. Prior step12/13/15 platform
acceptance limits remain open.

[Read-only candidate comparison and smallest verification path](../implementation/smb-step16-engine-decision-2026-10-30.md).

## D5 candidate evaluation decision — 2026-10-30

User selected A: evaluate alternative shared-Rust `smb2` without carrying a fork.
The previous `smb` candidate's passing tests remain historical evidence; its
unresolved RSA dependency is not suppressed or accepted as clean. Alternative
license/dependency/security/platform gates must be independently checked with
existing owned fixtures. This is evaluation approval, not production activation.
Android/iOS Rust ownership and Kotlin/Swift platform boundaries remain unchanged.

## D6 narrow compatibility patch — 2026-10-30

User approved A: only smb2=0.36.2's ENCRYPTION negotiate-capability bit may be
patched, with exact version/source-hash enforcement and removal once upstream
fixes it. This exception does not approve another SDK fork/crypto change or a
silent upgrade. Native security/recovery gates still precede product activation.

## D7 Files + Photos receipt/sidecar contract — 2026-10-30

User approved A in [the concrete contract](../implementation/smb-receipt-sidecar-decision-2026-10-30.md).
SMB uses its own native immutable receipts, known create/write/flush/no-replace
rename ACKs plus full byte/source/context verification, and a separate versioned
Photos sidecar bound to same-target local Completed resource receipts. Restore
revalidates every resource. PC/DAV authority is unchanged; no lost-ACK/hash-only
adoption, silent name mapping, other-device adoption or remote deletion. Native
security/recovery and platform acceptance gates still precede activation.

## D8 native route-bound socket constructor — 2026-10-31

User approved A in [the concrete transport decision](../implementation/smb-route-bound-transport-decision-2026-10-31.md): only expose the existing `TcpTransport::from_stream` constructor (`fn` to `pub fn`) in exact smb2=0.36.2, in addition to D6A. Preserve source hashes/version and remove the corresponding patch when upstream supplies it. No SDK framing/crypto/auth change or extra dependency. Kotlin/Swift retain actual OS-route/source/credential ownership; passing a socket does not itself grant admission. Runtime/receipt/recovery gates precede product activation.

D8 consumer verification correction: the approved visibility-only hunk was rolled back. Its parameter wrapper is private and the Tokio conversion is test-only, so an external consumer cannot use it. A typed Tokio ingress and actual native handoff are concrete proposals, not implicitly approved by D8A; see the updated decision record. No additional SDK/native ABI changes were applied.

Corrected D8 scope explicitly approved A on2026-10-31: add the public Tokio ingress and crate-private wrapper factory without exposing the private runtime type, plus the native connected-socket C/JNI/Kotlin/Swift handoff. Implemented and scoped tests passed; the prior automatic review rejection is resolved by this explicit approval. Actual OS route/source/profile/vault ownership and product activation gates remain open. [Fresh scoped evidence](../implementation/evidence/smb-native-publication-step16-2026-10-30/bound-socket-2026-10-31.json).
