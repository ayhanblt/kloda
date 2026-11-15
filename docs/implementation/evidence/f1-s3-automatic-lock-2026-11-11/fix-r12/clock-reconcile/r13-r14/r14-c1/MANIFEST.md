# F1 S3 — R14-C1 atomic plan-proof recovery (Opus, 15.11.2026)

Status: **ACCEPTED — independent GPT review, 15.11.2026.** Scoped goal F1-S3-R13R14 `[x]`; upper 1.4b/F1 remains `[ ]`.
Contract: [f1-r14-c1-atomic-recovery-fix.md](../../../../../../plans/f1-r14-c1-atomic-recovery-fix.md) (READY/FIX).
Latest review: [review.md](review.md) (GPT-6.1 Sol, separate from Opus implementation).
Previous finding: [../review.md](../review.md) R14-C1. Parent manifest: [../MANIFEST.md](../MANIFEST.md).
Implemented in the user-instructed continuation of the earlier Opus chat (user: "review … current'a yazıldı, oku ve uygula").

## Start / diff scope

- HEAD `f26e425dd808daf206ee7bd8ec6fe9402fbd1119`; staged empty at start/end (`baseline/staged.txt`, `staged-final.txt`).
- `baseline/`: `head.txt`, `status.txt`, `pre.sha256` (== `../source-final.sha256`, verified), `*.pre` copies,
  `accumulated-r13-r14.diff` (prior round vs HEAD — not owned by this fix).
- This fix only: `round-c1.diff` (baseline `.pre` → final). 3 files: Coordinator, LockChecks, PlanChecks.
  Plan.kt/OsChecks unchanged. Hashes `source-final.sha256`; lines `lines-final.txt`: Coordinator 299, Plan 179,
  LockChecks 300, PlanChecks 293, OsChecks 85. No new file/schema/ABI/dependency.

## Change

- Coordinator `unblock()`: plan-proof branch is one `sourceLock` section — `blocked`/`blockedAttempt` read inside the
  monitor; `settle` + observer + exact request/epoch/old-new binding (ClockCommitted only) + NoFence/MigrationSettled
  disarm (unchanged rule) + success cleanup (`clear()`), then release. Exception: no cleanup (unchanged).
  Admission-attempt branch: `resolveAutomatic` still outside the monitor, unchanged; cleanup now applied only if
  `blockedAttempt === attempt` (contract §2 "mevcut kimliğe") — **reviewer note: lock scope covers it, NOT_RUN here**.
- Seam: `@Volatile internal var afterPlanSettleForTest: ((S3Settle) -> Unit)?` (null in production), invoked right after
  settle, before binding/cleanup; decides nothing.
- Test: `S3TestBoundary.clocks` counts real `AndroidS3AutomaticPlan.clock` commit phases (stack frame). PlanChecks
  `committed` gains mode `parallel` (first) via `race()`: T1 real reconcile parks in the observer on ClockCommitted
  (records `holdsLock`); T2 second real reconcile; held → T2 must be BLOCKED with top kloda frame `unblock` (bounded
  yield observation); not held → T2 joins first. Release, bounded joins, worker errors surfaced, observer cleared in
  finally; then pump. Same expectation as `commit`. All modes now assert counter (setup 1; recovery +0, rollback +1)
  instead of the due-derived label; commit/rollback/parallel also cancels=0.

## Verification (fresh; S3=true arm64, emulator-5590, `deviceLocked=0`)

| Step | APK | Log | Result |
|---|---|---|---|
| red-c1 (seam+test, pre-fix product) | `e6629d71…` | `run-s3-automatic-plan-red-c1.log` | FAIL `R14 RED parallel: clockCAS=1 expected=1 due=…660000 expected=…660000 wake=5b03…≠6c58…` — wake rotated (NoFence→disarm→arm), intended invariant RED |
| g-c1 (atomic fix) | `02488fa5…` | `run-s3-automatic-plan-g-c1.log` | plan PASS: parallel + commit/rollback/mismatch/config/revoke + existing clock/migration/fence/NoFence groups |

| g-c1-lock (same final sources, hash-verified) | `02488fa5…` | `run-s3-automatic-lock-g-c1-lock.log` | lock PASS: representative + interleavings (incl. G13 stale throw/success/nonce/inflight, attempt storage fence) |

NOT_RUN: `s3-automatic-os` (unchanged OsChecks; Coordinator change in unblock only; not requested). Lint NOT_RUN (two-attempt rule).
Reused, not fresh: G13 lock/os PASS from `../` (APK `7ab69129…`, prior sources).

## Mapping

| ID | Evidence | Open |
|---|---|---|
| G14 (R14-C1) | red-c1 → g-c1 `parallel`; sequential modes GREEN in g-c1 | independent review |
| G13 | fresh g-c1-lock `stale` modes PASS on final sources; RED history reused from `../` (red1/red2) | independent review |
| GP | g-c1 plan (fence/rollback/migration/NoFence/config/revoke) + g-c1-lock (attempt fence, early-wake, lease/manual) | os NOT_RUN (reused `../` g14c, prior sources); lint; physical gates |

Counters: clock-proof atomic approach attempt 1 GREEN; no new failure; no reset. Self-review same-session, not independent.

## Independent GPT disposition — authoritative closeout

- [x] **F1-S3-R13R14** scoped goal: G14 parallel + sequential evidence, G13 final lock evidence,
  GP affected fence/lease/manual/migration/config/revoke evidence and source review accepted.
  The table above is the preserved implementer handoff; its independent-review gates are now satisfied.
- `review.md` documents actual diff/HEAD/source/APK integrity and the single recovery critical section.
  `blockedAttempt === attempt` cleanup accepted by source/queue-caller review; dedicated identity-mismatch
  runtime test NOT_RUN, not falsely reported PASS. Genuine NoFence disarm source preservation noted separately.
- Fresh reviewer work: static/diff/hash/log verification in `review-integrity.log`; runtime evidence reused
  from this Opus round. Reviewer new build/runtime/lint NOT_RUN. OS reused from prior sources, not a fresh C1 run.
- G14/R14-C1 blocker closed. Clock-proof family retains 2 historical rejected rounds; atomic approach
  attempt 1 GREEN/accepted. Other invariant counters and all deferred gates above remain unchanged.
- Baseline CURRENT snapshot absent: administrative provenance limitation only; product baseline/diff verified.
- Upper 1.4b/F1, FTPS, physical/production, Faz3–4/B4/P5 remain open. No full-product PASS, no commit/push.
- Next separate GPT **plan**, not Opus administrative closeout:
  `CURRENT'tan başlayarak üst 1.4b/F1 için kalan FTPS kapsamını ve açık kabul kapılarını ayıran dar GPT planını hazırla; ürün kodunu değiştirme.`
