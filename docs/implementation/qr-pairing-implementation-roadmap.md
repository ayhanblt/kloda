# QR LAN pairing — implementation roadmap

Current implementation checkpoint: 2026-10-08. [ADR0013](../decisions/0013-qr-based-local-lan-pairing.md) and [frozen KLODA-QR-PAIR-V1](../security/qr-pairing-v1-protocol.md) remain normative. Shared codec, Rust native core, Android/Electron bridges and pairing UI are implemented and build-tested under the approvals in [ADR0014](../decisions/0014-shared-rust-qr-pairing-core.md). Real hardware Android↔PC completion remains **blocked/not-executed**: this Mac's Electron host fails Secure Enclave creation with missing entitlement (`-34018`), and no valid development signing identity is installed. iOS native integration is explicitly deferred; no software-key fallback or file authority is created.

## Ordered deliverables and current evidence

Implemented paths below replace the earlier proposed paths. Rust owns all secret/session/store authority; shared TypeScript remains syntax/public encoding only. Build, synthetic loopback behavior and physical acceptance are separate evidence levels. The sender journal is not a trust store.

| Order | Module / integration | Current evidence / remaining acceptance |
|---|---|---|
| 1 QR payload/schema | `packages/sync-core/src/pairing/` and native `qr.rs`/`key.rs` | Frozen parser fixtures and canonical SPKI regressions pass; compiled public TypeScript API smoke observed. No helper grants trust. |
| 2 PC invitation/state | Native `pc.rs` and serialized runtime actor | 120s elapsed deadline, single winner, stale approval/cancel/expiry and durable commit failure regressions pass. Hardware actor/LAN exercise remains blocked. |
| 3 Local QR render | `apps/desktop/src/features/pair-device/` and narrow Electron IPC | Approved qrcode renders the synthetic fixture locally; actual Electron error surface inspected. Real invitation display awaits hardware identity. |
| 4 Mobile scan/parser | `apps/mobile/src/features/pairing/` and `pages/pairing/` | Approved QR-only CameraView, permission/errors, duplicate and offscreen scan gating implemented; consumer tests and native APK build pass. Physical camera/UI verification not executed. |
| 5 LAN connection | Native `network_*`, TLS/runtime and Android bound-network bridge | Direct-route checks and no remote fallback implemented; four Android ABI libraries compile/package. Actual route behavior on Android↔PC remains unverified. |
| 6 PC fingerprint | Native strict certificate/SPKI verifier | Real synthetic loopback rejects mismatched key/profile and verifies actual presented leaf SPKI. Hardware PC equality remains blocked. |
| 7 Mutual TLS possession | rustls0.23.45 native TLS and platform signers | Real loopback full TLS1.3/mutual CertificateVerify passes with test-only software identities. Hardware Android/Electron signer integration is not a pass. No production software fallback. |
| 8 QR secret HMAC | Native `proof.rs` and normal TLS exporter | Frozen bytes and actual loopback exporter/channel-swap rejection pass; no JS exporter/signing API. Physical integration unverified. |
| 9 PC approval | Protected desktop DOM/mobile Reanimated modal and native exact-candidate command | Reserved-candidate approval, stale callbacks, navigation/foreground fences implemented and tested. Actual hardware candidate surface awaits LAN execution. |
| 10 Durable pin/consume | Native SQLite WAL/FULL store, installation epoch/backup exclusion | Reopened-store atomic PC tuple, phone PENDING-before-proof/pin-before-ACK, failure and continuity/revoke regressions pass. Physical restore/backup behavior not proved. |
| 11 Completion/ACK recovery | Native phone/PC session and store | Actual synthetic loopback two-pin completion, lost commit/final reply, reopened-store recovery and wrong-key/revoke rejection pass. Hardware process-restart/lost-ACK proof remains open. |
| 12 Adversarial tests | Native43, desktop50, mobile16, shared104 regressions | Tests exercise observable behavior, not wiring/source text. The complete QR01–QR33 physical/integration matrix below is not closed by this subset. |
| 13 Real Android↔PC LAN | Final app/dev-build/native endpoints; authorized physical Android and actual PC | With internet/backend/homeserver/TURN absent: QR→actual mutual TLS→HMAC→PC approval→two durable pins→ACK complete; process restart/lost ACK recovery. Without scope/capability file access rejected. Emulator/simulator only preparation. |

Native Rust/rustls, dependency set, JNI/Node-API boundaries and hardware SDK implementations are now selected and written. Hardware custody/runtime, minimum-OS/background support and physical LAN adoption are not inferred from compilation. File authorization still requires account eligibility/step-up/PC scope/capability/time/revoke/fence; offline initial trust never creates first file grant.

## Future adversarial acceptance matrix

Separate QR-only plan; **not added to the 36 authority targets**, all of which remain not-executed. No row below is a runtime pass. Each independently listed input/phase variant must be exercised when actual implementation exists.

