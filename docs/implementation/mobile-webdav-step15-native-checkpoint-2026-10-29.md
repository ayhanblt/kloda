> 30 Ekim2026 son doğrulama: onaylanan ayrı iOS restore-kopyası testi PASS; gerçek PhotoKit/native Vault/HTTPS/yerel Completed receipt ile yeni asset/album, byte/ad/MIME/favori/album, otomatik hedef kapalıyken açık restore ve aynı süreçte DB reopen/tekrar kopya oluşmaması doğrulandı. Yalnız güncel kaydedilmiş restore asset/album cleanup doğrulandı; sentetik kaynak PNG ve ilk başarısız fixture kopyası review için retained. Android SAF/Photos SDK kanıtları, mobil163test/TS/ESLint9 ve gerçek iOS app build PASS. 15 kaynak/otomatik/izole kapsamı uygulandı; ürün picker/Expo UI, iOS gerçek BG delivery, signing ve12/13/20/21 kabul kapıları açık. [Kanıt](evidence/webdav-native-step15-2026-10-29/manifest.json). Aşağıdaki girişler tarihsel checkpointtir.

> 30 Ekim2026 son durum: Files ve Photos WebDAV restore/catalog/API/UI iki platformda bağlı. Android owned gerçek SAF provider restore ve sentetik MediaStore Photos restore/metadata/retry/unknown-create/context/target-library kontrolleri PASS. iOS actual native-core HTTPS→typed restore/local publication ve ortak medya kontrolü PASS; onaylı tek Simulator Keychain grubu ile gerçek PhotoKit kaynak/metadata-only/açık review daha önce PASS. iOS gerçek Photos import için ayrı restore-kopyası onayı bekliyor; çalıştırılmadı. Mobil22 suite/163test, TS/ESLint9 ve iOS host journal PASS; son ortak helper dahil gerçek Expo iOS arm64 Simulator app build PASS. 15 tamamlanmadı;12/13/21 kapıları korunur. [Güncel kanıt](evidence/webdav-native-step15-2026-10-29/manifest.json). Aşağıdaki eski checkpoint girişleri tarihseldir.

> 30 Ekim2026 güncel: ADR0025 A ve dar owned Photos/Keychain test deneyleri onaylandı. Açık tek-isteklik review yetkisi/native API/UI uygulandı; eski header/ACK değişmez. Files restore/catalog/UI iki platformda kaynak olarak bağlı; iOS host typed restore/fresh-process ve gerçek HTTPS download→local publication component PASS. Mobil tam158 + son lifecycle4, TS/ESLint9 PASS. iOS app build PASS (son cancel-before-admission patch sonrası tekrar gerekecek). Android yeni Files domain build/runtime son grubu sürüyor. Photos restore henüz uygulanmadı. Owned PhotoKit+vault runtime: -34018; onaylı tek keychain grubu Simulator launch reddi, BLOCKED; daha geniş entitlement/fallback yok. 15 tamamlanmadı;12/13/21 kapıları korunur. [Kanıt manifesti](evidence/webdav-native-step15-2026-10-29/manifest.json). Eski “onay bekliyor” girişleri tarihsel.

# Mobil WebDAV15 — güncel ara checkpoint /29 Ekim2026

## 30 Ekim2026 — restore ve son doğrulama kapsamı

Files/Photos catalog, native restore API ve Activity UI iki platformda bağlıdır.
Restore kaynağı yalnız bu cihazın aynı hedefteki yerel Completed receipt'idir;
uzak keşif, hash eşitliğinden sahiplenme veya PC operation ID taklidi yoktur.
Native kayıt/Photos import tabloları PC'den ayrıdır; ortak yardımcılar yalnız
SDK medya metadata/byte kontrolünü ve mevcut güvenli yerel publisher'ı paylaşır.

- Android gerçek SAF test provider/persisted grant: kaynak→HTTPS→ayrı yeni hedef,
  byte doğrulaması, kaynak grant bırakıldıktan sonra restore, tekrar aynı URI PASS.
  Gerçek sistem picker/Expo UI yerine owned SDK provider fixture'ı kullanıldı.
