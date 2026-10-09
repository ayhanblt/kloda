# AGENTS.md — Kloda

## Proje kimliği ve tasarım referansı
- Proje adı: **Kloda**.
- Kullanıcıya ve store'larda gösterilecek uygulama adı: **Kloda: Secure Photos & Sync**.
- "Private Photo Cloud" eski/geçici isimdir; uygulama kodunda, dokümantasyonda ve kullanıcıya gösterilen metinlerde kullanılmaz.
- Repository kökündeki `stitch_private_photo_cloud/` klasörü onaylanmış UI/UX tasarım referansıdır; görsel geliştirmede mümkün olduğunca source of truth kabul edilir.
- Stitch kaynak dosyaları salt tasarım referansıdır; bu dosyalar rename amacıyla değiştirilmez.
- Tasarım keyfi olarak yeniden yorumlanmaz veya başka bir design system ile değiştirilmez. Teknik platformda uygulanamayan bir tasarım varsa varsayım yapılmaz; Ayhan'a bildirilip karar beklenir.

Bu belge, projenin tek geliştirme aracı olan Codex için devir belgesidir. Projede başka bir AI aracı yoktur: hem implementasyon hem review Codex tarafından yapılır. Planlama ve mimari kararlar Ayhan'a aittir.

## 1. Amaç
Ana ürün yönü, kullanıcının telefonundaki **genel dosyalar ve Photos kaynaklarını kendi bilgisayarına** yedeklemesi, listelemesi/indirmesi ve isteğe bağlı Files çift yönlü sync'tir. WebDAV/SMB/NAS gelişmiş seçenekler olarak korunur. PC normal dosyaları tutar; aktarım E2EE, galeri/thumbnail/arama ve AWS premium kapsamı açık kalır. Merkezi servis dosya byte'ı, uç private key'i, pair secret, plaintext medya/album kataloğu veya medya hash listesi tutmaz; Supabase Auth+Postgres yalnız account/device/pair control metadata yönüdür.
Kalıcı ürün politikası: [ADR0005](../docs/decisions/0005-computer-first-files-and-photos-backup.md); hesap politikası: [ADR0006](../docs/decisions/0006-account-mfa-and-recovery-policy.md).

## 2. Temel kullanım senaryosu
- PC ana alıcıdır. İlk trust [ADR0013](../docs/decisions/0013-qr-based-local-lan-pairing.md) QR LAN: invitation, QR-only scan, gerçek mutual TLS, same-channel secret proof, exact PC onayı ve iki durable local pin. Rust core/Android-Electron bridges/UI implemented/build-tested; gerçek hardware Android↔PC henüz doğrulanmadı. İnternet/backend/login gerekmez; dosya yetkisi ayrıca aynı account/step-up/PC scope/capability ister.
- LAN dosya payload'ı yereldir; backend/internete sessiz fallback yok. Dışarıdan PC erişimi hedeflenir, real remote routing/adoption gate'i açık. PC offline/uykudaysa ve cloud file store yoksa iş telefonda bekler; completion uydurulmaz.
- Cellular backup **default-off**, explicit opt-in gerekir. İlk büyük backup için LAN/Wi-Fi güçlü öneri, zorunlu değil. Live OS fırsatına bağlıdır, kesintisiz realtime garanti değildir.
- Eski Keenetic/WebDAV/DDNS kurulumunda hostname/port/credential kullanıcı config/env'dir; koda/repoya gömülmez. Kullanıcının ~8000 FolderSync dosyası test/overwrite hedefi değildir.

