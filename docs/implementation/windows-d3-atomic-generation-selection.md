# Windows D3 — atomic active-generation selection proposal

## Existing-only production source connection — 2026-10-23

The current source connects compiled-role bounded selection, existing legacy/role/generation lease retention and the private EXCLUSIVE WAL VFS to Windows initialization. No existing-only reopen calls the legacy bootstrap or path-based Store::open. This supersedes the staged wiring descriptions below for these connected modules only. Epoch commitment is SHA256(domain Kloda.Windows.Generation.Epoch.v1 plus NUL plus raw16); SPKI commitment uses domain Kloda.Windows.Generation.Spki.v1 plus NUL plus SPKI bytes. No existing record/manifest is rewritten. [SQLite architecture and remaining gates](windows-d3-sqlite-object-binding-design.md). Fresh bootstrap, activation writer and live-switch protocol remain incomplete; source integration alone is not native acceptance.

## Staged implementation checkpoint — 2026-10-23

User authorized moving D3 from design into bounded implementation. The actual
record codec and inventory validator are implemented in
`installation_generation_record.rs` and `installation_generation_chain.rs`, with
direct tests of those functions, not a parallel simulation. Root module wiring is
cfg(test) while native layout/admission decisions remain open. No existing Windows
path/leaf allowlist or product startup is expanded by this slice.

The initial format is exactly164 bytes: magic8, version2BE, kind1, namespace1,
revision8BE, generation16, epoch commitment32, predecessor32, intent32 and SPKI32.
Intent cannot claim an existing key or activation; activation binds its exact
intent. Names contain exactly16 lowercase hex revision digits, with a typed kind
and optional pending suffix. Inventory rejects every pending/unknown entry,
duplicate, gap, mismatch or incomplete pair, rather than selecting a valid prefix.

Initial implementation bound:256 activations/512 records, with refusal before
allocation on an excessive revision or count. No record rotation/cleanup. A future
native reader must also bound enumeration and file reads before allocating input;
the in-memory validator is not a filesystem security or persistence witness.
Empty does not authorize initialization. Selected means graph consistency only:
the test explicitly demonstrates a terminal SPKI can change structurally, so
native identity/object/ACL/readiness binding is still mandatory.

Windows explicit locked/offline test compile exit0; nine new exact pure tests PASS.
Independent security/source/final-results review: no blockers. D1/D2/decoder/native
runtime tests were not repeated. No namespace/key/intent/activation or user data
was accessed/created. [Final evidence](evidence/windows-publication-d1-2026-10-21/d3-protocol-20261023T082249Z.json).

User selected existing validated legacy owner.lock exclusion. The staged native helper retains the existing lock and guarded ancestors with metadata/security-only access, OPEN_EXISTING and FILE_SHARE_NONE. Missing lock refuses; no creation, content change, flush or legacy authority adoption. No actual acquire was run. Compile-only validation passed; independent security review found no blockers. Before native integration, bind the compiled role and retain this distinct fence alongside the generation role owner, including unknown-outcome retention. Fresh installation requires separate admission. Original broader proposal below remains incomplete.

2026-10-23. User selected designing atomic selection changes with preserved old
generations, rather than a first-activation-only product. This authorizes design,
not creating a namespace/key/selector, operating existing authority, or choosing
automatic adoption/reset/migration. Fresh QR, separate grant, no fallback and
preserved old backups are already selected and are not asked again.

## Smallest candidate protocol

Do not start by overwriting a mutable active pointer. An ordinary replace rename
does not atomically compare the destination file identity that was validated
earlier. Holding a destination handle that denies delete also prevents our own
replacement; releasing/broadening that guard is not silently selected here.

Instead propose a **narrow immutable activation chain** using the D2 no-replace
primitive: each successful activation adds exactly one new revision record.
Generation content and earlier records are not overwritten. This is an authority
selection protocol only, not a new general receiver/transfer journal. Extra
metadata is justified by the requested atomic selection change and only describes
new prospective installations; it supplies no evidence for historical pending.