- Android yalnız onaylı emulator-5584/KlodaWebDavStep15 ve com.kloda.sync.test:
  yeni sentetik PNG/favori-only sidecar→yeni MediaStore hedef URI, byte/favori/klasör,
  aynı süreçte DB yeniden açma/tekrar kopya olmaması, unknown-create, context ve
  target-library fence PASS. Yalnız testin yeni kaydettiği URI'ler temizlendi.
  Taze süreç SDK import, eski API ve fiziksel cihaz sınanmadı.
- iOS onaylı exact Simulator Keychain grubu doğru XML+DER Simulator bölümlerinde;
  host signature unentitled. Gerçek PhotoKit source/native vault/metadata-only
  yedek ve explicit current-context review PASS (önceki sourceHash422d…bb9).
  BG handler kayıt edildi, kendi global Pause kalıcı; BG delivery kanıtı değildir.
- Güncel iOS actual core sourceHashde24917b…0ae3: HTTPS, typed restore/private
  publication ve ortak PC/DAV medya sınır testleri PASS. Bu koşuda PhotoKit yazma
  yapılmadı. Gerçek Photos import/restore-copy ayrı dar onay bekliyor, NOT_RUN.
- Tam mobil22 suite/163test, TypeScript, repo ESLint9; iOS host SQLite/fresh-process
  typed restore ve gerçek Expo arm64 Simulator app build PASS. Android güncel
  native/test APK build PASS. Kanıtlar manifestte hash'leriyle tutuldu.

Ayrı ana-ajan review geçişi yapıldı; bağımsız ajan review'u değildir. Final commit
current-context/cancel fence'i, known ACK/Completed receipt ayrımı, kayıp create
sonucunda kör kopya yaratmama ve PC sözleşmelerinden ayrım kontrol edildi.
15 tamamlanmadı: pending iOS restore-copy kararı, gerçek ürün picker/Expo UI,
iOS gerçek OS delivery ve ilgili platform/signing/12–13 görsel-a11y kapıları açık.
Fiziksel kabul yalnız21. adımda ayrı açık izinle. 16'ya atlanmadı.

**15 tamamlanmadı.** ADR0023 bağımsız açık opt-in ve ADR0024 ayrı DAV Photos
sidecar sözleşmesi bağlayıcı. 12/13 görsel/a11y/landscape ve fiziksel/platform
kapıları korunuyor. 16’ya atlanmayacak; checkpoint'te keyfi durma gerekçesi yok.

## Bağlanan dilim

- Ayrı device-local FULL/WAL DAV store, private backup snapshot ve native credential
  vault (ThisDeviceOnly Keychain / ayrı AES-GCM Keystore+noBackup AtomicFile).
  PC trust/grant/sidecar ve kişisel anahtar/pin/epoch değiştirilmedi.
- Gerçek native Files/Photos üreticileri ve HTTPS PUT201→durable uploaded→moving→
  MOVE201→durable moved→tam GET hash/size+source/context fence→Completed.
  Kayıp yanıt/hash eşitliği sahiplik değil. Eski generation pending işi otomatik
  re-authorize edilmez. ACK ve snapshot retained; skip Completed değil.
- Typed target/run/history ve bağımsız erişim5/60sn, OS5/300sn bütçeleri. Güncel
  öğe toplamı son revizyonu sayar; tüm operasyonlar ayrıca retained.
- `KlodaBackup` Expo API, native UI owner/lifecycle, protected-data ve gerçek
  native BGProcessingTask/JobService kanalları. Mevcut OS/date/clock mekanizmaları
  DAV'a ayrı typed dispatch ile bağlandı; sahte PC kaydı veya JS OS lease'i yok.
