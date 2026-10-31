# WebDAV15 — owned Android Photos/restore fixture proposal

User approved this exact narrow Android Photos/restore exception on 2026-10-30. The previous Photos mutation exception names
only the iOS Simulator; it does not authorize Android MediaStore writes.

Scope: only AVD KlodaWebDavStep15 / emulator-5584, separately owned registry/data
under /tmp/kloda-step15; self-targeted test APK com.kloda.sync.test. Never the
original Pixel_9_Pro, production package, personal media or physical device.
The host verifies the exact serial and AVD name before this scope runs.

The test creates a new synthetic PNG in a uniquely named test album/folder,
marks only that owned source PNG favorite to prove a metadata-only sidecar
revision without uploading media again, and explicitly restores that own backup
through the new native DAV importer into new generated target URI(s). Verify
bytes, native creation receipts, album/favorite metadata and no duplicate on
retry/reopen; verify unknown creation/target-library/source-context fences.
No modification or hash-based adoption of pre-existing media. Cleanup deletes
only source/target URIs recorded as newly created by this test and removes only
its own empty test folders. Keep uncertain leftovers for review, never scan/delete
by name/hash. No P-256 identity/key/pin reset, production AES alias, migrations or
credential fallback. Test-only profile uses a new absent-on-entry AES namespace.

Product gallery remains read-only. This authorizes neither arbitrary Photos
editing nor remote deletion. Proof would cover this owned Android SDK fixture,
not real Expo UI, physical hardware, old-API support, iOS signing or BG cadence.

Alternative: keep Android Photos SDK import/metadata validation NOT_RUN, with
source/build/pure-journal/Files/provider evidence preserved; step15 remains open.