Candidate layout is native-owned per compiled dev/production role, beside and
separate from the legacy pairing root. One role-wide owner fence precedes all
generation selection. Generation directory names are derived from checked opaque
IDs, never renderer/environment/file-supplied paths. Current path/leaf guards do
not yet permit this layout; no arbitrary-root exception is added in this task.

Each bounded fixed-format activation record contains only format version, role,
revision, generation ID, epoch commitment, SPKI commitment and predecessor-record
digest. Exact encoding/size/basename limits remain implementation-review work;
there are no tokens, private key bytes, imported pins, ACL grants or user paths.
The digest binds chain consistency, not origin beyond existing native ACLs or an
independent rollback witness. Revision overflow/unsupported version is refusal.

## Atomicity and reader rules

1. Acquire the native role-wide lifetime owner fence, retaining existing ancestor
   pins and selected generation owner. Quiesce old-generation foreground work and
   authorized publication before selection changes; stale generation/revision
   requests cannot continue against a new owner. No grant survives implicitly.
2. Validate the entire bounded activation inventory and contiguous predecessor
   chain from its fixed role-specific genesis. Do not choose by mtime, directory
   sort, highest number alone, a matching public key, or newest directory found.
   Unknown entries, gaps, duplicate revisions, bad binding, partial intent or
   malformed records block; do not fall back to the last valid prefix.
3. An explicit new-trust request may prepare only its own fresh generation under
   an approved prospective intent. Existing alias/object collisions refuse unless
   that exact new-intent protocol proves ownership; old state is never adopted.
   A cut before complete generation readiness preserves evidence and blocks.
   The prospective intent/recovery rules must be specified before implementation;
   incomplete generation is not automatically retried or silently skipped.
4. Before activation, verify the new generation's epoch/hardware identity/cert/DB
   and initialized state plus native object bindings. The selected certificate
   validity/safe-stop rule and SQLite opened-object binding remain prerequisites;
   an inventory match alone is not
   sufficient. The record names this exact generation, never a generic directory.
5. Create a new staged activation record with CREATE_NEW, no overwrite, same-handle
   write/preflush. Rename it to the next exact revision leaf with no replacement,
   then postflush and verify object identity/path/ACL/size/bytes. The final-name
   publication is the atomic selection boundary for cooperating updated code;
   durable success is not returned until D2 checks finish. The old generation and
   earlier activation records remain intact and are not a fallback target.
6. If publication is unconfirmed, retain original owner/request/source pins as
   applicable and return OutcomeUnknown. Do not republish/regenerate/ACK. This
   process cannot reopen a competing owner while the retained lease is alive.
7. At a later process open, validate the complete chain, exact selected generation
   and native bindings. A surviving complete new activation record is prospective
   selection evidence only after revalidation and its required persistence checks;
   it does not prove a past reply was delivered. Partial/ambiguous records refuse.
   A concrete restart-reconciliation rule and tests are required before shipping;
   no existing legacy restart path is silently treated as this protocol.

No reader can observe a half-record as a committed revision through the staged
name. A concurrent next revision cannot overwrite the intended revision. Serial
role-owner admission prevents two updated writers selecting competing generations.
This is a design-level atomicity argument, not native runtime/power-loss proof.

## Preserved limits and prerequisites

- Path+epoch continue to select a distinct TPM alias. No old alias is exported,
  deleted, overwritten or adopted; no software provider fallback.
- The chain and selector metadata live on the same disk. Restoring an older valid
  chain+generation with an available old key can defeat local freshness checks.
  This is not a monotonic hardware witness or full-rollback solution.
- Old binaries use the old owner lock and cannot be fenced by a newly invented
  lock they never open. Cross-version coexistence/release admission is still an
  integration gate; do not claim revocation of offline old executables.
- Preserved old backups and original retention/suppression/trash metadata are
  untouched and not automatically listed/restored/imported by the new trust.
  Same selected root does not authorize overwriting/adopting existing files.
- Bounded history/inventory exhaustion must refuse visibly; do not prune records
  or invent rotation/cleanup policy to make tests pass. Maximum supported chain
  length and user-visible exhaustion behavior are not frozen here.
