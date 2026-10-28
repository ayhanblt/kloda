# Android liste3 — Live, program ve OS yürütmesi — 25 Ekim 2026

**Sonraki takip:** [lint kapanışı ve statik uyumluluk kanıtı](android-lint-and-compatibility-2026-10-25.md) ile explicit K1 tam lint ve dört ABI ELF16KB kontrolü PASS; aşağıdaki eski K2 BLOCKED kaydı tarihsel olarak korunur. Gerçek OS/cihaz kabulü ve kaynak tüketimi açıktır.

Durum: kaynak uygulaması ve aşağıdaki otomatik/host doğrulamaları tamamlandı.
Android lint araç hatası açık; gerçek OS/runtime kabulü liste4'te açık kalır.
Tam Android/platform kabulü veya tüm mobil ürünün tamamlanması değildir.

## Onaylı karar ve kullanıcı akışı

Kullanıcı25 Ekim'de “Duraklat”ın otomatik yedeklemeyi de kullanıcı “Devam” diyene
kadar durdurmasını onayladı. Bu flag kalıcıdır; açılış/boot/saat/kaynak değişimi
bunu kaldırmaz. Sync Now ayrı manuel eylemdir ve otomatik duruşu kaldırmaz.
Başarısız resume commit, SharedPreferences belleği değişmiş olsa bile process
barrier ile çalışmayı açmaz. Pause kaydı başarısızsa işler bu oturumda durdurulur;
yeniden açılışta otomatik başlama ihtimali açık hata metninde belirtilir. Diske
başarıyla kaydedilmemiş sonuç kalıcı başarı diye gösterilmez.

Yeni Android tercihinde Live varsayılan; eski açık12/24 tercihi korunur. Live ve
program aynı revision commit'iyle exact FilesRunContext'e bağlanır; eski mode
alanı olmayan kaydın canonical hash'i korunur. Explicit mode değişimi bağlamı
geçersiz kılar. iOS'ta olmayan API sunulmaz; iOS native/scheduling tamamlanmadı.

Live, seçili SAF/Photos kaynakları için OS content trigger ile fırsat ister.
Provider'ın bildirim garantisi yoktur; kaçan değişiklikler için Android'in minimum
periyodik iş aralığıyla kaba yeniden tarama fırsatı kullanılır. Bu sürekli tarama,
anlık çalışma veya kesin15dk uyanma garantisi değildir.12/24 seçilince content
olayı anında upload başlatmaz; yerel program beklenir. Sync Now programı kaydırmaz.
Kaynak ekleme/kaldırma, mode/program değişimi, açılış ve boot kayıtları uzlaştırır.

## OS yolu ve mevcut mekanizmalar

Yerleşik JobScheduler/JobService kullanılır; yeni dependency/WorkManager/genel
kuyruk eklenmedi. Kullanıcı başlatmalı uzun iş liste2 dataSync FGS'inde; otomatik
iş yalnız gerçek JobService yürütme lease'i varken aynı process owner/queue ile
çalışır. Background'dan FGS başlatılmaz; mayRun sabit true yapılmaz. Servis
BIND_JOB_SERVICE ile korunur. Başka uygulamaya yönetim/trust/delete yetkisi yoktur.

