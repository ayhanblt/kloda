# Kloda — Production gate ve doğrulanmamış varsayım kaydı

Belgeleme:2026-10-04. **Ürün production-ready değil.** Yeni mimari seçimi yok; current decision, observed subgate ve release prerequisite ayrı tutulur. Tam kapsam [session index](../implementation/session-documentation-index.md), uygulama eksikleri [first-slice status](../implementation/first-vertical-slice-status.md) içindedir.

## Statü sözlüğü

| Etiket | Anlamı |
|---|---|
| **Kabul edilmiş karar** | Ayhan'ın yön/davranış onayı; code veya safety proof değildir |
| **Provisional** | Koşullu yön; ES256 runtime **ve gerçek KMS feasibility** doğrulanana kadar final değil |
| **Kanıtlandı / observed subgate** | Adı, platformu, sürümü ve girdileri belirtilmiş historical senaryoda gözlenen sonuç; ürün/genel OS/network garantisi değil |
| **Varsayım / unverified** | Sadece inference/source support veya eksik runtime/policy integration; confirmed fact yapılmaz |
| **Inconclusive** | Senaryo denendi fakat gereken sonucu kanıtlamadı; otomatik pass/fail/architecture rejection değil |
| **Unsupported** | Denenen ortam gerekli primitive/daemon/path'i sağlayamadı; henüz denenmeyen işten ve inconclusive overall'dan ayrı |
| **Not-executed** | Senaryo çalıştırılmadı; inconclusive veya geçmiş suite pass'i değil |
| **physical-device validation required** | Gerçek hedef cihaz/OS/provider/network/lifecycle kanıtı gerekli; emulator/simulator/source review kapatmaz |
| **Production gate: open** | Release için eksik prerequisite; başarılı başka PoC veya mimari onay bu gate'i kapatmaz |

## Açık production gate'ler