- D2 now supports initial no-replace publication under documented NTFS assumptions.
  It does not automatically admit new record names, prospective intent semantics,
  a generation namespace or stronger rollback guarantees.

## Acceptance before implementation/adoption

Required deterministic cases: bounded canonical parsing; role/version/revision and
predecessor mismatches; full-chain gaps/duplicate/partial/unknown inventory refusal;
revision race cannot replace a record; stale generation requests refused; no
fallback to a valid old prefix; collision refuses fresh identity adoption; lost
reply never gives false ACK or second activation. These need direct production
logic tests, not a parallel toy implementation.

Disposable Windows API checks must then validate actual owner/ancestor lifetime,
no-replace record publication and new-parent reachability. Real process restart
and power-loss tests have distinct later permission/evidence gates. Existing
authority/key/pending/archive and old binaries are not test fixtures. None of
these D3 tests or state changes was performed by this design task.

## Prospective intent and restart rule — bounded proposal

For each new revision, propose one immutable intent before generation/key creation.
It binds the compiled role, expected predecessor commitment, next revision,
fresh generation ID and epoch commitment. Activation additionally binds that exact
intent digest and the public identity returned by this attempt's successful new-key
creation. An intent cannot pre-authenticate a key that has not yet been created.
Unexpected existing aliases always refuse; a matching path/epoch or public key is
not permission to adopt one. No key is resumed from intent alone.

Intent and activation each use CREATE_NEW staged publication and D2 flush checks.
Keep both records; an activation consumes its exact intent logically, without
deleting or rewriting the old record. This adds two bounded record kinds for new
selection only; it does not turn the receiver journal into bootstrap authority.

| Reopen inventory under role owner fence | Proposed action |
| --- | --- |
| No new intent/activation, legacy interrupted root exists | Preserve/refuse; explicit fresh-trust flow is separate, never automatic |
| Complete new intent, no final activation | Preserve incomplete attempt and block selection; no old-generation fallback, automatic key reuse, second allocation or activation |
| Staged/partial intent or activation, gap, unknown record or mismatched digest | Preserve/refuse; never rename/adopt a staged record merely because it parses |
| Exact complete intent+activation chain, no ambiguous extra record | Revalidate protected native objects, selected generation/epoch/SPKI/cert/DB identity, then reflush the exact activation file under retained pins before accepting current selection |
| Complete activation but selected object inaccessible/mismatched or reflush fails | OutcomeUnknown/continuity refusal as appropriate; no old prefix fallback or regeneration |

Successful revalidation/reflush is evidence for the current selection under the
new prospective protocol; it never claims a historical ACK was delivered or
authenticates pre-protocol `epoch.pending`. A restored older complete chain is
still outside independent rollback detection. SQLite binding and role-owner
admission must exist before this positive restart branch is implemented.

Deliberate availability limit: an uncommitted attempt remains blocked. Allowing a
later request to abandon/supersede it, proving a prior created key belongs to it,
or removing retained evidence needs a separately justified recovery/product rule.
This proposal does not invent one to make interrupted bootstrap look complete.

Current result: atomic-selection and prospective intent/restart candidate specified;
not implemented or accepted as complete recovery. Remaining implementation gates
include role-owned layout/admission, exact record schema/bounds, SQLite object
binding, old-binary coexistence and review of restart/cut states. No new namespace,
key or activation runtime is considered executed or generally authorized.

## Authorized disposable runtime checkpoint — 2026-10-23

All five prepared exact ignored native cases executed once and passed/exit0. Actual lock contention/lifetime, private VFS DB/WAL identity before SQL, EXCLUSIVE query/write without SHM, single-admission second-connection refusal, rejected main-handle refusal and missing-WAL no recreation passed at fixture scope. This supersedes earlier NOT_RUN/pending-runtime descriptions only for these five cases. Full production generation/legacy/role/ACL/TPM/publisher/crash/powerloss remains untested; fresh bootstrap and live-switch remain incomplete. See evidence/windows-publication-d1-2026-10-21/d3-native-runtime-20261023T102540Z.json.
