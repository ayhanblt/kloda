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
- PC ana alıcıdır. İlk trust [ADR0013](../docs/decisions/0013-qr-based-local-lan-pairing.md) QR LAN: invitation, QR-only scan, gerçek mutual TLS, same-channel secret proof, exact PC onayı ve iki durable local pin. Rust core/Android-Electron bridges/UI implemented/build-tested; gerçek hardware Android↔PC henüz doğrulanmadı. [ADR0016](../docs/decisions/0016-v1-pc-local-file-authority.md) V1 LAN için ayrı explicit PC-selected backup scope ve native local ACL'yi seçer; ilk grant ve dosya işlemi internet/backend/login istemez. Local ACL/receiver/journal/resume/own restore uygulanmış ve host/software-fixture kapsamda doğrulanmıştır; fiziksel kabul açık.
- LAN dosya payload'ı yereldir; backend/internete sessiz fallback yok. Dışarıdan PC erişimi hedeflenir, real remote routing/adoption gate'i açık. PC offline/uykudaysa ve cloud file store yoksa iş telefonda bekler; completion uydurulmaz.
- Cellular backup **default-off**, explicit opt-in gerekir. İlk büyük backup için LAN/Wi-Fi güçlü öneri, zorunlu değil. Live OS fırsatına bağlıdır, kesintisiz realtime garanti değildir.
- Eski Keenetic/WebDAV/DDNS kurulumunda hostname/port/credential kullanıcı config/env'dir; koda/repoya gömülmez. Kullanıcının ~8000 FolderSync dosyası test/overwrite hedefi değildir.

