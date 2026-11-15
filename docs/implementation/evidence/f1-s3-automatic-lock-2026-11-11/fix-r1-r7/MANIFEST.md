# 1.4b/F1 S3 — review R1–R7 scoped fix round

Role: Opus implementation + same-session self-review (**not independent**). Unchecked;
awaiting separate GPT review at handoff. No commit/push/stage, checkbox closed: no.

12.11.2026 separate GPT review: **NOT ACCEPTED**; [review.md](review.md).
R1/R3/R5 partially resolved; blocking R8–R11 cover stale legacy OS ownership,
clock-fold/stop delivery loss, manual migration storage fence and mismatched
migration proof. Fresh source/diff integrity: `review-integrity.log`. Recorded
PASS results below remain limited to covered paths; no checkbox closed.

## Start / scope

- HEAD `650ec17f300ebdeee804bd4218f5b57356eecb21` (`baseline/head.txt`); staged empty.
- Start state: `baseline/verify.txt` — all 11 sources matched the hashes the reviewer
  checked (`baseline/sources.sha256` = `../final-sources.sha256`). No change after the review.
- Process check at start: no gradlew/instrument process; only idle Gradle/Kotlin
  daemons and the KlodaCloud18 emulator (not restarted).
- Changed this round (`changed-files.txt`), all inside the approved §7 list and all
  untracked: `AndroidS3AutomaticCoordinator.kt`, `AndroidS3AutomaticPlan.kt`,
  `AndroidAutomaticLockChecks.kt`, `AndroidS3AutomaticPlanChecks.kt`. The 6 tracked
  files are untouched: `git diff` is byte-identical to `../tracked-scope.diff`.
  `status-after.txt` = `baseline/status.txt`.
- Product round diff: `round-product.diff` (from the `baseline/*.kt.pre` copies).
  No pre-round copy was kept for the two test files; the full current files are the
  review subject (both untracked). Final hashes: `final-sources.sha256`.
- No schema column, new file, build config, dependency, ABI or native rebuild change.
  Line counts (`line-counts.txt`, nonblank/noncomment): Coordinator 300, Plan 154,
  LockChecks 286, PlanChecks 187, runner 300.

## R1–R7 → change → evidence

| # | Product change | Deterministic assertion |
| --- | --- | --- |
| R1 | `onStart` creates only a *candidate*; `install` on the background lane takes ownership only for the same epoch, no active execution and proven current wake; a stale candidate calls only its own `finish(false)` | LockChecks `active()`: held A + stale B + current-wake B + late duplicate of A → A lease/owner/run unchanged, no schedule/cancel; A completion projects once; old stop/start of A is a no-op |
| R2 | `planWake/wakeKnown` from the last proven SQLite read (the init read covers a fresh process); a pre-admission stop hands off once only if the wake is proven current, not paused/blocked/unresolved and there is no other active owner | `interleavings`: fresh coordinator + held lane + current due → `onStop=true`, run/accept 0, same plan, no schedule, owner OS_OWNED. Counterparts stale/paused/revoked → false. Storage counterpart: PlanChecks `fence()` → false |
| R3 | The active-owner decision is made under `sourceLock` *before* `arm`: an active clock event only sets dirty. The leftover dirty clock change is applied only when Idle; an OS-owned backoff folds it in its own outcome | `active()`: B active + `reconcile(true)` → plan == q1; exact stop → `true`; foreground reconcile → no schedule/revision; backoff W1 → one projection with the new wake/occurrence. Revocation: completion path checks the plan is unchanged |
| R4 | Legacy envelopes go through the same candidate/install path; `recover` checks the protocol-0 snapshot and, when locked, rearms its own job without vault/marker (≥5 min, protocol 0); unlocked → migrate + protocol=1 replacement (no admission). Stop: legacy hand-off only with a current snapshot and no plan wake | PlanChecks `recovery()`: pending=running and pending=absent both give one continuation each; changed snapshot → finish(false), no schedule; held stop true/false; unlock → marker, past due imported, protocol 1, run/accept 0 |
| R5 | `migrate` ack lost + proof read fails → in-memory `uncertain` fence: `marked/current/migrate/arm/disarm/defer/matches/admit/resolve` → storage_failure. Only `settle()` (one consistent read) closes it; coordinator `fence()` → STORAGE_BLOCKED | PlanChecks `ack`: plain reads/writes fenced, settle fails while read fault, then proof + cleanup. `fence()`: repeated reconcile, toggles, `reconcile(true)`, callback and held stop do not open projection/admission; after proof one projection with the same due |
| R6 | Negative `due` is in the corrupt-type check → storage_failure (no marker/import/cleanup) | PlanChecks `ddl` (without authority) + `mismatch` (with authority, matching binding): storage_failure, unmarked, prefs kept; missing due/binding mismatch behavior unchanged |
| R7 | Every projection (`replace`, initial/recovery/revision `schedule`) goes through one `submit()`: a generic throw counts as SUCCESS only with the exact new nonce, otherwise ProjectionUnresolved (OSOwned + unresolved) | LockChecks `projection()`: initial throw + pending absent / read failure → no second schedule; exact nonce → OS_OWNED; RESULT_FAILURE → Idle, then one projection; revoke opens a fresh epoch |

