# ADR 0012 — Kloda-owned P-256 device identity

- Kayıt tarihi: 2026-10-07; host UTC clock gözlemi `2026-10-07T08:01:13Z` (approval timestamp iddiası değil)
- Karar sahibi: Ayhan; bu konuşmada açık architecture cutover onayı
- Durum: tercih edilen yön kabul; implementation, exact protocol/API/ABI/provider adoption veya production/physical proof değil

2026-10-07 scoped supersession: [ADR0013](0013-qr-based-local-lan-pairing.md) bu kaydın eski “Matrix yalnız SAS” ilk trust/SDK/store/binding gerekliliklerini backend-independent yerel QR ile değiştirir. P-256 identity, hardware preference, issuer/authority/certificate lifecycle ve ayrı remote yönü korunur. Güncel freeze: [KLODA-QR-PAIR-V1 protocol bytes ve minimum native davranış](../security/qr-pairing-v1-protocol.md) frozen; actual API/ABI/adoption/integration unverified, implementation not executed.

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
4. PC-local durable transaction invitation consumption ile exact phone trust record'u birlikte kaydeder; telefon durable PC pin ardından matching ACK gönderir. İki uç arasında distributed atomic transaction iddiası yoktur; pending/ACK recovery yalnız aynı pinned key/fresh authenticated channel ile mümkündür. Backend registry, discovery, token veya yeni certificate eski yerel pin'i sessizce değiştiremez. Required key/pin/epoch/pairing-continuity kaybı veya restore şüphesi fresh yerel QR trust + ayrı gerekli online authorization/yeni grant ister; hardware key retention install continuity değildir. Backend endpoint private key tutmaz.

Matrix DB/key current initial veya ongoing auth dependency değildir. Gerekli Kloda state kaybı/restore şüphesi fail closed kalır; pre-consume pending invitation restart'ta eski secret ile restore edilmez, post-consume durable record ise aynı-key authenticated recovery için korunur. Bu pending trust veya local pin dosya yetkisi değildir.

### Session/channel ve remote yönü

5. **LAN:** pinned TLS/SPKI (TLS public key kimliğinin yerel kayıtla doğrulanması) + Kloda device-key mutual proof (iki cihazın key sahipliğini kanıtlaması). Initial QR LAN kapsamında yukarıdaki actual TLS P-256 SPKI equality artık seçilmiştir; eski “key==TLS SPKI seçilmedi” belirsizliği bu kapsamda superseded'dır. Fresh full TLS1.3, actual peer DER/SPKI ve canlı channel binding zorunluluğu korunur; PSK/0-RTT/replayed proof yeni admission açmaz. Exact native API ve proof bytes açık gate'tir. Fake native context/custom TLS handshake/client-auth-off bypass yok; remote DTLS composition bundan türetilmez.
6. **Remote:** WebRTC/DTLS + signed signaling/fingerprint + Kloda device-key mutual proof tercih edilir. Signaling bağlantı kurma bilgisidir; fingerprint DTLS peer certificate kimliğidir. İmza doğrulaması exact active peer/channel/role/flow'a bağlanmadan trust oluşturmaz. ICE direct P2P mümkünse tercih; **Cloudflare TURN yalnız relay fallback**. TURN trafik taşıyan relay'dir, dosya store veya Kloda auth/trust authority değildir. Cloudflare Tunnel ile aynı ürün değil. Exact native WebRTC/DTLS APIs, signaling proof/encoding/freshness, provider bootstrap/credentials/cost/limits/redundancy ve hosting/distribution adoption açık; sessiz backend payload fallback yok.
7. Cihaz identity session/channel **başlangıcında** doğrulanır; sonrasında TLS/DTLS veri yolunu korur. Her request'e yeni hardware ECDSA signature/nonce sistemi eklenmez. Session replay/role confusion/stale handle/generation/cancel/close güvenliği için exact başlangıç proof'u açık gate'tir; identity check sonrasında capability/time/scope/current deny/revoke/fence kontrolleri yine sürer.

### Authorization ve certificate lifecycle

