# F1 S3 — R12/R3 separate clock reconcile (Opus, 12.11.2026)

Status: **FIX — independent GPT review not accepted (R13/R14).** Latest review/handoff:
[review.md](review.md). Contract: [f1-r12-clock-reconcile-fix.md](../../../../plans/f1-r12-clock-reconcile-fix.md)
(user-approved, 5 files). Parent: [../MANIFEST.md](../MANIFEST.md) (strict R12 attempt 1, blocked by conflict).

## Start

- HEAD `650ec17f300ebdeee804bd4218f5b57356eecb21`, staged empty; `baseline/start-sources.sha256` == strict-R12
  end state (`../current-sources.sha256`). Pre copies of the 5 files + CURRENT/parent MANIFEST/contract:
  `baseline/*.pre` (+ `pre.sha256`, `status.txt`, `tracked-scope-start.diff`).
- Correction by GPT review: the 5 files were already **untracked** at start (prior F1 rounds, uncommitted); this round's own delta is
  `round.diff` (baseline `.pre` → final). Strict R12 early gate and R12 counter test were kept (no blind restore).

## Matrix

| Finding | Invariant | Event sequence | Symbol | Regression | Before → after |
|---|---|---|---|---|---|
| R12 | early OS delivery: capture/lease/admission=0, same plan+retry | foreground dirty → early callback | `admit` gate before `fold` (kept) | LockChecks `representative` counter (kept) | strict red1 FAIL → g1 PASS (parent) → PASS final |
| R3-A | explicit clock = separate authorized reconcile; never via OS delivery; run never revised | OSOwned+clock; active→clock→completion; active→clock→exact stop | `reconcile(changed)` RAM `Clock(epoch)` → `revise` (exact CAS, epoch++, one projection); `resume` after completion/stop/projection | LockChecks `revocation`, `active` | strict g1 FAIL `active():309` → PASS final |
| R3-B | pure clock keeps wake, new occurrence/due, retry cleared; stale params no-op; config/revoke drops request; locked: no capture | clock under OSOwned; old params/stop after revision; locked request → early delivery → unlocked continuation; source change after request | `Plan.clock`, request epoch bind, `revise` guards | LockChecks `active`; PlanChecks `clock` | new → PASS |
| R3-C | schedule FAILURE / generic throw unchanged | unchanged | `replace`/`submit` | existing `ownership`/`projection` | PASS (unchanged tests) |
| R9 | completion/stop vs revision barriers: no lost revision, stale owner no effect | completion queued → exact stop; revision committed+queued → stale stop / old-epoch candidate | `onStop` resume, `install` epoch fence, `fold` capture outside lock | LockChecks `fold` rewritten | PASS |
| Plan | clock CAS: own miss / rollback=old / ack-loss=new / unreadable → fence, manual gate, settle w/o cleanup/disarm; reopen before/after | real SQLite boundary faults | `Plan.clock`, `settle(): Boolean`, `Uncertain(plan, old)`; `unblock` | PlanChecks `clock` | new → PASS |
| OS | real harness: clock revision → one pending JOB 2712, same wake new nonce, early delivery capture=0, replaced stop no-op, exact cancel | harness | same coordinator | OsChecks extension | new → PASS |

Failed targeted fixes: early eligibleAt/capture family = attempt 1 (blocked by conflict, parent); this round is the
contract-directed approach and passed. stale=1, clock-stop=1, migration=1 history unchanged.

## Product change summary

- Coordinator: `clockChanged` removed. `reconcile(true)` records a RAM `Clock(epoch)` request before every guard
  (coalesced per epoch); ordinary dirty/foreground never creates one. `revise(authority)` runs only with no active
  execution, not blocked/unresolved, owner IDLE/OS_OWNED, same target/binding, wake non-null: exact
  `plan.clock(current, revised)` (wake kept, new occurrence, due = next(clock()), retry = null, fresh context),
  then epoch++, owner REPLACING, one main-lane `schedule`. `resume()` (background; unlocked and not globally
  paused) continues the request after terminal completion (`Exec.resume`), after an installed exact stop and after
  a non-execution projection. OS delivery never starts it. `fold` captures authority outside sourceLock and folds
  only ordinary dirty. Lost-ack proof: `r.proof` holds the written revision, so a proven commit is projected once
  without a second CAS. Formatting-only joins keep the file at 296 counted lines.
- Plan: `clock(expected, revised)`; own CAS miss → false; other throw → one read: exact new = true, exact old =
  false, else `Uncertain(revised, expected)` + `storage_failure` (fenced; reuses Queue attach gate). `settle()`
  returns true for a settled clock proof (no legacy cleanup; `unblock` then skips `disarm`).

## Verification (fresh, this round)

Variant: `:my-module` debug androidTest, `-PklodaS3Native=true -PreactNativeArchitectures=arm64-v8a`, emulator
`emulator-5590` (KlodaCloud18 API 35). No native/Rust rebuild in scope.

