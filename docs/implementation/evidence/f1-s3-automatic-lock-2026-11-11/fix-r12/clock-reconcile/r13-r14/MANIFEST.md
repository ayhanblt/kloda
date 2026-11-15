# F1 S3 — R13/R14 scoped FIX (Opus, 15.11.2026)

Status: **SCOPED GOAL ACCEPTED — F1-S3-R13R14 `[x]`, independent GPT review 15.11.2026 after R14-C1.**
Upper 1.4b/F1 stays `[ ]`; FTPS and deferred physical/release gates remain open.
Contract: [f1-r13-r14-clock-reconcile-fix.md](../../../../../plans/f1-r13-r14-clock-reconcile-fix.md) (READY/FIX).
Latest review: [r14-c1/review.md](r14-c1/review.md); latest round: [r14-c1/MANIFEST.md](r14-c1/MANIFEST.md).
Prior rejected review/design record: [review.md](review.md) (GPT-6.1 Sol, 15.11.2026).
Previous findings: [../review.md](../review.md). Parent round manifest: [../MANIFEST.md](../MANIFEST.md).

## Start / diff scope

- Start HEAD `f26e425dd808daf206ee7bd8ec6fe9402fbd1119` (five sources == previous round `../final-sources.sha256`).
  Staged empty at start and end (`baseline/staged.txt`, `staged-final.txt`).
- `baseline/`: `head.txt`, `status.txt`, `staged.txt`, `tracked-dirty-start.diff`, `*.pre` copies, `pre.sha256`.
  Pre-existing dirty (.opencode/commands ×3, AGENTS.md, plan doc) not touched; CURRENT.md + this dir edited.
- Round diff: `round-r13-r14-final.diff` (`git diff` vs start HEAD over the 5 contract files; 4 changed, OsChecks
  unchanged). Stage-1 subset: `round-r13-stage1.diff`. Hashes `source-final.sha256`; status `status-final.txt`.
- Line counts (`lines-final.txt`, nonblank/noncomment): Coordinator 300, Plan 179, LockChecks 300, PlanChecks 281,
  OsChecks 85. No new file/schema/ABI/dependency. Untracked: only this evidence dir.

## Product change

**R13 (G13)** — `AndroidS3AutomaticCoordinator.kt`
- Stage 1: `revision()` retires any non-halted installed Exec (incl. unresolved); only a real active run is paused.
  `onStop()` writes owner only for `e.epoch == epoch` or a proven retry; `resume()` only on a current-epoch installed stop.
- Ticket (§2): RAM `ticket: Any?`; `claim()` sets a fresh ticket + REPLACING under the lock before every OS call
  (apply→`replace`, onStop relay, `revise`, `revision`, `idleProject`, `lockedProjection`). `schedule` checks exact
  ticket+epoch before the OS call and when applying; `replace` applies only while `ticket === t` (else done, no
  write/finish); `revoke` clears it.

**R14 (G14)** — `AndroidS3AutomaticPlan.kt` + Coordinator
- `settle()` returns internal `S3Settle`: NoFence / MigrationSettled / ClockCommitted(expected, revised) /
  ClockRolledBack(expected, revised), from the single consistent read; mismatch/unreadable still throws and keeps the
  fence. Migration cleanup unchanged; NoFence/MigrationSettled keep the old disarm; clock results never disarm/cleanup.
- `Clock` request: `proof = (old, new)` set before the CAS; `committed` bound in `unblock()` (before `arm`) only when
  `clockReq.epoch == epoch && proof == (expected, revised)`. RolledBack binds nothing → CAS may retry while valid.
- `revise()`: with `committed`, fresh row from ordinary `arm(changed=false)` must keep R due/wake/retry and the fresh
  authority context (else request dropped); no clock-CAS/`next(now)`; one ticket/projection; request consumed.
  Guards (active/blocked/unresolved/owner/target/binding/wake) unchanged.

## Tests

- LockChecks `stale` (G13): modes `throw`, `success`, `nonce`, `inflight` (A's in-flight replace SUCCESS while a
  source revision claims a new ticket; `S3AutoFakeOs.during` hook).
