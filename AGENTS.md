# Kloda — Project Instructions (V1 Release Mode)

Read order: (1) `AGENTS.md`, (2) `docs/implementation/CURRENT.md`, (3) only the specific ADR (`docs/decisions/`) relevant to the files being modified. Historical evidence and retired harnesses live outside active context in `.local-evidence/evidence-archive-2026-11-25/` and `docs/implementation/archive/` — never load them unless explicitly requested.

## 1. Orchestration & Model Routing (User Decision — 2026-11-25)

- **Primary Orchestrator & Reviewer:** Antigravity `Neon` (`High` by default; `XHigh` for deep native/security diff review). Do not consume Carbon quota for routine coding/diffs; OpenCode workflow is retired.
- **Routine Coding (UI, TS, configs, scripts, ProGuard):** Prefer Antigravity subscription (`Sonnet` worker / `Neon` subagent) first; fall back to `claude -p --model sonnet` (with `--resume` for follow-ups) if subscription quota is reached.
- **Complex Native / Rust / Security Work:** Delegate via `claude -p --model opus` (reusing session via `--resume` for scoped fixes), then verify diff and tests in `Neon`.

## 2. Locked V1 Product & Architecture Decisions (2026-11-25)

- **V1 Enabled Destinations:** PC Desktop (LAN), WebDAV, SMB, FTPS, SFTP, Nextcloud, Dropbox, **OneDrive**, and **Yandex Disk**.
- **V1 Hidden Destinations (`hiddenProviders`):** `google-drive`, `amazon-s3`, `s3-compatible` (deferred to V1.1); `box`, `mega`, `cloudme`, `google-cloud-storage`, `kolab-now` (deferred to V2).
- **Target Platforms:** Mobile (`1.0.0` on Google Play + Apple App Store via paid Apple Developer Team) and Desktop (`1.0.0` `com.kloda.desktop` installers for macOS Developer ID/Notarized and Windows 11 TPM/CNG). Linux Desktop is deferred to V1.1/V2.
- **Background Lock Policy (`AfterFirstUnlock`):** Target credential vaults on Android (`noBackupFilesDir` CE storage, without `KeyguardManager.isDeviceLocked` block) and iOS (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`) allow automatic 12h/24h and live backups while the screen is locked after first post-boot unlock (AFU). Recovery Code display/copy continues to require biometric / device passcode verification every time.
- **PC Desktop Backup Layout:** Retire opaque `{id}.media` filenames. Stage uploads atomically in `.kloda/staging/`, keep zero-extra-space hardlink protection in `.kloda/objects/`, and publish human-readable files under `<Device>/Photos/<name.ext>` and `<Device>/Files/<relative_path>` with no-overwrite numbered conflict suffixes (`name (2).ext`).
- **WebDAV Folder Policy:** `targetPath` is optional (supports router/modem root shares directly); when a non-empty `targetPath` returns `404` after root verification, create missing collection segments via `MKCOL`.
- **Post-V1 Order:** Ship V1 first via automated suites + Release builds + 18-item Physical Device Acceptance. Immediately after V1 (and any urgent V1.0.1 hotfixes), execute the **Common Native Backup Engine + Unified Rust Cargo Workspace** refactor before adding V2 features.

## 3. Preserved Engineering & Security Standards

- **UI & Code:** Follow [Lovable design](docs/ui/lovable-design-reference.md), maintain `TR`/`EN`/`DE` translation key parity for all static user-facing strings, use Tailwind/NativeWind with shared global CSS (no new inline/page styles), Lucide icons, FSD boundaries (`eslint-plugin-boundaries`), and the 300-effective-line ESLint limit on `.ts`/`.tsx`.
- **Security Invariants:**
  - Native Rust (`packages/pairing-native`, `cap-std` capability-relative paths, pinned mTLS/SPKI) is the sole PC-local file authority ([ADR0016](docs/decisions/0016-v1-pc-local-file-authority.md)). Never introduce central JWT/KMS/OAuth brokers for LAN or cloud public clients ([ADR0022](docs/decisions/0022-advanced-destination-transport-and-credential-custody.md)).
  - Retain authorized Desktop native receiver across UI close/blur ([ADR0018](docs/decisions/0018-desktop-background-receiver-lifecycle.md)).
  - Saving/signing in never enables a destination without explicit opt-in ([ADR0023](docs/decisions/0023-explicit-independent-backup-destinations.md)). Never overwrite existing user files; verify SHA-256 and preserve ADR0029 recovery catalog invariants.
  - Release builds must exclude all test/fixture CA markers and include third-party license notices.
  - Do not push, reset, or run destructive Git/device operations without explicit user confirmation.
