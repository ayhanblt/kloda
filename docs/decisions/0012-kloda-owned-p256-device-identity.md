# ADR 0012 — Kloda-owned P-256 device identity

> **Current V1 LAN override — 2026-10-13:** [ADR0016](0016-v1-pc-local-file-authority.md) supersedes the backend eligibility/central signed capability/issuer/JWT/KMS/`<24h` and exact-DER online-reissue mandates below for the local ACL. P-256 identity, native TLS certificate/profile/pins/possession/installation continuity remain; file authority is native PC-local SQLite with separate explicit selected backup-scope approval. The Backend/Signed capability role rows below are historical for this LAN scope, not current requirements. Remote transport preference is unchanged; FINAL remote authorization and recovery/central revocation versus offline PC/local grants are OPEN. Approval is not implementation/custody proof.

- Kayıt tarihi: 2026-10-07; host UTC clock gözlemi `2026-10-07T08:01:13Z` (approval timestamp iddiası değil)
- Karar sahibi: Ayhan; bu konuşmada açık architecture cutover onayı
- Durum: yön kabul; ADR0014 native/Android-Electron implementation ve host/build evidence mevcut; physical platform custody/adoption ve final remote policy açık. Bu ADR'nin ilk docs-only teslimi runtime proof değildi.

2026-10-07 scoped supersession: [ADR0013](0013-qr-based-local-lan-pairing.md) bu kaydın eski “Matrix yalnız SAS” ilk trust/SDK/store/binding gerekliliklerini backend-independent yerel QR ile değiştirir. P-256 identity, hardware preference, issuer/authority/certificate lifecycle ve ayrı remote yönü korunur. Güncel freeze: [KLODA-QR-PAIR-V1 protocol bytes ve minimum native davranış](../security/qr-pairing-v1-protocol.md) frozen; actual API/ABI/adoption/integration unverified, implementation not executed.

2026-10-15 durum açıklaması: önceki paragraftaki “implementation not executed”2026-10-07 decision checkpoint'ine aittir. Sonraki implementation ve dar kanıt [ADR0014](0014-shared-rust-qr-pairing-core.md)/[handoff](../implementation/implementation-session-handoff.md) içindedir; source yokluğu ile physical kabul eksikliği karıştırılmaz.

## Karar ve sade rol ayrımı

**MVP single device key artık geçerli değil.** Ayrı Kloda-owned P-256 identity ADR0012 ile açıkça seçildi ve korunur. Bu kaydın önceki ilk-pairing kararı Matrix SDK key'i ile standard SAS idi; o mekanizma ADR0013 ile tarihsel/superseded oldu. Matrix current pairing path'te yoktur; key/SDK/Olm/FFI/store/homeserver veya upstream/fork prerequisite'i geri gelmez.

| Bileşen | Anlamı ve Kloda'da pratik görevi |
| --- | --- |
| Yerel QR LAN trust | PC invitation'ını tarama; gerçek mutual TLS possession + QR PC SPKI eşitliği + aynı-channel secret HMAC proof + explicit PC approval + durable local pins; backend/login olmadan ilk trust, file grant değil |
| Kloda ECDSA P-256 device key | Her cihaz için ayrı uzun ömürlü imza anahtarı; peer'in aynı Kloda cihazı olduğunu session/channel başlangıcında kanıtlar |
| Yerel peer pin | Eşleştirmede doğrulanıp cihazda saklanan exact karşı cihaz public key'i; sonraki peer trust'ın temel kaynağı |
| Backend | Hesap/cihaz/pair eligibility, capability issuance/revoke ve control metadata; registry kaydı tek başına peer trust oluşturmaz |
| TLS / DTLS | Sırasıyla LAN ve WebRTC kanalını şifreleyip bütünlüğünü koruyan standart bağlantı katmanı; kimlik proof'u authorization yerine geçmez |
| Signed capability | Hangi device/PC/scope/operation için hangi expiry ile izin olduğunu belirleyen ayrı imzalı yetki; PC local approval/deny/fence gerekir |
| JWT | Yalnız backend user session token'ı; peer identity, yerel pin veya PC file grant değildir |
| Payload encryption | Varsa kanalın üstündeki ek byte koruması (defense-in-depth); TLS/DTLS veya peer authentication yerine geçmez |

### Kimlik ve ilk trust kurulumu