## 3. Bağlantı mimarisi ve kapsam ayrımı
- Advanced WebDAV için orijinal direct public-IP veya CGNAT'ta E2EE HTTP(S) relay yönü korunur; relay byte taşır, dosya saklamaz. WAN/public-IP karşılaştırması ilk WebDAV slice'ın erişim/yazma probe'u değildir; probe external connectivity/CGNAT garantisi vermez.
- Advanced relay yolunda WebDAV; SMB/FTP/raw TCP backup protokolleri LAN-only. UI doğru erişilebilirlik gösterir; çalışmayan protokol etkin görünmez. Relay redundancy gereksinimi korunur.
- PC peer yönü [ADR0012](../docs/decisions/0012-kloda-owned-p256-device-identity.md): LAN pinned TLS/SPKI + Kloda device-key mutual proof; remote WebRTC/DTLS + signed signaling/fingerprint + mutual proof. Direct P2P mümkünse tercih, **Cloudflare TURN yalnız relay fallback**; Tunnel tarihsel ve farklı ürün. Provider deployment/native API/background/physical proof açık, kesintisiz WebRTC-only background garantisi yok.
- LAN file authorization certificate-bound capability + fresh full TLS1.3 ister; ilk QR LAN profile'da gerçek TLS SPKI (public-key encoding) Kloda P-256 key'dir ve QR SHA256 fingerprint buna eşittir. Capability exact certificate-DER hash'i ayrı sınırdır. Pairing-only channel preexisting capability istemez. Exact LAN/remote/native production gate açık; TLS/DTLS zorunlu, payload encryption yalnız ek koruma. Backend PC↔phone E2EE terminate etmez; QR trust/probe file authority değildir.

## 4. Onboarding ve sync davranışı
- “Depolama ekle” başlangıcı yok; kullanıcı kendi Files/Photos kaynaklarını seçer, Files “Tümünü seç” düğmesi yok. Photos library/albums ayrı izin/kaynaktır.
- Güncel ürün default **Live = OS izin verdiğinde ilk fırsat**;12/24 saat + yerel saat alternatifinde change detection hemen upload başlatmaz. Manual **Sync Now** ayrı kalır, programı kaydırmaz.
- İlk WebDAV ekran sırası/kapsamı [ADR0002](../docs/decisions/0002-first-vertical-slice-scope.md) tarihsel baseline; PC-first account/PC approval/target davranışı ADR0005/0006'da kabul. Ürün/UI cutover uygulanmış sayılmaz; yeni ekran düzeni bu belgede icat edilmez, Stitch referansı korunur.
- Files optional two-way:30-day trash/previous versions, two-copy conflict preservation; Photos backup-first, kullanıcı başlatmalı restore. Kesin edge-case kapsamı [ürün kaydı](../docs/product/computer-backup-files-and-photos.md) içindedir; davranış onayı runtime proof değildir.

## 5. Migrasyon gereksinimi
FolderSync'teki ~8000 dosya tekrar yüklenmemeli. Kullanıcı **SHA-256 içerik hash'i + kalıcı kayıt** yöntemini seçti; name/size/date eşitliği tek başına skip değildir. Kullanıcının mevcut arşivi hash'lenmiş/migre edilmiş/değiştirilmiş sayılmaz. Korunmuş kendi receipt'i genel migration proof değildir; ilk tarama/gerçek byte doğrulaması, source/target kimliği ve değişim yarışları ADR0005 edge-case/gate'leridir.

## 6. Teknik yığın (karar verildi)
- **Backend:** NestJS (TypeScript). .NET / Django'ya geçilmez; sebep mobil ve desktop ile TypeScript tutarlılığı.
  - **Clean Architecture:** domain / application / infrastructure / interface katmanları.
  - **Dosya başına tek use-case.**
- **Frontend (mobil + desktop):** **FSD (Feature-Sliced Design)**.


