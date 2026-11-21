# G4–G6 M13 Sonnet handoff (D-G456)
Files: settings-page.tsx (mod), shared/config/app-version.ts (new), settings-page.spec.tsx (new), locales tr/en/de (10 new ui.settings.* keys each). Hashes: source-final.sha256.
Note: the sonnet/ first RED attempt failed on a test-harness bug (sync `render`, "render has not been called"); g456-01-red.log is the overwritten valid RED ("Unable to find an element with role: switch, name: Cellular backup").
| ID | Test | Result |
|---|---|---|
| G456-01 | G456-01 cellular… | RED→GREEN |
| G456-02 | G456-02 photo access… | PASS (navigate once, gallery/file-transfer mocks 0 calls) |
| G456-03 | G456-03 notifications… | PASS |
| G456-04 | G456-04 version… (+ parseConfiguredVersion variants, mocked null → Unknown) | PASS |
| G456-05 | G456-05 theme/language/targets/remount | PASS |
| G456-07 | G456-07 ×tr/en/de (render only; no visual capture) | PASS |
Commands (apps/mobile unless noted), exit codes: tsc --noEmit 0 (tsc.log; tsc-pre.log 0); jest settings-page.spec 1 red (g456-01-red.log) → 0 (g456-01-green.log) → 0, 8/8 (spec-final.log); root eslint 3 files 0 (eslint-scoped.log); locale parse+parity 0 true (locale-parity.log); git diff --check 0; expo export ios/android 0 (export-*.log, /tmp/kloda-g456-export).
Export used root node_modules/.bin/expo: `pnpm exec expo` resolved the legacy global expo-cli (exit 1, env issue, not code).
Open: G456-07 scripted visual comparison / large-font / light-dark not run (NOT_RUN); G456-06 doc mapping is Opus scope; independent GPT review required. Layout order: backup, privacy, general(theme/language), background, rerun, about.
