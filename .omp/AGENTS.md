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
FolderSync'in yedekleme gücü ile Google Photos'un galeri deneyimini birleştiren fotoğraf yedekleme ve galeri uygulaması. Kullanıcı verisi **kullanıcının kendi depolamasında** (WebDAV / SMB / NAS) durur. Geliştiricinin işlettiği hiçbir sunucuda kullanıcı verisi tutulmaz. İleride opsiyonel, AWS tabanlı bir premium katman düşünülüyor.

## 2. Temel kullanım senaryosu
- Fotoğraflar her zaman kullanıcının **kendi evindeki NAS/harici depolamaya** yedeklenir.
- Ağ fark etmez: kendi wifi'ı, başkasının wifi'ı (yalnızca internet çıkışı olarak) veya mobil veri.
- Dışarıdayken de yedekleme eve dönmeyi beklemeden sürmelidir.
- Referans kurulum: Keenetic router, Keenetic DDNS, WebDAV portu dışarı açık, sabit IP yok. DDNS hostname'i ve port koda gömülmez; kullanıcı ayarı / env olarak tutulur, repoya commit edilmez.

## 3. Bağlantı mimarisi (karar verildi)
Kurulumda **bağlantı testi** çalışır: router'ın WAN IP'si ile dışarıdan görünen public IP karşılaştırılır.

1. **Doğrudan public IP varsa:** uygulama doğrudan WebDAV'e bağlanır.
2. **CGNAT tespit edilirse:** uçtan uca şifreli **HTTP(S) relay** üzerinden bağlanır (model: Keenetic KeenDNS "Cloud access" modu). Relay **veri saklamaz**, yalnızca byte taşır.

Kısıtlar:
- Relay yolunda yalnızca **WebDAV** desteklenir (HTTP/HTTPS tabanlı).
- SMB, FTP ve ham TCP protokolleri **yalnızca aynı LAN'da** kullanılır; relay'den geçemez.
- UI, seçilen protokolün uzaktan erişilebilirliğini doğru göstermelidir: WebDAV direct veya gerektiğinde HTTP(S) relay üzerinden; SMB yalnızca LAN'da.
- Relay servisi **tek nokta arızası olmamalı** (çoklu instance / redundant).

## 4. Onboarding akışı (kesinleşmiş hali)
"Depolama ekle" butonuyla **başlanmaz.**
1. Uygulama doğrudan ilk kurulum ekranına açılır.
2. Kullanıcı **senkronize edilecek klasörleri** seçer (ör. DCIM + Pictures ya da tüm dosyalar).
3. **Otomatik sync aralığını** seçer: 12 veya 24 saat.
4. Ardından depolama adresi ve kimlik bilgileri istenir (WebDAV/SMB/diğer).
5. Bağlantı testi (bölüm 3) çalışır.

Kullanıcı ayrıca istediği anda **Sync Now** ile manuel/instant sync başlatabilir. Bu, 12/24 saatlik otomatik sync seçeneğinin alternatifi değildir; ikisi birlikte desteklenir. "Live Sync" adı sürekli gerçek zamanlı senkronizasyon anlamına gelecek şekilde varsayılmaz.

AGENTS.md'deki storage/protokol gereksinimleri source of truth olarak kalır. Henüz kesinleşmemiş yeni protokoller veya davranışlar uydurulmaz.

## 5. Migrasyon gereksinimi
Kullanıcı şu an FolderSync kullanıyor ve yeni uygulamaya geçecek. FolderSync ile harici depolamaya kopyalanmış **~8000 fotoğraf** var. Yeni uygulama bunları **algılayıp tekrar yüklememelidir.** Tespit yöntemi henüz seçilmedi (bölüm 9).

## 6. Teknik yığın (karar verildi)
- **Backend:** NestJS (TypeScript). .NET / Django'ya geçilmez; sebep mobil ve desktop ile TypeScript tutarlılığı.
  - **Clean Architecture:** domain / application / infrastructure / interface katmanları.
  - **Dosya başına tek use-case.**
- **Frontend (mobil + desktop):** **FSD (Feature-Sliced Design)**.

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

## 9. Açık konular (karar yok — sor, uydurma)
- Uçtan uca şifreleme şeması ve anahtar yönetimi
- Relay servisinin teknolojisi ve barındırılacağı yer
- **Mobile:** React Native + Expo development build. **Desktop:** Electron.
  - Seçim, ayrıntılı sync davranışları, eski iOS/Android desteği ve iOS Files/Photos kaynak seçimi [ADR 0001](../docs/decisions/0001-mobile-sync-behavior-and-framework-constraints.md) içinde kayıtlıdır. Minimum OS sürümleri ve gerekli native API/paket seçimi henüz belirlenmedi.
- Backend'in tam rolü (kullanıcı verisi tutmadığına göre: relay, hesap/premium yönetimi, koordinasyon?)
- FolderSync migrasyonunda "zaten yedeklenmiş" tespiti (ad/boyut/tarih mi, hash mi)
- Galeri modunun kapsamı (thumbnail üretimi nerede, albüm/arama var mı)
- AWS premium katmanının içeriği

## 10. Önerilen başlangıç sırası
1. Monorepo iskeleti: `apps/mobile`, `apps/desktop`, `apps/api` (NestJS).
2. Lint/CI kuralları (max-lines, FSD boundaries) — kod yazmadan önce.
3. İlk dikey dilim: onboarding akışı → WebDAV bağlantısı → tek klasör sync.
4. Migrasyon ve relay: bu dilimden sonra, her biri için ayrı tasarım turu (Ayhan onayıyla).

