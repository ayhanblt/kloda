# SMB16a — exact owned iOS PhotoKit importer component fixture

Status: user explicitly approved “evet testi çalıştır” on01.11.2026. Exact media component execution PASS: seed/repeat/stale/unknown-create, separate-process reopen and receipt-owned cleanup. Existing no-media local proof retained. This is not full SMB/LAN acceptance.

Required by [D7](smb-receipt-sidecar-decision-2026-10-30.md): “Real media writes require their exact owned fixture approval”. Android's prior permission does not cover this iOS fixture.

## Exact effect for review

- Existing disposable Simulator only: `Kloda-WebDAV15-Disposable`, UUID497AAA0F-967E-4781-9468-3F05CA2D3D5A. Fresh random bundle `com.kloda.fixture.smb16.import.r<UUID>` and its private SQLite/staging/ledger. No physical device, personal account/library/NAS or host network access.
- One new1×1PNG staging file inside the fresh app container. No PhotoKit source asset is created/modified. Feed this owned local stage to the actual `IosSmbPhotosImport`/journal/media verification implementation as a **component test**; no upload receipt/SMB Completed row is fabricated. No claim of real backup, admitted LAN or full restore acceptance.
- Up to four importer invocations: first import, identical repeated import, stale check, unknown-create recovery. Expected one new PhotoKit asset and one new album. The imported asset is favorite; its original filename/MIME/byte hash/size and album membership are verified by production code. Repeat must retain the same receipt/identifier and exactly one album member. Stale-context rejects before create; creating-without-target intent stops for review. If faulty code creates unexpectedly, hard upper bound is four new assets and four new albums across four importer invocations; unreceipted effects are retained for review, never guessed/deleted.
- Terminate/relaunch the same fresh bundle, reopen the import receipt and verify exact asset/resource/organization again without creating another asset. Only after seed+reopen PASS, cleanup verifies the exact journal-owned asset and album IDs against the private ownership ledger, checks album title and sole membership, and deletes those exact objects. No name/hash search cleanup, no global library reset.
- The importer persists creation placeholder IDs in its own SMB journal. A failure before the fixture's extra ownership ledger is saved stops the sequence; no blind re-execution/cleanup. The journal and any unknown effects remain as evidence.
- Runner grants Photos access only to this fresh bundle and resets only that fresh bundle's permission on exit. Existing app permissions/assets/albums remain outside the scope. Simulator is shut down if the runner booted it. No production signing/custody/OS BG claim.

## Concrete reviewable code and commands

[Native component fixture](../../packages/storage-native/apple/tests/IosSmbPhotoImportApp.swift); [guarded runner](../../tools/test-ios-smb-photo-import.py).

No-media local execution: `python3 tools/test-ios-smb-photo-import.py 497AAA0F-967E-4781-9468-3F05CA2D3D5A --run`.

Media-enabled build only: `python3 tools/test-ios-smb-photo-import.py 497AAA0F-967E-4781-9468-3F05CA2D3D5A --photos-owned-fixture`.

**Exact separate approval received01.11; executed within the scope above**, media execution: `python3 tools/test-ios-smb-photo-import.py 497AAA0F-967E-4781-9468-3F05CA2D3D5A --photos-owned-fixture --run`.

Local codec/stage/hash/cancellation/SQLite checks and successful compilation do not close the PhotoKit mutation test. Passing this component does not close the separate real iOS selected-bookmark/admitted-LAN/SMB publication+download proof, actual BG delivery, independent review or12/20/21 acceptance.

## Execution result /01.11

[Single closure evidence manifest](evidence/smb-closure-step16a-2026-11-01/manifest.json). Initial attempts stopped before the importer with0 import/album/upload rows. The fixture was corrected to use the existing native requestAuthorization pattern and report assert line numbers. Simulator TCC grant alone did not dismiss the actual system permission prompt; full Photos access was confirmed in Device Hub for the exact owned bundle. Source/input hashes were rechecked. With documented zero-create proof, only the two failed private staging inputs were reset in that same bundle; no Photos object was guessed or removed and no additional importer invocation was consumed.

Then all four bounded importer invocations PASS, followed by actual process terminate/reopen PASS. Actual native verification checked PNG name/MIME/size/hash, favorite and sole album membership; repeated import kept the same receipt/target. Unknown-create intent ended review_required with no target. Cleanup confirmed both exact IDs from journal+owned ledger and completed the two normal OS deletion prompts for that owned album and one PNG. Both exact post-delete fetches returned zero.0 SMB upload rows confirms no remote receipt was fabricated. Fresh bundle Photos permission reset and owned Simulator Shutdown verified. No global library reset or Recently Deleted purge.

The first two attempts and read-only permission diagnostic are retained as failures/diagnosis, not PASS. The final checked runtime source hash is recorded in the manifest. Real admitted LAN/bookmark publication+own restore, actual BG/device signing/custody and independent review remain open;16b remains held.
