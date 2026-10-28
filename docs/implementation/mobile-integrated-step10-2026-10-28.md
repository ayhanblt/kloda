# Mobil liste10 — bütünleşik kontrol, 28 Ekim 2026

**Sonraki dar kapanış:** [Android açılış/görsel ve farklı-PID reopen doğrulandı](mobile-android-step10-followup-2026-10-28.md). Aşağıdaki unauthorized/BLOCKED, ilk koşunun tarihsel sonucudur; yeni dar PASS gerçek LAN/fiziksel kabul değildir.

Kaynak ve aşağıdaki otomatik/izole kapsam doğrulandı. Bu kayıt tüm mobil ürünün,
PC-LAN aktarımının veya fiziksel kabulün tamamlandığı anlamına gelmez. Liste11
başlatılmadı; önceki adımların PASS kayıtları yeni test olarak sayılmadı.

## Tamamlanan dar düzeltmeler

- WebDAV mutation öncesinde mevcut tek SecureStore profiline `probeWarning=true`
  yazılır ve geri okunur. Kesinti/reopen sonrası belirsizlik görünür kalır.
  Yeni başarılı probe eski belirsiz probe uyarısını temizlemez. Eski v1 kayıtlar
  rewrite olmadan okunur; yeni günlük, otomatik remote cleanup/adoption eklenmedi.
- NativeWind'in mevcut bağımlılığı için eksik Babel yapılandırması bağlandı.
  PairingButton native pressed stilini koruyan `cssInterop=false` kullanır.
  Kaynak/WebDAV ekranında safe-area, görünür alan etiketleri ve iOS klavye
  insets düzeltildi. Tam metin/font scaling ve48px dokunma alanı korunur.
- Büyük yazıda veya kısa pencerede Activity header/kontrolleri aynı ScrollView
  içine alınır; normal boyutta mevcut sabit yapı sürer. Callback/disabled ve
  native job/hook ömrü değişmez. Doğrulandı yazısının kontrastı düzeltildi.
- iOS Cocoa/POSIX ve Android SQLite/errno typed disk-full/quota hataları mevcut
  hata yollarına bağlandı. Photos preflight intent korunur; belirsiz PhotoKit
  sonucu otomatik retry/başarıya çevrilmez. Genel provider hatası tahminle alan
  dolu sayılmaz. Gerçek disk doldurulmadı.

## Bu grupta gerçekten çalıştırılan kontroller

| Kontrol | Sonuç ve sınır |
| --- | --- |
| Ortak Jest |108 test /11 suite PASS; intent/reopen/compatibility,48px/etiket/kontrast ve gerçek Dimensions değişim dalları dahil |
| TypeScript / root lint / iki JS export | exit0; [komut/süre](evidence/mobile-integrated-2026-10-28/checks-accepted.json) |
| Tam ad-hoc iOS Simulator app build | exit0; native depolama düzeltmeleri derlendi; sonraki JS düzeltmeleri Metro'da çalıştı |
| Android main+androidTest Kotlin | offline derleme exit0; typed storage testleri SDK'ya derlendi |
| Android modül K1 lint | exit0,0error/34warning; full-project veya warning-free iddiası yok |
| Typed storage helper | Swift host+Simulator runtime PASS; Kotlin production helper/type-double runtime PASS; fiziksel ENOSPC değil |
| iOS native UI | TR/EN/DE Computer; kaynak→PC→gelişmiş WebDAV, Activity ACK/unknown; fontScale2.643,852×393 yatay ve software keyboard gözlemleri |
| Host görsel | TR/EN/DE ×320/768,6 kombinasyon; yatay taşma yok,48px düğmeler. DOM/font yaklaşımı; native kanıt yerine geçmez |
|256MiB snapshot örneği | Simulator production staging/hash/open PASS;64KiB parçalar,296.863ms yazma+hash,173.815ms yeniden hash,0.167ms okumadan iptal |
| Ayrı kaynak/güvenlik review | Engelleyici bulgu yok; testleri reviewer yeniden çalıştırmadı |

Snapshot sayıları tek host-backed Simulator örneğidir; provider kaynak kopyası,
iCloud, PhotoKit, ağ, pil, gerçek telefon veya alıcı koruma kopyası ölçümü değildir.
Logical256MiB ve raporlanan524288×512byte blok; APFS fiziksel tüketimi genellenmez.
Rust/ABI değişmediği için bu grupta Rust/Clippy/dörtABI yeniden çalıştırılmadı.

## Görsel ve erişilebilirlik kanıtı

[Seçilmiş ekranlar ve JSON](evidence/mobile-integrated-2026-10-28/README.md).
Mevcut Stitch renk/kart/hiyerarşi/gezinme diliyle karşılaştırıldı. Sistem fontu
kullanılıyor; birebir Inter/font veya release piksel eşitliği iddiası yok. Debug
araç simgesi ekranda görülebilir. Fixture PC/iş cevapları sentetiktir ve TEST ONLY
olarak işaretlidir; hazır native alıcı, canlı QR/ACL veya gerçek transfer kanıtı
değildir. `READY` yalnız fixture sahnesinin yüklendiğini söyler.

Gerçek Simulator'da büyük DE yazısında dört scroll hareketiyle alt kontrolün tam
metnine ulaşıldı. Klavyede secure password alanı, Test düğmesi ve kalıcı uyarı
kaydırılarak erişilebilir; boş parola validasyonu uzaktan mutation başlatmaz.
AX etiket/heading/secure-field gözlemi yapıldı; VoiceOver/TalkBack tam kabulü yok.

