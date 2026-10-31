# Step13 evidence —2026-10-29

See [scope and checks](manifest.json) and [implementation report](../../photos-gallery-step13-2026-10-29.md).
Native screenshots use production HomePage/GalleryPanel/MobileShell and real Expo/PhotoKit.
The fixture seeds only selected disposable sources and a synthetic source-count/navigation harness;
no pairing/PC owner/ACL/real transfer is exercised. The blue development-tools overlay is not product UI.

`photokit-runtime.json`: production IosGallery, real PhotoKit/SQLite, fixture-only selection
shim + synthetic local receipt. `bridge-runtime.json`: actual production native bridge/source
selection. Initial permission/limited fixture failures remain in the runtime log; the final
limited PASS follows normal native Photos picker confirmation and fresh-process observation.
`photokit-denied.json`: no-permission empty page + preview refusal.

Raw fixture sources, compiler/build/test logs and earlier captures are in `/tmp/kloda-step13`;
the temporary Metro entry is archived in `.local-evidence/gallery-step13-2026-10-29/`.
These are not iPhone/Android/PC acceptance, VoiceOver or a whole responsive matrix.
