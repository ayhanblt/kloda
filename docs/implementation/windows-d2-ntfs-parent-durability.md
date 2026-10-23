# Windows D2 — NTFS parent links and narrow integration

2026-10-23. This checkpoint supersedes the earlier demand for one document naming
the complete native call chain. The user accepts explicit composition of official
contracts, and limited the remaining research to newly created parent links.

## Narrow evidence and inference

[MS-FSA 2.1.5.7](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-fsa/0de7dc40-9627-437e-a4df-c4696cdc3d02)
describes flush for an open data file or directory, persistent attributes and
directory structure reaching stable storage, followed by physical-storage flush.
[Appendix A, footnote80](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-fsa/4e3695bd-7574-4f24-a223-b4679c065b63)
identifies the directory-persistence behavior as NTFS-only and includes Windows11
without a contrary exception. It does not restrict this to pre-existing parents.

MS-FSA models the object store used by file-server protocols; it is not a standalone
local Win32 guarantee. The local mapping is composed with the documented
[FlushFileBuffers-to-flush-IRP relationship](https://learn.microsoft.com/en-us/previous-versions/windows/drivers/ifs/irp-mj-flush-buffers)
and the already-reviewed NTFS file metadata/write-through contracts. Independent
review accepts this composition under the user's evidence standard.

Supported inference: successful post-rename flush of the retained child file
persists the directory relationships needed for that final file to remain reachable,
including newly created ancestor links on the same validated NTFS volume. This
does not claim to flush unrelated sibling data or every object on the volume.
Storage/controller/filter drivers must honor persistence requests; live tests do
not establish actual power-loss survival or malicious full-rollback detection.

Source distinction: `installation_windows_path.rs:120-178` may create the fixed
application/pairing parents with CreateDirectoryW, then checks and pins each
ancestor. Those pins preserve identity/lifetime, not durability by themselves.
The child-file post-flush supplies the composed NTFS persistence condition. There
is no directory-write handle, changed sharing/ACL, admin volume flush or new API.
Thus the earlier documentation-only D2 blocker is removed for this narrow path.

Context7's targeted library resolution supplied no relevant MS-FSA source; the
Microsoft primary pages above supplied the evidence. General API research and D1
native tests were not repeated.

## Source integration scope

Windows `write_new` now uses a dedicated production no-replace publisher, sharing
only the existing checked target-name/buffer primitives with D1. It is not the D1
fixture/cutpoint/context code promoted wholesale. Existing SDK0.61.2 feature gates
for native rename and IO_STATUS_BLOCK move into Windows production dependencies;
no new crate/version or lockfile update.

Order: native path/NTFS/ACL/reparse checks and original owner lease -> CREATE_NEW
staged file on one write-through read/write/DELETE handle with shareREAD only ->
write/pre-flush -> exact synchronous no-replace completion -> post-flush -> same
object volume/fileID/path/ACL/size and byte+EOF verification -> success.

Original owner lease is explicitly threaded through initialization/file helpers;
Windows uses Arc ownership of the original owner+ancestor handles, with exact
parent-directory binding. Other platforms receive only an ignored owner reference,
with unchanged file algorithms. Unresolved native completion retains request/IOSB,
source, ancestor pins AND original owner until process exit. Other unconfirmed
native results and post-rename failures also retain owner/source pins and return
OutcomeUnknown. First-error diagnostics preserve actual native status separately
from Win32 errors; no invented mapping. No retry/adoption/cleanup is performed.

An independent review found the initially missing owner retention in the pending
branch; it was corrected before delivery. The early build is not the final reviewed
source. Logs distinguish preliminary and final checks.

## Certificate safe-stop decision and open boundaries

- User selected safe stop when certificate renewal is needed. Initial absent DER
  now uses the no-replace publisher. Existing DER is validated then reused only
  within the existing >=30-day/not-before rule. Otherwise Windows refuses with
  NativeUnsupported before signing/writing. The legacy MoveFileEx publication
  route was removed; actual certificate renewal/replacement remains unsupported,
  not solved by initial-create support. A target appearing in a race is not replaced.
- SQLite opened DB/WAL/SHM identity binding remains open.
- Holding the original owner prevents a competing owner during this process's
  uncertain native operation. It is not a persistent recovery witness. After
  process exit/restart, existing initialization consistency paths are not upgraded
  into an approved interrupted-installation recovery protocol.
- D3 generation direction, fresh QR/separate grant/no-fallback and preserving old
  backups remain selected. No namespace, selector, TPM alias/key or old record was
  created/changed. Durable selector replacement, old-binary coexistence, restart
  uncertainty and rollback witness remain distinct integration gates.
- Build/pure tests validate source/ABI and deterministic logic, not new-publisher
  native runtime. No production owner, TPM, native fixture, crash or power-loss
  acceptance was run; physical pause remains.

Final command results and source/raw hashes are recorded in the linked selected
evidence checkpoint; old D1/D2 evidence remains immutable and historical.

Final verification: explicit locked/offline Windows production library check AND
native library build/link exit0; test-binary no-run build exit0; four new exact pure
tests PASS (native status, exact bytes, first-error preservation, certificate safe
stop). Independent source/results/privacy review completed without blockers after
owner-retention repair. Fmt/clippy remain unavailable, not PASS. No Desktop app or
native publisher runtime was launched. [Final selected evidence](evidence/windows-publication-d1-2026-10-21/d2-parent-certificate-20261023T073810Z.json).

User subsequently selected designing atomic selection changes. The
[immutable activation-chain proposal](windows-d3-atomic-generation-selection.md)
reuses no-replace publication rather than silently adding mutable-pointer
replacement. Prospective intent/restart rules and namespace/owner/object bindings
remain gates; no D3 implementation or native state was created.
