# Session karar/kanıt kapsam indeksi

**2026-10-04 — docs-only konsolidasyon.** Yeni mimari, production cutover, PoC/JWT/KMS/device deneyi veya implementation execution onayı yok. Tarihsel plan, kabul edilmiş yön, kaynak araştırması, gözlenen sınırlı başarı ve açık gate birbirinden ayrıdır. Ephemeral kaynak adları aşağıda provenance'tır; kararın/sonucun anlamını öğrenmek için session chat veya `/tmp` gerekmez.

## Güncel karar ve uygulama durumu

| Canonical kayıt | Kabul edilen yön | Açık/kanıtlanmamış sınır |
|---|---|---|
| [ADR0001](../decisions/0001-mobile-sync-behavior-and-framework-constraints.md) | Expo development build/Electron, platform fırsatıyla sync; explicit Files ve Photos ayrımı; iOS16.4+/Android7/API24 support hedefi | Release-minimum/toolchain compatibility, native paket/API, gerçek OS scheduling/Photos erişimi ve eski/current cihaz doğrulaması |
| [ADR0002](../decisions/0002-first-vertical-slice-scope.md), [historical plan](first-vertical-slice-plan.md), [status](first-vertical-slice-status.md) | İlk dar WebDAV vertical slice; domain/application/adapters ve FSD/lint sınırları | Baseline unfinished; eski scope dışlamaları yeni ürün kararını veto etmez. Historical7 completed/10 open görev sayısı product completion değildir |
| [ADR0003](../decisions/0003-secure-pairing-and-offline-authorization.md), [living design](../security/secure-pairing-design.md) | Hesap+PC approval+bilateral SAS; request-start'tan strict offline LAN<24h; deny/recovery önceliği; current-authority reconcile/publication fence | Gerçek hesabın/device mapping/enrollment/revocation/time/FS fence implementasyonu yok |
| [ADR0004](../decisions/0004-certificate-bound-capability-and-authority-responsibilities.md), [profile](../security/capability-profile.md) | Certificate-bound capability+fresh full same-key mTLS; Nest merkezi eligibility/issuance/revoke, PC local scope/admission/file/fence; key-bound grant/exact-DER token/reissue | **ES256 provisional**; runtime+actual KMS feasibility yok; platform/TLS/device-key production gate açık. Token application data, TLS transcript imzası değil; jti reconnect'te global one-shot değil |
| [ADR0005](../decisions/0005-computer-first-files-and-photos-backup.md), [product contract](../product/computer-backup-files-and-photos.md) | PC-first genel Files+Photos, advanced NAS retained; Live ilk OS fırsatı/default,12/24 alternative/manual bağımsız; one-way+list/download/optional Files two-way; SHA256+durable record migration;30-day trash/version/conflict preservation; Photos original resources+accessible organization/restore | ~8000 FolderSync medya migration denenmedi/değişmedi. Photos restore tam iPhone/iCloud recovery değil. Galeri/search, actual transfer/metadata/versions/restore/production E2EE açık |
| [ADR0006](../decisions/0006-account-mfa-and-recovery-policy.md), [account contract](../security/account-mfa-and-recovery.md) | Supabase Auth+Postgres control metadata; optional TOTP/fresh operation-bound step-up; normal sync per-run userPresence değil; codes→backup authenticator→support;24h hold+ownership/manual approval/no objection; durable revoke/re-enroll/re-pair | Auth/MFA/recovery production suitability ve entegrasyon yok; native experimental recovery yeterli sayılmaz, yalnız koşullu tek custom fallback. Supabase logout eski JWT'yi anında öldürmez; offline authorization gecikmesi hold ile aynı değil |
| [ADR0007](../decisions/0007-matrix-verification-and-device-continuity.md) | Matrix full standard SAS verification-only/Kloda authority; aynı SDK Ed25519 software key; immutable active peer snapshot; epoch+local authorization backup/transfer dışı; retained key restore continuity değil | Production SDK/version/upstream byte-signer/package/provider, human physical SAS, backup/reinstall/reboot/provider/epoch–DB loss açık. Hardware non-exportability, deterministic RAM erase/full rollback detection garanti değil |
| [Transport evidence](../security/poc-transport-evidence.md), [gates](../security/production-gates.md) | LAN-local/cellular-default-off explicit opt-in; shared native crypto yönü frontend stack değişikliği değil | LAN HTTPS+remote WebRTC/ICE/STUN/TURN retained research candidate, production adoption/provider/hosting değil. Eski Cloudflare Tunnel tercihi yeniden açıldı; Tunnel≠TURN. Advanced WebDAV HTTP(S) relay ayrı scope |
| [Stitch mapping](../ui/stitch-reference.md) | Kloda naming, read-only approved reference/visual authority | Source select-all ve eski Live/manual mapping güncel politikayı karşılamıyor; yeni layout onayı veya product visual/physical completion yok |

