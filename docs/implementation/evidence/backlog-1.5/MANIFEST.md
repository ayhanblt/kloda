# Backlog 1.5 — evidence manifest / 16.11.2026

Contract (single goal + H15/P15/L15/B15/V15 table): [next-plan.md §1.5](../../plans/next-plan.md).
Not repeated here. Mode INITIAL, Opus `/implement`; host Windows 11 (no macOS/xcrun/swiftc).

## Baseline / diff scope

- Start HEAD `586a2fd51e61058053119dd8b1f3ecb65c4f7676`; staged empty. `baseline/` holds `head.txt`,
  `status.txt`, `staged.txt`, the starting copies of all four edited files (`*.start`), the starting CURRENT
  diff (`CURRENT.start.diff`) and `sha256.txt`.
- Pre-existing dirty state (not this work, untouched): five Android FTPS files, FTPS MANIFEST,
  `fix2/resume-win/`, `plans/next-plan.md`, `plans/backlog-1.5-research.md`, CURRENT (F1 lines).
- This work, tracked: `tools/test-ios-webdav-journal.py`, `packages/s3-native/THIRD_PARTY_NOTICES.md`,
  `docs/implementation/20-21-acceptance-collection-2026-11-04.md`, CURRENT (1.5 lines only).
  Untracked: `docs/implementation/evidence/backlog-1.5/**`. Diffs: `work.diff`, `l15/notices.diff`.
  Final hashes: `source-final.sha256`. No production Swift, `check-s3-native.mjs`, dependency or lock change.

## ID → evidence → status

| ID | Evidence | Fresh / reuse | Status |
|---|---|---|---|
| H15 | Harness: HTTP client source removed from closure; `IosWebDavClient.encode` and `IosCloudTarget.oauthKinds` extracted verbatim from production (explicit `SystemExit` if not found); real `IosRecoveryImportJournal.swift` added. `h15-ast.log` (AST ok), `h15-seam-extract.log` (both extractions match production text). Static reference scan: closure files reference no other type outside the closure + stub. | Fresh static only | **OPEN / BLOCKED-ENV**: `python3 -I tools/test-ios-webdav-journal.py` NOT_RUN (needs macOS + xcrun/swiftc). Compile diagnosis before/after not captured; no PASS claimed. |
| P15 | `IosWebDavPublicationChecks.swift` unchanged (no assertion removed/relaxed); no fake createImports/createCatalog/CAS/ACK or copied OAuth list. | — | **OPEN / BLOCKED-ENV**: seed/reopen run NOT_RUN. 02.11 iosJournal PASS is not current. |
| L15 | `l15/LICENSE-2.0.txt` official text, SHA256 `cfc7749b…3d30`, 11358 bytes. crates.io archives SHA256 == `Cargo.lock` checksums (`l15/cargo-lock-entries.txt`): cesu8 `6d43a04d…d83c`, instant-xml `2c32db75…850c`, instant-xml-macros `ac3c2e6c…15d7`. Archive file lists `l15/*.files.txt`: no LICENSE/NOTICE in any; cesu8 has `README.md` + `COPYRIGHT-RUST.txt`. Extracted text hashes `l15/extracted-sha256.txt`; Cargo.toml license `Apache-2.0/MIT`, `Apache-2.0 OR MIT`. Edit by `l15/apply-l15.py` (`l15/apply.log`); `l15/compare.log`: all three inserted texts == official text, 0 `unavailable` left. cesu8 README License section and COPYRIGHT-RUST Rust-origin notice carried verbatim; no copyright invented for instant-xml*. | Fresh | Documentation gap closed. Presence in the distributed app's license materials = §20 release gate, **OPEN** (not run). |
| B15 | §20 B2 bullet in `20-21-acceptance-collection-2026-11-04.md`: artifact path via `CFBundleExecutable`, Release config/SDK/arch, revision, executable SHA256, build settings; `KLODA_S3_OWNED_FIXTURE`/Rust fixture feature ⇒ FAIL; `xcrun nm --no-llvm-bc` output+exit; `_kloda_s3_owned_fixture_marker` ⇒ FAIL; stripped/nm error/missing artifact ⇒ OPEN; Rust archive check not a substitute. Marker source checked: `IosS3Client.swift:110–111`; s3-native Cargo features currently `android-jni` only. | Fresh (doc review of clean/marker/tool-error/missing cases) | Gate bound; real release run **DEFERRED/OPEN**. |
| V15 | This manifest; `diff-check.log` (exit 0); Python AST ok, no `__pycache__` left; script 45 lines (≤300). | Fresh | Self-check only; independent GPT review required. |

## Not run / open gates

- **16.11 kullanıcı kararı:** bu iş kapanmadan Mac kuyruğuna alındı; F1 fix2 ardından H15/P15.
  [Sıra/komutlar](../../windows-handoff-2026-11-16.md#güncel-mac-doğrulama-sırası--1611-kullanıcı-kararı).
  Windows'ta sıradaki bağımsız iş 2.1/G1 planlamasıdır. Bu erteleme H15/P15'i
  karşılanmış veya review-ready yapmaz. Kayıt öncesi kopyalar: `mac-queue-start/`.

- H15/P15 runtime (macOS). TS/JS/Kotlin/Rust/Swift product unchanged → Jest/ESLint/tsc/Android/native/app build
  not required by §1.5 step 4. Release packaging, signing, P5, Faz3–4 physical gates unchanged/open.
- Failed-fix counters: H15 0 attempts run (no runtime). No research subagent used.
