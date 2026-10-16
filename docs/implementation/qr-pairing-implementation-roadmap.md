# QR LAN pairing — implementation roadmap

2026-10-15 migration audit: [Codex handoff](codex-migration-handoff.md) current kısa giriş; aşağıdaki tarihli test sayıları kendi checkpoint'leridir. Son Android/ADR0017 implementation2026-10-14 bölümünde kayıtlıdır; iOS native ve mobile scheduled/background execution hâlâ eksiktir. Windows owner `storage_failure`/code-shaping continuity kararı ve physical pause sürer. Sonraki kritik bağımlılık bu mevcut Windows karar kapısını sonuçlandırmaktır; yeni probe/aynı araştırma veya bu docs-only denetimden development izni türemez.


Current implementation checkpoint: 2026-10-08. [ADR0013](../decisions/0013-qr-based-local-lan-pairing.md) and [frozen KLODA-QR-PAIR-V1](../security/qr-pairing-v1-protocol.md) remain normative. Shared codec, Rust native core, Android/Electron bridges and pairing UI are implemented and build-tested under the approvals in [ADR0014](../decisions/0014-shared-rust-qr-pairing-core.md). Real hardware Android↔PC completion remains **blocked/not-executed**: this Mac's Electron host fails Secure Enclave creation with missing entitlement (`-34018`), and no valid development signing identity is installed. iOS native integration is explicitly deferred; no software-key fallback or file authority is created.