8. Backend login JWT yalnız user session için kullanılır. Signed capability ayrı device/PC/scope/expiry authorization taşır; QR trust, P-256 possession veya TLS/DTLS bağlantısı tek başına file grant değildir. Pairing-only channel'da preexisting capability gerekmez; file admission için same-account eligibility, enrollment/operation step-up, PC scope approval, current capability/time/deny/fence ayrı gereklidir. Önceki profile'ın JWT/JWS claim referansları login JWT'yi capability olarak kabul etme izni değildir; exact capability encoding/type/wire API bu cutover ile uygulanmış/seçilmiş sayılmaz. Server issuer ES256 **provisional** kalır; device key ile aynı P-256 curve kullanması aynı key/role/custody demek değildir. Runtime + gerçek KMS gate'i korunur; bunlar initial local QR trust için backend blocker değildir.
9. LAN certificate-bound capability'nin actual exact leaf DER binding ve same-key/new-DER online reissue politikası korunur; local peer trust doğrulanmış Kloda P-256 pin/channel association ister. Initial QR PC SPKI hash'i capability full-certificate DER hash'i yerine geçmez. Native certificate DER persistence yönü korunur; remote DTLS için TLS `cnf`/mTLS contract'ı otomatik taşınmaz, remote capability/channel binding ayrı çözülmelidir.
10. Account/PC scope approval, `<24h` same-scope verified-LAN offline policy, request-start t0, trusted time, install epoch/authorization backup exclusion, local deny/revoke precedence ve durable publication fence değişmez. PC offline ise iş bekler; historical journal/result/receipt fresh authority değildir. Payload encryption varsa yalnız ek koruma; E2EE backend'de terminate edilmez, PC normal dosyaları tutar. Exact envelope/key lifecycle hâlâ gate.

## Supersession ve bakım etkisi

| Eski kayıt/varsayım | Yeni durum |
| --- | --- |
| ADR0007 MVP tek Matrix Ed25519 possession key / software-only Kloda identity | ADR0012 ile ayrı Kloda P-256 long-lived identity, hardware-preferred; ADR0013 ile Matrix SAS first-trust da superseded. Exact support/fallback unselected |
| ADR0008 D01 upstream-first byte signer | Retired product prerequisite; historical upstream/fork alternatifleri archival/non-actionable. D03 native DER persistence korunur |
| ADR0011 SDK-owned Matrix signer + async/sync callback producer | Matrix signer prerequisite retired; in-process owned query/session lifecycle ve native managed boundaries korunur. Exact TLS/native producer P-256 provider kaynaklarıyla çözülür; rustls hâlâ aday, adoption değil |
| ADR0004/0010 aynı SAS Matrix key TLS equality | QR-established Kloda local pin + fresh authenticated session association; initial PC QR fingerprint actual TLS P-256 SPKI ile eşit, authorization ve operation-bound PC result/query korunur |
| SDK signer contribution TODO / policy blocker | Historical contribution/policy araştırması archival/non-actionable; yeni upstream task veya product/native prerequisite değildir. Publication/human review yapılmadı |
| Historical Matrix/TLS patch, 1A–1D/2A–2D observations | Eski scope'ta tarihsel kalır; P-256/hardware/QR/session/remote kanıtına aktarılmaz; old corpus rebuild gerekmez |

Bu cutover SDK patch/fork, dependency/provider/service kurulumu veya native/cloud/device experiment execution izni değildir. Matrix arbitrary-byte API araştırması current roadmap seçeneği/TODO değildir; historical upstream policy/search kayıtları korunur.

## Before-code / production gate

Strict payload parsing/canonical SPKI hash, exact HMAC/channel-binding/exporter/transcript/framing/recovery ve minimum native davranış [KLODA-QR-PAIR-V1 sözleşmesinde](../security/qr-pairing-v1-protocol.md) frozen; [synthetic vectors](../security/qr-pairing-v1-protocol-vectors.json) documentation fixtures'dır, runtime proof değildir. Pure codec/state implementation yalnız ayrıca onaylı coding task'ta başlayabilir. Native integration için selected P-256 provider/TLS/DTLS callback and ownership; matched target source/manifest/lock/binding declarations; actual API/ABI/adoption mapping ve key+pin/cert/install continuity/scope/capability/channel runtime proof gerekir. Matrix/SAS/SDK binding gate'i yoktur; fake ABI veya opaque `trusted=true` factory yazılmaz. Dar Android hardware signer PASS universal Secure Enclave/StrongBox/TEE/TPM support/attestation, private material exposure veya iOS system-background signing/transfer kanıtı değildir; fiziksel eski/current cihaz ve actual peer LAN ayrıca gerekir. iOS16.4+/AndroidAPI24 support hedefleri sessiz daraltılmaz; no-runtime sonucu unverified/blocked/inconclusive olarak kalır.

## Impact review ve bu teslimin sınırı

Pre-change ayrı bounded pass: managed mobile/desktop source/storage/schedule/job/WebDAV sender, empty central Nest module; pairing/identity/session producer yok. Bu yüzden ürün kodu/dependency/test contract'ı değişmedi. ADR, aktif security contract/native prerequisite/status/TODO'lar dar cutover alır; eski sanitized evidence sonuçları/hash'leri korunur. Receiver/query/fence, enrollment/schema, hardware/native/background ve physical gate'leri kapanmaz. Bundan sonraki mimari sorular ilk kullanımda terimi sade tanımlar ve seçeneklerin Kloda'da pratik etkisini açıklar.
