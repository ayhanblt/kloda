# SMB16a — exact owned Android Photos fixture

Status: user explicitly approved A in the exact fixture question reply. Android execution PASS within the scope below; source and receipt-owned output cleanup assertions passed. iOS/production/physical acceptance remains open.
The separate D7 requirement is in [the approved receipt contract](smb-receipt-sidecar-decision-2026-10-30.md): “Real media writes require their exact owned fixture approval”.

- Only existing disposable AVD KlodaWebDavStep15 / emulator-5584, API33+ ranchu/goldfish, package com.kloda.sync.test. No physical device or personal library/account/NAS.
- Existing ledger-verified owned Samba strict container, no host mounts, loopback27445; native LAN route and encrypted SMB remain mandatory. Random new remote root android-smb-photos-UUID; no remote deletion.
- Create exactly one new 1×1 PNG source under Pictures/KlodaOwnedSmbPhoto-UUID. Select only that new album and assert its sole URI equals the returned insert URI. Backup twice, change only this source's favorite, backup again: one media resource and two sidecars expected.
- Read own Completed manifest/resources; four explicit restore invocations maximum (first, repeated, stale-context, unknown-create). Expected exactly one new restored PNG. Hard upper bound from four single-resource importer calls is four new restored rows plus one source. No existing asset edits except the newly created source favorite; restore organization applies only to freshly receipt-owned output.
- Persist source/created-target URI ledger before further assertions. Cleanup only the exact source insert URI and target URIs durably returned by the separate SMB import journal after ownership verification. No name/hash search deletion. An unrecorded/lost create is retained for review, never guessed or erased.
- New runtime permissions are tracked and restored; only the new SMB test Keystore alias and isolated test preferences/database are used. No shared app state reset.
- Tests include metadata-only media reuse, byte verification, repeated restore without duplicate, stale-context rejection and unknown-create stop. No iOS/production/physical acceptance claim.

Reviewable implementation: [test](../../apps/mobile/modules/my-module/android/src/androidTest/java/com/kloda/sync/AndroidSmbPhotosRestoreChecks.kt), [runner](../../tools/test-android-smb-publication.py). Default runner does not mutate Photos; the separately selected execution is `--photos-owned-fixture`.

No media execution is authorized merely by preparing or compiling this fixture.
