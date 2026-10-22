# Windows D2/D3 — durability contract and preserved-state fresh trust

2026-10-22. User approved D2 success only when correct content AND final name are
persistent, D3 priority for preserved-old-state fresh trust, bounded automated
verification and conditional narrow integration. This is not permission to create
a namespace/key, operate production owner/TPM, inspect existing authority, or lift
the physical pause. No reset, adoption, migration, cleanup or software fallback.

## Delivered narrow D2 contract

`windows_publication_contract.rs` remains cfg(test). Its existing two observations
both reject durable authority completion with existing `OutcomeUnknown`; neither
contains a persistence witness or a success variant. The existing status matrix
also checks this refusal. No renderer/wire/public error ABI changes.

`installation_windows_candidate.rs` retains original errors/statuses but classifies
unconfirmed native requests and post-rename failures/lost replies as
`OutcomeUnknown`. Pre-rename injected exits remain `StorageFailure`, which means
neither absence of side effects nor permission to retry/clean. Formatting retains
the original PairingError/NTSTATUS/IO_STATUS_BLOCK diagnostic alongside outcome.
Native negative statuses conservatively remain unknown in this coarse mapping;
an individual failed rename is not claimed to have changed the namespace.

Production `installation_windows.rs:116-170` is unchanged: write/create, file flush,
MoveFileExW, post-flush/checks. The test contract does not fix or certify production
startup/ACK behavior. A connected production outcome mapping and durable success
witness belong to the blocked integration gate below.

Windows test-binary build completed with seven existing warnings; strict clippy and fmt are unavailable on the explicit installed toolchain and were not installed or claimed PASS. Eight exact pure tests PASS on Windows: the previously unexecuted two decoder
tests, one failure-classification test, and five existing contract tests including
the expanded completion matrix. They do not query a token, open a fixture, call
rename/TPM/owner, or operate user storage. D1 native fixtures were NOT rerun.
These new results do not retroactively change the historical D1 binary/source.

## Official API evidence and unresolved composition

Primary sources checked 2026-10-22:

