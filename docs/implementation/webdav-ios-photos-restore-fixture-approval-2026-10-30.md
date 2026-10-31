# WebDAV15 — additional owned iOS restore-copy test

User explicitly approved this exact narrow exception on 2026-10-30. Earlier iOS exception covers a new source PNG,
its own album/favorite and album cleanup; this adds the actual restore-copy step.

Only Simulator 497AAA0F-967E-4781-9468-3F05CA2D3D5A / Kloda-WebDAV15-Disposable,
bundle com.kloda.fixture.webdav15, exact already-approved simulated Keychain group.
Create the same new synthetic source as the approved fixture; restore only its
own locally Completed DAV sidecar/resources through IosWebDavPhotosRestore into
new PhotoKit target asset/album IDs. Preserve original bytes/name/MIME/favorite
and album metadata; repeat/DB reopen verifies the same recorded target and does
not blindly create another copy. Keep source IDs distinct from target IDs.

Test writes are only new source/target records from this run. No existing or
personal asset/album edits, no name/hash-based adoption or cleanup. Cleanup may
remove only the newly recorded restored asset and its newly recorded target
album, after matching their native creation receipts; source PNG may stay as
proof, as before. Unknown targets are retained for review. No Recently Deleted
purge, physical device, production signing/group, app ID/team ID or key reset.
Product gallery remains read-only.

A separate --photos-restore-experiment flag will gate this extra mutation; the
existing --keychain-experiment scope will not silently grow. The fixture registers
real BGTask handlers and persists its own automatic Pause before dispatch; this
does not prove real BG delivery or physical/hardware custody.

Alternative: keep iOS actual Photos-import validation NOT_RUN while preserving
Android full owned Photos/restore and iOS source/build/journal evidence. Step15
platform acceptance retains that open boundary.

Observed final run PASS: sourceHashdb9aa110c47401d50dea2d90dffe72e9536c43ed4bd46ce9803d313b36047fa9, run10cf1a46-8305-41b0-8e9a-25296c644072. Actual native import/export/retry and recorded-copy cleanup passed; same-process DB reopen only. Initial failed test copy retained for review; exact IDs and failure history are in the evidence manifest. No production custody, Expo product UI, physical or BG delivery claim.
