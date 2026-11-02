# SMB16a — exact owned iOS → Windows Photos chain /01.11.2026

Status: **USER EXACT A APPROVED; seed/reopen/exact-owned cleanup PASS**. [Single runtime evidence](evidence/smb-windows-photos-2026-11-01/manifest.json). Initial build-only media flag=false and later approval/run are distinguished. Cleanup-only membership check was added after declining the inconsistent OS count; no seed/import rerun.2assets/2albums removed, exact post-fetch0, own Keychain/permission/password cleanup and owned Simulator Shutdown PASS.

[Required D7 decision](smb-receipt-sidecar-decision-2026-10-30.md): “Real media writes require their exact owned fixture approval”. The earlier approved iOS importer component did not create a source PhotoKit asset or exercise remote publication/download; it does not authorize this larger runtime effect.

## Exact reviewable effect

- Existing disposable Simulator only: Kloda-WebDAV15-Disposable,497AAA0F-967E-4781-9468-3F05CA2D3D5A. New random app bundle prefix `com.kloda.fixture.smb16.windowsphotos.`; only its own Simulator Keychain group, private journal/snapshots/ownership ledger. No physical iPhone, personal Photos/library/account/device/NAS, new network/signing privilege or other Simulator.
- Existing user-created Windows endpoint192.168.1.54:445 / KlodaTest16a, test user MMHA/kloda16a. Use the existing private600 credential file without printing/embedding its contents. One fresh remote UUID root `kloda16a-photos-<nonce>`; no other share/root and no remote deletion/overwrite/name adoption.
- Create exactly one new1×1PNG PhotoKit **source asset** and one new dedicated album, favorite=True. Persist creating intent and source placeholder asset/album IDs in the private ledger; verify their actual filename/UTI/bytes/favorite/title and sole membership. Select only this exact album in native photo source preferences. No `photos-library` source or whole-library enumeration.
- Run actual IosSmbPhotos export → native route-bound SMB publication → native immutable resource/manifest receipts. Expected one media resource and one versioned manifest remotely. A second unchanged run must reuse the same two local Completed IDs; it must not republish media/manifest. No fabricated PC/DAV/SMB receipt.
- Actual own-receipt remote manifest/resource downloads → IosSmbPhotosRestore → IosSmbPhotosImport. First restore creates one new imported asset and one new album; the imported IDs come from native import/album receipts and are recorded in the fixture ledger. Verify exact bytes/filename/UTI/favorite/title/sole membership. Second restore must retain the same IDs. Separate-process reopen verifies source/custody/receipts, unchanged source reuse and one more restore without duplicate creation.
- Expected total: **2 new assets and2 new albums** (source+restore); at most3 restore invocations across seed/reopen. Hard maximum if every restore wrongly creates anew: **4 assets and4 albums** including the one source. Assertions stop at the first detected error; unknown/unreceipted effects are retained for review, not guessed or retried.
- Expected remote objects: one media resource+one manifest; their UUID staging names may remain if an ACK is uncertain. No automatic publication retry after failure and no broad cleanup. The full Files fixture proved Windows interoperability separately; it is not reused as a Photos authority substitute.
- Cleanup runs only after seed+reopen PASS: verify the exact source ledger and native imported asset/album receipts again, titles/resources and sole membership. Delete only those2 assets+2 albums by their recorded IDs, then confirm exact fetches return0. No name/hash discovery, global library reset, Recently Deleted purge or personal object cleanup. Unknown intent/result stops for review.
- Afterwards remove only the fresh bundle's owned Keychain profile/private input and reset only that bundle's Photos permission; terminate the app and shut down the owned Simulator if booted here. Windows UUID test data/receipts stay available for review. The original test-password file is removed when the authorized SMB test work is finished.

## Concrete code/build

[Native test fixture](../../packages/storage-native/apple/tests/IosSmbWindowsPhotosApp.swift) uses actual production Swift classes and current native libraries. It refuses all modes before media authorization unless the explicit `FixtureMediaEnabled` flag is true. Modes are seed/reopen/cleanup only.

Build-only orchestration: `/tmp/kloda-windows-smb16a-photos-build.py` (captured hash below). Existing custody-fixture linker method embeds only the fresh bundle's Keychain group; it is not production signing proof. Compilation/signing passed; no runtime test is claimed.

Build root: `/var/folders/cm/fsyld6dn5xl1p74jcds8tc640000gn/T/kloda-windows-smb16a-photos-6sh541kb`.

Runtime approval changes only this exact build's media flag to true and re-signs it, then installs it on the one Simulator above. It does not expand the approved SDK/native ABI/schema or authorize any physical acceptance. Claude security review remains last.

Fixture source SHA256: `d0028397a7667e835bd40a75e92c4c440b2c01f1ea4ebf8c7cdd80ece8f8e7d8`. Build-script SHA256: `b0e99aedc524517ee04a49a00b2ad07315e8692417a9308d949c47b28381a047`.