| Case | Input / boundary | Expected durable state | Expected network / visible behavior | Status |
|---|---|---|---|---|
| QR01 | Malformed payload | No invitation reservation/pin | Reject before network/key action; visible parse error | not-executed |
| QR02 | Oversize payload | No reservation/pin | Bounded parser rejects before network/key action | not-executed |
| QR03 | Unsupported version; duplicate fields/unknown authority fields | No reservation/pin | Strict frozen schema rejects, no downgrade/authority import | not-executed |
| QR04 | Wrong sid/hash/secret lengths; invalid/noncanonical base64; invalid IP/port | No reservation/pin | Strict frozen limits reject before connection | not-executed |
| QR05 | Duplicate scan callbacks | At most one active candidate, no duplicate pair | Single network attempt/candidate workflow; visible cancellation/error remains accurate | not-executed |
| QR06 | Changed LAN IP with same actual PC key | Hint does not mutate identity/pin; normal approved pair only | Actual TLS equality/proof still required; IP alone not trust rejection/acceptance | not-executed |
| QR07 | Wrong PC fingerprint; header key; root-only delegated leaf | No new pin/consume | Reject actual TLS SPKI mismatch, no approval/file action | not-executed |
| QR08 | Wrong phone or PC private key | No reservation/pin | Native CertificateVerify failure; no verification bypass | not-executed |
| QR09 | Wrong secret | OPEN unaffected unless TTL expires; no pin | Same-channel proof rejected; socket alone never reserves | not-executed |
| QR10 | Expired secret / reconnect after TTL | Invitation invalid, no pin | Reject; reconnect cannot renew TTL; fresh UI invitation required | not-executed |
| QR11 | Session-swapped HMAC | No reservation/pin | Live channel mismatch rejected | not-executed |
| QR12 | Role-swapped HMAC | No reservation/pin | Role-bound proof rejected | not-executed |
| QR13 | Key-swapped HMAC | No reservation/pin | Two-identity binding mismatch rejected | not-executed |
| QR14 | Replayed HMAC / old resumed/0RTT proof | No new reservation/pin/authority | Fresh full channel required; replay/early proof rejected | not-executed |
| QR15 | Socket-only contender | OPEN, no reserve/pin | Other valid proof can still contend within TTL | not-executed |
| QR16 | Concurrent valid contenders | Exactly one RESERVED key/transcript; no pin yet | Atomic CAS one winner; losers rejected; QR hidden | not-executed |
| QR17 | Stolen-QR racer wins; PC denies | No pin/consume, invitation invalid | Valid racer reservation is residual accepted risk, not identity compromise; denial prevents trust; DoS possible | not-executed |
| QR18 | Expiry before consume | Invalid invitation, no pin | Abort, no completion; old secret never reopened | not-executed |
| QR19 | Denial / stale or mismatched approval | No pin/consume | Exact reserved approval only; stale callback rejected; fresh invitation after denial | not-executed |
| QR20 | Cancel before consume | Invalid invitation, no pin | Hide QR/close pairing; old secret not reused | not-executed |
| QR21 | Crash/restart in OPEN | No restored invitation/pin | New UI invitation requires fresh sid+secret | not-executed |
| QR22 | Crash/restart in RESERVED | No restored invitation/pin | Old reserved candidate/secret cannot resume to trust | not-executed |
| QR23 | Crash/restart in APPROVED before commit | No restored invitation/pin | Old approval not completion; fresh invitation required | not-executed |
| QR24 | PC-local durable commit failure | Neither consumed record nor pin committed | No consumed/trusted/completed response; invalidate invitation | not-executed |
| QR25 | Crash immediately after PC commit | Exactly one PC consumed record/pin survives | Truthful pending ACK; fresh same-key authenticated recovery only | not-executed |
| QR26 | Phone pin write failure | PC consumed may survive; phone no durable pin/completion | No ACK; no fabricated distributed success; authenticated pending recovery subject to retained binding | not-executed |
| QR27 | Lost authenticated response | PC consumed preserved; phone pending binding/result persisted as available, no false completion | Same exact pinned phone on fresh authenticated channel recovers result; no new pair | not-executed |
| QR28 | Lost ACK / restart after phone pin | Both pins and PC consumed survive; pending/completion accurate | Matching fresh same-key recovery/ACK idempotently completes | not-executed |
| QR29 | Duplicate ACK/result | One pair only; no duplicate consumption/pin | Idempotent matching response, no repeated authority grant | not-executed |
| QR30 | Same-key recovery | Exact consumed pair retained | Fresh authenticated matching channel finishes without reopening invitation | not-executed |
| QR31 | Different key consume reuse / lost pin / revoked peer / new invitation | Old consumed/deny record unchanged; no automatic adoption | Reject reuse; required loss fresh QR re-trust and separate online authorization | not-executed |
| QR32 | Backend/login/internet absent | Approved QR pair may durably complete; no file grant created | Direct LAN trust succeeds without remote service calls; scope/capability-free file access rejected | not-executed |
| QR33 | Secret-output capture and QR render | Raw secret absent from DB/logs/analytics/crash reports/URL query; only transient display/scan/native memory | No remote QR request; local display only, hide on reservation/expiry/cancel | not-executed |

