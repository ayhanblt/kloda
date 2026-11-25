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
- [x] **Faz V1-3 — OneDrive & Yandex Disk Upload/Download Adapters**
  - Implemented `AndroidOneDriveTransport` + `IosOneDriveTransport` (Graph `createUploadSession` with 320 KiB chunk multiples, `conflictBehavior=fail`, SHA-256 verification, atomic vault persistence of rotated `refresh_token`).
  - Implemented `AndroidYandexTransport` + `IosYandexTransport` (`resources/upload` + `move` with `overwrite=false`, 202 async polling, SHA-256 verification).
  - Enabled `'onedrive'` and `'yandex'` in `enableableProviders` and `CloudTarget` queues (including Photos + Files restore & ADR0029 catalog).
- [x] **Faz V1-4 — PC Desktop Human-Readable File Layout (`.media` → Real Filenames)**
  - Added `backup_paths` schema migration (`user_version=5`), staged incoming transfers under `<peer>/.kloda/staging/`, stored durable objects/keeps under `<peer>/.kloda/objects/`, and atomically hardlinked readable files into `<peer>/Files/` and `<peer>/Photos/` with collision-free `name (2).ext` suffixes (keeping photo manifests hidden and preserving legacy `v4` flat backups).
- [ ] **Faz V1-5 — `1.0.0` Release Signing, R8/ProGuard, Build Flags & Desktop Installers** *(macOS & Android Tamam — Windows 11 + iOS TestFlight Kaldı)*
  - Monorepo, Android (`app` + `my-module`), iOS (`KlodaSecurePhotosSync` + `KlodaLiveActivity`) ve Desktop sürümleri `1.0.0` yapıldı.
  - Android (`gradle.properties`) ve iOS (`KlodaSyncRuntime.podspec`) varsayılan V1 native protokolleri (`SMB`, `SFTP`, `FTPS`) açıldı, `S3` kapalı tutuldu (`excludes += '**/libkloda_s3_native.so'`).
  - R8/ProGuard (`consumer-rules.pro`) için `KlodaPairingJni`, `KlodaPairingPlatform`, `SmbNative*`, `SftpNative*`, `FtpsNative*` (`connect(String,int)` dahil) ve `S3NativeEngine` `-keep` kuralları eklendi; `minifyEnabled` + `shrinkResources` Release profilinde aktif edildi.
  - Desktop (`kloda_pairing.node`), Android (4 ABI) ve iOS (Release `KlodaPairingNative.xcframework`) yeniden derlendi; `THIRD_PARTY_NOTICES.md`, `tools/build-desktop-release.mjs` ve B2 fixture-CA (`nm`/`llvm-nm`) doğrulama kapısı (`tools/verify-v1-release.mjs`) eklendi.
  - **Tamamlanan Release Paketleri:**
    - macOS Desktop `1.0.0` (`com.kloda.desktop`): `Developer ID Application` ile imzalandı, notarized (`Accepted`), stapled (`Kloda-1.0.0-macos-arm64.zip`) ve canlı QR/LAN dinleme doğrulandı.
    - Android `1.0.0`: Release upload keystore (`CN=Ayhan Bulut`) ve Entra OneDrive Release SHA-1 (`JH84/BzkL6m5I53u/GkEQuOcztU=`) ile imzalı `app-release.apk` (`161M`) ve `app-release.aab` (`121M`) üretildi ve doğrulandı.
    - iOS Simulator `1.0.0` (`Release`, `arm64`): `iPhone 17 Pro` simülatöründe derlendi ve açılış doğrulandı.
  - **Kalan Release Adımları:** Windows 11 Desktop `1.0.0` paketleme (`Kloda.exe`) ve Xcode iOS TestFlight Archive yüklemesi (`Apple Distribution` sertifikası hazır).
- [ ] **Faz V1-6 — 18-Item Physical Device Acceptance (Android, Mac, Windows 11 + iOS Simulator / TestFlight Internal Testing)**
  - iOS işlevsel kabul testleri önce bu Mac üzerinde **Xcode iOS Simulator** ile doğrulanır.
  - Simulator'da doğrulanamayan 4 gerçek iPhone donanım maddesi (**Secure Enclave donanım anahtarı**, **kilitli ekran `AfterFirstUnlock` + `BGProcessingTask`**, **kamera QR tarama**, **Live Activity & FaceID Kurtarma Kodu**) yerel Android/Mac/Windows testlerinden sonra uzak test kullanıcısıyla **TestFlight Internal Testing** üzerinden çalıştırılır.

## Next Immediate Step

**Kullanıcı fiziksel testleri + Windows 11 paketleme:** Mac (`Kloda.app`), Android (`app-release.apk`), iOS Simulator ve Windows 11 (`Kloda.exe`) kabul testleri tamamlandıktan sonra iOS TestFlight Archive yüklemesi ve gerekirse tasarım/UI iyileştirmeleri.

## Post-V1 Queued Roadmap (V2)

1. **Faz V2-1:** Common Native Backup Engine (`kloda-native-sync`) — collapse ~300 duplicated Kotlin/Swift protocol files into one shared Scheduler/Job/Journal/Restore engine + thin `TransportAdapter`s.
2. **Faz V2-2:** Unified Rust Cargo Workspace & single mobile native library (`libkloda_core`) + `tools/` script consolidation.
3. **Faz V2-3:** Google Drive (with OAuth brand verification), Amazon S3 / S3-Compatible, WebDAV folder browser, Linux Desktop, and remote WebRTC/P2P sync.