## 3. Bağlantı mimarisi ve kapsam ayrımı
- Advanced WebDAV için orijinal direct public-IP veya CGNAT'ta E2EE HTTP(S) relay yönü korunur; relay byte taşır, dosya saklamaz. WAN/public-IP karşılaştırması ilk WebDAV slice'ın erişim/yazma probe'u değildir; probe external connectivity/CGNAT garantisi vermez.
- Advanced relay yolunda WebDAV; SMB/FTP/raw TCP backup protokolleri LAN-only. UI doğru erişilebilirlik gösterir; çalışmayan protokol etkin görünmez. Relay redundancy gereksinimi korunur.
- PC peer yönü [ADR0012](../docs/decisions/0012-kloda-owned-p256-device-identity.md): LAN pinned TLS/SPKI + Kloda device-key mutual proof; remote WebRTC/DTLS + signed signaling/fingerprint + mutual proof. Direct P2P mümkünse tercih, **Cloudflare TURN yalnız relay fallback**; Tunnel tarihsel ve farklı ürün. Provider deployment/native API/background/physical proof açık, kesintisiz WebRTC-only background garantisi yok.
- V1 LAN file authorization native PC-local ACL + current own-peer scope/operation/revoke/fence + fresh full pinned TLS1.3 ister. Gerçek TLS SPKI Kloda P-256 key'dir ve ilk QR SHA256 fingerprint buna eşittir; certificate validity/profile korunur. Merkezi signed capability, exact-DER online reissue ve `<24h` cache V1 LAN zorunluluğu değildir. Pairing-only trust file grant değildir. TLS/DTLS zorunlu, payload encryption yalnız ek koruma; backend E2EE terminate etmez. Final remote authorization politikası açık, LAN ACL'den otomatik türetilmez.

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
- [ADR0016](../docs/decisions/0016-v1-pc-local-file-authority.md): PC kendi backup alanının tek file authority'sidir; Rust native owner yerel app-data SQLite ACL, admission, revoke ve publication fence'i yönetir. Renderer DB'yi değiştiremez; Electron güvenli native yönetim API'si üzerinden explicit scope approval ister. Supabase/Nest account/device/pair control yönü korunur; gerçek backend integration yok.
- Backend JWT yalnız user session; V1 LAN için signed capability/merkezi issuer/KMS/deployment issuer allowlist gerekmez. Default ACL photo upload/status/finalize/own-backup list/user-triggered own restore; delete/other-device/outside-root yasak. Klasör seçilmezse pairing-only. Genel Files/two-way yetkisi bu default'tan türemez.
- Her dosya işleminde gerçek native peer/pin/possession/installation continuity ve güncel ACL doğrulanır; local revoke üstün, journal authority değildir. Key/pin/epoch kaybı/restore şüphesi fail closed + fresh local QR/PC grant ister. Account recovery/central revoke↔offline-PC ilişkisi ve final remote policy henüz kararlaştırılmadı; automatic grant survival/reset icat edilmez. Online unpair durable PC ACL+trust revoke ACK ister; offline yalnız local kaldırma/PC-unconfirmed, gecikmeli signed revoke/queue V2 dışıdır.
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
- Tam file/media E2EE envelope/key lifecycle, authenticated manifest ve native real-peer/session binding uygulaması; V1 local ACL/mTLS yönü seçili olsa da runtime proof açık.
- Remote tercih WebRTC/DTLS + Cloudflare TURN fallback; exact native signaling/fingerprint/device-key/channel proof, provider deployment/hosting/custody ve trusted issuer bootstrap+rotation gate açık. Tercih runtime/adoption/physical proof değil.
- [Frozen V1](../docs/security/qr-pairing-v1-protocol.md) değişmedi. [ADR0014](../docs/decisions/0014-shared-rust-qr-pairing-core.md) kapsamındaki Rust native core/Android-Electron/UI implementation ve43 synthetic native regression pass; hardware custody/native LAN/backup/background/support proof açık. Mac Secure Enclave creation `-34018` missing entitlement ile blocked; signing/provisioning kararı Ayhan'a sorulur. iOS native açıkça deferred. Matrix/SAS/ikinci comparison geri eklenmez.
- V1 native local scope/ACL/revoke/admission/publication fence ve cap-std4.0.3 backup-root confinement uygulanmıştır; trusted local PC/filesystem-writer sınırı altında hostile remote paths reddedilir, local relocation/outside-origin hardlink containment garantisi yoktur. Platform storage/custody ve fiziksel kabul açık. Merkezi issuer/KMS/file eligibility V1 LAN gate'i değildir; Supabase account enrollment/step-up ve recovery API/schema control kapsamındadır, offline PC-local ACL ile ilişkisi açık karardır.
- **Mobile:** React Native+Expo development build; **Desktop:** Electron. iOS16.4+/Android7/API24 destek hedefi ve ortak native crypto yönü seçildi; release/toolchain minimum compatibility, exact native APIs ve fiziksel eski/current cihaz kanıtı açık ([ADR0001](../docs/decisions/0001-mobile-sync-behavior-and-framework-constraints.md)). APK/deployment target product support proof değildir.
- Cert persistence/validity/same-key renewal, native key/epoch/ACL backup/restore exclusion ve kalıcı queue/reconcile; software full rollback detection garanti değil. Merkezi token-time/elapsed upper `<24h` cache V1 LAN authority şartı değildir.
- Scope-safe file-open/symlink/mount/durable revoke–publication fence ve authenticated reconcile; media/product conflict/restore acceptance.
- Galeri/thumbnail/arama ve AWS premium kapsamı açık. FolderSync hash yöntemi veya backend control rolü artık “hiç seçilmedi” diye sunulmaz; bunların uygulama gate'i açıktır.

**physical-device validation required** ve inconclusive ayrımı: [production gate kaydı](../docs/security/production-gates.md). Physical Android transport14pass/direct1inconclusive ve iOS URLSession simulator inconclusive, native simulator TLS pass'leriyle karıştırılmaz.
- **Android physical hardware-backed P-256 → TLS1.3 CertificateVerify: CLOSED/PASS (SM-S921B/API36)** yalnız cihaz-local native server/client signer. Tek cihaz; actual Android↔PC LAN/final app/Rust bridge, iOS physical, desktop hardware TLS/background/support gate'leri kapanmadı. iOS physical cihaz yokluğu ertelenmiş validation; simulator production proof değil. Bu deney tekrar koşulmaz.

