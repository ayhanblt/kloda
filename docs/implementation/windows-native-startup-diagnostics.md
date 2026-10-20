# Windows native startup diagnostics — 2026-10-20

Ayhan approved a narrow diagnostic slice, followed by a reviewed source overlay for the existing Windows test checkout. This does not approve a rename replacement, relaxed permissions, a new identity/storage provider, authority recovery/reset, application startup or lifting the physical-test pause.

## Scope and output

The existing `initialization::open` sequence now carries fixed stage labels: Directory, Storage, Windows OwnerLock, Epoch, Continuity, Identity, Certificate, Database and Initialized. No checks, filesystem operations, CNG calls or ordering are removed. Existing `PairingError` values, renderer/native ABI and frozen wire/status codes are unchanged. No new renderer method, persistent diagnostic file/table, telemetry or dependency is added.

On Windows only, a failed installation-open attempt emits at most one sanitized stderr line. Memory-only state is thread-local and scoped to the attempt; nested attempts/unwinding restore the previous state. Success emits no diagnostic. An unavailable output sink is ignored without replacing the original failure. Outside Windows production builds the wrappers pass through without diagnostic output.

**Synthetic example, not an observed Windows result:**

```text
KLODA_STARTUP stage=Epoch operation=Some(CreateNew) code=storage_failure win32=Some(183)
```

The output accepts only compiled stage/operation enums, existing closed error codes and optional numeric OS codes. It cannot carry paths, usernames, directory listings, credentials, key handles, SPKI/fingerprints, certificates, epochs, pairing/QR data or file contents.

- Failed Windows BOOL calls capture `GetLastError` immediately at the checked boundary. Successful calls and expected missing-file/directory-already-exists branches do not create a failure record.
- `GetSecurityInfo` reports its returned error code directly; the code is not read from `GetLastError`. See [Microsoft's contract](https://learn.microsoft.com/en-us/windows/win32/api/aclapi/nf-aclapi-getsecurityinfo).
- `GetFinalPathNameByHandleW` zero return captures the real error; insufficient buffer or mismatched verified path is a separate `FinalPathValidation` with no OS code. File attributes/link identity/type and local-volume policy rejections likewise have validation labels and no fabricated OS code. See [Microsoft's contract](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfinalpathnamebyhandlew).
- Security/SID/ACL validation refusal is distinct from a failing OS operation. An underlying first API failure wins over outer generic error propagation.
- Not every underlying failure exposes a Win32 number: HRESULT-only KnownFolder failures, provider/certificate/SQLite errors, cached failures and higher-level policy checks may contain `win32=None` and sometimes `operation=None`. The stage and original closed error remain useful; absence of a number must not be interpreted as success or proof of a particular cause.

## Existing Windows state is preserved

The earlier user-reported owner `storage_failure` and probe32/5 results remain historical and inconclusive as to the original failing operation. Current startup still refuses a pre-existing `epoch.pending` through `CREATE_NEW`. It neither deletes nor adopts that file. A later diagnostic could identify the existing pending collision rather than reproduce the original rename failure. Do not infer TPM key existence, identity acceptance, repaired continuity or successful rename from the presence of a diagnostic line.

Certificate replacement, exact SQLite DB/WAL/SHM object binding and independent continuity-witness decisions remain blocked. A diagnostic does not resolve those designs. No new probe or Windows investigation was performed for this slice.

## Observed verification

- Seven new native tests PASS: innermost error/original result, fresh-attempt/no-stale-code behavior, all stage classifications, bounded closed output labels, nested/unwinding state and thread isolation. The seventh test launches three separate native test child processes for synthetic publication32, pending183 and validation/no-code cases. A disposable pre-existing16-byte pending file remains exact in every child. Windows numbers are explicitly injected; the host filesystem assertion is not a Windows API or original-error reproduction.
- Full native locked suite:134 PASS,0 ignored; doctests0. Existing loopback tests used approved outside-sandbox execution. No existing production authority was opened; tests use disposable fixtures.
- `cargo fmt --check`, strict Desktop all-target clippy (`--features desktop-node --all-targets -- -D warnings`) and Rust300-line guard PASS. An initial Mac-only unused import was corrected with cfg gating; no warning suppression.
- Desktop build PASS on macOS: renderer/main TypeScript, shared core compilation, actual Electron SQLite packaging, native addon release build and Vite bundle. Existing Desktop316 UI/runtime tests are historical from the previous group and were not rerun for this native-only slice; no new visual claim.
- Source-overlay builder's two self-tests PASS; actual generated ZIP is reopened and every entry/size/hash is verified before delivery. Independent source/security review checked diagnostic privacy/error preservation and source-package boundaries; no unresolved concrete finding. Reviewer ran no tests/probes.

**NOT RUN:** current Windows target compilation, current Windows owner/TPM/storage/diagnostic stderr, Windows setup/tray/login/device-key TLS, real transfer or physical acceptance. Windows Rust target/toolchain is not installed on this Mac and none was installed speculatively. Mac build/shared diagnostic tests do not compile or exercise the Windows-only API branches.

Local replay/results/scoped source snapshots: `.local-evidence/windows-startup-diagnostics-2026-10-20/`. These are Git-excluded local files, not independently backed up. See the [source transfer procedure](windows-source-transfer.md) and [paused platform gate](desktop-platform-validation-plan.md#güncel-yürütme-kapısı--fiziksel-doğrulama-duraklatıldı).

## Next action

Transfer only the reviewed source ZIP/manifest/hash to the existing Windows project via empty staging and manual source-conflict review. No new Windows account is required for this build-only stage. Build there without starting Electron/native owner. An actual owner/diagnostic run requires separate explicit permission to lift the relevant physical pause; it may write authority/TPM state and is not authorized by source transfer. Keep the old archive, keys, pins, certificates, epoch and authority untouched; do not clear `epoch.pending` to make startup pass.
