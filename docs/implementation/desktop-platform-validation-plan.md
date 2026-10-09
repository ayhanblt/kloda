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

The next manual Windows step is compilation only, in an x64 Visual Studio developer terminal at the current repository checkout: `cargo +stable test --manifest-path packages/pairing-native/Cargo.toml --locked --no-default-features --target x86_64-pc-windows-msvc --no-run`, followed only on success by `cargo +stable check --manifest-path packages/pairing-native/Cargo.toml --locked --no-default-features --features desktop-node --target x86_64-pc-windows-msvc`. Stable here is the user's reported1.99.0; the desktop packaging driver separately requires the named1.99.0 toolchain before its later run. These commands do not execute unit tests, create a TPM identity, open a pairing owner or validate hardware custody/TLS. Stop on the first compiler error and report its diagnostic; do not alter frozen protocol, dependency versions or lockfile to bypass it.