- `S3TestBoundary.skip`: next N commits pass, so the fault hits the chosen clock commit (not the earlier arm).
- PlanChecks `committed` (G14): manual M running before the clock event; clock R commit with after-commit ack loss +
  read-deny; fence closes manual start; M exact pause rotates context; clock advanced; read restored; reconcile.
  Modes: `commit` (representative), `rollback` (exact old → one CAS retry, fresh due/context), `mismatch` (foreign row →
  stays fenced, manual gate, no projection), `config` (source change → rotated plan wins, request gone), `revoke`
  (automatic off → disarm/cancel, committed due kept, no projection). All: no accept/new run beyond M, lease null.

## Verification (fresh; S3=true arm64, emulator-5590 KlodaCloud18, `deviceLocked=0` before each run)

| Step | APK | Log | Result |
|---|---|---|---|
| headless cold boot | — | `run-red1-blocked.txt` | BLOCKED (credential-locked), not a result |
| red1 (R13 test, HEAD product) | `b60ae9d3…` | `run-s3-automatic-lock-red1.log` | FAIL `R13 RED: stale stop(A)=false owner=IDLE expected=REPLACING` (intended) |
| g1 (stage 1) | `a155a82b…` | `run-s3-automatic-lock-g1.log` | lock PASS |
| g2 (ticket + G13 counterparts) | `de53a157…` | `run-s3-automatic-lock-g2.log`, `run-s3-automatic-os-g2.log` | lock PASS, os PASS |
| red2 (counterparts on stage-1 product) | `c5ca20c3…` | `run-s3-automatic-lock-red2-stage1product.log` | FAIL `R13 inflight new projection: owner=OS_OWNED unresolved=false schedules=3` (ticket needed); product restored, hash OK |
| red-r14 (R14 test, pre-R14 product) | `ca628060…` | `run-s3-automatic-plan-red-r14.log` | FAIL `R14 RED: clockCAS=2 due=1700003720000 R.due=1700003660000` (intended invariant RED) |
| g14 (R14 fix, representative) | `ecf8e938…` | `run-s3-automatic-plan-g14.log` | plan PASS (all groups) |
| g14b (+ R14 counterparts) | `7ab69129…` | `run-s3-automatic-plan-g14b.log` | plan PASS |
| g14c (same sources) | `7ab69129…` | `run-s3-automatic-lock-g14c.log`, `run-s3-automatic-os-g14c.log` | lock PASS, os PASS |

Final product/test sources = `source-final.sha256` = APK `7ab69129…` (lock/plan/os all PASS on it).

## Acceptance mapping (implementer claim; reviewer decides)

| ID | Evidence | Open |
|---|---|---|
| G13 | red1→g1 representative; red2→g2 `inflight` RED→GREEN; `throw`/`success`/`nonce` GREEN on final APK (g14c lock) | `throw/success/nonce` are preservation counterparts (no separate RED); independent review |
| G14 | red-r14 → g14 representative; g14b `rollback/mismatch/config/revoke` + existing `clock` (rollback, unreadable-proof fence/manual gate, reopen, config) GREEN | counterparts preservation-only (no separate RED); independent review |
| GP | g14c lock (R12 capture=0, early-wake, lease/manual fence, interleavings), g14b plan (migration/cleanup/R10/R11), g14c os (real JobScheduler) all PASS | lint NOT_RUN (two-attempt rule); physical keyguard/Doze/natural delivery not covered |

Counters: no new failure in this round (stale-ownership approach: GREEN; clock-proof approach: GREEN first attempt).
Self-review performed in the same session — **not** an independent review. Usage: UNKNOWN (not estimated).

## Independent GPT review — authoritative disposition, 15.11

The table above and the preceding counters are the preserved implementer claim, not acceptance.

| ID | Reviewer evidence / decision | Open |
|---|---|---|
| G13 | final `g14c` lock + red1/red2; ticket retirement/result paths inspected; targeted invariant supported | no new G13 blocker; not whole-goal acceptance |
| G14 | sequential RED→GREEN confirmed, but `review.md` R14-C1 shows parallel settle→NoFence→disarm can rotate committed wake | **BLOCKED**, shared parallel recovery regression NOT_RUN |
| GP | final lock/plan/os reused; source/neighbor review; source and APK hashes verified in `review-integrity.log` | lint NOT_RUN; deferred physical/release gates remain; no full PASS |

