> Lower-usage rules remain binding; D6A and D7A are approved. Current work and next narrow slice: [native publication checkpoint](smb-native-publication-checkpoint-2026-10-30.md). Older pause/decision snapshots below are historical.

# Paused checkpoint and lower-usage execution plan — 2026-10-30

User explicitly asked to hold the current position, stop development, and discuss
usage reduction before resuming. Do not interpret that request as D6 approval.
No new SDK adoption, fork, test matrix, external message or automation during pause.
Main agent only; model/effort unchanged. No Git add/commit/push/reset/clean/stash.

## Resume position

Step16a, D5A alternative evaluation. ADR0026 common Android/iOS Rust SMB boundary
and Kotlin/Swift platform owners remain approved; initial engine scope SMB only.
SMB is disabled;16a incomplete. Step12/13/15/20/21 acceptance limits stay open.

- Published smb2=0.36.2, exact commit8a7bfc60a5119fd3d8c16d39a7ecefeea02fbb0e.
 71 resolved registry versions, OSV0 matches; no RSA/SSPI/Picky. Not a universal
 vulnerability-free claim. Six mobile targets cross-link passed.
- Unmodified SDK fails strict cipher admission before auth on the owned Samba
 fixture. Actual NEGOTIATE request omits ENCRYPTION capability; response has no
 cipher context. Source and bounded wire observation explain the failure.
- Separate /tmp one-bit diagnostic variant adds that capability. Its real1MiB,
 no-clobber/foreign-preserve/readback, negative profiles and two actual wire-fault
 tests passed; six diagnostic target cross-links separately passed.
- Nothing from the alternative/diagnostic variant was adopted into product
 Cargo/native bridges. packages/storage-native still contains the held first
 candidate; do not mistake its old source for the alternative implementation.
- Own SMB proxies/container services stopped; layers/evidence retained. No
 personal NAS, physical device, production key or media operation in this work.
- D6 is unresolved: adopt an exact pinned narrow compatibility patch (an
 exception to fork-free direction) or keep SMB blocked pending upstream fix.
 The D6 question has not been answered; no issue/PR/message was sent.

Read only these current files on resume, then the exact source needed:
[smb2 checkpoint/D6](smb2-step16-alternative-checkpoint-2026-10-30.md),
[evidence](evidence/smb2-alternative-step16-2026-10-30/manifest.json),
[local upstream draft, not sent](smb2-upstream-interop-report-draft-2026-10-30.md).
Do not reload old transcripts or repeat the successful matrices by default.

## Usage observations and proposed operating changes

No exact last-report cutoff or per-operation token counters are available in this
context. Do not invent totals, percentages or a guaranteed reduction. Repeated
reasoning/context/tool output, premature six-target matrices, toolchain/fixture
preflight errors, and repeated multi-document status updates drove avoidable work.
The repo already says prove one representative path before widening; apply it
strictly rather than creating more policy text.

On resume, use a narrow acceptance criterion and existing fixture. Check pinned
version/license/dependency advisories and strict host interoperability first.
If the critical gate fails, diagnose that gate before starting any ABI matrix.
After candidate/patch direction is actually accepted, run one Android arm64 and
one iOS Simulator build; run the required full target matrix once at a stable
checkpoint. Repeat only checks affected by semantic changes or unresolved failure.
Never drop security, recovery, accessibility or platform acceptance checks.

Validate compiler/rustdoc/Clippy paths and fixture readiness once. Preserve raw
logs on disk; default tool output to status plus a small relevant error excerpt.
Use targeted Serena/symbol/rg reads; do not repeatedly load full source/docs/web
navigation. Reuse recorded results by exact source/variant; never call historical
or diagnostic PASS a fresh product result. Keep one short current handoff pointer
and one evidence manifest per meaningful group rather than repeating long status
histories in every document. Bundle actual architecture/permission decisions when
concrete; do not create approval gates for routine implementation choices.

For subsequent work slices, optionally compare account-window usage before/after
with completed acceptance criteria; account usage is shared across chats and is
not exact per-step token attribution. Do not launch a long transcript-usage audit
just to measure this. Model/effort/subagent policy is not changed by these measures.
