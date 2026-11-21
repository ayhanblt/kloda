# Backlog 2.4 / D24 — evidence manifest (INITIAL, 18.11.2026)

Contract: [next-plan §2.4](../../plans/next-plan.md) G24-01…07 (not redefined here).
Research: [2.4 research](../../plans/2.4-clarity-diagnostics-research.md).
State: **REVIEW / ACCEPTED — INITIAL + FIX-R1 + FIX-R1b: 2.4 development goal closed.**
Review: [review.md §FIX-R1b closure](review.md#fix-r1b-devam-reviewu-ve-kapanış--18112026).
G24-R1 RESOLVED; G24-07 visual user-deferred to Faz3 / NOT_RUN. Not a full product PASS.
Counters: INITIAL ret=1, failed FIX=1 (stale ownership: FIX-R1 rejected once;
visual evidence: user-deferred gate, not a failed FIX). Token/usage UNKNOWN.

## Start / scope
- Start HEAD `508b3f0486a7ce04628ec0c3681d995573e5721d`; pre-existing dirty tree (2.2/2.3/F1/process)
  captured in `baseline/status.txt`; staged empty. Baseline file copies + `baseline/source.sha256`
  (29 files, matched the plan's HEAD-EQUAL record). 2.4 delta is measured against those copies, not HEAD.
- INITIAL code delta: `code-2.4-delta.diff` (baseline→INITIAL + 7 new files).
  Subsequent deltas: `fix-r1.diff`, `fix-r1b.diff`. Locale delta: `locale-2.4-delta.diff`.
- Changed code file list: `changed-code-files.txt`; final hashes `final-code.sha256`,
  locales `logs/locale-final-sonnet.sha256` (re-verified equal at closeout).
- Unchanged vs baseline (verified `cmp`): `preload.cts`, `webdav-connection-test.ts`, `webdav-errors.spec.ts`,
  `webdav.spec.ts`, desktop `PairingPage.tsx`, mobile `activity-page.tsx`, `webdav-settings.ts`.
  `electron/runtime/types.ts` and `preload.cts` == HEAD (runtime `testStorage(): Promise<void>` unchanged).
- Not touched: retry/deadline/fence/cleanup ordering, persistent profile schema, native ABI, normal upload `request()`.

## Implementation summary
- Mobile: `webdav-diagnostics.ts` module-private WeakMap metadata (`webDavFailure`/`webDavDiagnostic`/
  `safeWebDavDiagnostic`); Error keeps only its message code; cancellation never carries metadata.
  `webdav.ts` tags each real request/readback boundary. `use-backup-setup.ts` RAM-only `storageDiagnostic`
  bound to the current test version; cleared on edit/new test/leave/background. `webdav-page.tsx` hints +
  `accessibilityHint` + diagnostic alert. `pairing-modal.tsx` shows `pairing.repairWorking` while a repair
  approve/deny is in flight.
- Desktop main: `WebDavFailure.diagnostic?` + `atStage` (same code/message/cause); probe-only stage tracking in
  `verifyWriteAccess`/`cleanupProbe`. New `webdav-test-result.ts::storageTestReply` → `{ok:true}` |
  `{ok:false,code,diagnostic?}` rebuilt from the allowlist; `main.ts` `kloda:test-storage` wraps it inside the
  existing trusted-sender `handle`.
- Desktop renderer: new `shared/api/webdav-test-result.ts` (unknown-payload parser; success only `ok===true`;
  code/stage/kind/status 100–599 allowlist; reason-key map 401/403/404/405/other). `desktop.ts` renderer type
  `testStorage(): Promise<unknown>`. `BackupSetup.tsx`: `testErrors.{code}` + version-bound diagnostic (cleared on
  edit/new test/back), endpoint/targetPath hints via `aria-describedby`, security hint; all catches use the
  existing localized fallbacks (load/select/schedule/test/start) instead of raw `reason.message`.
- Locales (single writer Sonnet, session `ses_e129e239effe2MCWHogys2ysam`): pairing repair/repairWorking/
  consequences, transfer `os_interrupted`/`webdav_auth`, `onboarding.webdavHints.*`, `webdavDiagnostic.*`,
  desktop `testErrors.*`. Opus did not edit locale files.

## Acceptance → evidence (all FRESH this session unless marked)
| ID | Evidence | Status |
|---|---|---|
| G24-01 | mobile `pairing-page.spec.tsx` (repair idle vs in-flight, TR/EN/DE); desktop `PairingPage.spec.tsx` repair copy TR/EN/DE; logs `logs/g24-mobile-changed.log`, `logs/g24-desktop-renderer.log` | GREEN |
| G24-02 | mobile `App.spec.tsx` G24-02/05 (hints, a11y hint, TR/EN/DE); desktop `BackupSetup.spec.tsx` (accessible descriptions, port/path `https://fixture.example:8083/webdav/` reaches `saveStorage` unchanged) | GREEN |
| G24-03 | `logs/g24-03-red.log` (RED: diagnostic undefined) → `logs/g24-03-green.log` 28/28; tsc `logs/tsc-mobile-{baseline,red,g24-03}.log` exit 0 (REUSED from earlier in this INITIAL) | GREEN |
| G24-04 | mobile `webdav-settings.spec.ts`+`webdav-diagnostics.spec.ts` 37/37 (`logs/g24-04-06-mobile-api.log`, REUSED); desktop RED `logs/g24-desktop-red.log` 15/15 failing → GREEN `logs/g24-desktop-green.log` 77/77 (5 files incl. existing webdav/connection-test/storage-settings) | GREEN |
| G24-05 | mobile `App.spec.tsx` (edit clears, stale B form, background) ; desktop `BackupSetup.spec.tsx` stale storageVersion + edit clears | GREEN |
| G24-06 | desktop projection/forged diagnostic (`webdav-test-result.spec.ts`), renderer parser (`webdav-test-result.spec.tsx`), BackupSetup void/malformed reply not success + raw-message sentinel on load/select/schedule/save/start catches; mobile sentinel tests | GREEN |
| G24-07 | mobile `activity-automatic.spec.tsx` os_interrupted vs webdav_auth TR/EN/DE; locale parity (below); scoped lint/tsc/build | render/a11y GREEN; **visual comparison BLOCKED / NOT_RUN** |

Full suites/regressions (FRESH): desktop all vitest 34 files / 369 tests (`logs/g24-desktop-full-vitest.log`);
mobile changed specs 6 suites / 84 tests (`logs/g24-mobile-changed.log`, includes `settings-page.spec.tsx`).
Mobile full jest suite NOT_RUN (scope-limited per plan).

## Static checks
- mobile `tsc --noEmit -p apps/mobile/tsconfig.json` exit 0 (`logs/tsc-mobile-final.log`).
- desktop main `tsc -p tsconfig.main.json` exit 0 (`logs/tsc-desktop-main.log`).
- desktop renderer `tsc -p tsconfig.json` exit 2 (`logs/tsc-desktop-renderer.log`): only TS2882 CSS side-effect
  imports in `src/app/entry.tsx` and `src/pages/pairing/PairingPage.tsx`, both unchanged by 2.4 (same files ==
  baseline). Presumed pre-existing; not re-run at HEAD, so this is not claimed as a HEAD-proven baseline.
- ESLint on 22 changed code files exit 0 (`logs/eslint-final.log`); 300-line max-lines rule enforced there;
  largest file 288 non-blank/non-comment lines (desktop `PairingPage.spec.tsx`).
- `git diff --check` exit 0 (`logs/diff-check-final.log`).
- desktop `vite build` exit 0 (`logs/vite-build.log`); mobile `expo export` ios/android exit 0
  (`logs/expo-export-{ios,android}.log`). Build outputs were written under this dir and deleted afterwards.
- Locale parity: plan command exit 1 on pre-existing `ui.hub.gapsList` (null-list, present at HEAD)
  `logs/locale-parity-sonnet.log`; list/null-aware variant exit 0 (mobile 706, desktop 433 leaves)
  `logs/locale-parity-opus-lists.log`. Locale hashes unchanged since → REUSED.

## Deviations (for review)
1. Locale parity command variant (above); pre-existing `gapsList` mismatch not fixed (out of scope).
2. Renderer parser spec is `src/shared/api/webdav-test-result.spec.tsx` (plan said `.spec.ts`): desktop
   `vitest.config.ts` includes only `src/**/*.spec.tsx`; config unchanged.
3. Desktop start failure renders through existing `WebDavActivity`, which already shows the generic
   `activity.errors.unknown` alert; BackupSetup now passes `onboarding.startError` instead of the raw message.
4. Mobile App spec: new test uses awaited `act` for AppState listeners and no explicit `unmount()`; an
   unawaited act left later App tests rendering null (diagnosed by bisection; `logs/g24-mobile-app.log` is
   that superseded intermediate failure, not current evidence).
5. Desktop G24 renderer tests were written alongside the implementation; no separate renderer RED log.

## Open gates (unchanged / visible)
- **G24-07 visual:** no ready isolated capture path for the WebDAV form / pairing repair screens
  (`tools/capture-android-connections.py` covers only Connections on a specific owned emulator).
  **18.11 same GPT review session user decision: Faz3 DEFERRED / NOT_RUN**, after 2.5
  capture preparation. Only the visual closure gate is superseded; not a visual PASS or a waiver of G24-05.
- F1 fix2 Faz3 DEFERRED / NOT_RUN; G1-07 and G456-07 visual Faz3 DEFERRED; Faz3–4/step19 physical,
  OS/native/release gates open. Physical Desktop/mobile WebDAV field behavior not exercised.

## INITIAL bağımsız GPT review — 18.11.2026

- **REJECTED / FIX; checkbox açık.** [review.md §Bulgular](review.md#bulgular):
  **G24-R1 / G24-05 / stale ownership** — Desktop Back/retained hide test version'ını
  geçersizleştirmiyor; late failure diagnostic'i geri geliyor, late success Start'ı açıyor.
  Reviewer `review-probe.spec.tsx` **3/3 RED**, `review-probe.log`; ilk INITIAL bulgu,
  başarısız FIX değil. Scoped FIX mevcut Opus sohbetinde; receiver/runtime/retry değişimi yok.
- G24-01/03/04/06 kanıtları REUSE ve statik denetim; G24-02 portlu ilk gerçek probe URL'si
  reviewer `review-endpoint.spec.tsx` ile **2/2 taze GREEN**, `review-endpoint.log`.
  G24-05'in yukarıdaki uygulama GREEN kaydı yalnız o testlerin sonucu; bütün satır kabulü değil.
  G24-07 **G24-V1 visual BLOCKED / NOT_RUN**: kullanıcı kararı aynı GPT sohbetinde,
  otomatik Faz3 ertelemesi yok; goal kapatılamaz.
- 29/29 baseline, 22/22 final code, 6/6 locale hash; exact hunk replay 28/28:
  `review-audit.txt`. Staged boş, aynı HEAD `508b3f0`. Ürün kodu reviewer tarafından değiştirilmedi.
- Renderer tsc exit2 başlangıç snapshot'ında da yalnız aynı iki TS2882:
  `review-renderer-baseline.log`. Önceki “presumed” notu bu taze karşıtla açıklığa kavuştu;
  tam renderer typecheck PASS değil, 2.4'ün getirdiği yeni teşhis yok.
- INITIAL ret=1, failed FIX=0; mevcut geçerli GREEN suite/lint/build/export tekrarlanmadı.
  Tek sonraki kapsam G24-R1 scoped FIX; sonucu bu aynı GPT review sohbetinde değerlendir.

## FIX-R1 (G24-R1 / G24-05 / stale ownership) — 18.11.2026, same Opus implementation role

State: **REVIEW-READY / unchecked — awaiting the same GPT review session.** Failed FIX for this invariant: 0.
- Root cause (confirmed in source, then reproduced): `BackupSetup` fenced a pending test only on
  `storageVersion`, which advanced only on edit or a new test. Back (`setStep('sources')`), retained hide
  (`App.tsx` keeps the component mounted, `visible=false`) and unmount did not end ownership.
- Fix (renderer state only, `BackupSetup.tsx`): `releaseStorageTest()` advances `storageVersion` and clears
  the shown diagnostic. It is called by Back and by a `visible=false` effect; unmount advances the version.
  The runtime test, the retained receiver, IPC/preload/native ABI, profile, retry/deadline/journal and the
  pairing fence are unchanged. Edit, new-test, fresh-success and malformed/secret fallback paths are unchanged.
- Exact delta: `fix-r1.diff` (2 files; the pre-FIX reconstruction matched the INITIAL `final-code.sha256`).
  Final hashes are in `logs/g24-r1-final.sha256`.
- Regression in the production spec `BackupSetup.spec.tsx` §G24-R1 (5 tests): Back→late failure (sources +
  reopen), Back→late success keeps Start disabled, retained hide→late failure/success→reopen, and hiding
  clears a shown diagnostic while a fresh test after reopen still reports. **RED 5/5** `logs/g24-r1-red.log`
  (state assertions) → **GREEN 12/12** `logs/g24-r1-green.log`. Reviewer `review-probe.spec.tsx`
  3/3 GREEN, `logs/g24-r1-reviewer-probe-green.log`.
- Affected callers: full desktop vitest 34 files / **374** tests GREEN, `logs/g24-r1-desktop-full-vitest.log`.
  This includes App/ReceiverFlow/DesktopBackground, which retain BackupSetup and keep form values on route return.
  Scoped ESLint exit 0 (`logs/g24-r1-eslint.log`; 155/157 counted lines). `vite build` exit 0 to a temp dir
  that was then deleted (`logs/g24-r1-vite-build.log`). `git diff --check` exit 0. Renderer tsc exit 2 with
  only the same two baseline TS2882 errors (`logs/g24-r1-tsc-desktop-renderer.log`; baseline proven in
  `review-renderer-baseline.log`).
- REUSED (not affected by this diff): all mobile, desktop main/IPC/parser, locale, tsc-main and export evidence.
- Note for review: a test error *message* already shown before hiding stays visible after reopen, which is
  the existing behavior. Only the diagnostic detail is cleared, as the finding requested. A late reply never
  sets either one.
- G24-V1 / G24-07 visual: still BLOCKED / NOT_RUN; user decision in the GPT session.

## FIX-R1 bağımsız GPT devam reviewu — 18.11.2026

- **REJECTED / FIX, unchecked.** [Review §FIX-R1](review.md#fix-r1-devam-reviewu--18112026).
  Back/visible=false/unmount çözümü kaynak+mevcut GREEN ile doğrulandı; bütün G24-R1 kabulü değil.
- **G24-R1 / G24-05 / stale ownership — kalan komşu yol:** backup→jobs→backup
  `visible=true` kalırken yalnız `showActivity` değişiyor; release çalışmadığından
  late failure diagnostic'i Sources'a taşıyor, late success Start'ı açıyor.
  Yer: `BackupSetup.tsx:22–27,34–37,103–108`; gerçek çağıran `App.tsx:63,81`.
  Reviewer `review-fix-r1-neighbor.spec.tsx` **2/2 RED**,
  `review-fix-r1-neighbor.log`; yeni goal/beklenti değil, aynı leave invariant'ı.
- 2/2 final FIX hash + reverse diff→INITIAL 2/2; etkilenmeyen code 20/20 ve locale 6/6:
  `review-fix-r1-audit.txt`. HEAD aynı, staged boş. Reviewer ürün kodu değiştirmedi.
  RED5→GREEN12, reviewer-probe3, desktop374/lint/build kanıtı REUSE; tekrar koşulmadı.
  Renderer tsc baseline exit2 korunur.
- Sayaç: INITIAL ret=1; **stale ownership failed FIX=1** (FIX-R1). İki assertion iki deneme
  sayılmaz; sonraki aynı-invariant ret ikinci başarısız FIX olur ve GPT tasarım değerlendirmesi gerektirir.
- **G24-V1 / G24-07:** kullanıcı aynı GPT sohbetinde **Faz3'e ertelemeyi açıkça onayladı**.
  Görsel TR/EN/DE/light-dark/büyük yazı karşılaştırması 2.5 hazırlığı sonrası
  **DEFERRED / NOT_RUN**; artık geliştirme kapanış engeli değil, görsel PASS değil.
  Bu karar G24-R1'i veya başka kabul koşulunu kaldırmaz.
- Tek sonraki uygulama mevcut Opus sohbetinde G24-R1 kalan showActivity yolu
  için scoped FIX; yeni diff/kanıt bu GPT sohbetinde değerlendirilir.

## FIX-R1b (G24-R1 remaining jobs path / G24-05 / stale ownership) — 18.11.2026, same Opus role

State: **REVIEW-READY / unchecked — awaiting the same GPT review session.** Counter: stale-ownership failed
FIX=1 (FIX-R1). If this is rejected on the same invariant, it is the second failed FIX and goes to GPT design
reassessment, not to a third FIX.
- Root cause (reviewer path confirmed): FIX-R1 enumerated triggers (Back and `visible=false`). The backup→jobs
  route keeps `visible=true` and only changes `showActivity`→`step='activity'`, so no release ran.
- Fix (renderer only, `BackupSetup.tsx`): the enumerated triggers are replaced by a single boundary.
  `storagePresented = visible && step === 'storage'`; a `useLayoutEffect` advances `storageVersion` and clears
  the diagnostic whenever it becomes false. That covers Back, jobs/activity, start→activity and hide; unmount
  still advances the version. Layout timing means no late IPC continuation runs between the commit and the release.
  Every `step`/`visible` change away from storage goes through this boundary (sources←Back, activity←
  showActivity/startSync). No other leave path exists in the component.
- Unchanged: edit/new-test/fresh success, form values, the existing general error message, the runtime test and
  retained receiver, retry/deadline/profile/journal/IPC/native ABI, the pairing fence.
- Exact delta: `fix-r1b.diff` (pre-FIX2 reconstruction matched `logs/g24-r1-final.sha256` 2/2). Final hashes are
  in `logs/g24-r1-fix2-final.sha256`.
- Regression in the production `BackupSetup.spec.tsx` §G24-R1 (+3): backup→jobs→backup with a late failure or
  success (sources + reopened form, Start disabled), and a shown diagnostic cleared across jobs while form
  values are kept and a fresh test still reports. **RED 3/3** `logs/g24-r1-fix2-red.log` → **GREEN 15/15**
  `logs/g24-r1-fix2-green.log`. Reviewer probes (`review-probe` 3 + `review-fix-r1-neighbor` 2) **5/5 GREEN**,
  `logs/g24-r1-fix2-reviewer-probes.log`.
- Affected callers: full desktop vitest 34 files / **377** GREEN, `logs/g24-r1-fix2-desktop-full-vitest.log`.
  Scoped ESLint exit 0 (`logs/g24-r1-fix2-eslint.log`; 159/188 counted lines). Vite build exit 0 to a temp dir
  that was then deleted. `git diff --check` exit 0. Renderer tsc exit 2 with only the two baseline TS2882 errors
  (`logs/g24-r1-fix2-tsc-desktop-renderer.log`).
- REUSED (not affected): mobile, desktop main/IPC/parser, locale, exports.
- G24-07 visual: Faz3 DEFERRED / NOT_RUN per the user decision recorded in review §FIX-R1; no longer a blocker.

## FIX-R1b bağımsız GPT kapanışı — 18.11.2026

- **ACCEPTED — yalnız 2.4/D24 geliştirme goal'u. G24-R1 RESOLVED.**
  [Son review](review.md#fix-r1b-devam-reviewu-ve-kapanış--18112026);
  reviewer GPT-6.1 Sol (`openai/gpt-6.1-sol`), aynı bağımsız GPT review sohbeti.
  Session UUID UNKNOWN; ürün kodu değiştirilmedi. Self-review kabulü değil.
- G24-01/02/03/04/06 önceki test/source eşlemesi geçerli ve REUSE;
  **G24-05** tek sunum sınırı + RED3→GREEN15 / reviewer5 / desktop377 ile karşılandı.
  **G24-07** render/a11y ve ilgili kontroller REUSE; visual 18.11 açık kullanıcı
  kararıyla **Faz3 DEFERRED / NOT_RUN**, görsel PASS değil.
- 2/2 FIX-R1b final hash; reverse exact diff→FIX-R1 2/2; etkilenmeyen
  INITIAL code 20/20 ve locale 6/6 taze eşit. Önceki baseline zinciri reuse:
  `review-fix-r1b-audit.txt`, `review-fix-r1b-status.txt`.
  HEAD `508b3f0486a7ce04628ec0c3681d995573e5721d`, staged boş;
  iki dosya M/?? aidiyeti önceki kayıtla ayrıldı.
- Uygulayıcı logları `logs/g24-r1-fix2-*`: regression15/reviewer5/desktop377,
  scoped ESLint/Vite build GREEN REUSE; reviewer yeni test/build/lint NOT_RUN.
  Renderer tsc exit2 iki başlangıç CSS TS2882 ile aynı; genel tsc PASS değil.
  Runtime/ABI/retry HEAD-EQUAL, normal/hata/recovery sunum yolları korundu.
- Engelleyici/isteğe bağlı yeni bulgu yok. INITIAL ret=1; stale ownership failed FIX=1
  (FIX-R1); FIX-R1b kabul edildi, sayaç sıfırlanmadı.
- CURRENT 2.4 [x] aynı reviewer tarafından kapatıldı. G24-07/Faz3–4/F1/step19/
  gerçek OS/native/provider/signing/storage/release/fiziksel kapılar açık.
  Sıradaki ayrı iş yeni GPT plan sohbetinde **2.5**; burada başlatılmadı. Commit/push yok.