- Goal `F1-S3-R13R14`: `[ ]` **not accepted**; parent 1.4b also `[ ]` (FTPS/whole parent outside scoped goal).
- Invariant failures retained: early=1 contract conflict; stale ownership=2 historical rejected rounds
  (targeted G13 GREEN this round); clock-stop=1; migration=1; **clock-proof=2 rejected rounds**
  (previous R14 snapshot proof + this remaining concurrency recovery path). No reset or double-counting as migration.
  This is not evidence that the proposed atomic recovery approach was already attempted twice.
- State **DECISION**, not automatic FIX. Root cause/minimum proposal/contract consistency are in
  `review.md` DECISION. Continue in this GPT chat to finalize the narrow contract before any Opus handoff.
- Reviewer fresh runtime/build/lint tests NOT_RUN; successful unchanged checks reused, not rerun.

### Same-chat design clarification — awaiting implementation approval

[R14-C1 narrow contract](../../../../../plans/f1-r14-c1-atomic-recovery-fix.md) specifies the single
sourceLock section (fresh blocked check → settle → exact proof binding → blocked/owner cleanup)
and two real concurrent reconcile calls with a deterministic after-settle instance observer.
Authority capture and OS calls stay outside. Only Coordinator + existing LockChecks/PlanChecks
support may change; G13 and sequential G14 remain preserved. No implementation or new runtime
evidence yet. DECISION remains until user approves; no automatic Opus FIX or checkbox closure.

### User approval / Opus handoff — current state FIX

15.11.2026, same GPT conversation: user approved the narrow contract and requested Opus handoff records.
The DECISION/design gate is resolved; previous review rejection and evidence statuses are unchanged.
Executable contract: [f1-r14-c1-atomic-recovery-fix.md](../../../../../plans/f1-r14-c1-atomic-recovery-fix.md).
Only Coordinator.unblock + null internal instance observer + existing LockChecks/PlanChecks support;
≤300 lines each, no authority capture/OS inside the recovery critical section. Preserve G13 and sequential G14.

- Next: separate user-started **Opus** session, `/implement`, mode **FIX**, finding **R14-C1**.
- Read CURRENT → latest `review.md` R14-C1/DECISION → this manifest → approved narrow contract.
  Do not restart the original R13/R14 implementation or broaden research.
- Create `r14-c1/` under this round for fresh baseline/round diff/logs and a linked round manifest;
  record actual start HEAD, tracked/staged/untracked scope and dirty-source snapshots before edits.
  Existing `source-final.sha256` is the reviewed product reference, not a substitute for the new baseline.
- First representative: two real concurrent reconcile calls, invariant RED → minimum atomic fix → GREEN.
  Apply execution-budget.md; UNKNOWN usage requires a checkpoint before expansion.
- No new tests/builds were run for this approval. G14 remains OPEN; G13/GP reuse stays explicit.
  Retain invariant counters and deferred gates above. Opus ends at REVIEW, leaves both checkboxes open;
  separate GPT review owns acceptance/administrative closeout. No commit/push.

## Current independent closeout — supersedes earlier pending/rejected dispositions

- [x] Goal **F1-S3-R13R14**: G13 accepted with final C1 lock evidence and unchanged ticket paths;
  G14 accepted after deterministic parallel recovery RED→GREEN plus sequential counterparts;
  GP accepted with affected C1 plan/lock evidence and source review. See `r14-c1/review.md` for mapping.
- R14-C1 blocker closed; `blockedAttempt === attempt` cleanup is scoped/appropriate.
  No dedicated identity-mismatch runtime test or fresh C1 OS/lint PASS is claimed.
- Final C1 source/APK integrity verified; prior round source/OS evidence remains version-scoped.
  Historical clock-proof rejected rounds=2 preserved; atomic attempt 1 accepted, no counter reset.
- Earlier sections are history, not current FIX authorization. No product code edited by reviewer.
  Upper F1/FTPS and deferred physical/production/Faz3–4/B4/P5 gates remain open; no full PASS.
