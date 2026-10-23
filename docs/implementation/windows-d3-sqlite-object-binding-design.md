# Windows D3 — SQLite opened-object binding design

2026-10-23. User selected a separate SQLite architecture slice before positive
D3 owner integration. The approved reopen-only VFS and owner source are now
connected; this is not a real owner run or permission to operate existing state.

## Concrete blocker

Historical blocker resolved for the connected generation source only:
the legacy `Store::open` opened a path with READ_WRITE | CREATE. WAL setup and
migrations could mutate before native opened-object identity binding. SQL SPKI/epoch
consistency cannot identify actual Windows DB/WAL/SHM handles. Windows initialization
now selects the existing committed generation and uses the bound connection;
legacy path-based Store::open is test-only on Windows. The original legacy startup
below the non-Windows cfg remains for the unchanged other platforms.

The codec, complete-inventory validator and legacy fence are now connected to
the exact compiled-role existing-only namespace; arbitrary roots remain denied.

## Verified interfaces and limitations

Context7 official SQLite documentation and the pinned libsqlite3-sys0.37.0
SQLite3.51.3 amalgamation were read; no database or native owner was opened.

- [File control](https://www.sqlite.org/c3ref/file_control.html) can return the
  main `sqlite3_file`, journal `sqlite3_file` and selected VFS. These are borrowed
  objects, not ownership transfers.
- [WIN32_GET_HANDLE](https://www.sqlite.org/c3ref/c_fcntl_begin_atomic_write.html)
  returns the actual native handle for that SQLite file. Never close it, replace
  it with WIN32_SET_HANDLE, cast undocumented private layouts, or infer identity
  from a path-only second open.
- Pinned `sqlite3.c:51675` implements that opcode using `winFile.h`.
  `sqlite3PagerJrnlFile` at66036 returns the WAL file when WAL is active, otherwise
  the rollback journal. A null/closed journal is not a validated WAL object.
- The Windows SHM handle is internal to `winShmNode.hSharedShm` at51971.
  Main/WAL file controls alone do not validate SHM. A wrapper's delegated
  `xShmMap` cannot claim inspection of that internal handle.
- [WAL without shared memory](https://www.sqlite.org/wal.html#use_of_wal_without_shared_memory)
  documents EXCLUSIVE locking **before the first WAL access**: no SHM methods or
  shared-memory WAL index are used. Late EXCLUSIVE is not equivalent.
- [Open flags](https://www.sqlite.org/c3ref/c_open_autoproxy.html): VFS xOpen flags
  differ from connection flags. SQLITE_OPEN_EXCLUSIVE at connection open is not
  a substitute for PRAGMA locking_mode=EXCLUSIVE or Windows lifetime locks.

## Approved architecture choice

User approved, only for new Windows generations: one serialized
connection, EXCLUSIVE WAL established before the first WAL access, with a
connection-specific narrow validating VFS shim for DB/WAL. No SQLite version,
dependency, legacy store, other platform or existing journal policy is changed
by this proposal. Every unexpected SHM callback/file is refusal, not fallback.

Rejected alternative for this slice: retain NORMAL WAL/SHM and add an explicit SHM validation hook inside
the pinned Windows VFS. This increases bundled-source maintenance and requires
auditing upstream changes. Do not read private winShmNode offsets from Rust.

The chosen source integration is reopen-only. Existing main DB and WAL are pinned
before SQLite opens them; the private VFS strips CREATE and validates the actual
borrowed Win32 handle before forwarding I/O. Missing WAL is refusal, not recreation.
PERSIST_WAL is set before accessing the existing WAL; close cannot delete it through
this VFS. FULL remains required. SHM/unknown files/deletion poison the connection;
owner admission and writes check poison independently of cache-only SQL reads.
The existing pinned SQLite WAL open uses OPEN_EXISTING when CREATE is absent.
This is a source-supported composition pending disposable native runtime checks.

The native role is also user-approved: default development, explicit Cargo
`desktop-production` for production; never release/debug or environment inference.
Only that compiled role's exact KnownFolder root can select a generation.
No actual namespace/key creation or physical acceptance is authorized here.

Generation role and selected-generation owner.lock use GENERIC_READ plus share-none
and OPEN_EXISTING: metadata-only share-none does not mutually exclude two updated
owners. Existing legacy fence retains its approved metadata/security-only access,
which excludes old binaries requesting data read/write. All original leases and
record/DB/WAL pins survive through the OwnerLock Arc and VFS admission lifetime;
the D2 unknown-outcome retention clones retain the same complete bundle.

Fresh generation bootstrap, intent/activation publication, strict new-key collision
handling and live generation switching/quiescing are not implemented by this
existing-only reopen path. Missing/incomplete state refuses with no old fallback.
The protocol has no independent full-disk rollback witness. Do not describe this
slice as complete fresh-trust setup or production Windows acceptance.

## Common admission requirements

1. Derive paths from the compiled namespace role and validated selected generation,
   not renderer/env paths. Acquire role fence and existing legacy fence first;
   retain both plus original ancestor pins until the final owner/connection and
   in-flight publication references end. Unknown publication retains all leases.
2. Read the entire bounded inventory and exact selected generation under retained
   guards. Missing/partial/unknown/bad chains refuse; no prefix/legacy fallback.
3. Separate reopening an existing selected store from explicit fresh bootstrap.
   Reopen must not CREATE, initialize schema, migrate, or recreate missing sidecars
   before the native object-binding policy admits them. Fresh creation needs an
   approved prospective intent, strict new-key collision refusal and native
   CREATE_NEW ownership evidence; no existing alias/store adoption.
4. Validate each actual opened DB/WAL object before delegating data I/O: existing
   NTFS/ACL/owner/reparse/final-path/single-link guards and volume+file identity.
   Preserve original checked handles/ancestors. Main-only post-open checks do not
   solve WAL/SHM or mutation-before-validation. xOpen side effects and sidecar
   create/delete/reopen must be specified, not hidden behind a generic wrapper.
5. Keep SQLite byte-range locking, sync, recovery, error codes and FULL durability;
   do not replace these with the D2 publisher or weaken sharing/ACL guards.
   VFS forwarding must respect optional methods, object alignment, connection
   lifetime, reentrant callbacks and failure cleanup. No global default VFS swap.
6. Only after these checks may native key/cert/epoch/initialized/DB bindings and
   activation revalidation/reflush permit positive owner readiness. Fresh QR and
   separate scope approval remain mandatory; old trust/ACL/backups are not copied.

## Minimum validation before positive integration

Pure tests: policy transitions and no fallback on missing/bad/incomplete chains;
typed lifetime retention through last owner/publication reference; no lost-reply
success or second activation; fake callback failures never manufacture a witness.
These do not replace native API evidence.

Separately scoped disposable Windows runtime is required for actual DB/WAL native
handle identity, lock contention, retained pins, sidecar lifecycle, VFS failures,
early EXCLUSIVE behavior/SHM refusal if selected, and owner drop/unknown retention.
Use only test-owned roots and synthetic store contents, no TPM/key/legacy files.
Real process-cut/restart and power-loss remain distinct later gates. No such native
runtime is run or inferred from historical D1 PASS in this checkpoint.

The new disposable store regression verifies separate stores do not inherit old
trust and a completed new QR still has no grant, including after reopen. It uses
the same synthetic SPKI/epoch deliberately: this is store isolation only, not
hardware freshness, generation selection or Windows object-binding acceptance.

## Authorized disposable runtime checkpoint — 2026-10-23

All five prepared exact ignored native cases executed once and passed/exit0. Actual lock contention/lifetime, private VFS DB/WAL identity before SQL, EXCLUSIVE query/write without SHM, single-admission second-connection refusal, rejected main-handle refusal and missing-WAL no recreation passed at fixture scope. This supersedes earlier NOT_RUN/pending-runtime descriptions only for these five cases. Full production generation/legacy/role/ACL/TPM/publisher/crash/powerloss remains untested; fresh bootstrap and live-switch remain incomplete. See evidence/windows-publication-d1-2026-10-21/d3-native-runtime-20261023T102540Z.json.
