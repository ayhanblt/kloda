# ADR0019 — Desktop device removal and recoverable backup deletion

- Date:2026-10-19.
- Owner:Ayhan.
- Status:**approved product behavior**; device removal and selected-version trash/restore/expiry/source suppression implemented with automated/isolated evidence; Photos selection approved below. Not full Desktop/product/platform acceptance.
- Scope:PC-local owner management. ADR0016 remote ACL, ADR0017 metadata/resource consistency and ADR0018 foreground/background boundaries remain. No new remote delete permission, central LAN login/JWT/KMS requirement or provider fallback.

## Approved device-removal behavior

1. Existing access revoke revokes file permission only, retaining pairing trust and backups.
2. Separate **Remove device** revokes this PC's trust and ACL atomically, without requiring the phone online. Retain the native revoked tombstone, not silent physical record removal.
3. Existing completed backups remain. The operation does not claim any phone record or original was deleted. It does not trigger backup deletion.
4. Reconnection requires fresh QR pairing plus separate file-access approval. Old SID/trust cannot authorize operations; active channels/publication are fenced by existing native revoke mechanisms.
5. Show explicit consequences and default-Cancel confirmation in the visible/active trusted window. Success requires verified durable native trust/ACL result, not the action's UI reply alone.

## Approved backup deletion/recovery behavior

- Desktop owner may select individual or multiple **Kloda-managed completed Files/Photos backups**. Deletion means moving into a recoverable Kloda trash for30 days, not deleting phone originals.
- Preserved backups of removed devices remain manageable. Device removal and backup deletion are independent UI operations.
- Restore to the former target; never overwrite a different existing file. Report conflict.
- On expiry automatically perform permanent cleanup; if Kloda was closed, catch up next run. Explain retention and permanent outcome before confirmation. No immediate-permanent-delete control in this task.
- An unchanged phone source must not automatically recreate a Desktop-deleted backup. Explicit user rebackup remains possible. Later source changes are separate versions.
- Retain source-specific suppression/tombstone after byte expiry. Equal content alone cannot suppress unrelated sources.
- Reuse the native authority store and immutable transfer history; do not build a second general transfer journal. Local owner actions add no remote delete grant.
- Coordinate active upload/finalize/restore and verified Photos metadata/resource dependencies. Keep shared resources needed by retained backups. Partial operation/missing metadata is not success. Retry, lost reply and restart must preserve recoverability.
- Only exact verified managed file identities are eligible. Do not scan/adopt/delete existing user archives, manually added unrelated files or Kloda-external data. Unknown path/root/identity must stop visibly.

## Preserved existing protection contract

The [product contract §2](../product/computer-backup-files-and-photos.md#2-files-silme-ve-sürüm-koruması) requires live files and immutable protected content to be independent; a same-inode hardlink is not a protective copy. This ADR does not silently supersede it. Retention commit precedes removal; no early expiry based on a phone clock, no truncation when storage is full. Implementing that protection remains necessary for the deletion slice; it was not established by old receiver completion tests.

## Approved Photos version selection — 2026-10-19 continuation

Ayhan confirmed: **only the selected backup version is deleted**. Other versions remain separate and visible; the UI says “Bu yedek sürümünü sil” (localized equivalents in EN/DE). Users may explicitly select all versions in bulk.

Shared media remains protected for every retained active version and every deleted version within its30-day recovery period. Permanent media cleanup requires that no version requiring preservation references it. Deleting a newest version does not silently select/delete older versions or change the remaining versions into a single inferred photo. This closes the preceding selection-unit question; device removal is already complete and is not reopened.

## Implemented mapping — 2026-10-20 continuation

- Existing immutable `file_operations` remains the transfer journal. Authority schema4 adds narrow protection/deletion/admission records tied to that history, not another general transfer log. Existing trust/ACL/publication guards remain authoritative. Schema changes were exercised only in disposable stores; no existing user authority/archive was opened or migrated during development.
- An exact, fully SHA-256-verified **independent inode copy** is made before unlinking live content. Durable delete/restore/purge intents survive retries, lost replies and process restart. The30-day deadline is committed after deletion finishes, including resumed intent; it is not the earlier copy-start time. An exact retry does not restart the window. Cleanup runs on owner startup and bounded periodic maintenance, including listener-unavailable states; errors remain visible. No immediate-purge UI.
- Native parses bounded ADR0017 sidecars and validates same-peer/root Completed resource identities. UI lists sidecar versions separately and hides their media resources from independent deletion. Persisted dependency references retain shared media for active and recoverable versions. Last-reference expiry removes only verified managed identities; unrelated/manual files are never adopted or scanned for removal. Missing/ambiguous legacy metadata fails closed.
- Tombstones remain after byte cleanup, scoped to peer/root/source/revision rather than equal content. `owner_deleted` is a nonretryable disposition, not a completion receipt. Explicit rebackup uses a new immutable request linked to the old operation and current ACL. Files exact source/revision/name/hash/size binding remains. Photos remapped resource operation IDs are validated against a retained semantic signature covering all original manifest metadata/resource content identities except those operation IDs; publication checks both signature and current Completed dependencies. Changed metadata cannot masquerade as an explicit copy of the old version.
- Narrow Android integration preserves Completed receipts and stable local source linkage across pairing records; ambiguous historical random bindings fail closed. It stops automatic resurrection, exposes explicit user rebackup, and rebuilds Photos links when expired resources require new uploads. Proven metadata-only Photos changes can recover expired dependencies as a new revision; unknown semantic history stays suppressed until explicit rebackup. Repeated/interrupted and fresh-QR explicit requests preserve old receipts and use new current-record intents under current native authority. No Android background or iOS implementation is claimed.
- Desktop `Yedekler ve çöp kutusu` lists active/trash versions, individual/page/all-pages selection, retention deadlines, per-item results and no-overwrite restore conflicts. Default-Cancel native consent is foreground/active-window gated; stale reads disable mutations. Native batches are32 IDs; one explicit UI selection may cover4096, with an explicit limit/error instead of a false all-selected claim. Native dependency discovery is bounded at65536 Completed operations and fails closed above that bound.
- Existing scopes overwrite the current folder on regrant; historical operations do not always retain an old locator. Never guess/scan an archive: unverifiable old-scope operations remain visibly unavailable. Synchronous hashing/copying uses bounded memory but occupies the serialized native owner and may delay commands/receipt/foreground suspension for large files; large-file responsiveness remains unmeasured, not uninterrupted-transfer acceptance.

## Evidence boundary

[Current handoff](../implementation/implementation-session-handoff.md#desktop-selected-version-trash-restore-and-suppression--2026-10-20) records exact completed scope/checks and pending deletion behavior. Physical pause, Windows storage/continuity, macOS signing, Linux provider gates, no actual archive/authority mutation and Git index/history prohibition remain. Ubuntu LTS/GNOME and Kubuntu LTS/KDE are unverified acceptance targets. No next durable-jobs/settings/retry task is started.