Current V1 direction: [ADR0016](../decisions/0016-v1-pc-local-file-authority.md) native PC-local schema3 ACL/receiver/journal, separate explicit own-peer scope consent; no mandatory LAN JWT/Nest/issuer/KMS/cache. User-approved [ADR0010 §6](../decisions/0010-operation-bound-pc-commit-proof.md#approved-v1-sequential-contract) is implemented: full native mTLS1.3 `kloda-file/1`/HTTP1 upload/resume/finalize/query/list/own restore and atomic trust+ACL revoke exact ACK. Frozen QR unchanged; current root/pin/revision required, immutable completed own history only after same-peer/same-root regrant/repair, never pending adoption. Native84/strict clippy/policy15/root lint, full root suites(API1/desktop82/mobile19/sync-core117), desktop build and four-ABI JNI/APK PASS. Actual software-fixture TCP transfer/restart/restore/lost-reply revoke and isolated16MiB ENOSPC recovery PASS; not physical/hardware/phone Photos sender evidence. Trusted local-writer boundary and Windows storage, Mac signing/distribution, Linux custody/support, account recovery/central revoke/final remote policy OPEN gates remain. [Handoff](implementation-session-handoff.md#v1-local-authority-adoption) has exact evidence.

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

Native Rust, dependencies, JNI/Node-API boundaries and hardware SDK integrations are selected and written. Hardware custody/runtime, minimum-OS/background support and physical LAN adoption are not inferred from compilation. File authority is now PC-local ACL management with explicit per-peer scope consent; exact receiver contract and end-to-end file acceptance remain open under ADR0010 §6. Account recovery/central revoke and final remote authorization remain OPEN.

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

## QR host coverage eşlemesi — 2026-10-12

Bu eşleme yukarıdaki **not-executed** physical/integration statülerini değiştirmez. `N` = `packages/pairing-native/src/`; `M` = `apps/mobile/src/features/pairing/model/`; `D` = `apps/desktop/src/pages/pairing/PairingPage.spec.tsx`. Native state testleri abstract channel, TLS testleri gerçek TCP/rustls + disposable software identity, UI testleri mocked native boundary kullanır. Parser başarısı network/key side-effect proof değildir.

| Case | Mevcut host davranış dayanağı | Açık kapsam |
|---|---|---|
| QR01 | `N/qr_tests.rs:frozen_parser_fixtures` | Actual scan→native no-network/key-action sınırı |
| QR02 | Aynı fixture testi: wire/decoded limit ve sınırlar | Actual scanner boundary |
| QR03 | Aynı fixture testi + `exact_native_version_diagnostics_follow_normative_token_rules` | Native caller side effects |
| QR04 | Aynı fixture testi: field/base64/IP/port | On-link/interface/locality fiziksel kabulü |
| QR05 | `N/phone_tests.rs:duplicate_scan_never_opens_a_second_pending_session`; `M/pairing-controller.spec.ts` burst latch; `M/use-pairing.spec.ts` background/unmount callbacks | Actual camera/native network-attempt lifetime |
| QR06 | Doğrudan changed-IP/same-key testi yok | Actual route/hint değişimi; loopback IP'yi LAN proof sayma |
| QR07 | `N/tls_behavior_tests.rs:mutual_auth_profile_pin_and_certificate_verify_fail_closed_on_real_peers`; `N/certificate_tests.rs:hostile_correctly_signed_profiles_are_not_accepted` | Hardware presented leaf; tam header/delegated-leaf integration varyantları |
| QR08 | Aynı real-TLS negative test: **iki rolde** CertificateVerify signer mismatch ve channel rejection | Hardware device-key TLS |
| QR09 | `N/proof_tests.rs:frozen_transcript_and_tag_with_live_binding_negatives` secret mutation; `N/pc_tests.rs:invalid_contender_does_not_reserve_and_winner_is_immutable` bad proof→OPEN/no record | Actual actor socket/secret path |
| QR10 | `N/pc_tests.rs:stale_approval_is_noop_and_deadline_boundary_invalidates` 120000ms ve eski proof ret | Actual reconnect TTL/UI invitation |
| QR11 | Proof negative testi channel/sid mutation; `N/tls_behavior_tests.rs:real_exporter_proof_cannot_transfer_to_fresh_tls_even_with_same_generation` | Hardware channel binding |
| QR12 | Proof negative testi PC/phone role swap | Actual malicious peer frame |
| QR13 | Proof negative testi PC ve phone fingerprint'inin bağımsız mutation'ı | Actual malicious peer key binding |
| QR14 | Real exporter fresh-channel replay rejection | Resumed/0RTT peer davranışı; config tek başına proof değil |
| QR15 | Invalid proof sonrası OPEN korunması var; socket-only contender testi yok | Actor düzeyinde socket-only + valid contender |
| QR16 | `N/pc_tests.rs:invalid_contender_does_not_reserve_and_winner_is_immutable` serialized winner/duplicate/loser | Concurrent actor contention; sequential test concurrency değildir |
| QR17 | `N/pc_tests.rs:cancel_ordered_before_authorization_never_creates_trust`; `D` explicit deny/cancel | Stolen-QR racer + actual PC denial uçtan uca |
| QR18 | `N/pc_tests.rs:stale_approval_is_noop_and_deadline_boundary_invalidates`; `authorized_before_deadline_is_not_undone_and_cancel_is_revoke` | Actor expiry/abort/UI lifecycle |
| QR19 | Aynı stale-approval testi; `D` stale displayed generation/explicit decision | Actual identity/callback mismatch ve hardware candidate |
| QR20 | `N/pc_tests.rs:cancel_ordered_before_authorization_never_creates_trust`; `D` explicit cancel | Actual listener/QR closure |
| QR21 | OPEN crash/restart özel host testi yok | Process restart/fresh sid+secret |
| QR22 | RESERVED crash/restart özel host testi yok | Process restart/no restored candidate |
| QR23 | APPROVED-before-commit process testi yok | Native commit crash boundary; synchronous approve sonucunu ayrı persisted phase sayma |
| QR24 | `N/pc_tests.rs:consume_failure_yields_no_commit_and_restart_has_no_partial_tuple` SQLite injected failure/reopen | Platform durable storage/publication |
| QR25 | `N/tls_behavior_tests.rs:lost_commit_ack_and_complete_recover_after_store_reopen_with_same_pins` lost Commit; `N/phone_tests.rs:lost_commit_and_final_reply_recover_end_to_end_without_qr_secret` | Actual process crash/hardware continuity |
| QR26 | `N/phone_tests.rs:pin_failure_returns_no_ack_and_restart_is_pending_with_hint` | Platform phone write failure |
| QR27 | Real-TLS recovery testi lost Commit/Complete; `M/pairing-controller.spec.ts` uncertain native reply görünür pending | Actual bridge/process loss |
| QR28 | Real-TLS recovery testi **pin sonrası ACK teslim edilmeden** reopen; PC Consumed/phone PinnedPendingAck ve same-key completion | Actual process/network interruption |
| QR29 | `N/pc_tests.rs:ack_requires_sent_commit_and_fresh_recovery_is_idempotent`; `N/phone_tests.rs:complete_requires_actual_ack_write_and_stale_callback_cannot_pin` duplicate frames/one record | File-authority grant mevcut değil; grant testine çevrilmez |
| QR30 | Aynı real-TLS recovery testi; `N/store_tests.rs:durable_pc_tuple_reopens_and_sid_cannot_change_peer` | Hardware fresh-channel recovery |
| QR31 | `N/tls_behavior_tests.rs:recovery_rejects_different_real_tls_keys_and_durable_revocations`; `N/store_tests.rs:different_local_key_or_epoch_cannot_adopt_database`; `N/phone_tests.rs:explicit_phone_repair_has_new_sid_and_keeps_old_deny` | Actual lost-pin/restore continuity + ayrı online authorization |
| QR32 | `N/tls_behavior_tests.rs:full_mutual_tls_drives_durable_two_sided_completion` local loopback two-pin completion | Offline final app/network capture ve capability-free file rejection; pairing test file grant kanıtı değil |
| QR33 | `N/pc_tests.rs` reservation'da QR gizleme; `apps/mobile/src/shared/api/pairing.spec.ts` private status fields çıkarma; `D` raw error/QR exposure ret | DB/log/analytics/crash/URL capture ve actual render lifecycle |

Üç doğrulanmış boşluk **mevcut testler genişletilerek** kapatıldı: phone CertificateVerify mismatch, bağımsız secret/PC-key/phone-key HMAC mutation ve pin sonrası lost ACK. Yeni test dosyası, production code, dependency veya frozen wire değişikliği yok. Kalan satırlar yeni ürün implementasyonu veya physical PASS diye etiketlenmedi; aynı davranışa duplicate test eklenmedi.

Exercised: locked native47 + doc-tests0 PASS; `cargo fmt --check` ve all-target `desktop-node` clippy `-D warnings` PASS; desktop50 ve mobile16 PASS. Real TLS testleri actual loopback handshake, channel rejection, durable store reopen ve recovery'yi çalıştırdı; owner/device/probe/hardware deneyi değildir.

## Geliştirme grupları ve toplu fiziksel kabul

Bu beş grup bağımlılık sırası değil index'tir; zorunlu 1→5 yürütme sırası oluşturmaz. Account/file authorization ayrı mevcut gate'tir, altıncı grup değildir. [ADR0009](../decisions/0009-evidence-gated-incremental-implementation.md) prerequisite-ready bağımsız dilimleri ve code-shaping kanıt istisnasını korur. Güncel fiziksel duraklatma ve Windows kanıtı [validation checkpoint](desktop-platform-validation-plan.md#güncel-yürütme-kapısı--fiziksel-doğrulama-duraklatıldı) içindedir.

| Grup | Mevcut dayanak / yeniden yapılmayacak iş | Bağımsız geliştirme sınırı | Grup sonu fiziksel kabul / blocker |
|---|---|---|---|
| **Windows Native** — Storage, sertifika yenileme, Electron owner ve TPM entegrasyonu | ADR0014/0015, mevcut native source ve desktop validation plan. Kullanıcı bildirimli explicit MSVC compile/check, native53/53 ve desktop/native-Electron ABI build PASS tekrar görev değildir. | Storage yayınlama/sertifika yenileme/VFS/continuity kararları açık; bunlara bağlı product değişikliği hazır sayılmaz. | Windows identity/custody/nonexportability ile actual device-key TLS ayrı acceptance; ilgili source/automated/review hazırlığı ve blocker çözümü sonrası aynı platform grubunda toplanır. Şu anda fiziksel işler duraklatılmıştır. |
| **QR Pairing** — Gerçek TLS, QR eşleştirme, onay ve recovery | ADR0013/frozen V1 ve roadmap1–13. Codec/native state/store/TLS/bridges/UI implemented/build/synthetic kanıtı korunur; bunlar yeniden implementation backlog'u değildir. | Mevcut QR01–QR33 içinde physical sonucu gerektirmeyen, kabul edilmiş davranışa ait gerçek test boşluklarının giderilmesi Windows publication kararından bağımsız adaydır; production owner/gerçek pin completion uydurulmaz. | Grup sonunda hazır Android↔PC endpoint'leriyle camera→TLS→HMAC→exact approval→iki durable pin→ACK/restart/recovery kabulü; Windows endpoint blocker'ı çözülmeden bağımlı LAN pairing yapılmaz. Android device-local signer PASS tekrarlanmaz. iOS native deferred kalır; gruplama bunun implementation onayı değildir. |
| **LAN Transfer** — Güvenli aktarım motoru, chunk, hash, journal ve resume | ADR0005/0009/0010, [first-slice status](first-vertical-slice-status.md), [native prerequisite](native-peer-session-prerequisite.md). Mevcut beş WebDAV prerequisite (source-ID, target isolation, SHA256 snapshot, own-receipt byte revalidation, acknowledged recovery) tamamlanmış olarak kalır; PC receiver/authority yerine sayılmaz. | Chunk/wire/schema veya receiver API icat edilmez. File eligibility/capability/channel binding/result proof/durable publication prerequisites'i karşılanmış bağımsız dilimler ilerleyebilir; sadece pairing PASS dosya yetkisi değildir. | Fiziksel LAN kesinti/resume ve doğru hedef byte/publish kabulü grubun sonundadır; Windows güvenlik sınırına bağlı receiver işi blocked kalır. Gerçek FolderSync arşivi test fixture'ı değildir. |
| **Fotoğraf Yedekleme** — Mobil fotoğraf seçimi, otomatik yedekleme, geri yükleme ve kullanıcı akışları | ADR0001/0005, [ürün kaydı](../product/computer-backup-files-and-photos.md) ve first-slice status. Mevcut Files/Photos selection/queue temeli korunur; gerçek backup/restore tamamlanmış sayılmaz. | Onaylı UI/pure scheduling/source-state işleri ancak mevcut sözleşme ve source-backed readiness ile ilerler; Live OS-opportunity, ayrı Sync Now, limited permission/çok-resource/restore reconciliation korunur. | Fiziksel permission/lifecycle/background/restore/minimum-current OS kabulü grup sonunda; iOS native ertelemesi ve cihaz yokluğu korunur. Hazır olmayan transport/authority'e fake başarı bağlanmaz. |
| **Remote Transfer** — WebRTC P2P, STUN/TURN fallback ve uzaktan erişim | ADR0005/0012; WebRTC/DTLS + signed signaling/fingerprint + device proof, direct P2P ve Cloudflare TURN fallback yönü korunur. | Bu başlık provider/dependency/signaling tasarım veya cloud execution onayı değildir. Seçilmemiş API/hosting/custody/background kararına bağımlı iş implement edilmez; kararlaştırılmış bağımsız source işleri diğer grupları beklemez. | Fiziksel farklı ağ/NAT/TURN/reconnect/background kabulü grubun sonunda; historical direct inconclusive kapanmaz; LAN failure'a sessiz remote fallback eklenmez. |

Bağımsız desktop scheduling ilerlemesi: [persisted occurrence/cold-start checkpoint](implementation-session-handoff.md#desktop-scheduled-occurrence-checkpoint--2026-10-12) ve [single-owner/tray lifecycle](implementation-session-handoff.md#desktop-single-owner-ve-tray-lifecycle--2026-10-12) implemented/host-verified; root desktop62 ve actual Node/Electron-ABI/GUI isolated smoke PASS. Gizli/minimized renderer yeni pairing owner açamaz, cleanup-close native owner oluşturmaz. Bunlar Photos backup/OS execution, real auto-upload veya file grant completion değildir; Windows authority store'a dokunulmadı.

Bağımsız §9 desktop [persisted activity snapshot](implementation-session-handoff.md#desktop-persisted-activity-snapshot--2026-10-12): actual HTTPS completion/partial503 ve fresh-process GUI read PASS; root desktop63. QR/pin/store/file authorization kapsamı değişmedi; live activity ve full durable queue açık.

[Live activity continuation](implementation-session-handoff.md#desktop-live-activity-continuation--2026-10-12) desktop64 ve actual startup-scheduled HTTPS byte transfer/Sync Now join/no-reload progress PASS. QR/file authority veya physical gate kapanmadı.

[Desktop wall-clock continuation](implementation-session-handoff.md#desktop-wall-clock-deadline--2026-10-12): üç failing-before/passing-after case, desktop67 ve actual compiled timer/SQLite smoke PASS; Windows store/QR/file authority kapsamı unchanged.

[Desktop storage-test freshness](implementation-session-handoff.md#desktop-storage-test-freshness--2026-10-12): root desktop68 ve actual TLS stale-config/form race PASS; file grant, QR trust, Windows storage veya physical gate unchanged.

[Mobile storage-test freshness ve kalan readiness](implementation-session-handoff.md#mobile-storage-test-freshness--2026-10-12): mobile17/exports ve real HTTPS consumer state smoke PASS; actual native visual/vault/transfer veya QR/file authority değildir. Grup-sonu physical pause ve selected native/receiver/provider prerequisites korunur.

[Desktop ongoing timezone reconciliation](implementation-session-handoff.md#desktop-ongoing-timezone-reconciliation--2026-10-12): existing minute check runtime zone değişimini yeni local due'ya bağlar; desktop70 ve compiled actual timer/SQLite smoke3 PASS. OS timezone/sleep-wake/physical veya authority time gate'i değildir; Windows blocker'ı ve physical pause unchanged.

Historical [PC-first HTTP dependency checkpoint](implementation-session-handoff.md#pc-first-axumtokio-dependency-adoption--2026-10-12): Axum0.8.9/Tokio1.50.0 minimum features/native47/desktop70/build evidence before the receiver implementation below. Native async TLS adapter/file contract were prerequisites at that checkpoint, now implemented; no sidecar/resumption/authority bypass, and actual phone Photos/physical runtime acceptance remains open.

**V1 receiver checkpoint:** schema3 native receiver/journal and approved ADR0010§6 sequential mTLS/HTTP1 contract implemented; native84/strict clippy/policy15/root lint and full root suites PASS,110 Rust files/max292. Current desktop native/main/renderer build, four-ABI JNI and debug APK PASS (Android server-only dead-code warnings8, no suppression). Actual software-fixture upload100000/resume65536/reopen/finalize/list/exact restore/lost-reply revoke+exact ACK/file403 and isolated16MiB target ENOSPC queue/hash/offset preservation with identical retry PASS. Not physical/hardware/actual phone Photos sender acceptance. Account recovery/central revoke/final remote policy and platform-local gates OPEN. Actual182-package lock SHA256 `3018af056e687be5d50edf55a51a45c68aca8918121d619df0f7e4a0f69e8db5`, cargo-audit0.22.2 vulnerabilities0/warnings0 against DB `d5f46becf4d442d460e1fce5e12f2c0f00924868`, null date fields retained. Earlier candidate/management capsules remain historical.

## Evidence and next gate

[Production gates](../security/production-gates.md): Android physical hardware-backed P-256→TLS1.3 CertificateVerify **CLOSED/PASS (SM-S921B/API36)** is device-local native server/client on one device. Actual Android↔PC LAN/final app/Rust-rustls bridge, iOS physical (no device; deferred), Windows/macOS hardware TLS, minimum-OS coverage/background and aggregate G01/authority remain open. No rerun in this execution. Historical Matrix sources/results/hashes/counts remain archival, not QR evidence.

Mac paid development signing/provisioning remains an explicit platform-local gate: free Personal Team only, actual Secure Enclave creation `-34018`, no fallback/fake invitation. [ADR0015](../decisions/0015-desktop-platform-and-signing-isolation.md) isolates dev/production namespaces and lets Windows/Linux proceed independently. Approved Windows-only windows-sys0.61.2 now backs source TPM CNG identity, physical direct-LAN route/socket checks and protected LocalAppData/NTFS authority storage. Windows user-reported explicit MSVC compile/check, native53 and desktop/native-Electron ABI build PASS are retained; development owner opening returned `storage_failure`, not hardware acceptance. The [current validation checkpoint](desktop-platform-validation-plan.md#güncel-yürütme-kapısı--fiziksel-doğrulama-duraklatıldı) records evidence, unresolved storage/certificate/VFS/continuity decisions and physical pause. Current Mac verification: native47, API1/desktop50/mobile16/shared104 tests, strict clippy/size/lint and desktop build pass. Windows-only route/storage tests were not executed on Mac. Current next work is the security decision block and independent QR host coverage scoped in the [handoff queue](implementation-session-handoff.md#optimize-yürütme-kuyruğu), not owner opening or a new probe.

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

Windows compile update (2026-10-09) supersedes the earlier compilation-unobserved checkpoint: Ayhan reports explicit x64 MSVC native test --no-run and desktop-node check PASS, four naming-only/nonblocking warnings, unchanged dependencies/lockfile and no runtime/TPM/pairing execution at that checkpoint. Use explicit MSVC toolchain, not ambiguous `+stable`. Its then-next native suite step is superseded by the results below and the current validation checkpoint; no hardware or adversarial physical case is closed by compilation.

Windows native runtime update: Ayhan reports53 native tests PASS,0 failed/ignored,0.63s and doc-tests0/PASS. Real loopback TLS remains software-fixture evidence, not TPM/device-key CertificateVerify or physical pairing. Its then-next desktop/native-Electron ABI build is recorded below; owner opening effects and the current physical pause are in the [validation checkpoint](desktop-platform-validation-plan.md#güncel-yürütme-kapısı--fiziksel-doğrulama-duraklatıldı). No QR01–QR33 physical acceptance or hardware gate is closed by this suite.

Windows actual desktop ABI update: Ayhan reports npm ci/desktop native-main-renderer build PASS, exit0 (Rust46.42s; Vite1963 modules/1.36s), with genuine Python/pinned MSVC1.99.0 and unchanged dependencies/Cargo.lock. The then-next bounded development owner inspection has since returned `storage_failure`; no QR/phone/approval occurred. [Current validation checkpoint](desktop-platform-validation-plan.md#güncel-yürütme-kapısı--fiziksel-doğrulama-duraklatıldı) supersedes that execution direction. Actual device-key TLS is separate and dependent. No physical pairing/custody/nonexportability or QR01–QR33 case is closed by this build; the [handoff queue](implementation-session-handoff.md#optimize-yürütme-kuyruğu) keeps the security decision block and independent QR coverage next.

## Android mobile sender checkpoint — 2026-10-13

[Current implementation handoff](implementation-session-handoff.md#android-mobile-sender-integration--2026-10-13): existing native owner/channel now sends selected Android Files and MediaStore originals using private snapshots, durable journal and current PC-local ACL. Own Completed list/new-file download and real ACK Activity UI are integrated; frozen QR and file wire contracts/dependencies unchanged. Native91/root API1/desktop82/mobile28/sync-core117/lint/typecheck/build/policy15, four-ABI APK and real API36 journal/source/restore instrumentation PASS. Software-fixture native sender/resume/restore and actual Android picker/permission/error UI evidence are not physical Android↔PC proof. Photos-library import lacks the required approved manifest/import-receipt contract; iOS sender, physical/platform/background gates remain OPEN. Windows safe-storage failure does not block this independent Android work.


## Photos manifest and import checkpoint — 2026-10-14

[ADR0017](../decisions/0017-photos-sidecar-manifest-and-import-recovery.md) explicitly approves versioned sidecar metadata over unchanged native file transport/ACL; the prior Photos contract blocker is resolved. [Current handoff](implementation-session-handoff.md#photos-sidecar-manifest-and-import-recovery--2026-10-14) records source/asset/resource/album identity, Completed-only resumable publication, actual Android original-media import with durable crash reconciliation, single/all OWN restore, idempotent supported folder metadata and explicit review for uncertainty. Root API1/desktop82/mobile30/sync-core117/lint/typecheck/build/policy15, four-ABI APK and actual API36 PNG/video/crash/retry/catalog/cancellation checks PASS. Separate review and runtime found/fixed video root, pending-permission cancellation and pending MediaStore size-cache bugs. No physical Android↔PC/iOS/minimum-OEM/background/signing/storage gate is closed; grouped ADR0009 Photos acceptance remains deferred.