## Commands (fresh, this round; emulator-5590 KlodaCloud18 API 35, keyguard open)

| Step | Log | Result |
| --- | --- | --- |
| Compile + test APK `:my-module:compileDebugKotlin :my-module:assembleDebugAndroidTest -PklodaS3Native=true -PreactNativeArchitectures=arm64-v8a` | `build-1.log` | FAIL: my own `takeIf` `it` shadowing (`Unresolved reference 'binding'`) |
| Same | `build-2…5.log` | BUILD SUCCESSFUL; the two `arrayOf` inference warnings already exist in `../compile-main-1.log` (lines shifted) |
| `s3-automatic-lock` (build 2) | `run-s3-automatic-lock-1.log` | FAIL interleavings:189 — the added `c2.reconcile()` came after the exact-pause context rotation; test-order error, removed |
| Same (build 3) | `run-…-lock-2.log` | FAIL revocation:213 — absolute `epoch==1`; the initial migration is now a revision (R4). Changed to a relative check |
| Same (build 4) | `run-…-lock-3.log` | FAIL `active()` "R3 plan revised…": A's exact pause rotated the context, so B was not admitted; test adds a plain reconcile first |
| Same (build 5) | `run-…-lock-4.log` | **PASS** representative + interleavings (revocation/ownership/storage/active/projection) |
| `s3-automatic-plan` (build 5) | `run-s3-automatic-plan-1.log` | **PASS** |
| `s3-automatic-os` (build 5, `-r`) | `run-s3-automatic-os-1.log`, `.logcat.txt` | **PASS**, CODE -1; job 2712 absent after the run (strict grep 0; the pre-run grep pattern was too broad and is not evidence) |
| `s3-automatic-contract` (build 5, `-r`) | `run-s3-automatic-contract-1.log` | **PASS**, CODE -1 |

APK hashes: `apk-sha256.txt` (build 2), `apk-sha256-build3…5.txt`; final = build 5.
The lock/plan runs were without `-r`: the final stream line is written only on the
RESULT_OK path, and a failure prints a stack trace.

Product fix found during the round (inside R3, same file): with the dirty clock fold in
reconcile, a foreground reconcile could replace an OS-owned backoff; restricted to
`owner == IDLE`. Proven by the `active()` foreground assertion.

## Reused / NOT_RUN / open

- Reused (no Queue/Runtime/tracked change): `../run-s3-pause-1.log`, `../run-s3-global-pause-1.log`.
  RED mutation `../red/` is still the F1 representative path; not re-run.
- Lint NOT_RUN: two-attempt counter preserved (`../lint-1/2.log`, worker lint crash); no third attempt.
- Every failure in this round had a distinct, proven root cause (one compile error, three test-order/expectation errors); no approach failed twice.
- Physical keyguard/vault, first unlock/CE, reboot/force-stop/Doze, natural delivery timing: Faz 3/4.
- The in-memory fence (queue uncertain commit and migration) resets after a process restart; the existing decision (restart = ended transaction + exact CAS/marker) is preserved.
- FTPS F1, B4 remaining risks and P5 are outside this scope.
