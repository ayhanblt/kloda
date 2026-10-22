# Windows authority publication and interrupted initialization — proposed design

2026-10-22 **Windows D2 sözleşme dilimi doğrulandı; D2 production entegrasyonu engelli, D3 generation tasarımı ayrıntılandırıldı.** Kullanıcı doğru içerik+final ad birlikte kalıcı olmadan başarı verilmemesini ve eski veriyi koruyan fresh trust yönünü onayladı. Yalnız cfg(test) hata/durum sözleşmesi değişti; iki decoder regresyonu dahil8 exact pure Windows testi PASS/exit0, final locked/offline/no-run build0. Fixture/token API/owner/TPM/authority runtime yok. Microsoft belgeleri file-handle flush/write-through ile rename metadata kalıcılığını destekliyor; tam native zincir için yeterli composition kanıtı henüz kurulmadığından production'a taşınmadı. D3 native generation/no-fallback yönünü kullanıcı tasarım olarak seçti; selector durability, eski executable coexistence, rollback witness ve eski yedeklerin verified erişimi açık entegrasyon kapılarıdır. Namespace/key yaratılmadı. [Tasarım ve kabul tablosu](windows-d2-d3-contract-and-fresh-trust.md), [seçilmiş kanıt](evidence/windows-publication-d1-2026-10-21/d2-d3-contract-20261022T150939Z.json). Fmt/clippy explicit toolchain'de kurulu değil; PASS iddiası yok. Fiziksel duraklatma, cert replacement/SQLite binding ve veri/Git sınırları korunur. Aşağıdaki önceki duruş/onay checkpoint'leri tarihsel kapsamlarıyla okunur.

Date:2026-10-21. Status: **D1 test-only source/host scope approved and prepared; D2/D3 production/recovery decisions OPEN**. Ayhan authorized preparing this design after the confirmed `epoch.pending` refusal. This document does not authorize product code, a new Windows run, cleanup/adoption/reset, fallback or a physical-pause lift. Source baseline:HEAD4fdda80 with the reviewed diagnostic delta. Related: [root cause](windows-startup-root-cause-2026-10-21.md), [ADR0015](../decisions/0015-desktop-platform-and-signing-isolation.md), [ADR0016](../decisions/0016-v1-pc-local-file-authority.md).

## Problem and success boundary

Two different problems require separate evidence:

- Current existing owner cannot start because `prepare` rejects the preserved16-byte `epoch.pending`. Relaxing the filename check would next hit `CREATE_NEW` collision. No extra owner retry or label cycle is useful for that known layout.
- The original operation that left this staged file is unknown. A replacement publication design must be evaluated under existing confinement, sharing and durability conditions; it must not assume the original rename cause or weaken checks until a fixture succeeds.

**The first proposed slice does not make the existing Windows installation usable.** It prepares a narrowly isolated absent-target publication candidate and its tests while preserving the current product path. Adoption or reset of historical state is separately unapproved. Passing a disposable fixture is not full Windows/platform/physical acceptance.

## Existing structures and callers

| Mechanism | Existing code | Consequence |
|---|---|---|
| Bootstrap ordering | `initialization.rs:28–61` | Protected storage/epoch precede hardware key, certificate, SQLite. Transfer journal cannot repair an installation that cannot open the DB. |
| Staged publisher | `installation_windows.rs:116–163` | CREATE_NEW → same staged file write/flush → MoveFileEx → flush/checks. Interrupted pending evidence is deliberately retained. |
| Bootstrap epoch | `installation_files.rs:46–64` | No final epoch/bound marker leads to new random bytes, not adoption of pending. |
| Hardware alias | `identity.rs:47–75` | Path+epoch select identity alias; changing epoch can change the hardware-key namespace. |
| Certificate | `initialization.rs:116–150` | **Even initial absent certificate creation calls `replace`.** Dispatch must distinguish actual target absence from an existing-target renewal; function name alone is insufficient. |
| Other writes | `initialization.rs:65,106` | `initialized` and `listener-port` are create-only; no overwrite/reset. |
| SQLite | `store.rs:23–100` | Own WAL/schema/installation validation exists; real opened DB/WAL/SHM object binding remains a separate Windows gate. |

