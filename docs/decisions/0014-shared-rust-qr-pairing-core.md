# ADR0014 — Shared Rust/rustls QR pairing core

- Date: 2026-10-08 (execution clock).
- Owner: Ayhan.
- Status: **accepted and implemented/build-tested; hardware LAN adoption blocked/unverified**.

## Decision

Ayhan selected a common Rust core using **rustls0.23.45** for QR LAN pairing implementation. The [frozen KLODA-QR-PAIR-V1 contract](../security/qr-pairing-v1-protocol.md) remains normative and unchanged. This is a native implementation ownership/library decision, not a new pairing architecture or byte protocol.

Native owns identity/certificate/TLS/exporter/HMAC/secret/state/store transactions. Android/iOS/desktop bridges expose opaque operations and sanitized events, not private keys, raw signer handles, exporter/tag, writable trust stores or caller-created trust contexts. Platform hardware key providers must integrate with the standard TLS CertificateVerify signer interface; no accept-all/custom TLS/software/export fallback is authorized.

## Adoption boundary

rustls release selection does not verify actual hardware provider APIs, certificate profile verifier, local route classification, signer threading/lifetime, platform ABI/packaging, atomic store/backup exclusion or physical LAN behavior. The selected source/API/ABI must demonstrably meet the frozen contract before dependent implementation. Additional explicit dependencies and important technical choices require user approval before adoption; built-in provider/certificate/store/bridge mappings are not inferred as selected here.

Subsequent explicit approvals: ring cryptography (TLS/HMAC/SHA/RNG, not software identity custody), x509-parser/rcgen, zeroize, serde/serde_json, rusqlite bundled SQLite, socket2/libc, Android JNI and Electron napi/napi-derive/napi-build. Compatible exact versions/features are pinned after source verification. Other explicit dependencies still require approval.

Ayhan clarified the signer boundary: the same non-exportable key may sign native-generated V1 certificate TBS bytes for creation/renewal and standard TLS CertificateVerify. No caller-supplied certificate bytes/arbitrary-sign API, raw signer handle or per-request hardware signature is authorized. Only this minimum-native wording is amended; QR/transcript/HMAC/frame bytes and trust/authority boundaries are unchanged.

Ayhan approved365-day native certificates with same-key renewal on owner-open below30 remaining days; no clock/profile bypass. iOS C ABI/Swift integration is explicitly deferred. Android uses the installed Rust1.99.0 standard-library targets and NDK27.1/API24 for all four ABIs, without changing the global toolchain. Compatible napi-derive-backend5.0.1 is locked with napi-derive3.5.1 after the newer transitive backend failed compilation.

The current shared TypeScript codec is syntax/public-encoding only; it cannot own native trust state or establish TLS/locality/file authority. No Matrix/SAS dependency returns. Initial trust remains backend-independent; account/scope/capability/file authorization remains separate.

## Related UI approvals and limits

Ayhan approved desktop qrcode1.5.4 + dev @types/qrcode1.5.6 and SDK-matched mobile expo-camera57.0.6. Existing Stitch components/tokens may be adapted for pairing; source assets stay read-only. User additionally requested Lucide icons, Reanimated custom security modals, Gorhom quick-action panels and Sonner Native temporary notifications. Missing packages need approval before addition; React Native versus Electron ReactDOM compatibility requires an explicit platform mapping decision, not framework migration by assumption. Security approval must resist accidental dismissal/unapproved execution; animations remain restrained.

Ayhan approved the SDK-matched mobile set: Lucide RN1.52.0, Gorhom5.2.14, Sonner Native0.27.0 with SDK SVG15.15.4/Gesture Handler2.32.0/Screens4.26.0/Safe Area5.7.0 and explicit Reanimated4.5.1/Worklets0.10.1 pins. Desktop keeps Electron ReactDOM, using Lucide React/Sonner and custom DOM/CSS security modal/quick panels rather than React Native Web. Security dialogs do not dismiss through backdrop/Esc/swipe; explicit Cancel/Deny remains available and maps to native lifecycle.

## Evidence and remaining gates

[Roadmap](../implementation/qr-pairing-implementation-roadmap.md) and [handoff](../implementation/implementation-session-handoff.md) record native43 passing behavioral tests, full app builds, actual Android APK packaging and Electron UI/NAPI smoke. Test-only software identities exercise real loopback TLS/exporter/store recovery, not hardware custody. This Mac's Secure Enclave creation fails with `-34018` (missing entitlement); zero valid development signing identities are installed. Signing/provisioning needs a user decision before dependent hardware pairing. Aggregate G01/G03 and36 authority targets remain open. Previous physical Android signer PASS is unchanged/no rerun; physical phone/USB/ADB/manual steps require intervention.

### Subsequent macOS signing preparation approval

Ayhan selected preparation of supported macOS development signing/provisioning, not deferral. [Apple TN3137](https://developer.apple.com/documentation/technotes/tn3137-on-mac-keychains) requires the host main executable's authorized Keychain entitlements and an app bundle containing a provisioning profile; signing the `.node` library alone cannot grant them. [TN3125](https://developer.apple.com/documentation/technotes/tn3125-inside-code-signing-provisioning-profiles) identifies `keychain-access-groups` as restricted and documents `Contents/embedded.provisionprofile`. No ad-hoc self-asserted group, entitlement bypass or legacy keychain fallback is approved.

Xcode27.0 is installed; no valid code-signing identity is available and no Mac profile was found in the two standard local profile directories. Mobile uses `com.kloda.app`; desktop has no configured bundle ID/signing assets. Apple account/team access, a supported development certificate/profile and the desktop bundle ID remain manual/decision prerequisites. No signing key/account credential is requested in chat or committed.