## Evidence and next gate

[Production gates](../security/production-gates.md): Android physical hardware-backed P-256→TLS1.3 CertificateVerify **CLOSED/PASS (SM-S921B/API36)** is device-local native server/client on one device. Actual Android↔PC LAN/final app/Rust-rustls bridge, iOS physical (no device; deferred), Windows/macOS hardware TLS, minimum-OS coverage/background and aggregate G01/authority remain open. No rerun in this execution. Historical Matrix sources/results/hashes/counts remain archival, not QR evidence.

Mac paid development signing/provisioning remains an explicit platform-local gate: free Personal Team only, actual Secure Enclave creation `-34018`, no fallback/fake invitation. [ADR0015](../decisions/0015-desktop-platform-and-signing-isolation.md) isolates dev/production namespaces and lets Windows/Linux proceed independently. Approved Windows-only windows-sys0.61.2 now backs source TPM CNG identity, physical direct-LAN route/socket checks and protected LocalAppData/NTFS authority storage. Windows compilation/runtime/physical evidence remains absent; [validation plan](desktop-platform-validation-plan.md) provides the required manual inventory and Linux's nonphysical limits. Current Mac verification: native47, API1/desktop50/mobile16/shared104 tests, strict clippy/size/lint and desktop build pass. Windows-only route/storage tests were not executed on Mac. Physical Windows/Android/manual steps still require Ayhan.

## Historical shared codec checkpoint — superseded by native checkpoint

User authorized implementation; user-request steps1–2 (pure codec/constants and parser/public-SPKI negative tests) complete. Shared package104 tests pass, including83 documented parser fixture outcomes and public-key profile rejection. Compiled public API smoke roundtrips the frozen QR, accepts13/rejects70 fixture inputs and reproduces both canonical SPKI fingerprints. Root `npm run lint && npm run test && npm run build` passes; API1/desktop34/mobile2/shared104 tests. Mobile builds are Expo bundle exports, not native pairing/physical proof.

At this earlier checkpoint native dependencies, certificate signer clarification and platform UI choices were pending. Subsequent approvals in ADR0014 resolved them; the current implementation/evidence table above supersedes those blockers. Native ownership and no fake trust/session/store adapter remain required.

The earlier QR dependency installation and synthetic PNG observation remain library-only evidence. Subsequent native/UI approvals are adopted; steps3–12 have implementation/build/synthetic evidence but are not physical acceptance. QR01–QR33 and36 authority integration targets remain open; Android's previous signer PASS is unchanged and was not rerun.

## Native approval closure fence — 2026-10-08

The PC native approval path now pumps the winning TLS connection and requires an established channel with neither observed TCP EOF nor observed TLS `close_notify` before durable consume/pin. Closed reservations follow the existing connection-failure invalidation path. This authorization-only fence does not discard buffered plaintext: postconsume ACK and Complete frames still drain through ordinary frame handling.

Four behavioral regressions passed within the43-test native suite: observed preconsume TCP EOF/close-notify rejection and buffered final-frame draining after each closure kind, using real loopback TCP/mutual TLS, test-only software identities and reopened stores. They are not physical Android↔PC LAN, hardware custody or production-readiness evidence. Frozen wire bytes are unchanged.

## Native/UI build and smoke checkpoint — 2026-10-08

- `cargo fmt --check`, strict all-target desktop-node clippy and native43 tests pass. All Rust sources meet300 nonblank lines.
- Root lint/test/build pass: API1, desktop46, mobile16, shared104; Electron main/renderer and iOS/Android Expo exports compile. Mobile TypeScript check passes.
- Actual Android `assembleDebug` succeeds and packages the Rust JNI libraries for arm64-v8a, armeabi-v7a, x86 and x86_64. Compilation/minSdk24 configuration is not old-device support or physical pairing proof.
- Actual Electron app was launched, pairing page visually inspected and actual preload/IPC/NAPI error observed. Fixed runtime package exports, top-level startup-await deadlock and Electron44.4.5 SQLite ABI; the Electron binding builds separately without replacing the Node test binding.
- Separate native/UI reviews found and fixed the preconsume closure fence, Android callback lifetime cleanup, desktop owner/navigation fencing and mobile inactive scan rejection. Android callback counts and mobile physical visuals are not runtime-verified.
- No physical phone/USB/ADB, existing Android signer experiment, iOS native integration, backend/cloud/KMS, file grant or FolderSync archive operation was executed. Temporary numeric hardware diagnostics were removed.

### Subsequent platform/profile checkpoint

Desktop50 regressions now pass with canonical isolated development/production metadata/storage and no auto-migration. Actual development Electron startup uses `com.kloda.desktop.dev`, with product display name unchanged and truthful missing-identity error. Windows/Linux source portability and independent CI jobs are prepared; CI runs, Windows hardware and Linux VM execution are not claimed. Mac paid gates no longer block those independent source jobs.
