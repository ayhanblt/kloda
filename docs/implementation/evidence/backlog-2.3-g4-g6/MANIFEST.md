# 2.3/G4–G6 — D-G456 evidence manifest

Contract: [next-plan §2.3](../../plans/next-plan.md#23g4g6--native-free-m13-ve-kapsam-eşlemesi--18112026) (single goal, G456-01–07).
Mode **REVIEW / ACCEPTED**, 18.11.2026 — INITIAL bağımsız GPT geliştirme kabulü.
- [x] **2.3/G4–G6 geliştirme goal'u** — G456-01–06 ve G456-07 render/a11y karşılandı;
  G456-07 görsel Faz3 **DEFERRED / NOT_RUN**, tam ürün/görsel PASS değil.
Start HEAD `508b3f0486a7ce04628ec0c3681d995573e5721d`, staged empty.
Baseline: `baseline/` (status, CURRENT/next-plan/research start copies, CURRENT diff vs HEAD, target
file HEAD blob + SHA256). All product target files were clean at HEAD, so `git diff` against HEAD reproduces them.
The dirty Desktop 2.2, process and F1 files at the start are not part of this work.

## Diff scope (this work)
- Tracked M: `apps/mobile/src/pages/settings/ui/settings-page.tsx`, `apps/mobile/src/shared/i18n/locales/{tr,en,de}.json`,
  `docs/ui/lovable-design-reference.md` (§M13 / D10 / G6), `docs/implementation/CURRENT.md` (status only).
- Untracked new: `apps/mobile/src/shared/config/app-version.ts`, `apps/mobile/src/pages/settings/ui/settings-page.spec.tsx`,
  this evidence directory. Final hashes for the 6 product files: `sonnet/source-final.sha256` (Opus re-verified 6/6 OK).
- Not in the diff: App.tsx, SourcePage, Activity, API, theme, native, app.json, Desktop. 59 non-blank lines in the page and 92 in the spec, both under the 300-line limit; ESLint max-lines passes.

## Delegation
Sonnet 5.5 (`claude-agent/sonnet`), session `ses_e1466c11bffeHKmpXbUlPCmurW`, single writer of the 6 allowlisted
files; handoff `sonnet/HANDOFF.md`. Opus wrote the doc mapping, caller check and records, and verified
Sonnet's diff, hashes, RED reason and log exit codes. Opus did not rerun Sonnet's passing checks. Usage/time: UNKNOWN.
Failed fixes: 0. One test-harness mistake (sync render) was corrected before the valid RED; it was not a product fix.

## ID → evidence → status
| ID | Evidence | Status |
|---|---|---|
| G456-01 | `sonnet/g456-01-red.log` (RED: no `switch` "Cellular backup") → `g456-01-green.log`; spec test G456-01 | MET (fresh) |
| G456-02 | spec G456-02: one `navigate('sources')`; gallery/file-transfer mocks 0 calls | MET (fresh) |
| G456-03 | spec G456-03: one `navigate('activity')`, 0 API calls; `caller-check.md` | MET (fresh) |
| G456-04 | spec G456-04: real config `0.0.0`; ''/space/undefined/null/number/object → null → "Unknown" | MET (fresh) |
| G456-05 | spec G456-05 theme/language + all 6 targets, remount; `caller-check.md` | MET (fresh) |
| G456-06 | `docs/ui/lovable-design-reference.md` §M13 / D10 / G6; `caller-check.md` (BackupSetup hash = research) | MET (static) |
| G456-07 render/a11y | spec G456-07 ×3 (tr/en/de, no missing keys, disabled switch accessible) | MET (fresh) |
| G456-07 visual | Scripted M13 comparison against frozen M13, light/dark, large text | **Phase 3 DEFERRED / NOT_RUN** (user decision 18.11; no isolated M13 capture path) |

## Final checks (Sonnet, fresh, on the final hashes)
Jest spec 8/8 (`spec-final.log`); `tsc --noEmit` exit 0 (`tsc.log`); root ESLint, 3 TS/TSX files, exit 0
(`eslint-scoped.log`, multi-tsconfig warning only); locale parse + parity true (`locale-parity.log`);
`git diff --check` exit 0; expo export ios/android exit 0 → `/tmp/kloda-g456-export` (`export-*.log`, via root
`node_modules/.bin/expo`, because `pnpm exec expo` resolved the legacy global expo-cli: an environment issue).
Not run: full Jest suite (not selected; App/theme/Activity unchanged), native build, runtime.

## G456-07 visual blocker
`tools/capture-android-connections.py` is not an M13 command (plan §2.3 step 7). `tools/capture-ios-live-activity.py` renders
only the native Live Activity card. No simulator is booted. The plan does not authorize building 2.5 capture infrastructure,
and the visual check may not be deferred without a decision. **User decision 18.11: defer to Phase 3** (like G1-07);
capture infrastructure stays in 2.5. This is not a visual PASS. **State: REVIEW / ACCEPTED — geliştirme kabulü, görsel kapı açık.**

## Open gates (unchanged)
G1-07/F1 fix2 Phase 3, FO1 Phase 4, step19, B2/release/P5/provider/signing/storage, full physical/a11y/performance checks.

## Bağımsız GPT kapanışı — 18.11.2026

Reviewer GPT-6.1 Sol (`openai/gpt-6.1-sol`), uygulamadan ayrı GPT oturumu;
oturum ID'si UNKNOWN. [Review](review.md), taze statik [audit](review-audit.txt).
G456-01–07 tek sözleşme üzerinden topluca incelendi; engelleyici bulgu yok.
Başlangıç blob/hash 6/6 ve final ürün hash 6/6 doğrulandı; plan değişmemiş.
App/source/Activity/hook/theme/app.json/BackupSetup değişmezliği ve normal/hata/
recovery/departure yolları kontrol edildi. Sonnet 8/8, tsc/scoped lint/locale/iki
export kanıtları REUSE; reviewer yeni test/build NOT_RUN.
INITIAL ret=0, başarısız FIX=0. G456-07 görsel Faz3 NOT_RUN ve diğer kapılar korunur.
Yalnız 2.3 geliştirme goal'u kapandı; sonraki ayrı iş 2.4 GPT planı. Commit/push yok.
