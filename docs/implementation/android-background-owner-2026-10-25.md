# Android liste2 — arka plan owner/kuyruk ömrü — 25 Ekim 2026

Durum: kaynak uygulaması, otomatik/izole host kontrolleri ve ayrı güvenlik review
tamamlandı. Gerçek Android service/Activity/cihaz/LAN kabulü değildir.

## Kapsam

Tek native owner/platform/FilesQueue artık process kapsamındadır; Expo modülünün
ve ekranın kapanması authorized Files/Photos gönderimini kapatmaz. Kullanıcının
önde açıkça başlattığı iş non-exported dataSync foreground service hazır olduktan
sonra çalışır. Sessiz native bildirim uygulamayı açar; kullanıcı Activity'den işi
duraklatabilir. Servis başlatılamazsa background_unavailable döner, iş başlamaz.
Kuyruk bitince servis bırakılır. START_NOT_STICKY; process ölümü/reboot/force-stop
otomatik yürütme veya başarı değildir. Kalıcı run/ACK/operation/snapshot/suppression
aynı journal'da korunur; uygulama yeniden açıldığında native kayıtlar okunur.

Module/UI ayrılışı Files'ı durdurmaz; restore ve yeni eşleştirme yönetimi ön planda
kalır. Uygulama owner'ı saklarken transient eşleştirme native epoch ile ayrılır.
Android owner başlangıçta inactive'dir; scan/approve/resume native epoch taşır.
phone_pending/pin/complete/repair yazımında aynı foreground mutex'i tutulur.
Synchronous setForeground(false), actor kuyruğunu beklemeden eski işi geçersiz
kılar; yeniden görünür olmak eski işi yetkilendirmez. Durable pending/pin/complete
ve bağımsız file sender korunur. Yalnız doğrulanmış foreground-stale sonucu
transient temizliğe gider; storage/continuity/genel protokol hatası gizlenmez.

Runtime UI token'ı yeni start/rebackup/restore/peer değişimi ve açık pause
başında, transfer kontrollerinde ve servis beklemesi sonrasında doğrulanır.
Eski Expo modülünün gecikmiş eylemi yeni oturumu değiştiremez. Servisin retiring
instance'ı yeni lease alamaz; hızlı durdur/başlatta gerekirse doğru hata döner.
Gecikmiş eski onDestroy yeni servisi durdurmaz. Ana Android thread'i worker/JNI
join etmez. Aynı process owner/platform tutulur; ikinci owner yaratılmaz.

## Platform sözleşmesi

[Android dataSync](https://developer.android.com/develop/background-work/services/fgs/service-types#data-sync)
ve [timeout](https://developer.android.com/develop/background-work/services/fgs/timeout)
sözleşmeleri incelendi. Android15+ dataSync arka plan toplam6s/24saat sınırı
uygulanabilir; onTimeout işi güvenli noktada durdurmak için pause ister ve servis
hemen stopSelf çağırır. Anlık in-flight native isteğin bitmesi/sonucu belirsiz
kalması mevcut journal/status uzlaştırmasındadır; tamamlandı uydurulmaz.
FGS sınırsız çalışma/uyandırma garantisi değildir. Hardware key unlocked-device
şartı ve route/TLS/pin/PC ACL/revoke sınırları değiştirilmedi. Yeniden bağlantı
kilitli cihazda engellenebilir; kilitli background kabulü yapılmış sayılmaz.

POST_NOTIFICATIONS kullanıcı akışı ve hata sonucu bildirimi liste3 kapsamındadır.
Android13+ izin verilmezse FGS shade bildirimi görünmeyebilir; sistem Task Manager
kaydı aynı şey değildir. Bildirim görünürlüğü veya canlı byte göstergesi bu dilimde
kanıtlanmadı. [Resmî izin sınırı](https://developer.android.com/develop/ui/compose/notifications/notification-permission).
TR/EN/DE native bildirim metinleri ve eski foreground-only açıklamaları güncellendi.
Yeni bağımlılık, genel scheduler veya ikinci transfer günlüğü eklenmedi.

## Kanıt ve review

[Seçilmiş sonuçlar](evidence/android-background-owner-2026-10-25/result.json).
Mobile54 test/8 suite, lint/typecheck; Kotlin main+instrumentation ve dört Android
ABI native derleme; host foreground5 test, host clippy -D warnings; değişen Rust
dosyaları scoped fmt PASS. Tüm crate fmt kontrolü mevcut Windows/initialization
biçim farklarında FAIL; bu görevde ilgisiz dosyalar yeniden biçimlendirilmedi.
Production SQL2 ve mevcut gerçek Kotlin worker8/context host regresyonları PASS.
Production Kotlin service/runtime, Android doubles ile4 host senaryo grubu PASS:
UI ayrılışı/token; retiring/yeni servis; timeout; başlatma reddi. Bu Android OS
runtime değildir. Gerçek Activity/module recreation, bildirimin OS'de görünmesi,
servis timeout/kill, JNI aktarımda UI ayrılışı, kilitli cihaz ve eski/current OS
kabulü4. adım/fiziksel kapıda açık. Yeni simulator/cihaz/probe çalıştırılmadı.

Bağımsız Sol review servis reuse ve eski UI token açıklarını buldu; düzeltildi ve
host regresyon eklendi. Son kaynak geçişinde production blocker yok; Android'de
inactive default'a uygun iki saf test setup'ı ayrıca düzeltildi. Reviewer runtime
çalıştırmadı. Git mutation/kullanıcı arşivi/key/pin/authority işlemi yapılmadı.

Liste3 kaynak uygulaması [ayrı kayıtta](android-scheduling-2026-10-25.md) tamamlandı;
Android lint araç engeli ve gerçek OS/runtime kapıları açık. Kullanıcı Duraklat
ile otomatik yedeklemenin de Devam seçilene kadar durmasını onayladı; uygulandı.
