# ADR0017 — Photos sidecar manifest and import recovery

- Date: 2026-10-14.
- Status: approved direction; Android implementation and automated/API36 instrumentation verified as recorded in the [handoff](../implementation/implementation-session-handoff.md#photos-sidecar-manifest-and-import-recovery--2026-10-14). Physical acceptance is deferred to the grouped ADR0009 stage, not executed here; iOS native transport/import remains deferred.

## Decision

Photos metadata is a versioned sidecar backup file transferred through the existing native TLS/upload/status/finalize/own-list/own-download path. No new endpoint, central catalog, dependency, broader peer access or native file-authority bypass. Existing PC-local ACL/device isolation and deferred iOS native transport remain unchanged.

Each bounded asset manifest binds a source-installation identity, source asset identity and revision to resource roles, Completed operation IDs, original names/MIME types and exact SHA-256/size, plus source album identities/names and supported favorite metadata. Source identities are not target library/asset identities. Android folder albums are platform-specific; unsupported multi-resource or organization semantics must remain visible, not approximated by duplicate imports.

Only current-scope, authenticated Completed and metadata-matching resources may be referenced. The sidecar itself must be hash-verified and native-finalized before discovery/restore treats it as valid. Partial upload, stale scope or interrupted publication is not a valid manifest. Immutable prior media is retained; organization-only changes do not re-upload its bytes.

Restore uses a durable local import journal separate from source identity. Persist intent before platform creation; bind returned target library/asset identifiers before publication where the API permits it. On retry/reopen, reconcile target identity, ownership and verified bytes before trusting a receipt. Successful platform import followed by receipt-write failure must not trigger blind second import. Missing/ambiguous identity, inaccessible assets, limited permissions or unsupported crash guarantees produce explicit waiting/review state, not success or automatic duplicate creation.

Album mapping uses source-device+album identity, never title alone. Repetition must not create extra assets/memberships; media and organization completion are separate. Existing library media is not overwritten/deleted. No cross-device portability of Android/iOS local asset identifiers is assumed. Real Android/iOS Photos acceptance is deferred to the grouped physical stage; emulator/synthetic checks are not physical acceptance.

## Platform references

- [Android MediaStore access, owned files, permission and pending publication](https://developer.android.com/training/data-storage/shared/media).
- [MediaStore identifiers, volume/version and pending query APIs](https://developer.android.com/reference/android/provider/MediaStore).
- [MediaStore column ownership, pending state and relative path](https://developer.android.com/reference/android/provider/MediaStore.MediaColumns).

Actual API36 execution observed indexed pending size zero before publication while original-byte count/hash matched; bounded original-byte verification is authoritative. Shared DCIM placement is supported for both image and video collections, including Android10's stricter video roots. These checks do not establish legacy/OEM/physical behavior.

## Android emulator follow-up —2026-10-26

[Authorized isolated API36 evidence](../implementation/android-runtime-step4-2026-10-26.md) confirms real MediaStore/SQLite Photos publication/import and explicit rebackup with simulated PC replies. A lost-finalize reply regression left local state finalizing despite a verified Completed status; both early return paths now retain the exact validated ACK before cleanup. No metadata/authority policy changed. Real PC/TLS/ACL, actual FilesQueue resource sender and physical acceptance remain open.

## iOS implementation checkpoint —2026-10-27

[Liste7 kaynak/izole PhotoKit kanıtı](../implementation/ios-photos-step7-2026-10-27.md) önceki iOS uygulama ertelemesini yerel foreground dilimi için supersede eder. Aynı Files journal/upload/status/own restore, strict v1 sidecar, source/target kimlik ayrımı, kalıcı creating/placeholder, album mapping ve review sınırı uygulandı. Bulk restore Android gibi latest verified revision seçer; preflight'ta hiç platform yazımı yoksa prepared intent ile explicit retry güvenlidir, creating/sonucu belirsiz iş yeni yaratım olarak tekrarlanmaz. Yeni authority/endpoint veya güvenlik kararı yok. iPhone/PC LAN ve çoklu-resource/iCloud/physical kabulü açık; Simulator fixture'da PC/session sahtedir.