| ID | Gate / bugünkü statü | Eksik ispat / varsayılmayacak şey | Kalıcı dayanak |
|---|---|---|---|
| G01 | **#1 platform/TLS/device-key: open** | Aynı native SDK Ed25519 key ile gerçek supported OS/TLS/provider/packaging; native actual peer-DER↔session association. Fixture native TLS25/pair, production compatibility değil | [ADR0004](../decisions/0004-certificate-bound-capability-and-authority-responsibilities.md), [native evidence](poc-native-verification-evidence.md) |
| G02 | **#2 ES256: provisional** | jose6.2.12/jsonwebtoken10.1.0 exact ES256 source support var; sign/verify/import/alg/type rejection ve gerçek seçilecek KMS digest/message, DER/raw r||s contract **not-executed** | [Profile§6](capability-profile.md#6-sürümlü-imza-uyumluluk-tablosu) |
| G03 | SDK signer support/sustainability: open | Matrix0.19.1 iki-method patch local feasibility; upstream intended-use/API veya maintainable release/fork adoption değil. İkinci identity key/private export/custom handshake fallback yok | ADR0007, native evidence |
| G04 | Account/PC enrollment ve approval provenance: open | Gerçek Supabase account↔Matrix user/device/roles/pair, fresh operation step-up, authenticated exact PC scope approval; synthetic fixed user/UI bool/caller cert yeterli değil | [ADR0006](../decisions/0006-account-mfa-and-recovery-policy.md), [ADR0007](../decisions/0007-matrix-verification-and-device-continuity.md) |
| G05 | Native authority mTLS ve issuance/admission: not-executed | Authority actual cert possession, token issuance, PC full fresh TLS içinde cnf DER + ayrı SAS key equality + grant/context/version gate. Diagnostic nonce ve public identity DTO admission proof değil | [Feasibility plan](../implementation/issuance-admission-feasibility-plan.md), [36 matrix](capability-acceptance.md) |
| G06 | Issuer custody/hosting/trust: open decision | Provider/private signer custody/initial trusted keys/rotation/compromise refresh; token jku/jwk/x5u/kid trust kuramaz. Fixture server key/KMS library support real custody değil | ADR0004, profile§7 |
| G07 | Exact token/wire/API/schema: open | Registered claim anlamları ve logical domain bindings var; private claim/type/DB/API/enrollment serialization veya lab frame production contract seçimi değil | profile§2/4 |
| G08 | Trusted token-time + elapsed upper: open | exp equality, nbf, conservative time interval ve `<24h` request-start bound across suspend/restart; wallclock/library leeway60 veya exp<now default yeterli değil. Phone “kontrol ettim” cache t0 kuramaz | ADR0003; profile Offline |
| G09 | Cert/key/epoch lifecycle: open | Persistence, same-key/new-DER online reissue, epoch+authorization backup exclusion, retained-epoch/missing-SDK-DB; full software rollback detection garanti değil. Engine cache persistent storage değil | ADR0004/0007 |
| G10 | LAN eligibility/cellular/remote: open | Güvenilir LAN classification, real direct/ICE/TURN candidate/address policy, packet-level no-cellular/locality. Android TURN UDP/TLS443 pass; **direct inconclusive**. PC offline/Doze/network değişimini NAT relay çözmez | [Transport evidence](poc-transport-evidence.md) |
| G11 | Remote stack/provider/hosting adoption: open | Tunnel tarihsel/reopened tercih; retained WebRTC/ICE/STUN/TURN candidate production decision değil. URLSession LAN adaptörü TURN HTTP gateway'i değildir; relay redundancy/cost/limits/credentials/config ve distribution ayrıca | ADR0005, transport evidence |
| G12 | Durable revoke/scope/publication: open | Tek PC authorization/fence linearization; revoke/expiry-before-commit no final, valid durable commit-before-fence preserve final; path/symlink/mount/open/crash/durability races; authenticated reconcile. WebDAV MOVE/PoC rename test bunu production'da kapatmaz | ADR0003/0004;36 matrix |
| G13 | Auth/MFA/recovery integration: open | RLS/admin least privilege, access-JWT stale validity, atomic code consume/renew/replay, direct provider policy bypass, resumable fail-closed reset/factor revoke/session/device reenrollment, support hold/cancel race. Experimental recovery/passkey support source finding, production-ready feature değil | [Account contract](account-mfa-and-recovery.md) |
| G14 | Files/Photos/migration/product runtime: open | SHA256+record/~8000 FolderSync initial verification, immutable snapshot/retention/conflicts/no data loss; permissions/multi-resource/originals/restore/organization metadata; UI current-scope cutover. Kullanıcı arşivi değişmedi | [Product contract](../product/computer-backup-files-and-photos.md) |
| G15 | Native runtime/scheduler/release/UI: open | Actual queue→transfer→receipt/recovery, single-flight true Activity, real12/24/Live+retry budgets, old/current OS/native build/API/provider compatibility, Stitch actual UI, minimum toolchain/release compatibility. Generated target/APK/export bu proof değil | ADR0001/0002; status |
| G16 | Galeri ve premium: open decision | Thumbnail/index/search/albums UI ve AWS premium içeriği/role; Photos accessible organization backup galeri feature approval değildir | ADR0005; AGENTS§9 |

## physical-device validation required — ayrı release checklist

