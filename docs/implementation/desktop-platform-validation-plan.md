# Desktop platform validation — source, VM and physical evidence

2026-10-21 Windows CLI görev devri: kullanıcı sonuçları ana macOS oturumuna getirip burada devam edecek. [Windows-only devir belgesi](windows-codex-d1-handoff.md) ve [başlangıç prompt’u](windows-codex-d1-prompt.md), frozen kaynak/hash ve güncel derlemeden seçilen ikiliyle yalnız kalan dört exact ignored fixture’ın birer kez/fail-stop çalıştırılmasını kapsar; genel roadmap, kaynak düzeltmesi, owner/probe/cleanup/Git/model değişimi yok. [Git’e uygun seçilmiş kanıtlar](evidence/windows-publication-d1-2026-10-21/README.md) geçmiş host/Windows compile/ilk1PASS ile kalan4NOT_RUN ayrımını taşır; `.local-evidence` gerektirmez ve ignore kuralı değişmedi. Bu belge hazırlığında test/build/cihaz çalıştırılmadı. Kullanıcının Windows prompt’unu vermesi bu dört teste dar yürütme iznidir; sadece belgeyi okumak izin değildir. Sonuç ne olursa olsun raporla/dur; devam ana oturumda.


2026-10-21 first Windows D1 fixture PASS (user-reported): exact absent-target case1 passed/0 failed/0 ignored,148 filtered,0.11s, final `WINDOWS_D1_ONE_FIXTURE_COMPLETED_NOT_PLATFORM_ACCEPTANCE`. Reviewed source establishes all four fixed target names in fresh KnownFolder fixtures completed native single-handle no-replace rename, file flush-return/ID/volume/final-path/ACL/content checks and unrelated-file preservation. Result remains `NamespaceObservedDurabilityUnproven`; no power-loss/process-restart/historical-pending/current-owner/custody/product acceptance inferred. One-case permission consumed; no repeat/other ignored tests authorized. Proposed next group: four remaining exact collision/pending-preservation/injected-cut+lost-reply/late-target cases, fail-stop, at most nine fresh roots, no current authority/TPM/owner/network/cleanup. Awaiting explicit approval. Local evidence `.local-evidence/windows-publication-d1-2026-10-21/windows-first-fixture-user-reported.json`; no agent-local test/build/probe rerun.


2026-10-21 scoped D1 runtime permission: after successful Windows test-binary compile, Ayhan explicitly approved ONE exact ignored `installation_files::windows::candidate::tests::absent_targets_use_one_object_and_never_claim_durability` case. Command performs a list-only exact-name preflight, then one single-threaded case execution using the reported binary4db531d21f449c60; up to four fresh random KnownFolder fixture roots, no current pairing root/archive/TPM/listener. Disposable data/owner locks are retained; no cleanup or retry. **User execution/result pending, not PASS.** Other tests/owner/probes/physical acceptance remain unauthorized/paused. Command/scope: `.local-evidence/windows-publication-d1-2026-10-21/run-one-absent-fixture.ps1` and `one-absent-fixture-authorization.json`. No new local or Windows test was run by agent to prepare this command.


2026-10-21 Windows D1 test compile observed (user-reported): ZIP verified, `SOURCE_DELTA_APPLIED`, explicit MSVC1.99.0 + x86_64-pc-windows-msvc `cargo test --lib --no-run --locked --no-default-features` completed in27.31s and emitted `WINDOWS_D1_TEST_COMPILE_COMPLETED` plus test executable. Windows-only cfg(test) candidate/SDK types now compile; **no test/SDK-layout assertion/native rename ran**. Six existing-source warnings remain: unnecessary unsafe route_windows_query:155, unused io_error and four SDK pattern-name warnings; no D1 file warning shown, not strict Windows clippy PASS. Source apply/backup message observed via user transcript. Local evidence `windows-test-compile-user-reported.json` under `.local-evidence/windows-publication-d1-2026-10-21/`. Next proposed permission is ONE exact ignored absent-target candidate test using four fresh disposable KnownFolder test roots; no existing authority/TPM/owner/network/QR/grant/cleanup. Not authorized or executed yet. Current Windows owner remains blocked; D2 durability/D3 recovery and other platform/physical gates remain open. No new local tests/builds or Windows commands run by agent for this record.


