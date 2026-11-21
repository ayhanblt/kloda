# 2.3 read-only caller / D10 check — Opus, 18.11.2026

Start HEAD `508b3f0486a7ce04628ec0c3681d995573e5721d`. No product code changed by this check.

- `apps/mobile/src/app/App.tsx:61` is the only caller: `<SettingsPage navigate={navigate} />`.
  `navigate` is App's existing page setter; `MobilePage` (`shared/model/mobile-navigation.ts:1`)
  already contains `sources` and `activity`. App.tsx not in diff (hash research `a6731c4f…`).
- `sources` → `SourcePage` (App.tsx:50): its selection starts only on the user's own action inside SourcePage.
  `activity` → `ActivityPage embedded` (App.tsx:54): its poll/lifecycle is unchanged; the Settings
  background panel already navigated to `activity` before this work (same target, new entry row).
- Back/departure: Settings → sources uses `back`; activity uses `back`; RecoveryPage → settings. No
  callbacks/async are kept by Settings, so unmount leaves nothing pending (G456-05, confirmed by spec).
- D10 (G456-06): `apps/desktop/src/pages/backup/BackupSetup.tsx` SHA256 `4376fc30…` = research hash,
  clean in git; `step` 'sources' (l.19) holds `pickSources` (l.67) + `saveSchedule` (l.76);
  `apps/desktop/src/app/App.tsx:81` mounts the same BackupSetup. `/d/sources` exists only in the frozen
  Lovable `page-map.json:106`, not in the Desktop source. Mapping recorded in
  `docs/ui/lovable-design-reference.md` §M13 / D10 / G6. G6 stays at the step-19 gate.
