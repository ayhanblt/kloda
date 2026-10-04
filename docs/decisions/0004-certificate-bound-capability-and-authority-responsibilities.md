# ADR 0004 — Certificate-bound capability ve authority sorumlulukları

- Tarih: 2026-10-04
- Durum: Dört mimari yön kabul edildi; ES256 provisional; production gate'leri açık
- Karar sahibi: Ayhan

## Onay ve kapsam

Ayhan dört öneriyi onayladı; #1 için platform/TLS/device-key compatibility production gate olarak kalacak, #2 ES256 runtime ve KMS feasibility doğrulanana kadar provisional olacak. Bu kayıt production-ready veya doğrulanmış implementasyon iddiası değildir. İzin verilen sonraki iş **izole issuance/admission feasibility planı hazırlamaktır**; deneyin yürütülmesi, ürün kodu veya canlı servis kurulumu bu onaydan türetilmez.

[ADR0003](0003-secure-pairing-and-offline-authorization.md) `<24h`/revoke/recovery/fence politikası korunur; Nest control rolü bu ADR ile kabul edilir. [ADR0007](0007-matrix-verification-and-device-continuity.md) Matrix verification-only ve software key/installation continuity sınırıdır. [ADR0002](0002-first-vertical-slice-scope.md) tarihsel baseline; güncel ürün [ADR0005](0005-computer-first-files-and-photos-backup.md), account policy [ADR0006](0006-account-mfa-and-recovery-policy.md). Eski research proposal statüsü tarihsel; current approval ve koşullar bu kayıttadır.

## 1. Certificate-bound capability ve fresh possession — kabul edildi

JWS/JWT capability telefonun **tam X.509 leaf DER** sertifikasına `cnf.x5t#S256` ile bağlanır. PC bu değeri native TLS endpoint'inden alınan gerçek peer leaf DER'in SHA-256 unpadded base64url değeriyle karşılaştırır. Ayrı olarak gerçek leaf SPKI/raw Ed25519 key'i immutable SAS-verified peer key'e eşit olmalıdır; trusted root pini tek başına yeterli değildir. Telefon beklediği PC key'ini doğrular.

Her yeni file session fresh full TLS1.3 aynı SAS-verified device-key possession gerektirir; PSK/0-RTT veya eski handshake replay yetki açmaz. Aynı geçerli capability fresh mTLS reconnect'te tekrar sunulabilir; `jti` otomatik tek kullanımlık handshake nonce'u değildir. Token application data'dır, TLS transcript'inde imzalı sayılmaz. Account/pair/device/role/PC/scope/operations/epoch/version/current-authority kapıları tamamlanmadan file operation yoktur.

**Production gate açık:** Android/iOS/Electron platformları, gerçek TLS stack'leri, aynı device-key signer, native peer-DER/session bağı, OS provider/background davranışı ve minimum OS compatibility kanıtlanmalıdır. Patched SDK deneyi bunları production için kapatmaz; ikinci telefon/PC possession key'i, private-key export veya custom handshake alternatif olarak onaylanmadı.

## 2. Server capability imzasında ES256 — provisional kabul

ES256 (P-256/SHA-256), incelenen `panva/jose 6.2.12` TypeScript issuer ve `jsonwebtoken 10.1.0` Rust verifier adayları için provisional yöndür. Exact JOSE `Ed25519` identifier'ı iki adayda ortak doğrulanmadı; `EdDSA` legacy downgrade veya üçüncü stack kararı verilmedi. Dependency adoption ayrıca yapılmış sayılmaz.

**Runtime ve KMS feasibility doğrulanana kadar provisional kalır.** Cross-runtime signing/verifying, trusted public-key import, raw JWS r||s versus DER signature encoding, algorithm/type/key-family rejection ve seçilecek gerçek KMS'in ES256/signing contract'ı kanıtlanmalıdır. Lokal software signer testi KMS gate'ini kapatmaz; KMS/hosting/custody sağlayıcısı seçilmedi.

Server signer key'i uç possession key'i değildir. Telefon/PC Ed25519 cihaz anahtarları değişmez; merkez uç private key'lerini almaz. Trusted issuer/key config token'dan bağımsızdır; `jku/jwk/x5u/kid` trust anchor yaratamaz. Unknown kid, öğrenilmiş signer revoke veya güvenilir validity yokluğu ret; rotation overlap token/offline süresini uzatmaz.

## 3. NestJS merkezi control — PC yerel enforcement — kabul edildi

