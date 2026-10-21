# Windows startup: confirmed refusal and recovery gap — 2026-10-21

## Evidence and repository

User reported the second explicitly authorized one-shot output:

```text
NATIVE_STARTUP_ATTEMPT_ONCE
KLODA_STARTUP stage=Storage operation=Some(LeafNameValidation) code=storage_failure win32=None
OWNER_OPEN_FAILED storage_failure
```

At investigation start the local working tree was clean, HEAD `4fdda80`, incorporating Windows commit `52a9c67`. The three Rust files exactly match the SHA256 values of the prepared diagnostic delta. No source discrepancy was found. User performed push/pull; agent performed no Git mutation. The one-shot permission is consumed; no further Windows command, test/build, probe or physical acceptance was run for this source investigation.

## Confirmed current failure

The exact previously reviewed command requires only regular single-link `epoch.pending`16 and `owner.lock`0 before calling native open. Given this guard and observed Storage/LeafNameValidation, the rejected entry is `epoch.pending`:

1. [Initialization](../../packages/pairing-native/src/initialization.rs#L28) calls Storage preparation before Epoch, continuity, hardware identity, certificate or database.
2. [Preparation](../../packages/pairing-native/src/installation_windows.rs#L27) completes directory checks, then the OwnerLock stage, then scans each entry through `path::leaf` at line49.
3. [Leaf validation](../../packages/pairing-native/src/installation_windows_path.rs#L193) permits `owner.lock` and final authority/SQLite names, excludes `epoch.pending`, and emits the observed label with no invented OS code.

Directory and OwnerLock checks passed this attempt; their scoped success is not proof of complete Windows storage/custody acceptance. No claim is made about historical TPM key existence or post-attempt file bytes. There is no new evidence of network, pairing, renderer or TPM failure in this run.

## Why adding a filename cannot repair this

[Epoch initialization](../../packages/pairing-native/src/installation_files.rs#L46) finds no final epoch or bound marker under the guarded layout, generates fresh random bytes and calls `write_new`. [Windows publication](../../packages/pairing-native/src/installation_windows.rs#L133) uses the same `epoch.pending` with `CREATE_NEW`, deliberately refusing an existing staged file. Thus relaxing only the allowlist moves the refusal to an existing-pending collision; it does not resume safely. Deleting/overwriting that file or treating its bytes as a committed epoch would choose an unapproved recovery/continuity policy.

The real missing behavior is a safe, approved Windows interrupted-initialization/publication recovery protocol. Current code intentionally preserves staged evidence and fails closed. File name,16-byte length and private ACL alone do not prove a committed installation identity or authorize restoring trust. [Identity alias](../../packages/pairing-native/src/identity.rs#L47) depends on path+epoch; a new epoch can select a different hardware key identity. Reset/adoption is not a harmless retry.

## What remains unknown about the earlier failure

The publisher's sequence is create staged file → validate metadata/ACL → write bytes → flush → MoveFileEx → flush/checks. A16-byte pending file does not establish which later operation failed or even that the first flush completed. Older separate probe results WRITE_THROUGH32 and directory-reopen5 are retained in [the platform checkpoint](desktop-platform-validation-plan.md#güncel-yürütme-kapısı--fiziksel-doğrulama-duraklatıldı); they do not establish the original app failure. Current one-shot never reaches publication. Repeating it cannot reveal that original operation and only reproduces the known refusal.

Original raw app error/operation and standalone old probe transcripts are not available in the examined retained evidence; do not invent a definitive original rename cause. No old probe was repeated.

## Next work and decisions

Do not add another label cycle for this same layout. Prepare a scoped Windows authority-state publication/recovery design that (a) safely publishes absent targets under retained confinement/ACL/flush/owner checks, (b) distinguishes incomplete versus committed installation state, (c) states exactly which durable evidence permits any recovery, and (d) fails visibly without deleting/adopting existing state when evidence is insufficient. An implementation/API/layout/recovery choice needs approval before code or native-state change; this research does not select one.

Keep separate decision gates for certificate replacement/target races, SQLite DB/WAL/SHM real-object binding and independent continuity witness. Hardware-only custody, PC-local ACL and signing/provider boundaries remain unchanged. Current existing authority data and user archive must stay untouched. Any future Windows disposable experiment/owner run needs its own explicit scope; the general physical pause remains.

Evidence limits: the Windows-only negative filename test includes `certificate.der.pending`, whereas actual `with_extension("pending")` stages `certificate.der` as `certificate.pending`. This does not alter the epoch diagnosis; do not claim that test verifies actual certificate crash recovery. Both names currently fail the same allowlist. No test was run or changed during this investigation.

Separate read-only source/security review confirmed the current cause, insufficiency of an allowlist-only change and remaining original-cause uncertainty. Historical build/test successes retain their original scope; none is a newly run check here.
