# ADR0015 — Desktop platform scope and signing isolation

- Date: 2026-10-08.
- Owner: Ayhan.
- Status: accepted scope/policy; platform runtime evidence remains gated.

## Decision

Kloda Desktop targets macOS, Windows and Linux. A macOS signing/hardware failure must not block independent Windows/Linux source development or CI. Ayhan has a physical Windows11 machine; no Linux physical machine is available. Windows physical interaction and Android/USB/ADB/manual tests still require user intervention. Linux verification is planned through CI/VM and must not be labeled physical hardware custody.

Only a free Apple Personal Team is currently available. Operations requiring paid Apple Developer membership, authorized Mac provisioning/signing and actual Secure Enclave adoption remain explicit production gates. Do not weaken entitlement validation, use a self-asserted ad-hoc Keychain group, switch to legacy Keychain or fall back to a software device key. Apple account/enrollment/payment is not authorized by this decision.

Development bundle ID is **com.kloda.desktop.dev**; production bundle ID is **com.kloda.desktop**. Build identity, signing configuration, entitlements, provisioning and Keychain/local authority namespaces must remain separate. Product display name remains **Kloda: Secure Photos & Sync**. A production identity must be an explicit built-package choice, not an accidental environment toggle.

## Transition policy

Default transition is a new production installation identity and **fresh QR re-pairing**, not automatic key/pin/database adoption. Do not copy/export development hardware private keys, certificates, pairing DB, installation epoch or consumed/pending/deny records into production; do not claim that a public-key match alone proves continuity. Existing development data is preserved in its own namespace and is not deleted or silently reopened by production.

After production trust, file authorization still separately requires account eligibility, step-up as required, PC scope and capability. No pairing grants file access. A future migration alternative requires an explicit security decision and authenticated continuity/revocation design; none is approved now. Ordinary user Files/Photos are not pairing state and are not deleted by this transition.

## Platform evidence boundaries

Mac current native key creation fails with missing entitlement -34018. Windows TPM non-exportable P-256 remains the accepted hardware direction; actual CNG/route/private-storage source and physical Rust/rustls proof remain separate. Unsupported hardware/platforms fail visibly before unprotected authority-state creation. Linux custody/provider/fallback policy remains unselected; CI test-only software identities are not a product fallback.

See [ADR0014](0014-shared-rust-qr-pairing-core.md), [frozen V1](../security/qr-pairing-v1-protocol.md) and [implementation roadmap](../implementation/qr-pairing-implementation-roadmap.md).

## Subsequent Windows SDK binding approval

Ayhan explicitly selected **windows-sys0.61.2**, target-Windows-only, instead of hand-maintained FFI. Enable only required CNG, IP Helper/NDIS/WinSock, security/ACL/file and KnownFolder APIs. Microsoft Platform Crypto Provider/TPM remains the sole Windows device-key provider; no Microsoft Software KSP or preferred-VBS software fallback. Native signers remain certificate-TBS/TLS-only and opaque to JS.

Windows authority state belongs in the actual current-user **LocalAppData**, not Electron's default roaming AppData. JS environment path selection is not authority: native KnownFolder, owner ACL, local volume and ancestor/file reparse checks must validate it. Retained owner/ancestor handles bind the directory lifetime; no automatic migration from roaming/development/legacy data.

Sources: [Microsoft NCryptCreatePersistedKey](https://learn.microsoft.com/en-us/windows/win32/api/ncrypt/nf-ncrypt-ncryptcreatepersistedkey) and [pinned generated provider binding](https://docs.rs/windows-sys/0.61.2/windows_sys/Win32/Security/Cryptography/fn.NCryptOpenStorageProvider.html). SDK selection is not Windows compile/hardware/physical proof.