- PC açık hedef seçimi artık otomatik dispatch kapısında. Genel “Şimdi yedekle”
  hedefleri ayrı Promise akışlarıyla başlatır; PC seçili değilse pairing yoluna
  girmez. PC beklerken DAV başlar; sonuç/hata ayrıdır. Global Pause kalıcı,
  hedef opt-out yalnız kendi generation'ını değiştirir. Source/program değişimi
  DAV safe-stop'a bağlı; hedef kapat/aç eski pending bağlamı canlandırmaz.
- WebDAV sayfasında testli kayıtlı profili ayrı etkinleştirme, disable, tek çalışma
  pause/run ve gerçek sonuç/counts; Computer sayfasında PC opt-in; Activity'de
  ayrı PC/DAV durumları, TR/EN/DE. Profil kaydı native hedefi durdurur, opt-in yapmaz.
- Review native/API/UI: immutable header dışında scoped/retained yayın alias tablosu,
  recheck/keep-both/skip ve aynı intent'e eşzamanlı müdahale engeli. Bilinen PUTACK
  temp + no-overwrite MOVE; yabancı orijinal korunur. Photos sidecar actual alias
  yolu kullanır; receipt ayrıca cihaz/asset/role/kind kimliğini eşleştirir.
  Gerçek seçili SAF/PhotoKit kaynağı kimlik/byte ve Photos metadata doğrulayıcısı
  eklendi; yalnız aynı current binding recheck/keep-both yapar. Native foreground
  ve request nonce fence; Activity listeleme/sayfalama/eylemler TR/EN/DE.
  Keep-both adı UTC+content revision+collision suffix içerir. Eski listeleme veya
  eylem sonucu away/back sonrası yeni UI isteğini engellemez/üzerine yazmaz.

## Kanıt

- iOS host SQLite/policy/strict codec/fresh-process reopen + keep-both/alias/guard
  PASS. HTTP closures mocked; SDK/source proof diye sunulmaz.
- Owned iOS26.5 Simulator'da actual native core + mevcut Rust bridge ile, PC tablo
  veya OS lease stub'ı olmadan gerçek URLSession/private snapshot/SQLite HTTPS
  PASS. Lost PUT/MOVE, strict hostname/auth, cookie/redirect,507/excess, alınmış ACK
  sonrası context ve truncated diagnostic-body ACK; keep-both orijinali korur.
  Sentetik private byte kaynağı; PhotoKit/Expo UI/BG delivery/fiziksel proof değil.
  Sonuç içinde kullanılan kaynak SHA256 izi var; kalıcı manifest ile eşleştirildi.
  Gereksiz özel fixture signing entitlement'ları Simulator spawn'ını reddetti;
  standart Simulator derleme yoluna dönülünce launch/HTTPS PASS. Ürün key/pin yok.
- Android API36 emulator-5584: native vault/journal, gerçek MediaStore/HTTPS/Photos
  metadata-only/native foreground queue daha önce PASS. Gerçek JobScheduler2704
  **zorlamasız** JobService callback'i verdi: Photos/HTTPS, PC session yok, durable
  sonraki plan ve global Pause PASS. Normal cadence/fiziksel/hardware proof değil.
  Bu OS runtime son review extension'ından önce; güncel alias/source-negative
  journal runtime yeniden PASS. Güncel code/test APK compile PASS.
- iOS app/native module/OS integration build PASS; yeni publication-path Swift
  kaynağı actual UIKit native-core derlemesinde PASS. Ana app pod kaynak listesi
  güncellendi, Review/SourceValidation dahil ana app native build PASS; son naming
  değişikliği ayrıca actual-core derlendi ve Simulator HTTPS PASS. Mobile20suite/
  154test tam koşu PASS; son pending-list düzeltmesinden sonra ilgili3UI test PASS.
  Son TS ve tam mobil ESLint9 PASS. `pnpm lint` global ESLint8 seçtiği için config
  bulamadı; repo node_modules ESLint9 ile düzeltilerek gerçek kontrol geçti.
- Tek ana ajan; ayrı review aynı ajanla, bağımsız review diye adlandırılmaz.

## Pending onay ve açık iş