1. Her Kloda cihazında ayrı ECDSA P-256 key pair oluşturulması tercih edilir. Private key mümkün olan platformda non-exportable (anahtar byte'ları dışarı alınmadan imzalama) güvenli donanımda tutulur: iOS/macOS Secure Enclave; Android Keystore ile StrongBox/TEE; Windows TPM. Universal availability, exact product API/ABI, signature encoding, no-per-run userPresence/background compatibility ve supported-device coverage kanıtlanmış değildir. Android physical hardware-backed P-256→TLS1.3 CertificateVerify dar device-local signer alt-gate'i CLOSED/PASS'tir ([kapsam](../security/production-gates.md)); final-app Android↔PC LAN veya bütün platform desteği değildir. Hardware olmayan cihaz/fallback/Linux policy **seçilmedi**; plaintext/export/second silent identity fallback yok.
2. PC aktif pairing ekranından local invitation üretip yerel QR gösterir; telefon QR tarar. QR LAN adresi trust anchor değil connection hint'tir. İlk yerel trust backend/internet/login/signaling/STUN/TURN gerektirmez. Matrix standard SAS, Olm/account/store ve SDK distribution eski mekanizmanın superseded iç gereksinimleridir; second SAS/fingerprint comparison V1 required gate değildir.
3. **Initial LAN QR fingerprint = gerçek fresh full TLS1.3 kanalında kullanılan PC Kloda P-256 canonical SPKI SHA256.** Telefon actual PC private-key possession'ını ve fingerprint eşitliğini, PC telefonun P-256 TLS possession'ını doğrular. Phone certificate başlangıçta provisional'dır; native full-handshake signature verification bypass edilmez ve possession tek başına durable trust değildir. One-time secret HMAC proof'u aynı channel/transcript'e bağlanır. Exact reserved aday için PC explicit approval ve [frozen KLODA-QR-PAIR-V1 lifecycle](../security/qr-pairing-v1-protocol.md) gerekir; exact HMAC/exporter/transcript bytes ve minimum native davranış frozen, actual ABI/adoption/integration unverified'dır.
4. PC-local durable transaction invitation consumption ile exact phone trust record'u birlikte kaydeder; telefon durable PC pin ardından matching ACK gönderir. Distributed atomic transaction iddiası yoktur; pending/ACK recovery aynı pinned key/fresh authenticated channel ister. Registry/discovery/token/yeni cert yerel pin'i sessizce değiştiremez. Required key/pin/epoch/continuity kaybı veya restore şüphesinde fail closed + fresh QR ve ADR0016 explicit PC-local grant gerekir; V1 LAN için merkezi online reissue gerekmez. Hardware key retention install continuity değildir; backend private key tutmaz.

Matrix DB/key current initial veya ongoing auth dependency değildir. Gerekli Kloda state kaybı/restore şüphesi fail closed kalır; pre-consume pending invitation restart'ta eski secret ile restore edilmez, post-consume durable record ise aynı-key authenticated recovery için korunur. Bu pending trust veya local pin dosya yetkisi değildir.

### Session/channel ve remote yönü

5. **LAN:** pinned TLS/SPKI + Kloda device-key mutual proof. Initial QR PC actual TLS P-256 SPKI equality, fresh full TLS1.3, native certificate/profile and live channel binding zorunludur; PSK/0-RTT/replayed proof admission açmaz. Frozen V1 proof bytes/native implementation/build evidence QR roadmap'tedir; actual platform custody/native physical integration açık kalır. Fake native context/custom TLS/client-auth-off bypass yok; remote DTLS composition bundan türetilmez.
6. **Remote:** WebRTC/DTLS + signed signaling/fingerprint + Kloda device-key mutual proof tercih edilir. Signaling bağlantı kurma bilgisidir; fingerprint DTLS peer certificate kimliğidir. İmza doğrulaması exact active peer/channel/role/flow'a bağlanmadan trust oluşturmaz. ICE direct P2P mümkünse tercih; **Cloudflare TURN yalnız relay fallback**. TURN trafik taşıyan relay'dir, dosya store veya Kloda auth/trust authority değildir. Cloudflare Tunnel ile aynı ürün değil. Exact native WebRTC/DTLS APIs, signaling proof/encoding/freshness, provider bootstrap/credentials/cost/limits/redundancy ve hosting/distribution adoption açık; sessiz backend payload fallback yok.
7. Cihaz identity session/channel başlangıcında doğrulanır; TLS/DTLS veri yolunu korur. Per-request yeni hardware ECDSA signature/nonce sistemi yoktur. Stale-handle/generation/cancel/close/role/replay sınırları korunur. V1 LAN için ardından güncel native local ACL/scope/operation/revoke/publication fence gerekir; remote proof ve final authorization ayrıca açık.

### Authorization ve certificate lifecycle

8. Backend login JWT yalnız user session içindir; QR trust/P-256 possession/TLS tek başına file grant değildir. [ADR0016](0016-v1-pc-local-file-authority.md) V1 LAN için explicit PC scope/native local SQLite ACL seçer; same-account enrollment/step-up, central signed capability/issuer/ES256/KMS bu LAN admission'ın prerequisite'i değildir. Tarihsel merkezi issuer ES256 provisional ve device key'den ayrı roldür; bu kayıt final remote authorization modeli seçmez.
9. Native certificate persistence/validity/profile ve actual P-256 pin/channel association korunur. Exact leaf DER→same-key/new-DER online central reissue V1 local ACL için superseded'dır; aynı key certificate validity/continuity/current ACL bypass etmez. QR SPKI ve whole-certificate DER hash'i farklı nesnelerdir; remote DTLS binding ayrı açık gate.
10. Current local ACL/scope/revoke/installation continuity/publication fence gerekir; historical receipt/journal authority değildir. Merkezi `<24h` cache/t0/token-time V1 LAN şartı değildir. Account recovery/central revoke↔offline-PC ve final remote policy OPEN. PC offline ise iş bekler; backend E2EE terminate etmez, PC normal dosya tutar. ADR0017 metadata sidecar full media E2EE envelope/key lifecycle uygulaması değildir; o gate açık.

## Supersession ve bakım etkisi

| Eski kayıt/varsayım | Yeni durum |
| --- | --- |
| ADR0007 MVP tek Matrix Ed25519 possession key / software-only Kloda identity | ADR0012 ile ayrı Kloda P-256 long-lived identity, hardware-preferred; ADR0013 ile Matrix SAS first-trust da superseded. Exact support/fallback unselected |
| ADR0008 D01 upstream-first byte signer | Retired product prerequisite; historical upstream/fork alternatifleri archival/non-actionable. D03 native DER persistence korunur |
| ADR0011 SDK-owned Matrix signer + async/sync callback producer | Matrix signer prerequisite retired; owned native query/session yaşam döngüsü korunur. Shared Rust/rustls+ring LAN implementation ADR0014'te adopted; physical/platform custody ve remote composition açık |
| ADR0004/0010 aynı SAS Matrix key TLS equality | QR-established Kloda local pin + fresh authenticated session association; initial PC QR fingerprint actual TLS P-256 SPKI ile eşit, authorization ve operation-bound PC result/query korunur |
| SDK signer contribution TODO / policy blocker | Historical contribution/policy araştırması archival/non-actionable; yeni upstream task veya product/native prerequisite değildir. Publication/human review yapılmadı |
| Historical Matrix/TLS patch, 1A–1D/2A–2D observations | Eski scope'ta tarihsel kalır; P-256/hardware/QR/session/remote kanıtına aktarılmaz; old corpus rebuild gerekmez |

Bu cutover SDK patch/fork, dependency/provider/service kurulumu veya native/cloud/device experiment execution izni değildir. Matrix arbitrary-byte API araştırması current roadmap seçeneği/TODO değildir; historical upstream policy/search kayıtları korunur.

## Before-code / production gate

Aşağıdaki before-code metni ilk karar evresinin prerequisite kaydıdır; codec/native LAN/source adoption artık ADR0014 altında uygulanmıştır. Platform/physical/remote/restore güvence sınırları current olarak açık kalır; yeniden implementation başlatma talimatı değildir.

Strict payload parsing/canonical SPKI hash, exact HMAC/channel-binding/exporter/transcript/framing/recovery ve minimum native davranış [KLODA-QR-PAIR-V1 sözleşmesinde](../security/qr-pairing-v1-protocol.md) frozen; [synthetic vectors](../security/qr-pairing-v1-protocol-vectors.json) documentation fixtures'dır, runtime proof değildir. Pure codec/state implementation yalnız ayrıca onaylı coding task'ta başlayabilir. Native integration için selected P-256 provider/TLS/DTLS callback and ownership; matched target source/manifest/lock/binding declarations; actual API/ABI/adoption mapping ve key+pin/cert/install continuity/scope/capability/channel runtime proof gerekir. Matrix/SAS/SDK binding gate'i yoktur; fake ABI veya opaque `trusted=true` factory yazılmaz. Dar Android hardware signer PASS universal Secure Enclave/StrongBox/TEE/TPM support/attestation, private material exposure veya iOS system-background signing/transfer kanıtı değildir; fiziksel eski/current cihaz ve actual peer LAN ayrıca gerekir. iOS16.4+/AndroidAPI24 support hedefleri sessiz daraltılmaz; no-runtime sonucu unverified/blocked/inconclusive olarak kalır.

## Impact review ve bu teslimin sınırı

Pre-change ayrı bounded pass: managed mobile/desktop source/storage/schedule/job/WebDAV sender, empty central Nest module; pairing/identity/session producer yok. Bu yüzden ürün kodu/dependency/test contract'ı değişmedi. ADR, aktif security contract/native prerequisite/status/TODO'lar dar cutover alır; eski sanitized evidence sonuçları/hash'leri korunur. Receiver/query/fence, enrollment/schema, hardware/native/background ve physical gate'leri kapanmaz. Bundan sonraki mimari sorular ilk kullanımda terimi sade tanımlar ve seçeneklerin Kloda'da pratik etkisini açıklar.