No second transfer journal, scheduler, framework, new crate or platform provider is proposed. A bootstrap transaction record, if ever needed for recovery, must be justified separately because the existing receiver journal is unavailable before initialization; none is added in this slice.

## Options and recommendation

| Option | Effect | Recommendation |
|---|---|---|
| Add pending to allowlist / delete pending / promote its16 bytes | First merely moves the refusal; latter two choose a new recovery/identity policy without sufficient evidence | Reject as a fix; keep current data untouched. |
| Change production rename immediately | Might avoid one path but lacks sharing/durability/continuity evidence and does not authenticate historical pending | Do not ship on current evidence. |
| Prepare one absent-target, same-source-handle candidate in isolated fixtures; production path unchanged | Bounds API/ABI/state exploration and produces reviewable code without claiming the current owner is repaired | **D1 approved and source/host scope prepared; Windows execution remains unapproved.** |
| Full auto-recovery with new bootstrap records/hardware witness/layout | Needs a complete identity/rollback and crash-recovery protocol, compatibility and explicit policy | Defer as a separately designed decision; no implicit adoption. |

## Proposed native candidate (not selected for production)

Use the existing pinned **windows-sys0.61.2** bindings for `NtSetInformationFile(FileRenameInformation)` with `FILE_RENAME_INFORMATION`. Required additional target-Windows feature gates are `Wdk_Storage_FileSystem` and `Win32_System_IO`; no crate/version or hand-written FFI is proposed. Both symbols and feature names were inspected in the locally installed SDK crate. D1 later approved this expansion for test builds only; the implementation scopes it to Windows dev-dependencies. Production integration remains unapproved.

Microsoft explicitly documents a simple filename with NULL RootDirectory as a rename within the same source directory; FALSE ReplaceIfExists causes an existing-target failure. The native API requires DELETE access on the source. These are API contracts, not observed success with Kloda's retained handles. [Native rename structure](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ntifs/ns-ntifs-_file_rename_information), [native operation](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ntifs/nf-ntifs-ntsetinformationfile).

Use the **native** structure/operation contract together. Do not silently substitute the Win32 `FILE_RENAME_INFO` relative-path rules: its documentation describes process-current-directory-relative paths; it does not establish the required source-parent interpretation. [Win32 structure](https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-file_rename_info).

Proposed fixture algorithm:

1. Establish the existing owner/ancestor, actual KnownFolder, fixed local NTFS, ACL, no-reparse and single-link checks. Fixtures use disposable owned directories and test-internal entry points only; no environment override or caller-path bypass reaches production `prepare`.
2. Destination is a compiled internal final basename (`epoch`, `initialized`, `listener-port`, or **absent** `certificate.der`), not a renderer path. Reject separators, absolute/drive/UNC syntax, stream colon, NUL, traversal and unknown names in the buffer builder.
3. Create the corresponding staged leaf with CREATE_NEW on **one** synchronous handle, requesting read/write plus DELETE at creation. Retain that handle through validation, byte write, flush, rename and post-validation. Do not reopen with weaker sharing or release pinned ancestors. Proposed source share allows reads but denies competing writes/deletes; exact rights/sharing compatibility must be tested without relaxing directory sharing. No FILE_SHARE_WRITE/DELETE expansion to existing authority/ancestors is a fallback.
4. Validate staged object type/attributes/link count, exact protected owner/DACL and object identity. Write expected bytes and require successful pre-publication file flush; keep FILE_FLAG_WRITE_THROUGH. Fail without deleting/adopting state on error.
5. Construct an appropriately aligned SDK-layout variable-length buffer with checked offsets, allocation size and UTF-16 byte length. Set ReplaceIfExists=false, RootDirectory=NULL and only the compiled destination basename. No POSIX/bypass-access-check/read-only-ignore/replace flags. The **rename itself**, not an earlier existence check, must refuse a destination introduced in a race.
6. Invoke the native operation on the original source handle. Validate synchronous completion and IO_STATUS_BLOCK. Never treat a nonnegative `STATUS_PENDING` as completed success. No async wait/extra handle/retry mechanism is presumed; unsupported/uncertain completion fails the candidate acceptance. Preserve the real NTSTATUS; any Win32 mapping must use the explicit status, not GetLastError. Numeric diagnostic extensions require privacy/error-preservation review; no public PairingError/wire/renderer ABI change is presumed.
7. Require post-publication file flush and metadata/ACL/final-path checks on the same source object. Compare file ID+volume identity with the pre-rename object. Verify target correspondence without permitting replacement or competing-writer adoption. If later checks fail after namespace change, report failure/uncertain outcome; never retry creating a new epoch or declare that no effect occurred.
8. Durability acceptance remains a **blocking condition** below. A runtime file/path match cannot be promoted to a power-loss guarantee.