Otomatik onay incelemesi `IosWebDavPhotosAppChecks.swift` önerisinin yazılmasını
reddetti: favori değiştirme ve albüm oluşturma/silme önceki salt-okunur Photos
kapsamını aşıyor. Komut uygulanmadı; bu dosya oluşturulmadı, Photos mutasyonu yok.
[Somut owned-Simulator test istisnası](webdav-photos-fixture-approval-2026-10-29.md)
kullanıcıya async soruldu; henüz yanıt yok, sessizlik onay değil. Bu sınırlama
başka yolla aşılmayacak. Salt-okunur/diğer işler devam eder.

Current source validator ve native UI/API bağlıdır. Positive SDK source-review
kanıtı henüz yoktur; synthetic bytes/negative source testi bunun yerine sayılmaz.
[Ayar değişimi sonrası açık inceleme kararı](webdav-explicit-review-context-decision-2026-10-29.md)
kullanıcıya soruldu: aynı-binding dışı toparlama yetkisi henüz onaylanmadı; eski
bağlam engeli korunuyor. Bu yeni yetki politikası varsayılmayacak.

Sıradaki: bu karara göre review recovery ve Completed kendi DAV yedeğinden Files/Photos restore (her kaynak yeniden hash/size,
no-overwrite ve import crash reconciliation); source/context negatifleri; iOS
OS/PhotoKit kanıt sınırlarını açık tutmak; app native build+ilgili regression,
ayrı aynı-ajan review ve kalıcı kanıt. Eski bağlamları kendiliğinden rebind/adopt
etme; yeni politika kararı gerekiyorsa varsayma. Native Photos mutation testi
onay gelene kadar çalıştırılmayacak; fiziksel cihaz adım21 yeni onayına bağlı.

## Emulator olayı — yanlış veri yolu /11:42:28 yerel saat

Android emulator ilk başlatmada `-datadir /tmp/kloda-step15/android-avd`
verilmesine rağmen var olan `Pixel_9_Pro` AVD veri dosyalarını kullandı.
İlk kurulum yetersiz alan nedeniyle başarısız oldu. Ana ajan bunu düzeltmek için
aynı komuta `-wipe-data -partition-size 4096 -read-only` ekledi; `-read-only`
base imajı wipe'dan korumadı. **Bu yetkilendirilmemiş/destrüktif bir hataydı.**
`/Users/ayhanblt/.android/avd/Pixel_9_Pro.avd/` altındaki
`userdata-qemu.img`, `encryptionkey.img` ve qcow2 dosyaları11:42:28'de yeniden
oluşturuldu (baseuserdata6356992byte; qcow2196704byte). Önceki AVD verileri
kaybolmuş olabilir. Emulator5588durduruldu; tekrar başlatma/restore yapılmadı.
Kullanıcıya olay ve risk açıklandı. Fiziksel cihazda işlem yapılmadı.
Bu AVD altında snapshots dizini gözlenmedi;
`tmutil listlocalsnapshots /System/Volumes/Data` boş döndü. Harici yedekler
araştırılmadı; kurtarılabilirlik doğrulanmış değil. Otomatik yeniden yaratma,
restore veya kişisel native key/pin/epoch reset deneme.

Kullanıcı daha sonra AVD verilerinin **disposable** olduğunu ve **kurtarma gerekmediğini** bildirdi. Kurtarma işi yoktur; bu yanıt gelecekte başka AVD/cihaz reset izni değildir. Runtime yalnız yeni ve açıkça izole bir AVD kimliği/veri yollarıyla devam edebilir.

Runtime denemesi bu olayla durduruldu. Test APK'ları kurulmadı; instrumentation
`Unable to find instrumentation info` döndü. Bunu test failure/PASS karışımı
veya Android12/13runtime kabulü olarak sunma.

[Kalıcı dar loglar/manifest](evidence/webdav-native-step15-2026-10-29/manifest.json).
Ham build logları `/tmp/kloda-step15/`; yeniden koşulabilir host aracı ve native
kontrol kaynakları repoda. Git add/commit/push/reset/clean/stash yapılmadı.