NestJS merkezi hesap/cihaz/pair eligibility, capability issuance/reissue ve revoke/version koordinasyonundan sorumludur. PC yerel kullanıcı scope/operation onayı, admission, dosya işlemleri, durable deny ve authorization/publication fence'ini uygular. Backend interface→application→domain; infrastructure domain port'larını uygular, dosya başına tek use-case; frontend FSD korunur.

Backend dosya byte'ı, uç private key'i, pair secret, plaintext medya kataloğu veya medya hash listesi tutmaz; PC normal final dosyaları korur, transfer E2EE kalır. Supabase Auth+Postgres mevcut ürün yönüdür, çalışan enrollment/account entegrasyonu değildir. İlk pair/new device/scope/recovery için account ve fresh step-up, PC onayı ve bilateral SAS ayrı koşullardır; normal sync'te per-run TOTP/biometric/userPresence eklenmez.

PC local revoke/öğrenilmiş deny/version mismatch stale allow'dan önce gelir. Yalnız mevcut aynı-scope ve LAN eligibility kanıtlı durumda merkez unreachable ise trusted elapsed upper `<24h`, token validity ve install continuity birlikte dar offline istisna verebilir. t0 başarılı authenticated kontrolün request-start anıdır; late allow/reconnect/token/restart/wall-clock pencereyi yenilemez. Explicit deny network error değildir. Fence önceyse yeni publication/completed yok; geçerli durable commit önceyse final korunur. Journal/staging authority değildir; reconcile güncel authenticated same-scope authority ister. Filesystem atomikliği/clock/LAN implementation'ı henüz doğrulanmadı.

## 4. Key-bound grant / exact-DER-bound capability lifecycle — kabul edildi

Grant device-key + installation continuity'ye, capability kesin certificate DER'e bağlıdır. Aynı key ile yeni DER certificate eski token'ı devralamaz; authenticated online reissue gerekir, yeni scope onayı yerine geçmez. Mevcut Engine cert cache'i persistent production lifecycle değildir.

Restart/suspend sonrası certificate ve trusted elapsed continuity kanıtlanamıyorsa offline erişim açılmaz; online beklenir. Bu bekleme eski grant geçmişini, key'i, journal/ciphertext veya geçerli PC final'i silmez. Missing epoch/restore şüphesi ve retained epoch+SDK DB kaybı ayrı online PC onayı+SAS+grant ister; transient provider failure identity reset/key loss sayılmaz. Software epoch her tam rollback'i algılar veya key hardware-backed'dir denmez.

## Kanıt sınırı ve sonraki kapı

[Native/TLS kanıt](../security/poc-native-verification-evidence.md) ve [public certificate inspection](../security/evidence/certificate-binding-inspection.json) yalnız alt-gate'tir. Authority enrollment/issuance/admission, JWT runtime/KMS, native actual peer-DER/session bağı, filesystem fence/trusted time ve physical/real-peer-network doğrulanmadı. [36 acceptance hedefi](../security/capability-acceptance.md) **not-executed** kalır; [profile sözleşmesi](../security/capability-profile.md) wire/API implementasyonu değildir.

[İzole issuance/admission feasibility planı](../implementation/issuance-admission-feasibility-plan.md) hazır; execution ayrıca onay bekler. Başarılı lab deneyi bile production/service veya full acceptance pass değildir. Açık gate'ler [production/physical kayıt](../security/production-gates.md) içindedir. WebDAV direct/HTTP(S) relay ve SMB LAN-only sınırları korunur.

## Dayanaklar

- [RFC 8705 §§3–3.1,6.5](https://www.rfc-editor.org/rfc/rfc8705#section-3): exact certificate binding ve TLS metadata sınırı; binding tam OAuth server/client-authentication implementasyonu demek değildir.
- [RFC 7519 §4.1](https://www.rfc-editor.org/rfc/rfc7519#section-4.1), [RFC 8725 §3](https://www.rfc-editor.org/rfc/rfc8725#section-3), [RFC 9864 §2](https://www.rfc-editor.org/rfc/rfc9864#section-2): claims/validation ve fully-specified algoritmalar.
- Kalıcı detay: [capability profile](../security/capability-profile.md), [acceptance](../security/capability-acceptance.md), [session coverage index](../implementation/session-documentation-index.md). Önceki session-local research yalnız tarihsel köken; karar/kanıt bu ephemeral kaynakların erişimine bağımlı değildir.