Keep the candidate test-only and reuse existing checks; do not add an unused production helper. Host tests of input lengths/state/model buffers do not establish Windows SDK ABI layout. The actual SDK structure layout and call require Windows-target compilation. Do not wire this helper into product startup or existing `replace` during the first source/test slice. Any future production integration needs an explicit proved durability contract and separate review. Existing-target certificate renewal is outside the candidate; do not leave a new production absent-target path silently falling back to the old unproved replacement path.

## Durability: unresolved acceptance condition

Current code requests MOVEFILE_WRITE_THROUGH plus file write-through/pre/post flush. The native rename contract and `FlushFileBuffers(file)` documentation do **not by themselves establish equivalent persistent directory-name publication**. Do not remove the old flag by claiming equivalence without evidence. Microsoft describes MoveFileEx write-through separately from flushing a file's buffers. [MoveFileEx flags](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw), [file flush](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers).

A future product decision must state the supported NTFS/storage assumptions, completion/rename metadata persistence contract, and behavior after a crash or lost reply. Process-kill/restart proves a scoped crash scenario, not electrical power-loss or hostile full rollback. No admin volume flush, changed ACL/sharing, directory-write-handle workaround, ignored error, TxF, copy/delete, delayed reboot, software key or silent fallback is authorized. If the candidate cannot meet the existing durable authority requirement under these boundaries, **stop it as unfit**; do not lower the requirement to make it pass.

## Recovery state matrix (proposal; not new authority)

| Observed state | Safe behavior / proof boundary |
|---|---|
| Historical pending, including this PC's `epoch.pending` | Preserve, stop before identity/DB/listener; explain interrupted initialization. No promotion, deletion, fresh epoch, or auto-retry. New metadata cannot retroactively authenticate it. |
| Newly created pending, failure before rename or process termination | Preserve pending. Without a separately approved durable intent/identity protocol, next launch also fails closed. Candidate does not promise automatic recovery. |
| Rename returned success but later flush/validation failed or response lost | Preserve available evidence, report uncertain outcome. No new epoch regeneration/automatic republish. Final-name visibility alone is not an ACK. |
| Final epoch present but initialization markers incomplete | Inventory is not proof of freshness/continuity. Do not expand existing resumption into a newly accepted recovery policy; later source integration must reconcile exact identity/certificate/DB evidence under the independent continuity decision. |
| Final epoch+hardware key+certificate+DB+initialized all present | Use existing validation; agreeing copies are not an independent rollback witness. Not a new promise that restored/revoked trust survives. |
| Missing/mismatched epoch, hardware identity, cert, DB, ACL, or suspicious restore | Fail closed. No credential/peer/grant inheritance or automatic reset. |
| Existing certificate target / pending renewal | Separate replacement/target-race/recovery design needed; no absent-target workaround. |
| Unknown file/reparse/hardlink/outside-root target | Preserve refusal and do not scan/remove/adopt. |