[JobInfo sözleşmesi](https://developer.android.com/reference/android/app/job/JobInfo)
ve [JobService](https://developer.android.com/reference/android/app/job/JobService)
incelendi. NETWORK_TYPE_ANY kullanılmaz: Android'in internet/validated koşulu
internetsiz LAN'ı engelleyebilir. Dispatch minimumLatency ile OS fırsatı ister;
gerçek native Wi-Fi/Ethernet/direct-route/no-VPN/TLS/pin/PC ACL/revoke kontrolü
her aktarımda kalır. Cellular/WAN opt-in çalışıyor izlenimi veren toggle eklenmedi.
İleri WebDAV/remote cellular seçimi liste9/ayrı transport kapsamındadır; LAN native
yolunun olmayan yeteneği tamamlandı sayılmaz.

Tek OS dispatch token'ı persisted preferences ile bağlanır. Eski callback/finally,
yeni token'ın işi veya zamanını değiştiremez. İçerik trigger ile ana iş ayrı
execution kayıtlarına sahiptir. Eski stop parametre nesnesi yeni token'ı durdurmaz.
UI/new target ile yarışta expectedBinding, kaynak snapshot/run oluşturmadan önce
aynı sourceLock içinde kontrol edilir. Eski iş yeni bağlamın fırsatını tüketmez.

Native Complete/repair=false/current record doğrulanmadan queue başlamaz. Job
trust resume/scan/approve çağırmaz. Pairing henüz bitmediyse Live sonraki OS
fırsatı korunur; tamamlanmamış pairing alıcı hazır/erişim izni değildir. İlk grant
PC'de ayrı kalır. Hardware provider'ın unlocked-device şartı gevşetilmedi; cihaz
kilidinde bağlantı/provider çalışırlığı henüz kabul edilmedi.

## Kalıcı sonuç ve iki retry bütçesi

Mevcut kloda-sync.sqlite schema6 yalnız scheduled_occurrence ve files_run_job
metadata ekler; transfer journal/ACK/operation/snapshot/owner_deleted ve access
retry kayıtları aynı kalır. İkinci transfer günlüğü veya dosya byte kopyası yoktur.

- files_run erişim bütçesi toplam5, gerçek hata sonrası60sn; değiştirilmedi.
- OS occurrence ayrı toplam5, kesinti sonrası hedef5dk. Saat aynı boot'ta elapsed
  üzerinden izlenir; wall saat yalnız gösterim/dispatch projeksiyonudur. Boot veya
  elapsed rollback'te tam bekleme yeniden kurulur; attempt sıfırlanmaz. OS'nin
  tam5dk içinde çalıştırması garanti değildir. Çalışan uzun iş çoğaltılmaz.
- Açık pause OS hatası sayılmaz; Continue aynı bütçeyi korur. OS stop ana thread'i
  join etmez; güvenli noktada pause istenir. In-flight native yanıt kaybolabilir;
  mevcut operation/status/ACK toparlanması kullanılır, tamamlandı uydurulmaz.
- Sadece exact linked terminal run/context/peer ve immutable üyelerin tamamlanmış,
  silinmemiş olması updated=1 kanıtıdır. Eski peer geçmişi, boş/bilinmeyen kapsam,
  blocked/pending veya OS'ye teslim edilmiş olmak başarı değildir. Dosya bazlı
  gerçek sonuçlar Activity'de ayrıca görünür. owner_deleted tekrar upload edilmez.
- Files runA bitip occurrence sonucu yazılmadan crash olursa, terminal linked A
  uzlaştırılır; immutable linke aykırı yeni B başlamaz. CAS attempt/phase/token
  eski callback'in yeni girişime sonuç yazmasını engeller.

Geçmiş fırsat TIME/TIMEZONE değişiminde kaybolmaz; catch-up aynı occurrence ile
kalır. Aynı boot elapsed due kanıtı wall rollback'te ilk claim'i de destekler.
Gelecekteki yerel hedef yeniden hesaplanır; manuel iş kesilmez, scheduled aktif
iş yeniden başlatılmaz. DST gap ilk geçerli an, overlap yalnız ilk occurrence
olarak sync-core davranışıyla hostta karşılaştırıldı.

## Görünüm ve bildirim

Activity ayrı access ve OS denemelerini/durumunu, beklemeyi, kalıcı otomatik
pause'u ve gerçek hatayı üç dilde gösterir. finished, bütün yedeklerin başarılı
olduğu mesajı değildir; updated0 olan bitmiş çalışma dosya sonuçlarını saklamaz.
Eski unavailable native state canlı ilerleme gibi sunulmaz.

Sessiz ongoing bildirim FGS/job çalışırken uygulamaya erişim verir; erişim bütçesi
bittiyse/müdahale gerekiyorsa ayrıntısı uygulamada olan hata bildirimi kullanılır.
Dosya adı, özel yol veya fingerprint bildirime konmaz. Açık Sync Now/Continue
notification izni isteyebilir; ret yedeklemeyi sahte hata yapmaz. Gerçek uygulama/
kanal bildirim engeli ayrı görünür. Android13+ izin yoksa FGS bildirimi shade'de
görünmeyebilir; [resmî sınır](https://developer.android.com/develop/ui/compose/notifications/notification-permission).
OS quota, Doze, force-stop, notification/channel ve üretici davranışı garantiye
çevrilmedi; ekran kilidinde key guard aynıdır.

## Doğrulama, review ve açık kapılar

[Seçilmiş kanıt ve hash'ler](evidence/android-schedule-2026-10-25/result.json).
Mobil64 test/8 suite, ESLint/TypeScript, iki JS export; Kotlin ana+instrumentation
compile/dört ABI native build; gerçek Kotlin worker/context/policy host; production
SQL/model8 ve eski SQL2; gerçek service/runtime4, Scheduler/Job10 host grubu
PASS. Job host Android/SQLite/native doubles kullanır; Android OS değildir.
SQL ayrı disposable child process reopen içerir; gerçek Android process kill,
JobScheduler reboot/Doze veya elektrik kesintisi kabulü değildir.

Android lint offline eksik mevcut Expo test cache'iyle başlamadı. Online çözümleme
sonrası ve ayrı modül analiz girişiminde react-native-worklets:lintAnalyzeDebug,
“Cannot find a KaModule for the VirtualFile” araç hatasında durdu. Android lint
**BLOCKED/FAIL**, PASS değildir. Kontrol kapatılmadı; dependency/model/effort veya
policy değiştirilmedi. İlgili Rust5 test/host clippy/scoped fmt PASS; crate-wide
fmt mevcut ilgisiz Windows/initialization biçim farklarında FAIL olarak korunur.
Android derlemesinde mevcut native dead-code ve eski API notification constructor
uyarıları vardır; host clippy, Android clippy yerine sunulmaz.

Bağımsız Sol review servis/epoch/token, offline LAN, clock/catch-up, immutable
linked-result recovery ve manual-clock sınırlarını kontrol etti. Bulunan açıklar
host regresyonlarıyla giderildi; son kaynak geçişinde yeni blocker yok. Reviewer
runtime çalıştırmadı. Son gate: Android lint toolchain hatasının giderilmesi ve
liste4 gerçek Android runtime/uyumluluk kabulü. Fiziksel duraklatma kaldırılmadı;
yeni cihaz/emulator/probe, kullanıcı arşivi/key/pin/authority veya Git mutation yok.

Kaynak tüketimi sınırı: Live'ın provider bildirimi olmayan durumdaki kaba taraması
seçili arşivi yeniden okuyabilir; files_run_job üyeliği dosya×çalışma başına metadata
tutar ve bu dilimde silme/retention politikası eklenmedi. Büyük arşivde IO/pil ve
kalıcı kayıt büyümesi ölçülmedi; yayın öncesi optimizasyon/retention değerlendirmesi
liste4/10 kabulünde açık ve gerekli iştir. Host correctness PASS bunu kapatmaz.

Liste4'te açık: API24+güncel OS, gerçek SAF/MediaStore trigger, offline LAN, izin
kaybı, worker stop/reboot/process kill, kesinti+revoke+suppression/rebackup,
foreground→background/lock ve notification görünürlüğü. Performans/kota/pil/a11y
ve bütünleşik görsel kabul kendi kapılarında kalır. Windows D3, macOS signing,
Linux provider ve iOS locality/Expo/provider/Files/Photos/background işleri bu
kaynak sonucu ile kapanmaz. Diğer geniş ürün backlog'u korunur.