| ID | Hedef | Gerekli gözlem / neden hâlâ açık |
|---|---|---|
| P01 | iOS16.4 ve güncel fiziksel iPhone | Real LAN HTTPS/URLSession, ATS/hostname/key/CA/trust rejection, background daemon callback/termination/relaunch. Önceki simulator transport before-TLS inconclusive; sonraki simulator SAS/TLS pass'i ayrı |
| P02 | iOS storage/resources | URLSession task-create temporary copy ve peak/residual cleanup budget, bounded encrypted staging/export; Files bookmarks/PhotoKit limited/revoked permission/iCloud originals/multi-resource; gerçek Photos restore+organization |
| P03 | iOS key/installation | Lock, first unlock before/after reboot, OS provider availability, software secure storage, reinstall/key retention, backup/restore/device transfer exclusion, retained epoch+lost DB; ThisDeviceOnly backup exclusion/reinstall deletion değildir |
| P04 | Android API24 ve güncel OEM | SAF URI permission/source queue, native same-key SAS/TLS/ABI, Keystore/Doze/foreground/background/reboot/force-stop; API36 isolated transport eski/current her OEM proof'u değildir |
| P05 | Android uzun lifecycle | Gerçek6-hour OS quota, background long transfer, secure lock ve network/timeout recovery; deterministic callback/Home60s smoke gerçek quota yerine geçmez |
| P06 | İki cihazda insan SAS/UI | İki gerçek uç local compare/confirm/MAC/done, cancel/mismatch/key substitution, fresh same-key possession; otomatik fixtures doğru insan onayı UX/security garantisi değil |
| P07 | Native schedules | Real12/24 hedef/actual start/end, default opportunistic Live, 5×60s access ve ayrı5×5min OS target, >5min active task duplicate suppression; force-stop/force-quit limitations görünür |
| P08 | Gerçek ağlar/policy | Packet-level LAN local-only/no silent relay, cellular default-off/opt-in, Wi-Fi↔cellular, real separate uplinks/direct/TURN UDP/TLS443/renewal; lsof TLS443 observation packet capture veya zero-cellular proof değil |
| P09 | Native desktop hedefleri | Electron app window-close/quit/sleep/wake receiver/journal, Windows/Linux/older macOS secure storage backend/ABI/packaging; Linux basic_text/no secure backend fail closed. Bir macOS Electron fixture bütün platformları kanıtlamaz |

Bu liste hardware-backed key seçmez; software protection onayını korur. Physical validation'ın olmaması **not-executed prerequisite**, eski iOS attempted transport ise **inconclusive** sonuçtur. Desktop cross-OS validation native/platform gate'idir; phone physical sonuçlarıyla kapatılmaz.

## Yanlış çıkarım yapılmayacak varsayımlar

- 14 Android transport pass ≠ direct pass/full product complete; failed direct transfer'ın TURN cleanup'u direct payload proof değil. Wi-Fi manual continuation ve failed/blocked denemeler final başarının yanında durur.
- iOS native verification/TLS pass ≠ iOS URLSession background/certificate strategy proof; mimari retained kalır, eski inconclusive silinmez.
- SAS verified/cross-signed/login/valid JWT veya geçmiş journal ≠ file access; scope+authority+fresh possession+time/fence birlikte gerekir.
- exp/nbf NumericDate semantics ≠ trusted clock; process restart/late allow/iat/token renewal yeni offline pencere değildir. Reachable authenticated denial unreachable network değildir.
- Aynı private key ≠ aynı DER cert; grant key-bound olsa da old cert-bound token renewal'da taşınmaz. Same-key renewal case historical donor farklı-key inspection ile kanıtlanmadı.
- Kaynak doküman/destek tablosu ≠ runtime/KMS/provider interoperability; JS/header cert ≠ TLS possession; trusted root ≠ actual leaf key pin.
- Software epoch ≠ perfect rollback detector; ThisDeviceOnly ≠ no backup veya guaranteed reinstall deletion; transient locked error ≠ actual key loss.
- Short-lived TURN credentials/public endpoint ≠ pairing/auth/scope authority; relay encrypted-stream goal ≠ chosen custody/architecture/release contract.
- Profile/plan/document-review complete ≠ runtime implemented. **36 authority acceptance hedefi not-executed**; Files/Photos/Auth detailed contracts da acceptance targets, not pass reports.
- Tarihsel source/archive hash varlığı ≠ bütün raw traces/binaries/screenshots/source/private-state'in repo içinde korunması. Public summaries/outcomes kalıcı; raw rerun availability limitleri evidence docs'ta açık.

## Sonraki yetki sınırı

Dört architecture yönü onaylandı; **yalnız izole issuance/admission planı hazırlandı**, [execution](../implementation/issuance-admission-feasibility-plan.md) ayrıca onay bekler. KMS/provider/custody ve live server/device/production cutover otomatik izin değildir. Gate'ler actual scoped evidence ve gerekiyorsa ayrı Ayhan kararıyla kapanır; bu dokümantasyon konsolidasyonu hiçbiri için yeni runtime proof üretmedi.