| Source | Documented support | Boundary |
| --- | --- | --- |
| [CreateFileW caching behavior](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew#caching-behavior) | NTFS write-through requests flush resulting metadata, explicitly including rename | Exact native rename request composition is not separately specified; hardware support is not universal |
| [File caching](https://learn.microsoft.com/en-us/windows/win32/fileio/file-caching) | Metadata persistence uses file flush or write-through | File flush is not data-only; POSIX parent-fsync cannot be assumed mandatory on Windows |
| [FlushFileBuffers](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers), [flush IRP](https://learn.microsoft.com/en-us/previous-versions/windows/drivers/ifs/irp-mj-flush-buffers) | Buffered file information and important metadata associated with the file object are flushed | Successful live checks alone do not prove sudden-loss survival or honest device/controller behavior |
| [NtSetInformationFile](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ntifs/nf-ntifs-ntsetinformationfile), [rename structure](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ntifs/ns-ntifs-_file_rename_information) | Handle-based rename, DELETE access, completion, no-replace | No class-specific durable-final-name clause found |
| [MoveFileExW](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw) | Write-through move language and explicit copy/delete flush guarantee | Not proof that native replacement is equivalent under retained handles; copy/delete remains excluded |
| [ReplaceFileW](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-replacefilew) | Existing-file replacement; write-through replacement flag unsupported | Different sharing/ACL semantics; not a drop-in absent-target or cert fix |
| [NtFlushBuffersFileEx](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ntifs/nf-ntifs-ntflushbuffersfileex) | Normal mode documents data, metadata and storage-cache synchronization | Cited driver contract/kernel linkage does not establish an approved supported user-mode substitute |

Corrected conclusion: there is strong official support for file-handle metadata
flushing, including rename. It would be wrong to say file flush cannot persist
rename, or that an admin volume/directory flush is inherently required. However,
applying the general contract to every namespace dependency of this exact
CreateFileW(write-through) -> NtSetInformationFile -> FlushFileBuffers chain is
still a composition inference. Independent research did not find the explicit
link needed to certify the strict contract. No claim of impossibility is made.

Smallest next D2 evidence step is authoritative confirmation of that exact chain
on supported local NTFS/storage that honors persistence requests. No API probing,
new flags, admin volume flush, sharing/ACL changes, TxF or new journal is selected.
If this composition is confirmed, reuse existing single-handle checks with a
reviewed durable completion mapping; otherwise keep integration blocked. Physical
crash/power-loss verification remains a separate explicitly authorized gate.

## Failure/reopen matrix

| Observation | Allowed conclusion and behavior |
| --- | --- |
| Pending only, before rename | Staged data may exist; preserve/refuse; no new epoch or automatic retry |
| Native request pending/error without confirmed completion | Outcome unknown; retain real status and existing in-flight lifetime handling |
| Rename observed, later flush/postcheck failed or reply lost | Outcome unknown; no ACK, republish, regeneration or inference that nothing happened |
| Final bytes/path/ACL/ID verified live | Observed object, not durable ACK, freshness or rollback witness |
| Reopened epoch/cert/DB/markers agree | Existing consistency checks may pass; agreement is not independent freshness evidence |
| Historical pending/mismatch/missing evidence | Preserve and fail closed; new metadata cannot authenticate past initialization |

## D3 concrete design proposal — no state created

Already selected: preserve old state and backup bytes, fresh QR AND separate local
scope grant, no inherited pins/ACL/journal/pending work, hardware-only Windows
identity. ADR0015's development/production separation is retained, not reopened.

1. **Namespace.** Native KnownFolder currently accepts exactly two built-in roots
   (`installation_windows_path.rs:31-44,109-113`). For the already-approved dev to
   production transition use that built-package separation only after absence and
   all native guards are verified in a later authorized task. We have not checked
   actual production state; it is not presumed empty. An interrupted installation
   in the same selected role has no approved fresh-generation layout today.
   Proposal for that case: native-owned isolated generation plus explicit active
   selection; no renderer arbitrary path, environment override, silent fallback,
   moving old state, or treating another Windows user as production recovery.
   Layout/selection is a NEW architecture decision, not implemented.
2. **TPM alias.** Current alias hashes canonical path+epoch (`identity.rs:47-75`).
   A new generation must use fresh epoch/path and its own hardware identity; do
   not reuse/export/delete old keys. Current CNG opens an existing alias or creates
   only on missing-keyset with create permission, without overwrite
   (`identity_windows.rs:88-95,132`). For explicit fresh bootstrap, any unexpected
   preexisting alias must be treated as a collision unless an independently
   approved new-intent protocol proves it belongs to that attempt. No alias/key
   creation or such protocol is included here.
3. **Interrupted fresh bootstrap.** D2 must first establish durable intent/result
   rules. Any future intent metadata binds only that new attempt; a partial one
   remains blocked if its evidence is insufficient. Existing initialization order
   is prepare -> epoch -> key -> certificate -> DB -> initialized
   (`initialization.rs:28-65`); a new marker alone does not make it recoverable.
4. **Rollback/fencing.** New store starts with no inherited trust. Active-generation
   selection must never fall back to an older generation on missing/corrupt data.
   A pointer on the same disk is not an independent monotonic witness. Existing
   SPKI+epoch consistency (`store.rs:221`) and TPM possession cannot detect a full
   matching disk-state rollback with old key still available. Full rollback
   detection remains unprovided; no new guarantee is selected. Stronger fencing
   against restored old generations needs a separate trusted witness design.
5. **Backups.** Preserve old bytes and all old authority/retention/suppression
   records. Fresh grant must not automatically adopt old files or overwrite them.
   Existing history access depends on same-store completed records, peer/root and
   current scope (`file_receiver.rs:102-136`); copying old DB into new identity is
   not fresh trust. Proposed first scope leaves old backups outside new remote
   list/restore. A later verified read-only recovery/import design must preserve
   provenance, ADR0019 trash/dependencies/suppression and conflict safety. No scan,
   ownership assumption, dedup/migration or new retention cleanup is authorized.

## Acceptance checkpoint and decisions

| Criterion | Status |
| --- | --- |
| Content+final-name durable before success | APPROVED requirement; test-only refusal verified; production mechanism BLOCKED |
| Original errors and uncertain outcome retained | PASS pure classification/format tests; production mapping NOT integrated |
| Two decoder regressions actually executed | PASS, exact Windows tests, no token API calls |
| Official API evaluation | DONE; strong metadata support, exact composition not yet established |
| Crash/restart/power-loss validation | NOT_RUN; injection never substituted for these |
| Certificate absent-vs-existing renewal | OPEN separate replacement/recovery design; initialization calls replace even for initial cert |
| SQLite DB/WAL/SHM opened-object identity | OPEN; current path open/WAL/FULL/schema/SPKI+epoch checks do not prove native object binding |
| D3 namespace/alias/rollback/backups design | PROPOSED above; no namespace/key/state created |
| Existing authority/archive/ACL/guard/fences | Unchanged; no real state opened or modified |
| Independent security review | Independent code/base-design review and separate final evidence/generation-proposal review complete, no blocking findings; no production/generation-creation approval |

User selected **detail the native-owned generation design**, preserving old backups
outside automatic new remote list/restore. This is design authorization, not
permission to create a namespace/key or integrate new selection into production.

## Generation design detail — user-selected direction, not implemented

Keep the existing built-package development/production distinction. Within each
role, a future native-owned layout has an isolated generation directory and one
small protected active selector outside the old pairing directory. The exact new
basename/schema is intentionally not frozen before the following gates close.
Native code derives paths from KnownFolder + compiled role + strictly parsed
opaque generation ID; no path string comes from renderer, environment or selector.
Existing legacy authority remains in place and is not renamed or scanned/adopted.

The selector must bind a version, role and generation ID plus the generation's
epoch/SPKI commitment. It is a routing/consistency record, not permission, rollback
witness or a copy of pins/ACL. Mutable SQLite contents cannot be bound by one
static database-content hash; native object identity/WAL/SHM and consistency checks
remain a separate gate. Certificate replacement/renewal remains separate as well.

Proposed state transitions:

| State/event | Required result |
| --- | --- |
| Legacy interrupted state without selected generation | Visible blocked state; never delete/adopt it or silently choose another root |
| Explicit fresh-trust intent in foreground | Later approved code may allocate one fresh native generation/epoch; no key or state is created by this design task |
| Existing unexpected generation/alias | Collision/refusal; do not open as new or overwrite it |
| Fresh bootstrap interrupted before active selection | Preserve partial generation; keep blocked; a second request cannot silently allocate another generation or authenticate the partial one |
| All generation records validated but selector not durably published | No activation/success; uncertain selector outcome blocks automatic retry |
| Selector committed with D2 durability and exact binding verified | Only this generation can become the current owner; trust remains empty until fresh QR; files remain unauthorized until separate grant |
| Missing/corrupt/mismatched selector or selected generation | Stop; no fallback to legacy, another directory, previous generation, user profile or software key |
| Fresh trust established | Old pins/ACL/revoked/pending/retention records stay untouched and unimported; existing foreground and revoke/publication fences apply |

**Activation is blocked by D2**, including atomic durable selector publication and
any subsequent selector replacement. A selector cannot solve its own durability
problem by adding a second identical marker. No general recovery journal is
proposed. A future exact-intent recovery protocol would need separate justification;
until then, incomplete fresh bootstrap deliberately remains unavailable.

Concurrency requires a native role-wide lifetime owner fence acquired before
selection as well as existing generation-local owner/ancestor pins. No current
sharing or ACL is relaxed. Old binaries know only the legacy owner lock, so a new
lock alone cannot prevent an old binary from opening old state. No claim that new
code can remotely invalidate offline old executables is made; release/old-binary
coexistence is an unresolved integration gate, not a reason to modify old keys.

The selector forbids accidental fallback but is not an external monotonic witness.
Restoring a self-consistent older selector+generation while the older TPM key
remains available can evade local checks. Hardware non-exportability does not
provide monotonic revocation. Stronger whole-installation rollback detection needs
a separately selected trusted witness; no TPM counter, backend requirement or
hardware deletion is introduced here.

Old managed backup bytes and their original metadata remain preserved. Initial
generation scope exposes none through the new trust; choosing the same old backup
root must not bypass provenance or overwrite/adopt existing files. Verified access
to old backups is a later read-only recovery/import design, with explicit user
selection, exact source/target identities, conflict refusal, and ADR0019 retention,
trash/dependency/suppression reconciliation. Old-record cleanup never runs merely
because a new generation exists. These are design constraints, not an implemented
permission to parse/open old authority or user archives.

Future acceptance tests, only after integration is approved: bounded selector/ID
parsing; role/epoch/SPKI mismatch refusal; absent/corrupt/partial selector and
generation fail-closed; no fallback after active loss; unexpected alias refusal;
one selected owner under concurrency; cut/lost-reply activation never gives false
ACK; fresh QR without grant denies files; old history is not adopted. Pure model
tests, disposable actual API tests, process-crash tests and power-loss acceptance
must retain distinct evidence labels. None of these generation tests ran here.