### Kabul edilen security/control sınırı
- [ADR0012](../docs/decisions/0012-kloda-owned-p256-device-identity.md) ayrı Kloda-owned uzun ömürlü ECDSA P-256 identity; [ADR0013](../docs/decisions/0013-qr-based-local-lan-pairing.md) ilk QR LAN trust. Matrix/SAS/SDK/Olm/store/homeserver/fork/upstream signer current pairing path/gate değildir; **MVP single device key retired**. Local pin trust, backend registry değil. Secure Enclave/Android Keystore-StrongBox-TEE/Windows TPM non-exportable (private key dışarı çıkarılamayan) hardware tercih; kalan API/support/fallback/Linux/background/physical proof açık. Per-run biometric/userPresence veya per-request hardware signature/nonce sistemi yok.
- Nest central eligibility/issuance/revoke control; PC local scope/admission/file/durable fence enforcement kabul edildi. Supabase provider yönü seçili, gerçek enrollment/backend integration yok.
- Backend JWT yalnız user session; signed capability device/PC/scope/expiry file authorization. Server signer **ES256 provisional**: runtime+actual KMS olmadan final değil, Kloda P-256 device key ile aynı key/rol değil. Bu backend gate ilk offline QR trust'ı engellemez.
- Aynı-scope verified LAN offline **file authorization** yalnız center unreachable ve trusted elapsed upper **<24h** + valid token + install continuity; request-start t0, explicit/local deny üstün. Epoch/pin kaybı/restore şüphesinde fresh local QR re-trust + ayrı gerekli online PC scope approval/grant; journal authority değildir. İlk file grant offline cache istisnasıyla oluşmaz; policy runtime proof yoktur.
## 7. Kod kalitesi kuralları (bağlayıcı)
Uzun ve dağınık ("AI slop") dosyalar istenmiyor.
- ESLint `max-lines` kuralı; ihlalde **CI fail**.
- FSD sınır denetimi (steiger veya eslint-plugin-boundaries); ihlalde CI fail.
- Backend'de bir use-case = bir dosya. Katmanlar arası bağımlılık yönü: interface → application → domain; infrastructure, domain'deki port'ları uygular.
- Bu kurallar kod yazılmadan **önce** kurulur.

## 8. Çalışma şekli (Codex için)
- Tek araç Codex olduğu için implementer ve reviewer rolleri **ayrı geçişlerde** yapılır: önce uygula, sonra ayrı bir review geçişinde diff'i bölüm 3, 6 ve 7'deki kurallara karşı denetle. Kendi yazdığın kodu aynı geçişte onaylama.
- Her görevde küçük, gözden geçirilebilir değişiklikler yap; lint ve testler geçmeden bitmiş sayma.
- **Bölüm 9'daki açık konularda varsayımla ilerleme.** Gerektiğinde seçenekleri/öneriyi Ayhan'a sor; teknik terimi ilk kullanımda sade tanımla, her seçeneğin Kloda'da pratik etkisini belirt. Onaylanan kararı `docs/decisions/` altında kısa kayıt olarak yaz.
- Mimari kararları (katman yapısı, protokol seçimi, relay modeli) tek başına değiştirme; değişiklik gerekiyorsa öner.
- Gizli bilgi (hostname, port, kimlik bilgisi) koda ve repoya girmez.

## 9. Açık production gate'ler ve henüz seçilmemiş kararlar
- Tam file/media E2EE envelope/key lifecycle, authenticated manifest ve native real-peer/session binding uygulaması; capability/mTLS yönü kabul edilmiş olsa da runtime proof açık.
- Remote tercih WebRTC/DTLS + Cloudflare TURN fallback; exact native signaling/fingerprint/device-key/channel proof, provider deployment/hosting/custody ve trusted issuer bootstrap+rotation gate açık. Tercih runtime/adoption/physical proof değil.
- [Frozen V1](../docs/security/qr-pairing-v1-protocol.md) değişmedi. [ADR0014](../docs/decisions/0014-shared-rust-qr-pairing-core.md) kapsamındaki Rust native core/Android-Electron/UI implementation ve43 synthetic native regression pass; hardware custody/native LAN/backup/background/support proof açık. Mac Secure Enclave creation `-34018` missing entitlement ile blocked; signing/provisioning kararı Ayhan'a sorulur. iOS native açıkça deferred. Matrix/SAS/ikinci comparison geri eklenmez.
- ES256 issuer runtime+actual KMS ve gerçek Supabase account↔Kloda device/pair enrollment, operation step-up, PC scope approval, recovery/revocation API/schema ayrı **file authorization** gate'leridir; ilk QR trust backend-independent.
- **Mobile:** React Native+Expo development build; **Desktop:** Electron. iOS16.4+/Android7/API24 destek hedefi ve ortak native crypto yönü seçildi; release/toolchain minimum compatibility, exact native APIs ve fiziksel eski/current cihaz kanıtı açık ([ADR0001](../docs/decisions/0001-mobile-sync-behavior-and-framework-constraints.md)). APK/deployment target product support proof değildir.
- Trusted token-time + elapsed upper continuity, cert persistence/renewal/reissue, native key/epoch backup/restore exclusion; software full rollback detection garanti değil.
- Scope-safe file-open/symlink/mount/durable revoke–publication fence ve authenticated reconcile; media/product conflict/restore acceptance.
- Galeri/thumbnail/arama ve AWS premium kapsamı açık. FolderSync hash yöntemi veya backend control rolü artık “hiç seçilmedi” diye sunulmaz; bunların uygulama gate'i açıktır.

