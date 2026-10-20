# Windows source overlay transfer

This procedure transfers the current working-tree Desktop/native/sync-core source to the existing Windows development checkout. It includes modified and untracked source; it does not depend on a commit or `git archive`. It does not mirror/delete the destination, transfer authority state, or authorize application startup, probes or physical testing.

## Build the package on the source host

After concurrent source/document edits finish, run from the repository root:

```sh
python3 tools/create-windows-handoff.py --self-test
python3 tools/create-windows-handoff.py
```

The builder writes a content-named ZIP, identical internal/external SHA256 source manifest, and external ZIP SHA256 text under `.local-evidence/windows-startup-diagnostics-2026-10-20/transfer/`. It rejects existing output names, unexpected source extensions/filenames, symlinks and source changes detected while capturing. Archive entries have deterministic ordering, timestamps and permissions; filenames and byte hashes identify the exact snapshot. SHA256 detects modification only when the expected hash arrives through a trusted channel; it is not a publisher signature.

Included paths:

- Desktop `electron` (`.ts/.cts`) and `src` (`.ts/.tsx/.css/.json`) source, including tests; the single known public asset `tray-logo.png`.
- Native Rust `src/*.rs` recursively, `Cargo.toml`, `Cargo.lock` and `build.rs`; shared sync-core TypeScript source and build configuration.
- Root npm package/lock and ESLint configuration, optional existing root TypeScript configurations, Desktop package/index/Vite/Vitest/TypeScript configurations, and all existing `apps/*/package.json` / `packages/*/package.json` workspace manifests. Other API/mobile source is intentionally excluded; the manifests preserve the existing npm workspace/lock graph.
- The existing Desktop native/Electron-SQLite build drivers and native dependency/size checks, plus this builder.
- Project AGENTS instructions, current ADR directory, migration/session handoff, roadmap/status/platform plan, relevant production/QR/product policy documents and public protocol test vectors, and this procedure. Exact required filenames are listed in `REQUIRED` in the builder; it fails if one is missing.

Excluded: `.git`, `.env`, `.local-evidence` contents, `.codex`, `.serena`, dependencies, compiled binaries, `dist`, `target`, generated mobile projects, archives, user settings, device/authority/credential files and SQLite state. `.DS_Store` and empty-source `.gitkeep` placeholders are ignored. Public assets are a fixed allowlist; a new public filename requires review before packaging. No design/evidence archive is included or required for this build-only transfer.

## Receive and review on Windows

1. Preserve the existing Windows checkout. Stop any running Kloda process before replacing its source; do not open a new owner. Do not change the user's existing LocalAppData/TPM/pairing state.
2. Transfer the ZIP and external SHA256/manifest through the chosen trusted channel. In PowerShell, use `Get-FileHash -Algorithm SHA256 <zip-path>` and compare the entire expected hash before extraction. Do not run build scripts from an unverified transfer.
3. Extract into a **new empty staging directory**, using `Expand-Archive -LiteralPath <zip-path> -DestinationPath <new-staging-path>`. Read `WINDOWS-BUILD-ONLY.txt` and `WINDOWS-SOURCE-MANIFEST.json`. Verify each staged manifest entry's byte length and SHA256 before copying.
4. Compare only manifest-listed source paths with the existing checkout. If Windows has custom source edits, back up those source files outside the checkout and manually resolve differences first. Do not blindly overwrite or recursively copy the entire staging directory over the project. Never use mirror/delete synchronization, Git reset/clean/stash or authority cleanup.
5. Apply only reviewed manifest-listed repository files. The generated `WINDOWS-*` files are package metadata, not replacements for application source. Extra Windows source files are not removed; review any stale source separately. This package does not silently decide which custom/old files to delete.
6. Keep the final ZIP and SHA256/manifest as the identity of the transferred source snapshot. Do not send private state, full environment dumps, credentials or raw QR data in chat.

## Windows build-only boundary

Use the already verified x64 MSVC/Windows SDK, genuine Python, Node/npm and named Rust `1.99.0-x86_64-pc-windows-msvc` toolchain. Do not reinstall/downgrade tools speculatively. Run as the normal Windows account from the reviewed Windows repository root:

```powershell
npm.cmd ci
npm.cmd run build --workspace @kloda/desktop
```

Stop on the first failure. `npm ci` replaces the dependency installation (`node_modules`) and may execute dependency installation hooks; Desktop build writes its declared compiled artifacts. Neither command grants file authority or opens a pairing owner. Do not copy macOS `node_modules`, `dist`, Cargo `target` or native binaries to Windows. Do not run a root all-workspace build/test as proof from this partial source overlay: API/mobile source is not transferred.

Do not launch Electron/`dev:desktop`, run any diagnostic probe/device/ADB command, create a QR, change firewall/TPM/authority state, adopt/reset/migrate old records or enable a software-key fallback. The physical test pause remains until explicitly lifted. A successful build proves compilation/ABI packaging of this snapshot, not Windows owner initialization, TPM custody, continuity, device-key TLS or real transfer acceptance. Follow the current [platform checkpoint](desktop-platform-validation-plan.md#güncel-yürütme-kapısı--fiziksel-doğrulama-duraklatıldı); historical manual startup instructions do not override it.
