# Android geçişi — kaynak değerlendirmesi, 23 Ekim 2026

Kullanıcı Windows D3 devam ederken mobil çalışmanın paralel başlamasını istedi.
Bu kayıt salt okunur kaynak/kanıt değerlendirmesi ve ilk geliştirme önerisidir;
Android implementasyonu, yeni test/build/emulator/cihaz/probe çalıştırılması değildir.
İnceleme tabanı34dcbb8. Windows D3 fresh-bootstrap/intent-activation writer/canlı
geçiş Windows oturumunda açık kalır; burada tamamlanmış sayılmaz. iOS'a geçilmez.

## Uygulanmış temel ve gerçek açıklar

| Alan | Kaynak/kanıt | Durum ve kullanıcı etkisi |
| --- | --- | --- |
| Kalıcı Files işi, native ACK/offset ve snapshot | `AndroidSyncJournal.kt:16-64,164-207`; `AndroidFilesQueue.kt:234-282` | Uygulanmış. İş kimliği/hedef record/kaynak/hash/operation/offset kalıcıdır; Completed yalnız doğrulanmış native sonuçla oluşur. Bu journal/resume yeniden geliştirilmez. |
| QR ve ayrı dosya yetkisi; Files/Photos aktarım ve restore | `KlodaPairingModule.kt:46-76,193-218`; `AndroidPhotoManifestPublisher.kt`; ADR0016/17 | Kaynak uygulanmış. Önceki API36/host/build kanıtları handoff2026-10-13/14 kapsamındadır, bugün yeniden çalıştırılmadı. Gerçek Android-PC kabulü açık. |
| Arka plan çalışma | `KlodaPairingModule.kt:39-50,244-248`; `AndroidFilesQueue.kt:18-41,73`; `use-file-transfer.ts:44-58` | Gerçek eksik. Activity arka plana girince veya Activity görünümü kaldırılınca kuyruk pause olur; çalışan owner/iş ömrü Activity/Expo modülüne bağlıdır. Mevcut davranışı tek bir foreground kontrolünü kaldırarak değiştirmek yeterli değildir. |
| Programlı/Live yürütme | `KlodaSyncRuntimeModule.kt:114-119,143-149`; `App.tsx:35-36,62-67,175-180`; native manifest/build dosyaları | Gerçek eksik.12/24+saat yalnız preference kaydıdır; production kaynaklarda buna bağlı Android OS worker/service/alarm yürütücüsü yok. ADR0005 Live default'u UI/native schedule modelinde yok. |
| Kalıcı retry ve çalışma sonucu | `AndroidFilesQueue.kt:33-40,274-282`; `AndroidSyncJournal.kt:49-64,185-207`; `packages/sync-core/src/retry.ts` | Gerçek eksik. Dosya durumları kalıcı; run/attempt bütçesi, başarısızlık zamanı ve next-retry zamanı native journal'a bağlı değil. Geçici hatada pause+çıkış var. Shared5/60s ve5/5min yardımcıları mobile native kuyruğu yönetmiyor. |
| Desktop silme/suppression ve açık rebackup | `AndroidSyncJournal.kt:137-153,172-175`; `AndroidFilesQueue.kt:104-150,189-222`; ADR0019 | Kaynak uygulanmış. owner_deleted otomatik retry değildir; explicit rebackup ayrı immutable işe bağlıdır.20 Ekim mobile32 test/Kotlin derleme/host SQL kanıtı tarihsel; Android cihaz/emulator instrumentation bu değişiklik için NOT_RUN. Retry bu korumayı aşamaz. |
| Ayar ve kaynak ilişkisi | `AndroidFilesQueue.kt:75-90,153-164`; `KlodaSyncRuntimeModule.kt:89-111,143-149` | Kaynak kaldırma ve byte/source değişim fences var. Çalışma genelinde kaynak seçimi/program revision'ı ve yeni schedule fırsatı için kalıcı run bağlamı yok; scheduling diliminde ele alınmalı. |
| Gelişmiş WebDAV kaydı | `App.tsx:113-128`; `KlodaSyncRuntimeModule.kt:122-140` | Ayrı açık. Credential ve config çağrıları ayrı; Desktop'ta kapanan atomiklik mobile için varsayılmaz. PC-first native sender başarısı veya ilk Android dilimi değildir. |
| Kullanıcı akışı ve görsel kabul | `App.tsx:45-46,62-67,145-180` | QR/Activity erişilebilir; setup hâlâ source→schedule→WebDAV storage düzeninde. Tutarlı PC-first/Stitch uyarlaması ayrı görünür iştir; mevcut ekranlar sessizce tamamlandı sayılmaz. |
| Uyumluluk ve kabul | ADR0001; `my-module/android/build.gradle:13`; app Gradle root minimumuna bağlı | API24 hedef/minSdk ayarı gerçek eski-cihaz/runtime desteği kanıtı değildir. Önceki API36 sonucu tüm sürümlere yayılmaz; gerçek LAN, izin/lock/background/OS davranışları açık. |