**physical-device validation required** ve inconclusive ayrımı: [production gate kaydı](../docs/security/production-gates.md). Physical Android transport14pass/direct1inconclusive ve iOS URLSession simulator inconclusive, native simulator TLS pass'leriyle karıştırılmaz.
- **Android physical hardware-backed P-256 → TLS1.3 CertificateVerify: CLOSED/PASS (SM-S921B/API36)** yalnız cihaz-local native server/client signer. Tek cihaz; actual Android↔PC LAN/final app/Rust bridge, iOS physical, desktop hardware TLS/background/support gate'leri kapanmadı. iOS physical cihaz yokluğu ertelenmiş validation; simulator production proof değil. Bu deney tekrar koşulmaz.

## 10. Kalıcı durum ve sonraki gate
- Monorepo/lint/FSD ve ilk WebDAV temeli var; ilk slice ve PC-first ürün tamamlanmadı. [First-slice status](../docs/implementation/first-vertical-slice-status.md) implemented ile required işleri ayırır.
- [Session coverage index](../docs/implementation/session-documentation-index.md) bütün önemli karar/kanıtların kalıcı karşılığıdır; geçici konuşma veya /tmp tek source of truth olamaz.
- [İzole issuance/admission feasibility planı](../docs/implementation/issuance-admission-feasibility-plan.md) hazır; **execution ayrıca onay bekliyor**. Dört mimari yönün onayı experiment/product code/cloud/KMS kurulumu veya production-ready onayı değildir.
- Current checkpoint: ADR0013 + frozen V1 + ADR0014/0015 + [QR evidence roadmap](../docs/implementation/qr-pairing-implementation-roadmap.md). Root lint/tests, native47 strict clippy/size, desktop50/build, önceki dört-ABI Android APK ve gerçek isolated Electron development launch doğrulandı; physical Android↔PC tamamlanmadı. Son integration smoke gerçek Electron pairing ekranında identity_unavailable/no invitation durumunu gösterdi. Mac ücretli signing/provisioning açık platform-local gate. Physical Windows/Android/manual için kullanıcı müdahalesi gerekir; security/architecture/dependency belirsizliği varsayılmaz.
- [ADR0015](../docs/decisions/0015-desktop-platform-and-signing-isolation.md): Desktop macOS/Windows/Linux bağımsız geliştirilir. Ücretsiz Personal Team nedeniyle ücretli Mac signing/provisioning açık gate; diğer platformları durdurmaz. Windows11 fiziksel cihaz var, Linux yok; Linux CI/VM kanıtı physical custody değildir. Development `com.kloda.desktop.dev`, production `com.kloda.desktop`; signing/profile/Keychain/userData/native authority ayrı. Otomatik key/pin/DB/epoch migration yok; varsayılan fresh production identity + QR re-pairing. Windows-only windows-sys0.61.2 onaylandı; TPM CNG/LAN/private LocalAppData-NTFS source uygulandı. Kullanıcı açık Windows x64 MSVC test --no-run, desktop-node check ve53 native test PASS bildirdi. Dört non_upper_case_globals ve bir unused_unsafe warning nonblocking; suppression yok. `+stable` GNU seçip E0463 verdi: açık MSVC toolchain kullanılmalı. Sıradaki adım Python/pinned MSVC1.99.0 ve gerçek desktop/native-Electron ABI build; pairing açılmadan kalıcı TPM/authority etkileri anlatılmalı. Hardware TPM/nonexportability/device-key TLS ve Android/ADB bekler. Software fallback yok.
