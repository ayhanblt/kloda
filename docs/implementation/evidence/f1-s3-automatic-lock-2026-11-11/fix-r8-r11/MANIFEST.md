# F1 S3 — R8–R11 scoped fix round (Opus, 12.11.2026)

Status: **uygulandı; bağımsız GPT review bekliyor.** Not accepted, 1.4b stays `[ ]`.
Review sonrası güncel durum (12.11): **FIX / kabul edilmedi**;
[bağımsız GPT review](review.md). R8–R11 hedefleri karşılanıyor; komşu erken-wake
invariant'ı R12 açık (foreground dirty → eligibleAt öncesi capture). Güncel gerçek
diff/hash/APK kontrolü `review-integrity.log`; scope status `review-status.txt`.
Sonraki scoped uygulama komutu `/implement`; ilk adım review'daki R12 regression'ı.
Findings/acceptance source: [../fix-r1-r7/review.md](../fix-r1-r7/review.md). Plan:
[next-plan.md](../../../plans/next-plan.md) §7 boundary (11 files), unchanged.

## Start / scope

- Start HEAD `650ec17f300ebdeee804bd4218f5b57356eecb21` (`baseline/head.txt`, `head-after.txt`
  identical). Nothing committed or staged (`baseline/staged.txt`, `staged-after.txt` empty).
- Start state: all 11 hashes matched `../fix-r1-r7/final-sources.sha256`; the tracked 6-file
  diff matched `../tracked-scope.diff` (`baseline/tracked-scope-start.diff`, `baseline/*.pre`).
- Changed this round (5 of 11, `round-hash-compare.txt`):
  - product: `AndroidS3AutomaticCoordinator.kt` (untracked), `AndroidS3AutomaticPlan.kt`
    (untracked), `AndroidS3Queue.kt` (**tracked**, new 6-file diff in `tracked-scope-after.diff`);
  - test: `AndroidS3AutomaticPlanChecks.kt`, `AndroidAutomaticLockChecks.kt` (both untracked).
- Unchanged this round: Automatic.kt, Runtime.kt, AutomaticChecks, OsChecks, runner, test manifest.
- Round diffs: `round-product.diff`, `round-test.diff`. Final hashes: `final-sources.sha256`.
  Line counts (`line-counts.txt`, nonblank/noncomment): Coordinator 297, Plan 154, Queue 191,
  PlanChecks 224, LockChecks 300, runner 300 — all ≤ 300.
- No new file in product/test, schema column, ABI, dependency, build config or policy.
- Pre-existing unrelated dirty files (not touched): FTPS/SFTP/SMB Kotlin/Swift modules, JS
  file-transfer/api + specs, `packages/ftps-native/*`, AGENTS.md, CURRENT.md (closeout only).
  `status-after.txt` vs `baseline/status.txt` differs only by two untracked docs created outside
  this round: `evidence/opus-usage-audit-2026-11-12.md`, `evidence/workflow-root-cause-2026-11-12.md`.

## Invariant → change → assertion (fix tracking by invariant)

| ID | Invariant | Change | Assertion (RED → GREEN) |
|---|---|---|---|
| R8 | A stale/legacy envelope never alters owner/epoch/unresolved/exec state | `install(e,p,legacyOk)`: `wake==null` requires `legacyCurrent` (no marker; protocol null, or 0 with wake == snapshot); else `finish(false)` only. `onStop` legacy retry gated by same check | PlanChecks `stale()`; mutation `red-r8-mutation.diff` → "R8 backoff ownership changed by a stale envelope" (PlanChecks.kt:227) |
| R9 | A clock fold committed before stop is projected exactly once, never lost | `fold(e,p)` under sourceLock, only `!halted(e)` and unlocked, sets `e.carry`; `onStop` relays carry wake when ≠ `e.wake` and == `planWake` (REPLACING, returns false, schedules revised wake); old envelope not retried | LockChecks `fold()` (a) backoff, (b) completion; baseline → "R9 completion revised plan lost" (`run-s3-automatic-lock-red1.log`) |
| R10 | Unresolved migration proof blocks manual + automatic starts and `status.canRun` | Queue `attach(plan)` (instance-bound, journal identity checked) + `blocked()` used in `start`, `startAutomatic`, `status`; Coordinator init attaches | PlanChecks `fence()`; baseline → fail PlanChecks.kt:184 (`run-s3-automatic-plan-red1.log`) |
| R11 | A marker with a mismatched plan is a storage gate, never a bypass | `migrate`: mismatched marker → `uncertain = Uncertain(plan)`; only proven absence throws unfenced; `settle` still rejects mismatch | PlanChecks `mismatch()`; mutation `red-r11-mutation.diff` → "R11 mismatch not fenced" (PlanChecks.kt:203) |

Failed fix attempts this round: 0 per invariant (all failures were intended RED). Green
sources restored after each mutation and verified against `green-src/`.

Review-maintained cumulative invariant history (no reset by finding ID/session):

| Invariant family | Earlier failed scoped round | This round / carry-forward |
|---|---|---|
| stale ownership | fix-r1-r7 R1 partial → R8: 1 | R8 target verified; historical 1 retained |
| OS handoff / clock-stop | fix-r1-r7 R3 partial → R9: 1 | R9 reported stop interval verified; historical 1 retained |
| migration proof/storage fence | fix-r1-r7 R5 partial → R10/R11: 1 round, not two | R10/R11 verified; historical 1 retained |
| early eligibleAt/capture | no recorded targeted fix | R12 first discovered residual in dirty fold; targeted failed fixes 0 |

R12 is not a renumbering/reset of R9's stop interval: it is the adjacent admission
entry guard, already required by approved §6.1/§8.2. Two failed fixes of the same
approach require CURRENT=DECISION and GPT design reassessment, not automatic FIX.
The six GREEN scopes below do not prove the missing R12 capture assertion.

## Commands (fresh, emulator-5590 KlodaCloud18 API 35, keyguard open)

- Build (from `apps/mobile/android`): `./gradlew :my-module:compileDebugKotlin
  :my-module:assembleDebugAndroidTest -PklodaS3Native=true -PreactNativeArchitectures=arm64-v8a
  --console=plain` → `build-<tag>.log`, `apk-sha256-<tag>.txt`, `install-<tag>.log`.
- Run: `adb -s emulator-5590 shell am instrument -w -r -e scope <scope>
  com.kloda.sync.test/com.kloda.sync.AndroidFilesQueueRecoveryInstrumentation` → `run-<scope>-<tag>.log`.
- RED: `red1` (baseline product), `red-r11`, `red-r8` (mutations) — fail as intended.
- GREEN `g1` (APK `3613ed1a…`): `s3-automatic-plan`, `-lock`, `-os`, `-contract`, `s3-pause`,
  `s3-global-pause` all PASS, INSTRUMENTATION_CODE -1 (×6). All 5 changed sources have mtimes
  before `build-g1.log`; final hashes equal the g1 build input. No leftover job 2712.

## Reused / NOT_RUN / open gates

- Reused (not re-run): `../red/` and `../fix-r1-r7/` earlier evidence for unchanged paths.
- Lint NOT_RUN: react-native-worklets lint crash, two attempts already used; no third.
- Review: same-session self-review only (Coordinator/Plan/Queue hunks); **not** independent.
- In-memory fences (Unresolved/StorageBlocked/migration `uncertain`) reset on process restart;
  recovery then relies on recover + exact CAS (unchanged design note).
- Faz 3/4 physical: real keyguard/vault, Doze, reboot, natural delivery timing.
- FTPS F1 separate plan; B4/P5 unchanged. S3 acceptance alone does not close 1.4b.
