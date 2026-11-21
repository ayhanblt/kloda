# FIX-R1 Sonnet handoff (G25-R3 matrix part, G25-R5)

Files: tools/ui-capture/matrix.json, matrix.py, test_matrix.py (sha256 in files.sha256).

1. fingerprint body keys: `files`, `localeKeys`, `row` (sha256 of canonical row), plus top-level `status`, `digest`.
   `files` now also holds the row driver's `driverSources` (new required top-level map, validated in load()).
   `_changed_keys` reports `row` and `localeKeys`. Shell tab keys (statusUi.title/photos/targets/settings) added to every ios row
   rendered in MobileShell (all except welcome, pairing, lock-screen-cards). apps/mobile/app.json added to the two rows depending on app-version.ts.
2. Tests: row change, driver source, shell tab key, app.json, unrelated key reuse, body keys.
3. Added desktop.backup-storage (state_unavailable: needs sources + saveSchedule bridge).
4. desktop.jobs ref step=activity (WebDavActivity); desktop.backup ref step=sources (D10 combined step).
5. mobile.provider-cloud replaced by provider-cloud-nextcloud / -password (kolab-now) / -oauth (dropbox etc.), all state_unavailable.
   Ready ios set unchanged: welcome, settings, provider-generic.
6. listing rows expose `overrides` [{cell,status,reason}].
7. Frozen page-map test, 12 cells each.

Results: 33 tests OK (exit 0); capture-ui.py list exit 0 (50 rows, 600 cells).
Doubts: matrix.json is 310 non-blank lines (>300 original cap; the FIX scoped the cap to Python files).
The cloud page lives at pages/connections/ui/, not pages/setup/ui/ as the task said. Both locale-key and file reads were traced from source only.