| Step | Log | Result |
|---|---|---|
| compile prod+test (pre-test-edit) | `build-c1.log` | BUILD SUCCESSFUL |
| APK c2 `acb99998…` lock | `run-s3-automatic-lock-c2.log` | FAIL own test precondition (R9 expected exact plan; pause rotates context) |
| APK c3 lock (diagnostic msg) | `run-s3-automatic-lock-c3.log` | FAIL same; diagnosed `plan != p1` (ordinary context refresh) |
| APK c4 lock | `run-s3-automatic-lock-c4.log` | PASS |
| APK c4 plan | `run-s3-automatic-plan-c4.log` | FAIL own test: reopen new journal context → occurrence rotates |
| APK c5 plan (diagnostic msg) | `run-s3-automatic-plan-c5.log` | FAIL same, diagnosed |
| APK c6 plan / lock / os | `run-s3-automatic-*-c6.log` | PASS / PASS / PASS |
| self-review fix: `resume` fresh `paused()` guard | — | product one-condition change |
| **final** APK `bcb65ade6894ce17e72bacedc854e4d0bb9833ffcdf303b0d4160f310103e2fd` (`apk-final.sha256`) | `build-final.log`, `run-s3-automatic-{lock,plan,os}-final.log` | BUILD SUCCESSFUL; lock PASS (representative + interleavings), plan PASS, os PASS |

The intermediate failures were test-expectation errors in this round's new assertions (both derived from the
contract: due/wake/binding authority, not occurrence identity across a context refresh); product code was not
changed for them.

Reused, not rerun (unchanged code paths): Queue/Runtime/contract/pause/global-pause evidence from the parent
rounds. Lint: **NOT_RUN** (two-attempt limit retained). No schema/ABI change (`round.diff`: 0 schema/ABI lines).

## Handoff

- Diff scope (this round): exactly the 5 contract files — `round.diff` (+159/−89 lines), `final-sources.sha256`,
  `line-counts.txt` (Coordinator 296, Plan 173, LockChecks 300, PlanChecks 253, OsChecks 85; limit 300).
- Git classification corrected by GPT review: the 5 files are **untracked**, not tracked-dirty; their prior-round
  content is separated by baseline `.pre` copies and `round.diff`. Other scoped tracked HEAD changes are unchanged. Staged:
  empty (`staged-after.txt`). Untracked added: this evidence directory only. `status-after.txt` equals
  `baseline/status.txt` outside this directory. Other pre-existing dirty files (FTPS/SFTP/SMB, JS, ftps-native,
  AGENTS.md) were not touched. No commit/push/stage.
- Self-review (same agent; NOT an independent review): added the missing `paused()` guard in `resume`.
  Observation outside scope (pre-existing, unchanged): an exact `onStop` of an old installed Exec in state
  `unresolved` sets owner IDLE even after a later `revision`/`revise` moved the epoch; it self-heals via pending
  adoption in `idleProject` (no second JOB), but the reviewer may want it recorded.
- Open gates: independent GPT review of the real diff; lint NOT_RUN; physical/real keyguard/Doze/natural delivery
  timing not proven (synthetic clock + lock-deny only); RAM request loss before commit and backward-clock delay are
  user-accepted limitations; FTPS/Faz3–4/B4/P5 unchanged.

## Independent GPT review — 12.11.2026

- **Not accepted; FIX.** [review.md](review.md): R12 preserved; R13 stale installed-unresolved stop can erase
  a newer projection's owner/unknown-outcome fence; R14 exact committed clock proof is invalidated by ordinary
  context refresh before consumption, allowing a second clock-CAS and due recomputation. Source/event findings;
  new regressions NOT_RUN. Scoped event sequences, symbols and acceptance references are in the review.
- Fresh: hash/baseline/round reconstruction, tracked/staged/untracked scope checks (`review-integrity.log`,
  `review-status.txt`, `review-tracked-scope.diff`). Reused: final build/APK/lock/plan/os evidence; no reruns.
- Invariant failures retained: early-capture=1 conflict; stale ownership=2 rounds (prior candidate/install vs.
  current installed-unresolved branch; two failures of the same approach not established); clock-stop=1;
  migration=1; new clock-proof approach=1 (R14). No renumber/session reset. Same-approach second failure requires
  DECISION/design reassessment, not another automatic FIX. Lint two-attempt stop remains.
- Next: separate Opus `/implement`, only R13/R14 within existing five-file contract; checkbox remains open.
  Review clarification/evidence/admin remains in this GPT review session. Physical/FTPS/Faz3–4/B4/P5 gates unchanged.

## GPT root-cause/design clarification — 12.11.2026

- **FIX / READY**, documentation only: [executable R13/R14 contract](../../../../plans/f1-r13-r14-clock-reconcile-fix.md).
  Required post-rejection design gate completed in the same GPT conversation; review rejection remains valid.
- R13: exact Exec lifecycle identity is separate from epoch-bound projection ticket/origin; old unresolved
  Exec is retired on revision; stop cannot mutate/resume a newer ticket; schedule/replace prove ticket before/after OS.
- R14: settle returns distinct migration/no-fence/clock committed/clock rollback proofs; bind result before arm;
  same-config context refresh preserves committed due/wake/retry, without another clock-CAS/next(now).
- First only R13 representative RED/minimum fix/GREEN; usage UNKNOWN requires checkpoint/user response before
  R14/expanded tests. No runtime, build or product edits in this design clarification; five source hashes unchanged.
  Counters, five-file/300-line scope and all deferred gates preserved. Separate Opus `/implement`; no pilot.