Thus the current Windows PC stays blocked until an explicit safe recovery route is approved and proved. Choosing a different directory/user/profile merely to get a green run is not part of this proposal. Any future fresh-install path must explicitly keep old state and user backups, require fresh QR plus separate grant, and resolve the namespace/hardware witness policy; no reset UI or migration is introduced now.

## Validation plan — none executed by this design task

| Phase | Required evidence | Limit / stop condition |
|---|---|---|
| Host tests of pure input/buffer/state logic | Fixed leaves, Unicode/overflow/alignment and reject invalid paths; no-replace/completion-state branches; failure never becomes success; existing label/error privacy preserved | Host stubs do not exercise Windows native API or prove storage. |
| Source checks and review | Native regression, fmt, strict Desktop clippy/size guard, relevant build/typecheck; independent security review of connected calls and unsafe buffers | Windows branches require real target compile; no false host-only Windows PASS. |
| Existing Windows checkout build-only, after reviewed transfer | Exact SDK feature/ABI/native compilation; no production owner open | Source build is not runtime acceptance. |
| Explicitly authorized Windows disposable candidate execution | Single-handle same-directory rename, target collision/race preserving bytes, staged/final file ID+ACL, injection before/after write/flush/rename/postcheck, lost response and process restart, unrelated files retained | New bounded test, not a repeat of old MoveFileEx32/directory-reopen5 probes. Needs separate permission before any Windows execution; no current authority state used. |
| Product integration gate | Documented acceptable metadata persistence and recovery evidence; cert/SQLite/continuity decisions accounted for; no current-state adoption | Candidate fixture success alone is insufficient. Physical pause remains. |

Actual staged certificate name is `certificate.pending` (`with_extension("pending")`), not `certificate.der.pending`; any future test must use the real name. No test budget, timeout, retry, API/CLI version or dependency version changes are selected. The Desktop5-attempt/60-second WebDAV policy is unrelated to native installation and stays unchanged.

## Decisions requested

**D1 — approved source/test slice:** user approved preparing only the isolated absent-target native candidate and automated host tests using the two SDK feature gates above, with production startup unchanged and no Windows execution. This source/host scope is prepared; all security checks, no-replace and explicit durability-blocked status remain required. See the dated delivery section below.

**D2 — later product publication:** conditional on D1 evidence, choose an acceptable persistence API/protocol; unresolved durability does not authorize production replacement. Certificate renewal and SQLite-object binding require separate concrete designs, not an inferred approval bundled into D1.

**D3 — historical interrupted initialization / continuity:** define what independent durable identity/intent evidence could permit recovery, or select an explicit fresh-trust route with preserved old data. The existing `epoch.pending` cannot meet a newly invented transaction proof retrospectively. No existing data mutation or namespace/profile choice is requested now; the safe current behavior remains refusal. This proposal does not claim D3 solved.

## Review and evidence provenance

Prepared from current source, previously retained user-reported observations and current primary Microsoft API contracts. Context7 resolved Windows Rust and confirmed the NtSetInformationFile binding; Microsoft native/Win32 structure documentation supplied semantics. No old probe was repeated. No application, owner, test, build, device or Windows command was executed. Prior PASS records remain historical. Separate read-only security/design review completed: no must-fix finding for D1 approval only. Reviewer required explicit test-only candidate placement and no host-only Windows ABI claim; both limits are incorporated above. Reviewer ran no implementation, tests, Windows API or probes. This is not implementation or platform acceptance.

## D1 source and host verification — 2026-10-21