Başlangıçta notch üstüne çıkan kaynak içeriği, stilsiz NativeWind, büyük yazıda
ulaşılamayan Activity gövdesi ve klavye örtüşmesi görüldü; düzeltme sonrası ayrı
kayıtlar var. `computer-de-normal.png` ara görüntüsü eksik kart/düğme stiliyle
reddedildi; sebebi kesinleştirilmedi. `computer-de-final.png` odaklı yeniden
çekimde doğru. Tam geçiş/stres kabulü bundan çıkarılmaz. İlk async fixture entry
ve birkaç test-harness derleme/API hatası düzeltildi; bunlar PASS diye gizlenmedi.

## Gerçek açıklar / karar ve kabul sınırları

| Durum | İş ve kaynak kanıtı | Etki / sonraki kapı |
| --- | --- | --- |
| Gerçek risk; ölçüm eksik | `backup_retention_files.rs:131,161–170` senkron hash/kopya/sync; `runtime.rs:184`, `runtime_retention.rs:22` aynı owner actor | Desktop silme koruması alıcı yanıtlarını geciktirebilir. Native request30s/idle10s değişmedi. Normal finalize bu tam kopyayı yapmaz. Eşzamanlı receiver latency ölçümü yok; async/fence mimarisi onaysız değiştirilmedi |
| Gerçek alan sınırı | `IosFilesSnapshot.swift`, `IosPhotosImport.swift` | iOS orphan snapshot/extension kopyası için genel kapasite/retention cleanup politikası yok; kör tarama/silme eklenmedi. Photos stage+extension+verify app-private mantıksal üst tahmin ~3R, PhotoKit hedefi ayrıca; gerçek peak ölçülmedi |
| Uygulanmış sınır | Android own Files restore | Download offset0'dan yeniden başlar; upload/receiver resume yok sayılmadı |
| Performans açığı | iOS Photos completed/suppressed kaynak seçimi | Değişmemiş kaynak receipt yeniden kullanımından önce yerel export/hash maliyeti oluşabilir; otomatik yeniden upload anlamına gelmez |
| Ürün/entegrasyon açık | Mobil WebDAV | Ayar/probe gerçek; byte sender bağlı değil. Gerçek HTTPS sunucu ve eski belirsiz probe için güvenli remote reconciliation ayrı |
| Kabul açık | iPhone/PC LAN, Secure Enclave/lock, OS callback/reboot/force-quit, LivePhoto/RAW/edited/iCloud, eskiOS/16KB, büyük arşiv/pil | Sentetik fixture veya önceki dar fiziksel gruplar bunları kapatmaz; liste11 ayrı izinle |
| Kabul açık | VoiceOver/TalkBack ve release geçişleri | Seçilmiş etiket/kontrast/font/klavye gözlemi tam erişilebilirlik sertifikası değildir |
| Yönetim sınırı | Eski scope locator kayıp yedekler | Yedek byte'ları korunur; yönetilebilirlik otomatik kazanılmaz |
| Platform engelli | WindowsD3, macOS normal UI/release signing, Linux identity/storage | Ayrı Desktop kapıları; Ubuntu LTS/GNOME ve Kubuntu LTS/KDE gerçek kabul yok |
| Ayrı backlog | E2EE/key lifecycle, account/recovery, remote, two-way/conflict/versions, migration | Sessizce düşürülmedi; bu dilime eklenmedi |

## Android runtime kontrolünün kapanmayan kısmı

Debug APK assemble exit0 (23s); yeni API36 emülatörü mevcut ve özel5038 ADB
yollarında unauthorized kaldı. APK install/cold launch/UI screenshot NOT_RUN;
güvenlik kontrolü aşılmadı. [Derleme/engel/kapanış kanıtı](evidence/mobile-integrated-2026-10-28/android-runtime-blocked.json).
Yalnız owned emulator ve özelADB durduruldu;5590/5591/5038 kapalı; userdata
silinmedi. Liste10 Android UI runtime kabulü bu nedenle **BLOCKED** kalır.

## Android SDK yan etkisi

Yeni disposable emülatör hazırlanırken salt okunur amaçlı `avdmanager list device`
varsayılan SDK config'inde `devices.xml` parse/`.old` yedekleme mesajı üretti.
Sonraki salt okunur metadata gözleminde asıl dosya yok, `.old`2909byte ve XML
well-formed; [hash/mtime/belirsizlik](evidence/mobile-integrated-2026-10-28/sdk-config-incident.json).
Önceki dosya/hash/yedek varlığı bilinmediğinden overwrite/geçmiş içerik kaybı sonucu
çıkarılamaz. Geri yazma/reset/cleanup yapılmadı; kullanıcıya bildirildi. Sonraki
AVD/ADB işlemleri yalnız açık `/tmp` user/AVD/key/server ortamında yürütülür.
Kullanıcı arşivi veya Kloda authority etkisi gözlenmedi; SDK config olayı saklanmadı.

## Sıradaki adım

Liste11 için gerçek cihaz/normal PC receiver kabul planını açık kapılarla sun.
Öncesinde koruma kopyasıyla eşzamanlı receiver yanıt süresinin dar disposable
ölçümü önerilir; yeni actor/cleanup mimarisi ve timeout değişikliği bu grupta yok.
Genel fiziksel grup kendiliğinden başlatılmaz. Git mutation yapılmadı.