## İlk önerilen en küçük geliştirme dilimi

**Mevcut Android journal ve manuel native kuyruğa kalıcı çalışma/erişim-retry
bağlamı eklemek.** Yeni genel kuyruk/scheduler veya ikinci aktarım günlüğü yok.
Mevcut journal dosya ilerlemesini tutar ancak attempt/due/budget/run sahipliği
alanları olmadığı için tek başına kalıcı retry sözleşmesini sağlayamaz.

- Mevcut iş kimliği, operation/offset/snapshot, kaynak seçimi ve exact peer record
  korunur. Yeniden açılış yeni kopya veya resetlenmiş retry bütçesi üretmez.
- Geçici erişim hatasında ilk dahil5 deneme; gerçek başarısızlık sonucundan60s
  sonra tekrar. ADR0001 ve ADR0005'in iki ayrı bütçesi korunur; OS5min/5 girişim
  bütçesi bu ilk dilimde OS yürütücüsü varmış gibi tüketilmez veya erişimle birleşmez.
- Revoked/denied/source değişimi ve owner_deleted erişim retry'sine girmez.
  Belirsiz create/finalize sonucu mevcut operation/status uzlaştırmasıyla devam
  eder; yeni operation veya tamamlandı varsayımıyla aşılmaz.
- Aynı run için ikinci worker başlamaz. Manuel pause/background durması erişim
  hatası değildir. Bu dilim uygulamaya arka plan transferi eklemez; erken UI/native
  foreground fence kaldırılmaz.
- Otomatik/sentetik doğrulama: sayaç/due sınırları, clock ve süreç yeniden açılma
  durumu, duplicate-run reddi, kaynak/peer bağlamı, suppression ve explicit rebackup
  ayrımı. İlgili mobile/Kotlin/native kontrolleri ve ayrı review. Gerçek cihaz veya
  yeni emulator/runtime kabulü ayrıca kapsamlandırılır; çalıştırılmamışa PASS yok.

Bu dilim yeni ürün politikası seçmez; mevcut ADR0001/0005/0016/0017/0019 kararlarını
uygular. Kullanıcının geliştirme öncesi plan/onay düzeni korunur; ilk dilim henüz
başlatılmadı. Depolanan güncel işi/anahtarı veya kullanıcı arşivini test etmez.

## Sonraki sıra ve görünür açıklar

1. Kalıcı run/retry ve kaynak/program değişikliği bağlamını dar dilimlerle bitir.
2. Native owner/worker ömrünü Activity'den ayıran Android background yaklaşımını,
   güncel Android OS/API/SDK kısıtları ve sessiz ilerleme/hata bildirimi gereksinimiyle
   karşılaştır. Yeni service/worker/dependency seçimi gerekiyorsa gerekçeyle sun;
   WorkManager/foreground service veya kesin saat garantisini varsayımla seçme.
   Yeni QR/cihaz onayı/izin/restore foreground eylemleri ayrı güvenlik sınırında kalır.
3. Live ve12/24+saat programını, iki retry bütçesini ve network/cellular default-off
   politikasını seçilen yürütücüye bağla; OS ertelemesini gerçek hata/başarı sayma.
4. PC-first/Stitch akışı, mobile WebDAV atomik ayar kaydı, ADR0019 Android runtime
   kabulü, eski/güncel Android uyumluluğu ve bütün akış otomasyonu/görsel/erişilebilirlik
   açıklarını kapat veya somut platform engeli olarak raporla.
5. Android sonrası iOS native pairing/Files/Photos/import/restore/background planı;
   kullanıcı açık izni olmadan toplu fiziksel kabul başlatılmaz.

Medya E2EE/key lifecycle, account/recovery, remote routing/authorization,
Files two-way/conflict/versions ve migration geniş ürün açıkları sürer; bu Android
ilk dilimine eklenmediği için tamamlanmış/kapsamdan düşmüş sayılmaz.