## 10. Kalıcı durum ve sonraki gate
- Monorepo/lint/FSD ve ilk WebDAV temeli var; ilk slice ve PC-first ürün tamamlanmadı. [First-slice status](../docs/implementation/first-vertical-slice-status.md) implemented ile required işleri ayırır.
- [Session coverage index](../docs/implementation/session-documentation-index.md) bütün önemli karar/kanıtların kalıcı karşılığıdır; geçici konuşma veya /tmp tek source of truth olamaz.
- [Codex migration handoff](../docs/implementation/codex-migration-handoff.md) güncel kısa giriş ve Git/OMP taşınabilirlik envanteridir. Son uygulama TODO'su14/14 yalnız onaylı Android kapsamı için tamamlandı; ürün completion değildir. ADR0017 sidecar publication/Android import recovery, source/target kimlik ayrımı ve görünür review uygulanmıştır; native91 önceki sender checkpoint'i, son root API1/desktop82/mobile30/shared117 ve API36 instrumentation PASS'tir. iOS native ve mobile scheduled/background execution uygulanmadı; physical pause sürer. Aşağıdaki eski checkpoint sayıları kendi tarihsel kapsamlarındadır.
- [İzole issuance/admission feasibility planı](../docs/implementation/issuance-admission-feasibility-plan.md) tarihsel merkezi modeldir, V1 LAN için yürütülebilir prerequisite değildir. Yeni [ADR0016](../docs/decisions/0016-v1-pc-local-file-authority.md) local authority yönünü seçer; account recovery/central revoke/remote final policy açık kalır. Physical pause ve Windows storage güvenlik engeli aşılmaz.
- Receiver checkpoint2026-10-13: ADR0013/frozen V1 + ADR0014/0015/0016 + [QR roadmap](../docs/implementation/qr-pairing-implementation-roadmap.md). Native PC-local schema3 ACL/receiver/journal, explicit consent, cap-std root/peer identity confinement, ADR0010§6 sequential mTLS1.3 `kloda-file/1` upload/resume/finalize/query/list/own restore and atomic trust+ACL revoke exact ACK implemented. Same-peer/same-root explicit regrant permits immutable Completed own history only, never pending adoption. Native84/strict clippy/policy15/root lint, API1/desktop82/mobile19/shared117 and desktop/four-ABI APK were that checkpoint's evidence, superseded for Android/root by the later sender/ADR0017 evidence above. Full-disk/software-fixture checks are not Windows/hardware/physical acceptance. [Handoff](../docs/implementation/implementation-session-handoff.md#v1-local-authority-adoption) retains precise evidence and open gates.
- [ADR0015](../docs/decisions/0015-desktop-platform-and-signing-isolation.md): Desktop platforms develop independently; development `com.kloda.desktop.dev` and production `com.kloda.desktop` authorities/keys/pins/DBs stay separate; default production uses fresh identity+QR, no migration. Mac paid signing/provisioning blocked; Linux provider/locality unselected and no physical machine. Windows-only windows-sys0.61.2 TPM CNG/LAN/private LocalAppData-NTFS source exists; user-reported historical explicit MSVC1.99.0 compile/native53/desktop ABI build PASS is not current owner success. Latest Windows development owner returned `storage_failure`; probe WRITE_THROUGH failures32/directory reopen5 do not prove original cause. Certificate replacement, SQLite object binding and continuity-witness decisions remain blocked. [Current physical-pause checkpoint](../docs/implementation/desktop-platform-validation-plan.md#güncel-yürütme-kapısı--fiziksel-doğrulama-duraklatıldı) supersedes old manual-owner instructions; no new probes/reset/TPM/ADB or software fallback.