User approved the proposed first slice with “ierle”. D1 is implemented solely behind cfg(test): `windows_publication_contract.rs` plus nested `installation_windows_candidate{,_buffer,_fixture,_tests}.rs`. Existing production selection, allowlist, publication/init, ABI/status codes, keys/certs/epochs/ACL/journals and retry behavior are unchanged. Only cfg(test) accessors for validated KnownFolder and existing final-path validation were added; no arbitrary-path production bypass. The same pinned SDK has two extra features only under target-Windows dev-dependencies; no crate/version/lock change.

The candidate uses one synchronous CREATE_NEW source handle with read/write/DELETE access and read-only sharing, the retained original owner/ancestor handles, protected ACL/no-reparse/single-link/NTFS checks, pre/post flush, checked aligned SDK rename buffer, FALSE replacement and NULL root. It checks real returned status and IO_STATUS_BLOCK; unexpected pending retains stable heap request/status plus source and original pins until process exit, avoiding premature release without an async wait/retry. A successful check yields only `NamespaceObservedDurabilityUnproven`, never durable authority completion. Actual code is not reachable from production owner startup.

| Evidence | Observed scope |
|---|---|
| Native139 tests,0 failed/ignored; doctests0 | PASS macOS host/software fixtures; Windows candidate modules excluded by target cfg. |
| Four new contract tests | PASS, including final rerun after equivalent clippy correction/dev-only scoping: fixed leaves/real staged names, hostile/Unicode input rejection, checked model size/offset/alignment/overflow, pending/warning/error/postcheck refusals. No Windows ABI claim. |
| fmt, strict Desktop all-target clippy,300-line guard | PASS. Initial modulo-style lint corrected using is_multiple_of; no warning suppression. |
| Desktop macOS build | PASS renderer/main/shared TypeScript, native release, Electron SQLite packaging driver and Vite; no app/owner launched. |
| Independent security/source review | No concrete finding for D1-only scope. Reviewer ran no tests/build/probes. |
| Windows SDK memory-layout test | Prepared, NOT COMPILED/RUN here; no Windows target is installed or speculatively added. |
| Five mutating Windows fixture tests | Prepared and explicitly ignored pending runtime permission: absent targets/unrelated files, existing target collision, existing pending preservation, cut points/lost reply, target introduced immediately before rename. NOT COMPILED/RUN here. |

Fixtures only create fresh random test roots under the actual validated LocalAppData with a private constructor, retain original ancestor/owner pins, and never reuse the real development/production pairing root. They intentionally retain disposable evidence and have no recursive cleanup. Test injection uses ordinary returns at create/write/preflush/rename/postflush/verified boundaries; **not genuine process-kill/restart evidence**. Retrying the disposable candidate cannot overwrite a final target or adopt pending, but no installation-recovery promise follows.

Local observed-result/source-hash/review records: `.local-evidence/windows-publication-d1-2026-10-21/`. UI/visual316 tests were not repeated for this test-only slice. Existing Windows owner remains blocked with `epoch.pending`; no state changed by this host work. D2 metadata persistence/power-loss, D3 historical recovery/continuity, certificate renewal and SQLite object binding remain open.

**Next single step, not authorized/executed:** reviewed source transfer and Windows test-binary compile only, with no tests or owner startup. Compiling the Desktop production build alone cannot validate cfg(test) candidate code. Windows native runtime fixtures, genuine process restart and physical acceptance each retain their explicit permission/evidence gates. No pending reset/adoption is bundled into compilation.

## D1 compile-only transfer — 2026-10-21

After D1 source/host delivery, Ayhan approved the proposed next source transfer and Windows library test-binary compile, with no test/runtime execution. This narrowly supersedes earlier “compile not authorized” text only for the described command, not D2/D3 or physical acceptance.

