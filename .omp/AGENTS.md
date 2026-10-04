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
- PC ana alıcıdır; aynı Kloda account, bilgisayarda izinli alan/ilk cihaz onayı ve bilateral peer verification gerekir. QR pairing ana akışta zorunlu değildir.
- LAN dosya payload'ı yereldir; backend/internete sessiz fallback yok. Dışarıdan PC erişimi hedeflenir, real remote routing/adoption gate'i açık. PC offline/uykudaysa ve cloud file store yoksa iş telefonda bekler; completion uydurulmaz.
- Cellular backup **default-off**, explicit opt-in gerekir. İlk büyük backup için LAN/Wi-Fi güçlü öneri, zorunlu değil. Live OS fırsatına bağlıdır, kesintisiz realtime garanti değildir.
- Eski Keenetic/WebDAV/DDNS kurulumunda hostname/port/credential kullanıcı config/env'dir; koda/repoya gömülmez. Kullanıcının ~8000 FolderSync dosyası test/overwrite hedefi değildir.

## 3. Bağlantı mimarisi ve kapsam ayrımı
- Advanced WebDAV için orijinal direct public-IP veya CGNAT'ta E2EE HTTP(S) relay yönü korunur; relay byte taşır, dosya saklamaz. WAN/public-IP karşılaştırması ilk WebDAV slice'ın erişim/yazma probe'u değildir; probe external connectivity/CGNAT garantisi vermez.
- Advanced relay yolunda WebDAV; SMB/FTP/raw TCP backup protokolleri LAN-only. UI doğru erişilebilirlik gösterir; çalışmayan protokol etkin görünmez. Relay redundancy gereksinimi korunur.
- PC peer kanalında LAN HTTPS + remote WebRTC/ICE/STUN/TURN **araştırma adayı** tutuldu; Cloudflare Tunnel tarihsel tercih, daha sonra remote seçimi yeniden açıldı. Tunnel/TURN aynı ürün değil; hosting/provider/production transport adoption veya WebRTC-only background garantisi seçilmedi.
- Certificate-bound capability + fresh full aynı-device-key TLS1.3 yönü [ADR0004](../docs/decisions/0004-certificate-bound-capability-and-authority-responsibilities.md) ile kabul; **platform/TLS/device-key production gate açık**. PC↔phone E2EE backend'de terminate edilmez. TLS/probe/Matrix trust file authority değildir.

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
- [ADR0007](../docs/decisions/0007-matrix-verification-and-device-continuity.md): Matrix standart SAS **verification-only**, Kloda authority; cross-signing/SSSS/SecretsBundle file grant/recovery değil. Aynı device key, OS-protected **software** model, per-run biometric/userPresence yok; hardware non-exportability iddiası yok.
- Nest central eligibility/issuance/revoke control; PC local scope/admission/file/durable fence enforcement kabul edildi. Supabase provider yönü seçili, gerçek enrollment/backend integration yok.
- Server signer **ES256 provisional**: runtime **ve gerçek KMS feasibility** gelmeden final değil. Server signer ikinci endpoint possession key değildir. SDK byte-sign patch üretim adoption/sustainability gate'ini kapatmaz.
- Aynı-scope verified LAN offline yalnız center unreachable ve trusted elapsed upper **<24h** + valid token + install continuity; request-start t0, explicit/local deny üstün. Epoch kaybı/restore şüphesinde online PC onayı+SAS+grant; journal authority değildir. Policy runtime implementation'ı kanıtlanmadı.
## 7. Kod kalitesi kuralları (bağlayıcı)
Uzun ve dağınık ("AI slop") dosyalar istenmiyor.
- ESLint `max-lines` kuralı; ihlalde **CI fail**.
- FSD sınır denetimi (steiger veya eslint-plugin-boundaries); ihlalde CI fail.
- Backend'de bir use-case = bir dosya. Katmanlar arası bağımlılık yönü: interface → application → domain; infrastructure, domain'deki port'ları uygular.
- Bu kurallar kod yazılmadan **önce** kurulur.

## 8. Çalışma şekli (Codex için)
- Tek araç Codex olduğu için implementer ve reviewer rolleri **ayrı geçişlerde** yapılır: önce uygula, sonra ayrı bir review geçişinde diff'i bölüm 3, 6 ve 7'deki kurallara karşı denetle. Kendi yazdığın kodu aynı geçişte onaylama.
- Her görevde küçük, gözden geçirilebilir değişiklikler yap; lint ve testler geçmeden bitmiş sayma.
- **Bölüm 9'daki açık konularda varsayımla ilerleme.** O konulara dokunan bir iş çıkarsa dur, seçenekleri ve önerini kısa bir notla Ayhan'a sun, onay bekle. Onaylanan kararı `docs/decisions/` altında kısa bir kayıt olarak yaz.
- Mimari kararları (katman yapısı, protokol seçimi, relay modeli) tek başına değiştirme; değişiklik gerekiyorsa öner.
- Gizli bilgi (hostname, port, kimlik bilgisi) koda ve repoya girmez.

## 9. Açık production gate'ler ve henüz seçilmemiş kararlar
- Tam file/media E2EE envelope/key lifecycle, authenticated manifest ve native real-peer/session binding uygulaması; capability/mTLS yönü kabul edilmiş olsa da runtime proof açık.
- Remote routing/relay/provider/hosting/custody/trusted issuer bootstrap+rotation; Cloudflare candidate/preference adoption proof değil.
- ES256 runtime+gerçek KMS, patch sustainability ve Android/iOS/Electron same-key TLS/device compatibility.
- Gerçek Supabase account↔Matrix/device enrollment, operation step-up, PC scope approval, recovery/revocation integration ve production API/schema.
- **Mobile:** React Native+Expo development build; **Desktop:** Electron. iOS16.4+/Android7/API24 destek hedefi ve ortak native crypto yönü seçildi; release/toolchain minimum compatibility, exact native APIs ve fiziksel eski/current cihaz kanıtı açık ([ADR0001](../docs/decisions/0001-mobile-sync-behavior-and-framework-constraints.md)). APK/deployment target product support proof değildir.
- Trusted token-time + elapsed upper continuity, cert persistence/renewal/reissue, native key/epoch backup/restore exclusion; software full rollback detection garanti değil.
- Scope-safe file-open/symlink/mount/durable revoke–publication fence ve authenticated reconcile; media/product conflict/restore acceptance.
- Galeri/thumbnail/arama ve AWS premium kapsamı açık. FolderSync hash yöntemi veya backend control rolü artık “hiç seçilmedi” diye sunulmaz; bunların uygulama gate'i açıktır.

**physical-device validation required** ve inconclusive ayrımı: [production gate kaydı](../docs/security/production-gates.md). Physical Android transport14pass/direct1inconclusive ve iOS URLSession simulator inconclusive, native simulator TLS pass'leriyle karıştırılmaz.

## 10. Kalıcı durum ve sonraki gate
- Monorepo/lint/FSD ve ilk WebDAV temeli var; ilk slice ve PC-first ürün tamamlanmadı. [First-slice status](../docs/implementation/first-vertical-slice-status.md) implemented ile required işleri ayırır.
- [Session coverage index](../docs/implementation/session-documentation-index.md) bütün önemli karar/kanıtların kalıcı karşılığıdır; geçici konuşma veya /tmp tek source of truth olamaz.
- [İzole issuance/admission feasibility planı](../docs/implementation/issuance-admission-feasibility-plan.md) hazır; **execution ayrıca onay bekliyor**. Dört mimari yönün onayı experiment/product code/cloud/KMS kurulumu veya production-ready onayı değildir.
