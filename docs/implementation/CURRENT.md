# CURRENT — V1 Release Execution Status (25.11.2026)

Single active status tracker. Rules & locked decisions: root [AGENTS.md](../../AGENTS.md).
Historical Faz3 manifests, evidence, and OpenCode files are archived under `.local-evidence/evidence-archive-2026-11-25/`.

## Active Phase Summary

- [x] **Faz V1-0 — Repository Cleanup, Baseline Reconciliation & Rule Simplification**
  - Integrated pending Desktop layout/shell (`App.tsx`, `global.css`) and light-theme selected control contrast fix (`4.77:1`), plus Android FTPS scheduler/job updates.
  - Archived 335 MB `docs/implementation/evidence/` and `.opencode/` to `.local-evidence/evidence-archive-2026-11-25/` and updated `.gitignore`.
  - Simplified `AGENTS.md` and `CURRENT.md` to a 1-page V1 Release contract.
- [x] **Faz V1-1 — V1 Provider Visibility & Router/NAS WebDAV (`targetPath` optional + `MKCOL`)**
  - Hidden non-V1 providers (`google-drive`, `amazon-s3`, `s3-compatible`, `box`, `mega`, `cloudme`, `google-cloud-storage`, `kolab-now`) in mobile Connections UI (`cloud-destinations.ts`).
  - Allowed empty/root `targetPath` in Mobile, Desktop, Android, and iOS WebDAV layers and added root-verified `MKCOL` subfolder creation when `targetPath` returns `404`, with `TR`/`EN`/`DE` hint parity.
- [x] **Faz V1-2 — `AfterFirstUnlock` Background Lock Policy (Android & iOS)**
  - Replaced app-level `KeyguardManager.isDeviceLocked` checks with `UserManager.isUserUnlocked` in Android target vaults & `KlodaPairingPlatform` (`setUnlockedDeviceRequired(false)`), keeping biometric/keyguard gate on `AndroidRecoveryVault`.
  - Migrated iOS target vaults to `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` (upgrading existing entries seamlessly on read), switched Apple pairing identity (`identity_macos.rs`) + snapshot/journal protection to `completeUntilFirstUserAuthentication`, and removed locked-screen background aborts (keeping FaceID/passcode on `IosRecoveryVault`).
- [ ] **Faz V1-3 — OneDrive & Yandex Disk Upload/Download Adapters**
  - Implement `AndroidOneDriveTransport` + `IosOneDriveTransport` (Graph `createUploadSession`, `conflictBehavior=fail`, atomic vault persistence of rotated `refresh_token`).
  - Implement `AndroidYandexTransport` + `IosYandexTransport` (`resources/upload` + `move` with `overwrite=false`, SHA-256 verification).
  - Enable `'onedrive'` and `'yandex'` in `enableableProviders` and `CloudTarget` queues (including Photos + Files restore & ADR0029 catalog).
- [ ] **Faz V1-4 — PC Desktop Human-Readable File Layout (`.media` → Real Filenames)**
  - Stage incoming transfers in `.kloda/staging/`, retain hardlink protection in `.kloda/objects/`, and atomically publish `<Device>/Photos/<name.ext>` and `<Device>/Files/<relative_path>` with no-overwrite numbered suffixes (`name (2).ext`).
- [ ] **Faz V1-5 — `1.0.0` Release Signing, R8/ProGuard, Build Flags & Desktop Installers**
  - Bump versions to `1.0.0`; enable `SMB`/`SFTP`/`FTPS` build flags by default (`S3` off for V1).
  - Add missing JNI `-keep` rules (`KlodaPairingJni`, `AndroidFtpsPublication`, callbacks) to `consumer-rules.pro`; configure Android Release signing & OneDrive Release SHA-1.
  - Configure Apple Developer Team signing (iOS App + Live Activity + Yandex Team ID; macOS `com.kloda.desktop` Developer ID + Notarization) and Windows 11 Desktop installer.
  - Verify B2 fixture-CA exclusion (`nm`) and `THIRD_PARTY_NOTICES` inclusion.
- [ ] **Faz V1-6 — 18-Item Physical Device Acceptance (iPhone, Android 13+, Mac, Windows 11)**

## Next Immediate Step

Start **Faz V1-3**: implement OneDrive and Yandex Disk upload/download/restore adapters for Android & iOS and enable them in the V1 UI.

## Post-V1 Queued Roadmap (V2)

1. **Faz V2-1:** Common Native Backup Engine (`kloda-native-sync`) — collapse ~300 duplicated Kotlin/Swift protocol files into one shared Scheduler/Job/Journal/Restore engine + thin `TransportAdapter`s.
2. **Faz V2-2:** Unified Rust Cargo Workspace & single mobile native library (`libkloda_core`) + `tools/` script consolidation.
3. **Faz V2-3:** Google Drive (with OAuth brand verification), Amazon S3 / S3-Compatible, WebDAV folder browser, Linux Desktop, and remote WebRTC/P2P sync.