Package: `.local-evidence/windows-publication-d1-2026-10-21/transfer/kloda-windows-publication-d1-source-delta.zip` (21,321bytes;13entries;10source payloads). SHA256 `d38f37b4d16a785271f39acba39ad52c52293eab93f54d26949509793bae17bb`. Manifest SHA256 `d847ab0789d04fdcb3bccb4114bc946223abf968d6a5f1382c990bd845694419`. Existing five-file baseline is commit4fdda80599337d9e8aeb630f62be1a29b0480aad; other five must be absent or match the new hash. No authority, state, archive, Git or dependency-install artifact included.

The source-only script preflights all10 fixed paths/payloads, rejects custom edits/reparse ancestors, saves original existing bytes, inserts NEW files without overwrite, accepts only strict UTF8 BOM/CRLF normalized baseline/new states, and checks written hashes. Copy failure may leave mixed source, requiring stop/report with backups; no automatic rollback/cleanup. Original packages are immutable. Package CRC/whitelist/baseline/new/custom predicates/source equality and independent actual-package review PASS; PowerShell runtime NOT RUN here.

After successful apply, use the existing explicit1.99.0-x86_64-pc-windows-msvc toolchain and x86_64-pc-windows-msvc target to compile the library tests with `cargo test --lib --no-run --locked --no-default-features`. [Official Cargo --no-run documentation](https://doc.rust-lang.org/cargo/commands/cargo-test.html) confirms compilation without execution; --lib includes the cfg(test) candidate omitted by a Desktop production build. Stop on a missing toolchain/compiler error; no install/update, removing --locked/--no-run, target change or code bypass. No npm ci, new Desktop launch, actual tests/ignored fixtures, owner/probe/TPM/key/authority operation is authorized.

**Awaiting user output:** no Windows compile has been observed for this candidate yet. No D1 automated checks were rerun for this transfer-only preparation; their prior scope remains. Evidence and reviewed commands are in the package README and local `transfer-preparation/` records. Source apply/build artifacts are the only approved changes; actual runtime/physical gates stay paused.

## Windows D1 test-binary compile observed — 2026-10-21

2026-10-21 Windows D1 test compile observed (user-reported): ZIP verified, `SOURCE_DELTA_APPLIED`, explicit MSVC1.99.0 + x86_64-pc-windows-msvc `cargo test --lib --no-run --locked --no-default-features` completed in27.31s and emitted `WINDOWS_D1_TEST_COMPILE_COMPLETED` plus test executable. Windows-only cfg(test) candidate/SDK types now compile; **no test/SDK-layout assertion/native rename ran**. Six existing-source warnings remain: unnecessary unsafe route_windows_query:155, unused io_error and four SDK pattern-name warnings; no D1 file warning shown, not strict Windows clippy PASS. Source apply/backup message observed via user transcript. Local evidence `windows-test-compile-user-reported.json` under `.local-evidence/windows-publication-d1-2026-10-21/`. Next proposed permission is ONE exact ignored absent-target candidate test using four fresh disposable KnownFolder test roots; no existing authority/TPM/owner/network/QR/grant/cleanup. Not authorized or executed yet. Current Windows owner remains blocked; D2 durability/D3 recovery and other platform/physical gates remain open. No new local tests/builds or Windows commands run by agent for this record.

Proposed next exact test: `installation_files::windows::candidate::tests::absent_targets_use_one_object_and_never_claim_durability`, once and alone. It loops over four fixed final names, each in a fresh random `Kloda.NativePublication.Test.<nonce>/pairing` under native validated LocalAppData, creates a disposable owner lock/test data/unrelated fixture file, runs the new single-handle rename and file/ACL/identity checks, and retains the test roots without cleanup. No existing dev/prod pairing directory or archive is used; it does not open a PairingOwner, hardware key, listener or grant. A failure stops the test; do not repeat automatically. This requires a separately scoped runtime permission, not implied by the completed compile-only step. It cannot establish power-loss durability or recover the preserved historical pending file. No other ignored test or historical probe is included.

## D1 first fixture permission — 2026-10-21

2026-10-21 scoped D1 runtime permission: after successful Windows test-binary compile, Ayhan explicitly approved ONE exact ignored `installation_files::windows::candidate::tests::absent_targets_use_one_object_and_never_claim_durability` case. Command performs a list-only exact-name preflight, then one single-threaded case execution using the reported binary4db531d21f449c60; up to four fresh random KnownFolder fixture roots, no current pairing root/archive/TPM/listener. Disposable data/owner locks are retained; no cleanup or retry. **User execution/result pending, not PASS.** Other tests/owner/probes/physical acceptance remain unauthorized/paused. Command/scope: `.local-evidence/windows-publication-d1-2026-10-21/run-one-absent-fixture.ps1` and `one-absent-fixture-authorization.json`. No new local or Windows test was run by agent to prepare this command.

## First candidate runtime evidence — 2026-10-21

2026-10-21 first Windows D1 fixture PASS (user-reported): exact absent-target case1 passed/0 failed/0 ignored,148 filtered,0.11s, final `WINDOWS_D1_ONE_FIXTURE_COMPLETED_NOT_PLATFORM_ACCEPTANCE`. Reviewed source establishes all four fixed target names in fresh KnownFolder fixtures completed native single-handle no-replace rename, file flush-return/ID/volume/final-path/ACL/content checks and unrelated-file preservation. Result remains `NamespaceObservedDurabilityUnproven`; no power-loss/process-restart/historical-pending/current-owner/custody/product acceptance inferred. One-case permission consumed; no repeat/other ignored tests authorized. Proposed next group: four remaining exact collision/pending-preservation/injected-cut+lost-reply/late-target cases, fail-stop, at most nine fresh roots, no current authority/TPM/owner/network/cleanup. Awaiting explicit approval. Local evidence `.local-evidence/windows-publication-d1-2026-10-21/windows-first-fixture-user-reported.json`; no agent-local test/build/probe rerun.

The148 filtered-out cases were not executed by this command. Injected cutpoint/lost-reply behavior is still unrun and, even if later passing, is not real process-kill/power-loss proof. Current evidence validates a conditional same-handle primitive in the observed environment, not a production storage API/durability/recovery decision. Original pending cause is not retroactively established.

The next proposed four exact names under `installation_files::windows::candidate::tests::` are `rename_atomically_refuses_existing_target_and_preserves_pending`, `existing_pending_is_not_adopted_deleted_or_overwritten`, `injected_cut_points_and_lost_reply_never_ack_or_regenerate`, `target_appearing_after_preflush_is_not_replaced`. Each would run once with exact ignored selection and one test thread; stop before the next test on failure. At most nine fresh roots (1+1+6+1), retained for evidence. No runtime permission yet; do not invoke all-suite or include-ignored wildcard commands.

## Windows CLI task handoff and portable evidence — 2026-10-21

2026-10-21 Windows CLI görev devri: kullanıcı sonuçları ana macOS oturumuna getirip burada devam edecek. [Windows-only devir belgesi](windows-codex-d1-handoff.md) ve [başlangıç prompt’u](windows-codex-d1-prompt.md), frozen kaynak/hash ve güncel derlemeden seçilen ikiliyle yalnız kalan dört exact ignored fixture’ın birer kez/fail-stop çalıştırılmasını kapsar; genel roadmap, kaynak düzeltmesi, owner/probe/cleanup/Git/model değişimi yok. [Git’e uygun seçilmiş kanıtlar](evidence/windows-publication-d1-2026-10-21/README.md) geçmiş host/Windows compile/ilk1PASS ile kalan4NOT_RUN ayrımını taşır; `.local-evidence` gerektirmez ve ignore kuralı değişmedi. Bu belge hazırlığında test/build/cihaz çalıştırılmadı. Kullanıcının Windows prompt’unu vermesi bu dört teste dar yürütme iznidir; sadece belgeyi okumak izin değildir. Sonuç ne olursa olsun raporla/dur; devam ana oturumda.