2026-10-21 D1 compile-only transfer approved/prepared: Ayhan approved reviewed source transfer and Windows **test-binary compilation only**. Verified [10-source delta package](windows-authority-publication-recovery-design.md#d1-compile-only-transfer--2026-10-21) has five4fdda80 baselines and five NEW cfg(test) files; all-preflight/hash/reparse/custom-edit checks, original-byte backups and no-overwrite NEW insertion. Separate actual-package review clean; ZIP SHA256 `d38f37b4d16a785271f39acba39ad52c52293eab93f54d26949509793bae17bb`. Explicit installed1.99.0-x86_64-pc-windows-msvc + target + `cargo test --lib --no-run --locked --no-default-features`; official Cargo documentation confirms --no-run compiles without executing tests. Actual Windows apply/compile result **pending user output**; PowerShell not run on this Mac, no new native/host tests repeated. No test executable/ignored fixtures, owner/TPM/probe/cleanup/reset or physical acceptance authorized. Existing owner remains blocked; D2/D3/platform gates unchanged.


2026-10-21 approved D1 publication candidate: [test-only source and host verification](windows-authority-publication-recovery-design.md#d1-source-and-host-verification--2026-10-21) prepared same-source-handle absent-target NtSetInformationFile candidate, checked SDK buffer/completion/identity, and only `NamespaceObservedDurabilityUnproven` output. Two additional features use existing SDK0.61.2 in Windows dev-dependencies only; all helpers/callers cfg(test), product startup/publication unchanged. Host native139/contract4/fmt/strict Desktop clippy/lineguard/Desktop macOS build PASS; separate security review clean. Actual Windows compile/SDK-layout test and five ignored mutating fixture tests NOT RUN; cutpoints are not process restart proof. Current Windows pending/keys/authority untouched, owner still blocked. D2 durability and D3 recovery/continuity plus certificate/SQLite-object decisions remain OPEN. Next proposed step is Windows test-binary compile only, after approval; no runtime/physical-pause lift. Local evidence `.local-evidence/windows-publication-d1-2026-10-21/`.


2026-10-21 design-only follow-up: [Windows authority publication/recovery proposal](windows-authority-publication-recovery-design.md) separates an isolated same-source-handle absent-target native rename candidate from production metadata durability, historical pending recovery, certificate replacement, SQLite-object binding and continuity witness decisions. **D1 source/test slice is proposed, not approved or implemented**; SDK0.61.2 feature expansion/API choice is awaiting approval. Existing Windows state remains blocked and untouched; no automatic pending adoption, cleanup, new namespace or reset is selected. New candidate runtime, owner/probe and physical work are not authorized. No tests/builds/devices ran for this design task; current primary API documentation was read only. Prior test/build results retain dated scopes.


2026-10-21 root-cause checkpoint: second authorized user-run returned `Storage/Some(LeafNameValidation)/storage_failure/win32=None`. Exact guarded two-file layout plus current source identifies **`epoch.pending` rejection** in prepare; directory/OwnerLock stages passed this attempt, Epoch/Identity/certificate/DB were not reached. Adding pending to the allowlist alone cannot recover: `epoch()` would next attempt `CREATE_NEW` on the preserved pending file. Original operation that first left pending remains unproven; old probe32/5 is not original app evidence. Local clean HEAD4fdda80 includes Windows commit52a9c67 and three source hashes match the prepared delta. Separate read-only review agrees. **One-shot consumed; no retry/probe/cleanup/reset/adoption authorized.** No tests/builds/device commands ran for this investigation. Next scope is Windows authority publication/interrupted-initialization recovery design, requiring an explicit safe recovery/API decision before implementation. [Full source-backed findings](windows-startup-root-cause-2026-10-21.md).


2026-10-21 scoped follow-up runtime permission: after the refined diagnostic delta applied and built successfully on Windows, Ayhan explicitly approved one guarded native startup attempt. Reuse the exact previously reviewed command (recorded at `.local-evidence/windows-startup-labels-2026-10-20/owner-once.cjs`): development win32/x64 only, exact existing two-entry partial layout and expected sizes/single links, one native open, immediate close on success, stop on any guard/error/result. Result is **awaiting user execution**, not PASS and not yet observed. This call is not read-only: native initialization/TPM/listener effects are possible if earlier stages pass. No QR/grant/transfer/probe/cleanup/reset/adoption or broader physical-pause lift is authorized. No further retry is implied by a failure. Authorization: `owner-once-authorization-2026-10-21.json`; prior 2026-10-20 permission remains separately consumed.


2026-10-21 refined Windows diagnostic delta applied/built (user-reported): verified ZIP `319120fa…bbddb`, `SOURCE_DELTA_APPLIED` (script reported original source backups), then `WINDOWS_DIAGNOSTIC_LABELS_BUILD_COMPLETED`. Renderer/main/shared TypeScript, Electron SQLite build driver, Windows MSVC native release including both new validation labels, and Vite build completed. Five existing Rust warnings remain (unused `file_sender_ack::io_error`, four SDK pattern-name warnings); this is not strict Windows clippy or unit-test acceptance. Actual PowerShell source apply is now observed via the user's transcript; earlier preparation-only NOT RUN records retain their dated scope. **No new native startup was run or authorized**: exact runtime cause remains unresolved, receiver readiness is not established, and the earlier one-shot permission remains consumed. Next action requires explicit permission for one guarded native startup using the existing two-entry state-layout checks, immediate close on success, no QR/grant/transfer/probe/cleanup. Local evidence: `.local-evidence/windows-startup-labels-2026-10-20/windows-delta-build-user-reported-2026-10-21.json`. No local test/build or Windows command was run by the agent to record this checkpoint.


2026-10-20 follow-up diagnostic labels (approved after the observed Storage failure): added fixed `PathSelectionValidation` and `LeafNameValidation` labels without changing selection, allowed names, errors, ordering or Windows storage policy. Existing lower-level API failures remain first; validation refusals have no fabricated Win32 code. Native135 tests (including8 diagnostic tests), fmt, strict Desktop all-target clippy,300-line guard and Desktop build (main/renderer/shared/native/SQLite/Vite) PASS on macOS; the new Windows-only allowlist test is NOT RUN here. Source/security review found no concrete regression. This does not establish the exact Windows cause or make the receiver ready; other untagged checks can still report `operation=None`. Three-source-file baseline-checked transfer preparation is isolated at `.local-evidence/windows-startup-labels-2026-10-20/`. The original package stays immutable. **No new Windows startup authorization**: the previous one-shot permission is consumed and physical pause remains. [Details](windows-native-startup-diagnostics.md#storage-validation-label-follow-up--2026-10-20).


2026-10-20 Windows one-shot result (user-reported): `NATIVE_STARTUP_ATTEMPT_ONCE` → `KLODA_STARTUP stage=Storage operation=None code=storage_failure win32=None` → `OWNER_OPEN_FAILED storage_failure`. The addon loaded and native initialization was attempted once; it failed before Epoch/Continuity/Identity/Certificate/Database. The receiver is **not ready**. No exact failing operation or Win32 code was obtained; this does not reproduce or establish the earlier rename error. Current `prepare` checks every entry through `path::leaf`, whose allowlist excludes the pre-existing `epoch.pending`; this is a source-supported explanation, not uniquely identified by this output because other Storage validation paths also lack operation labels. The one-shot permission is consumed: no repeat/probe/cleanup/reset is authorized and other physical work remains paused. Next smallest diagnostic candidate is fixed labels for remaining path-selection/leaf-validation refusals, preserving refusal policy; a further Windows run requires a new scoped authorization. Local evidence: `.local-evidence/windows-startup-diagnostics-2026-10-20/windows-owner-once-user-reported.json`. No new tests/builds or Windows commands were run to record this result.


2026-10-20 scoped exception: after Windows build success, Ayhan approved exactly one guarded existing-development native owner startup/close diagnostic. [Scope and guards](windows-native-startup-diagnostics.md#scoped-owner-start-permission--2026-10-20); result pending. Other owner/device/probe/QR/grant/transfer/platform/physical work remains paused. No cleanup/adoption/reset. This narrowly supersedes the blanket pause below only for that one observation.

2026-10-20 subsequent Windows build evidence (user-reported): source comparison found289 UTF-8 text files equal after CRLF/BOM normalization and1 byte-identical asset; no source overlay was needed. `npm.cmd ci` and `npm.cmd run build --workspace @kloda/desktop` completed with WINDOWS_BUILD_TAMAMLANDI. Windows native release/diagnostic source compiled and Vite/main/renderer build completed;5 Rust warnings remain, not a strict Windows clippy PASS. npm reported77 aggregate vulnerabilities (16 moderate/58 high/3 critical), deprecated packages and3 pending install-script approvals; advisory details/Desktop reachability not yet assessed, no automatic fix/approval/version change. No native owner/TPM/API-runtime/diagnostic execution or physical-pause lift is inferred. [Current Windows record](windows-native-startup-diagnostics.md#windows-build-only-follow-up--user-reported).

2026-10-20 current Windows slice: [startup diagnostics and source transfer](windows-native-startup-diagnostics.md) adds bounded fixed-label/numeric startup failure output while preserving security/status/ABI and all existing authority data. Seven diagnostic tests (three synthetic fresh-process cases), native134/fmt/strict Desktop clippy/line guard and macOS Desktop build PASS; source-overlay builder2 self-tests PASS and separate review clean. Actual current Windows compile/API/runtime NOT RUN. [Source-only transfer](windows-source-transfer.md) targets the existing Windows checkout via verified staging/source conflict review, then build only. No new account required, no owner/probe/physical-pause lift/cleanup/reset. Windows certificate/SQLite-object/continuity decisions remain open. Earlier dated checkpoints below retain their original evidence scopes.

2026-10-20 current: [Desktop durable WebDAV jobs + final host review](implementation-session-handoff.md#desktop-webdav-jobs-and-final-host-review--2026-10-20). Approved continuous execution through the feasible4–5 group delivered step3.2–3.5: safe settings-context stop/schedule identity, early durable results, persisted5/60 retry, independent-file review and explicit recheck/skip/verified keep-both. Filename PC+frozen UTC+revision approved; timeout unchanged/no new total limit. Desktop316 tests/29 files, lint/typechecks/build; native127 tests/fmt/strict Desktop clippy/line guard; actual HTTPS/SIGKILL/fresh-process recovery, atomic regression, compiled lifecycle and52 current Chromium screenshots PASS at fixture/host scope; independent review fixes verified. Large-file64MiB timing evaluated, no general response guarantee. Step3 and automatic portion4–5 complete; installed/platform/physical acceptance remains open/paused. Windows continuity/storage, macOS signing, Linux provider and real GNOME/KDE acceptance, Android suppression/rebackup runtime and old historical scope limits remain open. No Android/iOS development or platform probe started. Earlier dated entries below are historical, including per-slice approval language superseded for this authorized group.

2026-10-19 [device removal + trash checkpoint](implementation-session-handoff.md#desktop-device-removal-and-trash-preparation--2026-10-19), [ADR0019](../decisions/0019-desktop-device-removal-and-recoverable-backup-deletion.md): separate offline PC trust+ACL removal implemented, backups retained, explicit TR/EN/DE confirmation and durable reread; Desktop157/native109/lint/typecheck/build/clippy and isolated removal/restart/lifecycle checks PASS, review finding fixed. **Whole deletion request remains incomplete:**30-day trash/restore/expiry/source suppression/Photos graph not implemented. Photos selected-version versus all-versions choice requested; no destructive default inferred. No Android change, live archive/authority mutation, platform/physical acceptance or next jobs/settings/retry task.


2026-10-17 [approved PC-first Desktop integration](implementation-session-handoff.md#desktop-pc-first-main-flow--2026-10-17): option1 adaptation delivered default receiver home, native truthful status/blockers, explicit QR→separate folder/ACL, existing devices/incoming/settings, advanced WebDAV/draft preserved.146 Desktop tests/lint/typechecks/build and isolated actual Chromium flow +24 screenshots/3 locales/360–1280px PASS; independent review no unresolved findings. Native/main/preload/locks unchanged, no new native suite/physical/platform support claimed. Device removal,30-day reversible deletion, durable job/settings/retry assessment and platform acceptance remain open/not started. Ubuntu LTS/GNOME and Kubuntu LTS/KDE are unverified acceptance targets. [Detailed acceptance](desktop-pc-first-stitch-mapping.md#delivered-integration-and-acceptance--2026-10-17).


2026-10-16 [PC-first/Stitch mapping audit](desktop-pc-first-stitch-mapping.md): existing reference lacks Desktop receiver/QR/separate ACL layout. Adaptation versus new Stitch screens awaits user choice; no implementation or new test/visual acceptance claimed. Existing native/device/history/lifecycle evidence and all platform/physical gates unchanged.

2026-10-16 latest [Desktop device/permission management](implementation-session-handoff.md#desktop-device-and-permission-management--2026-10-16): native peer/pin records and separate current ACL/folder now have a paginated Desktop management surface; explicit foreground grant and ACL-only revoke preserve trust/files and background receipt. Desktop139/native106/lint/typecheck+build/strict Desktop clippy and isolated partial-transfer revoke + true child-process reopen + compiled lifecycle/renderer smoke PASS, not platform/physical acceptance. Independent review findings fixed. No device-removal/deletion policy added. Next Desktop group: approved PC-first/Stitch main-flow integration; platform blockers and physical pause unchanged.


Current policy: [ADR0015](../decisions/0015-desktop-platform-and-signing-isolation.md). macOS/Windows/Linux development jobs are independent; a paid Mac signing gate must not gate Windows/Linux builds. User-reported Windows evidence is recorded below; no new device, VM or CI execution is claimed by this document update.

2026-10-16 latest [incoming Activity evidence](implementation-session-handoff.md#desktop-incoming-progress-and-history--2026-10-16): existing native journal projection and separate Desktop view; Desktop126/native101/build/lint/clippy and isolated native true-process restart/progress plus compiled lifecycle/renderer reload PASS. Actual Windows/macOS/Linux close/reopen during real transfer, native-provider process restart, missing media/permissions and responsive/Stitch accessibility acceptance remain not-executed. These fixtures do not resume the physical gate or Windows storage investigation below.

2026-10-16 [ADR0018](../decisions/0018-desktop-background-receiver-lifecycle.md) and [implementation evidence](implementation-session-handoff.md#desktop-background-lifecycle--2026-10-16) now separate background authorized receipt from foreground trust/grant management. Normal Quit is confirmed, login-start explicit opt-in, observed errors drive the tray marker. Current Desktop117/native97/host build and isolated compiled lifecycle/renderer fixtures are not platform acceptance. No old manual blocks below are authorized by this update.

### Required future Desktop lifecycle acceptance — not executed

- Windows notification area and macOS menu bar: installed profile, close/minimize/blur/navigation while an authorized real-peer transfer continues; native foreground QR/candidate invalidation; no hidden new approval/grant. Reopen, sleep/wake/network loss, tray/theme accessibility and truthful error/recovery marker require actual OS/runtime proof.
- App/tray/keyboard Quit: Cancel retains work; confirmed active quit warns, waits for native close and preserves pending/acknowledged journals, no false Completed. Forced OS termination is crash recovery, not a guaranteed confirmation path.
- Packaged login-start: explicit opt-in/off, real OS disable/approval/block, profile-specific identity, hidden Windows/macOS launch only with usable tray. No startup registration was changed on the development host by this task.
- Linux shell support target: stable installed binary, XDG desktop session and usable StatusNotifierItem/AppIndicator/legacy tray. Electron cannot prove tray visibility; current implementation keeps the window visible at login until actual tray activation/menu reopen in that session, and keeps controls visible if tray is absent/unverified. GNOME without tray extension and other unsupported sessions must retain the window and show the limitation. AppImage transient-launch integration is not selected. No Linux distro/session has passed actual lifecycle/login acceptance; Linux native identity/storage remains unsupported and no fallback was introduced.

## Güncel yürütme kapısı — fiziksel doğrulama duraklatıldı

Bu checkpoint aşağıdaki eski `Next` yönergelerini supersede eder. Manuel komut blokları geçmiş/prosedür referansıdır; **şimdi çalıştırılmaz**. Kullanıcı physical pause'u kaldırmadan mevcut Windows/Android/iOS deneyleri veya yeni probe talep edilmez.

Kullanıcı-bildirimli kanıt:

- Windows11 x64 explicit MSVC native compile/check, native53 passed/0 failed/0 ignored ve desktop/native-Electron ABI build PASS; dependency/Cargo.lock değişmedi. Electron development owner açıldı, status `storage_failure`. QR/davet/telefon/onay yok. TPM key'in varlığı/yokluğu veya ilk hatalı Win32 işlem kanıtlanmadı.
- Readonly layout: `owner.lock` 0 byte, `epoch.pending` 16 byte ve beklenen private ACL; final epoch/certificate/initialized/SQLite/listener kayıtları görülmedi. Mevcut pairing/probe/TPM kayıtları korunur; otomatik cleanup/adoption/reset yok.
- Probe1: staged write/preflush PASS; `MoveFileExW WRITE_THROUGH` FAIL32.
- Probe2: yalnız iki leaf-directory share READ→READ|WRITE; diğer koşullar aynı; yine FAIL32. Leaf WRITE sharing tek başına yetersiz.
- Probe3: source `ReOpenFile` DELETE+metadata/shareALL PASS, aynı dosya kimliği PASS; directory `ReOpenFile` mask `0x120082` FAIL5; rename Stage3 çalışmadı. Hata5 sharing violation değildir. Probe sonuçları özgün app hatasının kesin nedeni değildir.

Bağımsız design/API/security incelemesi: tek source handle + native simple-leaf/NULL-root rename yalnız koşullu absent-target adaydır; implementasyon seçimi/onayı veya runtime PASS değildir. Ordinary certificate replacement/target TOCTOU, SQLite DB/WAL/SHM gerçek-object binding ve bağımsız continuity witness sınırları çözülmedi. Bu kullanıcı görevi native API/features/schema/layout seçmez. Karar-blocked Windows işi, [handoff kuyruğundaki](implementation-session-handoff.md#optimize-yürütme-kuyruğu) bağımsız QR host coverage işini durdurmaz; aynı inceleme yeni code-shaping bilgi/karar yokken tekrarlanmaz.

Fiziksel sıra, yalnız pause kaldırıldıktan sonra: ilgili platform grubunda hazır source+otomatik checks+ayrı security review → ayrı identity/custody kabulü → ayrı gerçek device-key TLS → QR grubu sonunda hazır iki endpoint ile Android↔PC kabulü. Daha önce geçen Android device-local signer deneyi tekrarlanmaz. Mac paid gate bağımsız işleri durdurmaz; iOS native deferred ve cihaz yokluğu değişmez. [Beşli grup index'i](qr-pairing-implementation-roadmap.md#geliştirme-grupları-ve-toplu-fiziksel-kabul) zorunlu bağımlılık sırası değildir; code-shaping storage/API/crypto kanıtı eksikse ADR0009 uyarınca yalnız bağımlı iş blocked kalır, grup sonu bahanesiyle varsayılmaz.

## Linux — no physical device available

2026-10-17 user-selected acceptance targets: **Ubuntu LTS with GNOME** and **Kubuntu LTS with KDE Plasma**. These name the intended future real-session matrix; neither is runtime-accepted or proven supported. Exact LTS release/session/package combinations must be recorded when separately authorized acceptance actually runs. Native identity/storage provider remains unselected/unsupported; the UI adaptation does not add one. Keep visible controls where tray/AppIndicator is unavailable/unverified, test each environment’s autostart restrictions, and retain the physical pause.

1. Independent Ubuntu CI: Rust1.99 format/strict clippy/300-line guard and native protocol/state/store tests. Test-only software identities drive real loopback TLS/exporter/recovery; they are not a Linux identity provider.
2. Independent Linux desktop source job: build the actual Electron ABI SQLite binding, Rust Node addon, main and renderer. Assert actual addon owner creation returns native_unsupported without creating an installation/authority directory while Linux custody/locality is unsupported.
3. Linux VM surface check, after an approved/available VM exists: launch the actual Electron app, verify development namespace and truthful native-unavailable UI, source selection/settings/backup behavior and close/reopen. This is VM execution, not physical key custody or pairing acceptance. Do not start an install/purchase or choose a new hypervisor dependency without approval.
4. A future Linux hardware custody/provider and private-storage/locality decision is separate. No software-key fallback or fake completed pair. VM/vTPM behavior, if later approved, must be recorded as virtual, never physical.

## Windows11 — user physical machine available

1. Independent windows-2025/MSVC CI compiles native test sources and actual desktop native/main/renderer builds. MSVC C/C++ tools, Windows SDK and node-gyp-compatible Python are required. Windows ARM64 additionally needs matching compiler components; no ARM64 physical support claim.
2. Windows source now implements opaque TPM CNG signing, direct physical LAN evidence/socket restriction and protected private storage using approved windows-sys0.61.2. Source adoption is not Windows compilation or hardware readiness; no Windows native build/runtime has been observed on this Mac.
3. Key provider is Microsoft Platform Crypto Provider only, non-exportable/signing-only P-256 with public-blob/DER validation. Storage validates actual KnownFolder LocalAppData, exact profile directory, fixed local NTFS/persistent ACLs, owner/SYSTEM protection, no reparse/cloud/network path, exclusive owner and retained ancestor handles. Other authority filesystems remain a provider support gate, not a restriction on ordinary user Files/Photos.
4. After approved implementation and source verification, request manual Windows setup/access from Ayhan. No SSH host is configured; do not assume remote access. Guide checks for TPM/provider/curve support, actual device key→certificate/TLS CertificateVerify, direct physical LAN route and fail-closed storage. Do not export private keys or request credentials in chat.
5. Only after both native endpoints are ready, request Android phone/USB/ADB intervention for the frozen QR→mutual TLS→exporter HMAC→exact PC approval→two durable pins→ACK sequence, restart/lost-ACK/revoke/negative scenarios, with backend/internet fallback absent. Prior Android signer experiment is not rerun or relabeled.

## macOS — explicit paid signing/provisioning gate

Free Personal Team is the available account. Unsupported paid-profile/signing steps remain open; no automatic enrollment/payment, ad-hoc Keychain entitlement, legacy Keychain switch or software device key. Development and production use different bundle IDs, separate host entitlements/profiles/Keychain groups and local namespaces. Real profile/host-signature authorization, Secure Enclave signer/TLS adoption and physical LAN remain unverified. See [Apple TN3137](https://developer.apple.com/documentation/technotes/tn3137-on-mac-keychains) and [TN3125](https://developer.apple.com/documentation/technotes/tn3125-inside-code-signing-provisioning-profiles).

## Development → production

Default is fresh production identity and fresh QR re-pairing, not copying development hardware keys/certificates/DB/epoch/pins. Preserve development data without opening it from production. [ADR0016](../decisions/0016-v1-pc-local-file-authority.md) requires separate explicit PC scope/native ACL for V1 LAN, not account/step-up/central capability; pairing grants no files. Final remote authorization and recovery↔offline-PC remain OPEN. A secure migration alternative requires an explicit security decision and proof, not an environment switch/public-key comparison. Original user Files/Photos are not deleted.

## Next Windows manual prerequisite — read-only inventory

No Windows std/MSVC cross toolchain or configured Windows SSH endpoint is available on this Mac. Before native compilation or physical pairing, Ayhan must open **Windows PowerShell** on the actual Windows11 machine and report only this sanitized inventory:

```powershell
[System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
Get-Command node,npm,rustup,python,cl -ErrorAction SilentlyContinue |
  Select-Object Name
if (Get-Command Get-Tpm -ErrorAction SilentlyContinue) {
  try {
    Get-Tpm -ErrorAction Stop |
      Select-Object TpmPresent,TpmReady,TpmEnabled,TpmActivated
  } catch { 'TPM inventory unavailable in this terminal' }
}
```

Do not run Clear-Tpm/Initialize-Tpm, export/import private keys, change BIOS/TPM state, install tools, create firewall rules or start Android/ADB yet. Do not print OwnerAuth, signing keys, credentials, raw QR, exporter or HMAC. If a tool is absent, choose/guide supported installation before dependent build. No source transfer, remote access or user credentials are assumed.

After the environment and repository access are ready, build the actual Windows target with existing `npm ci`, desktop build driver and Rust1.99; run strict Windows-native tests before a hardware owner/invitation. Inventory alone cannot prove TPM P-256 support, provider property behavior, custody or TLS. Physical acceptance then follows the frozen13-step/negative matrix, with no Mac paid gate dependency.

### Reported physical Windows inventory — 2026-10-08

Ayhan reports Windows11 Pro x64 build26200; Intel (`INTC`) TPM Present/Ready/Enabled/Activated all true; Node/npm installed; Rust/Cargo/rustup absent. `cl.exe` was not found in the current terminal, which does not establish that Visual Studio is absent. Python resolves to WindowsApps alias, not a verified interpreter. These are user-reported inventory facts, not Kloda hardware signing/TLS evidence. Do not rerun TPM inventory or infer P-256 support from readiness.

Next manual prerequisite: discover existing C++ installations using [Microsoft vswhere](https://github.com/microsoft/vswhere/wiki/Find-VC) with `-products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64`, and list real Python installations using `py -0p` when the launcher exists. No Python WindowsApps alias invocation, installer, TPM change or dependent native test yet. Then guide the required MSVC/Windows SDK, genuine Python and x64 MSVC Rust toolchain using the [Rust Windows prerequisites](https://rust-lang.github.io/rustup/installation/windows-msvc.html) and [node-gyp Windows instructions](https://github.com/nodejs/node-gyp#on-windows), respecting edition/license and any new material choice.

### Reported Windows toolchain readiness — 2026-10-09

Ayhan reports Rust/Cargo1.99.0 with active stable-x86_64-pc-windows-msvc, Visual Studio Community2026 (18.10.3), x64 MSVC14.51.36231 and Windows SDK10.0.26100.0 installed; Node/npm remain installed. Accept these reported checks without repeating them. Genuine Python was not included in this update; it is not needed for the initial Rust-only compile, but remains a prerequisite to verify before Electron SQLite/node-gyp build. Visual Studio2026 adoption by the actual bundled build tools is unexercised; do not install/downgrade another toolchain speculatively.

The initial manual Windows compilation used an x64 Visual Studio developer terminal at the current repository checkout. Select `+stable-x86_64-pc-windows-msvc` explicitly, not ambiguous `+stable`: the latter selected GNU on the user's machine and failed E0463. The desktop packaging driver separately requires the named1.99.0 toolchain before its later run. Compile-only commands do not execute unit tests, create a TPM identity, open a pairing owner or validate hardware custody/TLS. Do not alter frozen protocol, dependency versions or lockfile to bypass a diagnostic.

### Reported Windows native compile — 2026-10-09

Ayhan reports PASS for explicit MSVC `cargo test --locked --no-default-features --target x86_64-pc-windows-msvc --no-run` (43.13s) and `cargo check --locked --no-default-features --features desktop-node --target x86_64-pc-windows-msvc` (21.44s), both against packages/pairing-native/Cargo.toml. Test executable created; no tests, TPM key or pairing runtime executed. Lockfile/dependency versions unchanged. Four compiler warnings are reported as naming-only/nonblocking by Ayhan; diagnostic contents were not independently inspected, and no warning suppression was introduced.

Next manual step: run the existing native suite with explicit MSVC `cargo +stable-x86_64-pc-windows-msvc test --manifest-path packages/pairing-native/Cargo.toml --locked --no-default-features --target x86_64-pc-windows-msvc`. This exercises protocol/state/store, real loopback TLS with test-only software fixtures, and Windows helper/rejection boundaries; it is not production TPM identity creation, non-exportability, physical LAN or hardware CertificateVerify evidence. Report final counts and failing diagnostics, stopping on failure before dependent hardware/Electron/Android steps.

### Reported Windows native runtime

Ayhan reports the explicit x64 MSVC native suite PASS:53 passed,0 failed,0 ignored in0.63s; doc-tests0/PASS. Protocol/state/durable-store/recovery, real software-fixture loopback TLS and Windows helper/rejection boundaries passed. Production TPM key creation, non-exportability, device-key CertificateVerify and physical LAN pairing remain unexecuted. Reported nonblocking diagnostics: four non_upper_case_globals warnings at route_windows_if.rs:61,64 and one unused_unsafe at route_windows_query.rs:155; no suppression, dependency or lockfile change.

Next stage is desktop native/Electron ABI build only, before launching Electron or opening pairing. Genuine Python and the pinned explicitly MSVC Rust1.99.0 toolchain are required by the existing drivers. Current Windows source checkout must include the build-selector correction for an ambiguous GNU default host. Stop on a build failure; no speculative SDK/toolchain downgrade or dependency replacement. Loading/launching the real pairing surface is a later physical step, with persistent TPM/authority effects explained first.

### Desktop build host-selection correction

The shared native build driver now names Windows MSVC1.99.0 explicitly for the Node host architecture (x64 or ARM64), instead of letting rustup resolve a bare version through a possibly GNU default host. Mac/Linux selection and frozen protocol/dependencies/lockfile are unchanged. Existing desktop and Android drivers reuse this selector; no compatibility shim or alternate signer was added.

Smoke evidence: real Node imports under simulated win32/x64 and win32/ARM64 selected the exact respective MSVC toolchain; darwin/ARM64 and linux/x64 retained1.99.0. The actual Mac native desktop build/package driver succeeded, followed by root lint and API1/desktop50/mobile16/shared104 tests. This is selector/Mac integration proof, not an actual Windows desktop build or ARM64 hardware proof. The Windows checkout must contain the updated tools/native-build-common.mjs before the next manual build.

### Next manual desktop build — no pairing owner

Use the current Windows checkout (including tools/native-build-common.mjs); do not copy Mac node_modules/dist/target as Windows artifacts. In an x64 developer PowerShell, select an actually installed supported Python interpreter through the session-only `PYTHON` variable and verify that executable's version; a WindowsApps alias is not this prerequisite. If no genuine Python is installed, stop and report it before npm/node-gyp. [node-gyp configuration](https://github.com/nodejs/node-gyp#configuring-python-dependency) supports `PYTHON`; npm11 deprecates npm_config_* options. Do not install a global node-gyp or change project dependencies.

Install the named pinned `1.99.0-x86_64-pc-windows-msvc` toolchain with rustup's minimal profile (existing stable1.99 does not establish that this named toolchain exists), then run `npm.cmd ci` and `npm.cmd run build --workspace @kloda/desktop` from repo root, stopping at the first failure. This builds isolated Electron SQLite ABI, Rust Node-API, main/preload and renderer artifacts without opening a native pairing owner. It writes build/dependency artifacts, not a Kloda TPM identity. Report build status, genuine Python version and failing diagnostics; do not launch `dev:desktop`/Electron or begin Android/ADB yet.

### Persistent effects before the later physical owner step

- First native owner open, including initialization reached by a status request, is not an OS-state-free probe: it prepares authority storage and opens/creates a named current-user development P-256 CNG key through Microsoft Platform Crypto Provider. No machine key, overwrite, software fallback, PIN/user-presence policy or TPM reset is requested. Provider/key policy checks are source enforcement, not independent physical attestation/non-exportability proof.
- Authority lives at actual KnownFolder LocalAppData/com.kloda.desktop.dev/pairing: epoch, initialization marker, public self-signed certificate, SQLite trust/recovery records and owner lock. On PC, owner startup also tries the direct-LAN listener and persists its stable port; it does not wait for QR generation. No automatic firewall rule is created; if Windows asks for network permission, stop for explicit guidance.
- These keys/files survive app exit. A partially failed initialization can leave a key/epoch/certificate behind; do not delete/reset/adopt state to conceal failure. Closing releases runtime handles/listeners, not persistent identity. No automatic cleanup/migration into production; production is a separate fresh identity/re-pairing scope.
- Creating/opening an owner alone creates no peer trust or file authority. Initial development identity/certificate signing is not device-key TLS CertificateVerify proof; real peer/session validation remains a later step. No user Files/Photos, FolderSync archive, backend enrollment or cloud file operation is part of this step. No private key, raw QR/secret, DB or credential should be sent in chat.

Complete the build first. Before providing the actual physical owner/launch command, restate this bounded persistent scope and obtain the user's readiness for that manual step; hardware key/custody/TLS and dependent Android tests remain open.

### Reported Windows desktop ABI build

Ayhan reports genuine Python verified, pinned Rust1.99.0 MSVC, npm ci and actual desktop build PASS: Rust release46.42s, Vite1963 modules/1.36s, exit0. Four known non_upper_case_globals warnings remain nonblocking. Dependencies and Cargo.lock unchanged. Electron/production native owner was not launched; no TPM identity or pairing session was created. This is real Windows build evidence, not key custody, non-exportability or device-key CertificateVerify.

Next physical step is bounded development owner opening and certificate/identity inspection with no QR creation, phone scan or PC approval. Real-device TLS is a separate later gate, dependent on this result; no prior Android hardware signer experiment is rerun.

### Physical identity step — development profile only

After accepting the persistent development scope above, use the normal Windows account (not Run as administrator) and the existing built application, from repo root: `.\node_modules\.bin\electron.cmd .\apps\desktop`. Do not rebuild or run a dev server. Launch also initializes development sync.sqlite and Electron session/cache files under com.kloda.desktop.dev; no source selection or Sync Now is part of this check.

Open “Telefon eşleştir” without creating an invitation. This page's first native status initializes the real owner, including CNG key/certificate/store and attempted direct-LAN listener. If a firewall permission dialog appears, do not grant it; stop/report before further action. Do not reset TPM, delete authority/key state, switch to production or install/use a software signer on failure.

In the application's local Developer Tools console, call only the existing read-only bridge and print a whitelist, never a whole snapshot:

```javascript
window.kloda.pairing.status().then(
  s => console.log({
    phase: s.phase,
    hardwareClass: s.hardwareClass ?? null,
    errorCode: s.errorCode ?? null
  }),
  e => console.log({ errorCode: e?.code ?? "outcome_unknown" })
);
```

Expected fresh owner is idle/windows_tpm with no error. Hardware class plus successful initialization means the actual Microsoft Platform Crypto Provider/key policy checks and certificate path ran; the label alone is not physical attestation. A lan_unavailable error is a separate route gate, not permission to bypass it. Report any error before retry/reset or the TLS step. No QR creation, phone scan, approval or trust completion in this stage.

Close the app normally, then inspect only the public certificate in PowerShell. This reader never accesses/exports the private CNG key or writes state:

```powershell
@'
const { X509Certificate, createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const cert = new X509Certificate(readFileSync(join(
  process.env.LOCALAPPDATA, "com.kloda.desktop.dev", "pairing", "certificate.der"
)));
console.log({
  keyType: cert.publicKey.asymmetricKeyType,
  curve: cert.publicKey.asymmetricKeyDetails.namedCurve,
  selfSignatureValid: cert.verify(cert.publicKey),
  spkiSha256: createHash("sha256").update(
    cert.publicKey.export({ type: "spki", format: "der" })
  ).digest("hex")
});
'@ | node
```

Expected ec/prime256v1/selfSignatureValid:true; record the public SPKI hash locally for later continuity comparison. The certificate verifies possession/signing by its corresponding private key; combined with the actual native provider path this is bounded provider-bound P-256 identity/certificate-signing evidence, not an independent attestation or private-export denial test. Non-exportability enforcement by native property checks and empirical export/backup/restore assurances remain separate.

Reader API verification: documented [Node24 X509Certificate.verify](https://nodejs.org/docs/latest-v24.x/api/crypto.html#x509verifypublickey) and public KeyObject export. The reader operations were smoke-exercised on a throwaway software certificate on Mac (ec/prime256v1/valid signature); ephemeral key output discarded to /dev/null, no product identity/files adopted. This is reader syntax/API proof only, never Windows hardware evidence.

Report the sanitized native fields and public-reader results; do not send QR, private key, DB or credentials. Stop before phone/TLS until this result is assessed.

### Separate real-device TLS step — blocked on the identity result

Do not execute this yet. Assess Windows native owner/provider/certificate results first, then obtain the user's Android phone/USB/ADB readiness and guide the final app's native identity/permission setup separately. No prior Android P-256 signer experiment rerun, app-data wipe, uninstall, TPM clear or silent identity adoption. Any required LAN/firewall choice remains explicit; no public-network blanket allow or backend/internet/relay fallback.

Use the unchanged frozen QR LAN flow, not a weaker TLS-only profile, software signer, Node HTTPS replacement or JS trust setter. The later first TLS observation is QR scan→fresh full mutual TLS1.3 with actual endpoint device keys→same-channel exporter HMAC proof→PC reserved/phone awaiting PC approval. Capture only sanitized native phase/error and public fingerprint evidence; do not approve yet. QR is120s, not paused/extended for reporting; expiry is not proof that a prior handshake failed.

This real-device step has its own persistent effects: Android may create/open its scoped native hardware identity/certificate and writes pending recovery state before proof. Reserving a candidate does not complete PC trust; the later exact PC approval→atomic consume/pin→phone pin→ACK flow creates durable two-sided trust. Explain phone/install and pending-state scope before providing device commands; do not treat “not yet approved” as “no local state written”.

Evidence distinctions: Windows provider policy and public self-signature are identity/certificate-signing evidence, not TLS CertificateVerify. A QR appearing is not a handshake. The native reserved transition is control-flow evidence of completed mutual TLS/exporter proof in the actual frozen path, not independent attestation or a packet/signature transcript. Collect actual real-peer evidence and retain its scope before closing a device-key TLS gate; a UI label alone is insufficient. Non-exportability/export-denial/backup-restore and complete pairing/negative-matrix/file-authority gates remain separately open.

Only after the dependent manual result is actionable may approval/completion or restart/negative tests proceed. No file/media payload or FolderSync operation is part of identity/TLS verification.

## Selected-version trash/restore automated checkpoint — 2026-10-20

[Latest handoff](implementation-session-handoff.md#desktop-selected-version-trash-restore-and-suppression--2026-10-20) adds native managed-copy/identity/Photos dependency/restart/expiry/suppression checks, Desktop foreground mutation/lifecycle and actual Chromium responsive fixture evidence. These tests never open the existing archive/authority and are not OS custody, actual tray/login, phone↔PC or physical acceptance. Windows `storage_failure`/continuity remains decision-blocked; macOS signing and Linux native identity/storage provider remain open with no fallback. Ubuntu LTS/GNOME and Kubuntu LTS/KDE remain unverified acceptance targets. Physical testing remains paused. Large-file native-owner latency must be evaluated before claiming responsiveness under load; no large-file result is inferred from small disposable fixtures. Git index/history actions remain forbidden.
