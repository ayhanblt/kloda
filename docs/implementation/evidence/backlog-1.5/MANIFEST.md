# Backlog 1.5 — evidence manifest / 16.11.2026

Contract (single goal + H15/P15/L15/B15/V15 table): [next-plan.md §1.5](../../plans/next-plan.md).
Not repeated here. Mode INITIAL, Opus `/implement`; host Windows 11 (no macOS/xcrun/swiftc).

## Baseline / diff scope

## 17.11 Mac doğrulaması — güncel durum

Kullanıcı 10 dakika sınırını onayladı. HEAD `508b3f04`; ürün/harness düzenlemesi yok.
`python3 -I tools/test-ios-webdav-journal.py`: **exit 0, 6.01 saniye**.
H15 gerçek host Swift derlemesi ve P15 seed/reopen assertion'ları PASS.
Kanıt: `mac-2026-11-17/host-check.log`, `mac-2026-11-17/result.txt`.
Önceki source-final.sha256 üç dosyası Windows CRLF biçimine göre eşleşir;
Mac LF farkı içerik farkı değildir (17.11 maliyet incelemesi).
L15/B15 mevcut kanıtları korunur; release marker/packaging koşusu yapılmadı.
**REVIEW / ACCEPTED — 17.11 bağımsız GPT:** aşağıdaki tarihî H15/P15 BLOCKED-ENV
durumları bu koşuyla giderildi; H15/P15/L15/B15/V15 birlikte kabul edildi.
[review.md](review.md), taze statik kanıt: `review-audit.txt`. CURRENT 1.5 [x];
release/fiziksel kapılar açık. Test ilk denemede geçti; reviewer tekrar koşmadı.
F1 Faz3 ve FO1 Faz4 DEFERRED/NOT_RUN korunur. Token UNKNOWN.

### Tarihî Windows baseline

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
| H15 | HTTP client removed from compile closure; encode/oauthKinds extracted verbatim with fail-closed lookup; real import journal added. `mac-2026-11-17/host-check.log` + `result.txt`: real Swift compile + execution exit 0 / 6.01 s. `review-audit.txt`: AST, seams, baseline/HEAD/hash chain and 19 production inputs checked. | Mac application PASS REUSE; fresh reviewer static | **ACCEPTED**. Reviewer compile/runtime NOT_RUN. Initial compile RED log absent; prior concrete diagnosis and final proof/limitation in review.md. |
| P15 | Existing checks and golden unchanged; real production journal/publication/schedule/restore closure. Mac log's 8 PASS lines include seed and fresh-process reopen, lost PUT/MOVE/ACK, stale plan, immutable/keep-both/restore assertions. No fake createImports/createCatalog/CAS/ACK or copied OAuth list. | Mac application PASS REUSE; fresh reviewer input/diff verification | **ACCEPTED**. No test rerun; no TLS/Keychain/OS proof claimed. 02.11 PASS is not substituted for current Mac evidence. |
| L15 | `l15/LICENSE-2.0.txt` official text, SHA256 `cfc7749b…3d30`, 11358 bytes. Archives SHA256 == actual Cargo.lock: cesu8 `6d43a04d…d83c`, instant-xml `2c32db75…850c`, instant-xml-macros `ac3c2e6c…15d7`. File lists/extracted hashes/declarations retained. `review-audit.txt`: local checksum-matched archives verified; three full inserted texts == official text, 0 unavailable; cesu8 README/Rust notices verbatim, other sections/JNI unchanged. Old apply/compare logs absent, not reused as PASS. | Existing sources REUSE; fresh reviewer comparison | **ACCEPTED — documentation goal**. Distributed app's license materials = §20 release gate **OPEN / NOT_RUN**. |
| B15 | §20 B2 bullet in `20-21-acceptance-collection-2026-11-04.md`: artifact path via `CFBundleExecutable`, Release config/SDK/arch, revision, executable SHA256, build settings; `KLODA_S3_OWNED_FIXTURE`/Rust fixture feature ⇒ FAIL; `xcrun nm --no-llvm-bc` output+exit; `_kloda_s3_owned_fixture_marker` ⇒ FAIL; stripped/nm error/missing artifact ⇒ OPEN; Rust archive check not a substitute. Marker source checked: `IosS3Client.swift:110–111`; s3-native Cargo features currently `android-jni` only. | Existing procedure REUSE; fresh independent clean/marker/tool-error/missing cases review | **ACCEPTED — gate definition**; real release run **DEFERRED/OPEN**. |
| V15 | `review.md` independent GPT real-diff review; `review-audit.txt` baseline/source/input hash chain, AST, license verification and scoped committed diff-check exit 0; tracked/staged/untracked scope recorded. Script 45 lines (≤300). Historical AST/seam/diff-check logs absent, not claimed inspected. | Fresh independent review/static audit; Mac runtime REUSE | **ACCEPTED**. CURRENT checkbox closed here; product code unchanged. |

## Not run / open gates

- **Tarihî 16.11 kullanıcı kararı (17.11 superseded):** bu iş kapanmadan Mac kuyruğuna alındı; F1 fix2 ardından H15/P15.
  [Sıra/komutlar](../../windows-handoff-2026-11-16.md#güncel-mac-doğrulama-sırası--1611-kullanıcı-kararı).
  Windows'ta sıradaki bağımsız iş 2.1/G1 planlamasıdır. Bu erteleme H15/P15'i
  karşılanmış veya review-ready yapmaz. Kayıt öncesi kopyalar: `mac-queue-start/`.

- H15/P15 macOS koşusu 17.11 tamamlandı, bağımsız review kabul; tekrar yok. TS/JS/Kotlin/Rust/Swift product unchanged → Jest/ESLint/tsc/Android/native/app build
  not required by §1.5 step 4. Release packaging, signing, P5, Faz3–4 physical gates unchanged/open.
- Failed-fix counters: H15 0 failed runtime/fix attempts; first actual Mac run PASS. No counter reset. No research subagent used; local exact-version archives sufficient. F1 counters untouched.
- F1 fix2 compile/RED-GREEN/scoped lint Faz3 **DEFERRED/NOT_RUN**; FO1 delta Faz4 **DEFERRED/NOT_RUN**. Neither accepted by this 1.5 review.
- Next: separate GPT plan conversation for **2.2/G2–G3**, exact prompt in CURRENT. No new implementation/review session for administrative closeout.