## Kanıt evreleri — toplamlar birbirine çevrilmez

- **E1 transport:** physical Android14 pass/1 direct connectivity inconclusive (`complete:false`, production false); host-only HTTPS/WebRTC ayrı. TURN UDP/TLS443 ve LAN↔TURN resume gerçek; direct8MiB retry_exhausted/no final,256MiB denenmedi/NAT root cause unproven. Eski iOS URLSession simulator1 build/UI pass/5 unsupported, daemon failure **TLS öncesi**, inconclusive/physical pending/architecture retained.
- **E2 Matrix Rust:**17 pass/0gap/0fail; standard full verification/encrypted store/child restart/software signer. İlk3 harness beklenti hatası final17'ye dönüşmeden önce kaydedildi; native/account/file authority değil.
- **E3 native verification:** emulator Android26+iOS simulator26=52; injected storage refusal ve diagnostic possession. İlk23/26 chronology korunur; genuine device/provider lock/human comparison ve production authorization değil.
- **E4 same-key native TLS:** host8, her pair TLS25 ve copied verification26; SDK0.19.1 iki exact-byte signer method patch'i gerekli. Actual presented leaf SPKI pin delegated different-leaf açığını kapattı. İlk22/25 korunur; localhost fixture, no real peer network; Engine-lifetime certificate cache persistence/renewal proof değil.
- **E5 public certificate inspection:** actual Node22.23.1 (historical documentation22.23.3),2 recorded happy-path pair, exit0/**88 assertions** (shape dahil,88authority tests değil). Full DER SHA256≠SPKI hash; public raw32 identity/native peer/SAS key equality. Script kaldırıldı; live TLS/JWT/admission/KMS/renewal yeniden çalıştırılmadı. [Exact public inspection](../security/evidence/certificate-binding-inspection.json), [stdout](../security/evidence/certificate-binding-stdout.json), [source research capsule](../security/evidence/capability-research-summary.json).
- **E6 source-only issuer readiness:** jose6.2.12 exact Ed25519 var, jsonwebtoken10.1.0 yok/legacy EdDSA başka ad; ortak exact ES256 kaynak desteği runtime/KMS kanıtı değil. Rust conservative exp/nbf/trusted-time gate gerekli; default leeway60/nbf false/exp equality davranışı production strict profile yerine geçmez; EC/JWK input parsing issuer/curve/profile validation değildir.
- **E7 future authority:** [36 targets](../security/capability-acceptance.md) **all not-executed**. [Issuance/admission feasibility plan](issuance-admission-feasibility-plan.md) hazırlanması onaylandı, execution değil; real lab signer/token/fresh AS→PC same-DER native sessions/real gate/file-list proposal, production enrollment yerine synthetic control fixture değil. Actual KMS ayrı unresolved prerequisite; no cloud provider/service/key chosen.

[G01–G16 production gates ve ayrı P01–P09 physical checklist](../security/production-gates.md) current blocking requirements'ın tek toplu envanteridir. Accepted direction≠closed production gate; simulator pass≠physical pass; inconclusive≠architecture rejection; source support≠runtime proof.

## Session kaynaklarının kalıcı karşılıkları

Aşağıdaki `local://` adları tarihsel provenance kimliğidir, canlı bağımlılık değildir. ADR tekrarı üretilmedi: mevcut0001–0004 düzeltildi, farklı ürün/account/Matrix kararları0005–0007'ye ayrıldı. Ayrıntılı living contracts ve public kanıt özetleri ADR'leri tekrar karar vermeden açar.

| Historical artifact (`local://` prefix) | Kalıcı kayıt / sınıflandırma |
|---|---|
| `kloda-first-vertical-slice-plan.md` | [Complete historical plan snapshot](first-vertical-slice-plan.md), ADR0001/0002, status; job/source revision/snapshot, bounded staging/native single writer, durable journal/finalize/no-overwrite/ambiguous outcome, local-time DST/timezone/retry/SyncNow constraints plan olarak korunur |
| `kloda-todo-coverage-plan.md` | Status historical7 completed/10 open coverage ve current work groups; original count proof/product-complete değil |
| `kloda-computer-backup-plan.md` | ADR0005+product contract: target/source identity, snapshots, version/trash/conflict transitions ve source-specific Photos permissions/restore/organization dahil |
| `kloda-security-discussion-plan.md` | ADR0006+account contract: step-up binding, MFA-off path, factor/recovery/hold transitions, no destructive lockout/revoke semantics |
| `kloda-transport-analysis-plan.md` | Transport evidence+ADR0001/0005+gates: target OS/shared native engine, alternative reopening, research scope, network/default cellular policy |
| `kloda-lan-urlsession-poc-plan.md` | Transport evidence+iOS planned-only matrix/staging/temporary-copy limits+physical gates; no false pass |
| `kloda-poc-engine-contract.md` | Transport evidence: same Rust motor/journal/receipt/publish contract; test provisioning≠production keys/signaling; JS payload prohibition |
| `kloda-android-physical-poc-plan.md` | Transport evidence: scoped native ABI/version pins,15 target outcomes, exact real/host/manual/fixture distinctions |
| `kloda-android-poc-scope-freeze.md` | Transport evidence+gates: minSdk24 experiment≠minimum-device proof; no unapproved scope expansion/production crypto adoption |
| `kloda-secure-pairing-design-plan.md` | ADR0003+living design: verification/current possession/authorization separation, strict time/revoke/publication fence |
| `kloda-pairing-protocol-research.md` | ADR0007+native evidence historical source research/Matrix standard and package constraints; bare SAS/graph authority not selected |
| `kloda-matrix-pairing-feasibility-result.md` | Native evidence+public native summary E2, exact17 cases, failures/source/archive hashes/limits |
| `kloda-protocol-native-storage-research-plan.md` | ADR0007+native evidence: OS software-key/background/provider/recovery research scope, no production SDK/native API adoption |
| `kloda-protocol-native-storage-research.md` | Native evidence research section+ADR0007: pinned binding/core versions, feature/security/package gaps, backup/reinstall/provider/OS support limits |
| `kloda-verification-authority-decision-plan.md` | ADR0007+ADR0003+profile: verification-only versus Kloda authority; decision preparation not implementation |
| `kloda-verification-authority-decision.md` | ADR0007: software key/immutable SAS snapshot/epoch continuity/reinstall/retained epoch+lost SDK DB/key-loss handling and rejected alternatives |
| `kloda-native-verification-poc-plan.md` | Native evidence E3: SDK/native OS-storage/diagnostic possession/ABI/negative matrix; file/backend authority excluded |
| `kloda-native-verification-poc-result.md` | Native evidence E3+public summary:52 cases, environment/initial23/26/fault refusal/warnings/UI capture/final diagnostic boundaries |
| `kloda-authority-session-contract-plan.md` | Profile+ADR0004+acceptance: same-key proof/session/authority design preparation; no runtime authority pass |
| `kloda-authority-session-contract.md` | Profile+living design: context/roles/key binding, SDK exact-byte blocker chronology, no private export/second key/custom handshake, conservative time/fence |
| `kloda-authority-session-acceptance.md` | Capability acceptance consolidates original32 targets plus18a/27a/31a/31b; all36 not-executed |
| `kloda-same-key-tls-feasibility-plan.md` | Native evidence E4: isolated two-method patch/native exact-byte signer/stock fresh TLS scope; no product cutover |
| `kloda-same-key-tls-feasibility-result.md` | Native evidence E4+public summary:host8/TLS25 each/copied26 each/actual leaf pin/fresh reconnect/cache/initial22/25/public patch hashes |
| `kloda-authority-capability-decision-plan.md` | ADR0004+profile+research capsule: certificate binding/RFC/library/KMS/custody/time/lifecycle study, no implementation |
| `kloda-authority-capability-decision.md` | ADR0004+complete profile tables, qualified four approvals, ES256 provisional and platform gate open, nonselected DPoP/exporter/COSE alternatives |
| `kloda-authority-capability-acceptance.md` | Capability acceptance36 named IDs/status, no test execution |
| `kloda-authority-capability-result.md` | Exact public DER inspection/stdout+source research capsule; source-only ES256 profile and unexecuted issuer/admission/KMS gates |
| `kloda-issuance-admission-feasibility-plan.md` | Complete permanent feasibility plan, same native Engine one-session/cache constraints, lab/control fixture separation, explicit execution boundary |

## Durability / güvenlik sınırı

Public sanitized transport/native JSON'lar exact case/pair/status ve historical public report/archive SHA256/provenance tutar. Original public DER inspection/stdout byte'ları repo'dadır. Critical karar, koşul, outcome, initial failure ve limitation bu dosyalar/bağlı contracts içinde anlamlıdır; yalnız chat/session linkine bağlı kritik karar bırakılmadı. Source-only observations'ın kaynak erişim zamanı her kaynak için kaydedilmemişse timestamp uydurulmadı.

**Tam ham replay paketi saklanmadı:** ephemeral log/xcresult/screenshot/source/binary archives repo'ya taşınmadı. Hash kaybolan archive byte'ını yeniden oluşturamaz; full byte-for-byte replay ayrı archive custody gerektirir. Repo self-contained decisions/outcome evidence ve public metadata tutar; independent security audit, packet proof veya yeniden deney sunmaz. Private DB/key/epoch/state/credentials/endpoint veya kullanıcı medya byte/hash kataloğu açılmadı/kopyalanmadı.

Bu konsolidasyon code/config/CI/device/cloud değiştirmedi. Aşağıdaki [documentation review](documentation-consistency-report.md) yalnız docs/reference/JSON/status/coverage consistency smoke'udur; eski lint/tests/PoC başarısını yeniden doğrulamaz.
