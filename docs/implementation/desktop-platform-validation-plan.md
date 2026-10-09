# Desktop platform validation — source, VM and physical evidence

Current policy: [ADR0015](../decisions/0015-desktop-platform-and-signing-isolation.md). macOS/Windows/Linux development jobs are independent; a paid Mac signing gate must not gate Windows/Linux builds. No physical Windows/Android, VM setup or CI execution is claimed here.

## Linux — no physical device available

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

Default is fresh production identity and fresh QR re-pairing, not copying development hardware keys/certificates/DB/epoch/pins. Preserve development data without opening it from production. Required account/step-up/PC scope/capability approval remains separate; no first file grant arises from pairing. A secure migration alternative requires a new explicit security decision and proof, not an environment switch or public-key comparison. Original user Files/Photos are not deleted by profile cutover.

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
