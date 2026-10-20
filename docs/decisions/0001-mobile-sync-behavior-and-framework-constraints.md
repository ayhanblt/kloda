# ADR 0001 — Mobil sync davranışı ve framework seçim kısıtları

- Tarih: 2026-09-29
- Durum: Kabul edildi
- Karar sahibi: Ayhan
- Kapsam: Mobile ve desktop framework seçimi; iki ayrı deneme politikası, eski mobil sürümlerin desteklenmesi ve iOS kaynak seçimi.

2026-10-07 scoped supersession: [ADR0013](0013-qr-based-local-lan-pairing.md) aşağıdaki standard SAS referansının ilk-trust gerekliliğini yerel QR LAN pairing ile değiştirir; framework, schedule/retry, source selection ve support hedefleri değişmez.

## Context

İlk WebDAV vertical slice otomatik12/24 saat ve cihazın yerel çalışma saatini, ayrıca Sync Now'ı kabul etti. Session'da daha sonra kabul edilen PC-first ürün kapsamı ve default opportunistic Live [ADR0005](0005-computer-first-files-and-photos-backup.md) içindedir;12/24 program/retry kuralları korunur. Aktif sync sessiz ilerleme bildirimiyle görünür; erişim bütçesi tükenirse hata bildirimi gerekir. Davranış hedefleri tamamlanmış native runtime sayılmaz.

Framework değerlendirmesinde mobile için React Native + Expo development build ve React Native bare/native; desktop için Electron ve Tauri incelendi. NestJS backend ve FSD frontend kararları değişmez. WebDAV doğrudan veya gerektiğinde HTTP(S) relay üzerinden kullanılabilir; SMB yalnızca LAN içindedir.

Sunucuya erişilememesi ile işletim sisteminin işi ertelemesi veya iptal etmesi farklı durumlardır. Aynı deneme sayacıyla yönetilmemelidir. iOS'un planlanan zamanı ertelemesi kabul edilir; örneğin OS güncellemesi sürerken iş daha sonraya bırakılabilir. Ancak tamamlanmamış işin sessizce kaybolması kabul edilmez.

## Decision

### 1. WebDAV / SMB sunucusuna erişim denemeleri

- İlk girişim dahil **toplam 5 erişim denemesi** yapılır: ilk girişim ve en fazla 4 yeniden deneme.
- Yeniden deneme, önceki girişimin başarısızlık sonucu alındıktan **60 saniye sonra** yapılır; önceki girişimin başlangıcından itibaren sayılmaz.
- Başarılı erişimde erişim hatası nedeniyle yeniden denemeye gerek kalmaz. Beş denemenin tamamı başarısızsa hata bildirimi gönderilir.
- Bu politika WebDAV / SMB sunucusuna erişim sağlanamaması içindir; OS erteleme/iptal kontrolü değildir.

### 2. OS ertelemesi / iptali sonrası scheduled sync takibi

- Seçilen saat hedef başlangıçtır; iOS'un başlangıcı ertelemesi kabul edilir. Android veya iOS işi ertelediğinde ya da iptal ettiğinde, tamamlanmamış çalışma kuyruk ve gönderim/ilerleme durumu üzerinden takip edilir.
- İlgili scheduled sync çalışması başlatıldığında **`updated = 0`** olur. Çalışma kapsamındaki dosyalar başarıyla sync edildiğinde **`updated = 1`** olur. Kuyruğa alma, görevi OS'ye teslim etme veya bildirim gönderme tek başına dosyaların sync edildiği anlamına gelmez.
- İş tamamlanmadıysa (`updated != 1`), **5 dakika sonra** yeniden kontrol edilmesi ve OS ertelemesi/iptali nedeniyle devam edemeyen işin yeniden denenmesi hedeflenir.
- Bu politika da ilk çalışma girişimi dahil **toplam 5 girişimle** sınırlıdır: ilk girişim ve en fazla 4 yeniden kontrol/çalıştırma girişimi. Tamamlanınca tekrar deneme sona erer; bu bütçe sonunda tamamlanmadıysa kalan iş **bir sonraki scheduled sync'e bırakılır**.
- OS erteleme/iptal bütçesi ile sunucuya erişim bütçesi ayrı izlenir. Bir erişim hatası OS iptali sayılmaz; henüz çalıştırılmamış bir görev de sunucuya erişim hatası olarak raporlanmaz.
- Kuyruk, tamamlanma bilgisi ve ilerleme birlikte değerlendirilir. `updated = 0` hem devam eden hem de kesilmiş işte görülebilir; bu bit tek başına OS iptalinin kanıtı değildir. Beş dakikalık kontrol, hâlen çalışan uzun aktarımın ikinci bir kopyasını başlatma gerekçesi değildir.

### 3. Eski iOS ve Android sürümleri

- Uygulama yalnızca iOS 26+ cihazlarla sınırlandırılmaz; eski iOS sürümlerinde ve eski Android telefonlarda da kullanılabilmelidir.
İlk karar minimum sürüm seçmedi. Daha sonraki transport araştırmasında kullanıcı **iOS16.4+ / Android7+ (API24)** compatibility/destek hedefini ve ortak native kripto bileşenini seçti. Bu hedef bütün toolchain/API'ların çalıştığı veya release minimumunun doğrulandığı anlamına gelmez; sonraki PoC'nin minSdk24 değeri açıkça experimental ve product minimum kanıtı olmayan build ayarıdır.
- Yalnız yeni OS sürümlerindeki bir API, tüm desteklenen cihazlar için tek çözüm olarak seçilemez. Framework ve native entegrasyon değerlendirmesi eski sürümlerin imkânlarını da kapsamalıdır.
- **Production gate:** Expo/RN/SDK/build toolchain fiilî minimumları, eski hedef cihazlarda API/crypto/TLS/key-provider/background ve release compatibility ayrı kanıtlanır. iOS16.4 ve güncel iOS, Android API24 ve güncel fiziksel cihaz karşılaştırması gerekir; framework/minimumu sessiz yükseltme veya bütün eski OS'lere sınırsız destek vaadi yok.

### 4. iOS kaynak seçimi

- Kullanıcı Files klasörlerinin yanında **Photos albümlerini / fotoğraf kütüphanesini** de yedekleme kaynağı olarak seçebilir; fotoğraf yedekleme öncelikli kullanım senaryosudur.
- Klasörleri kullanıcı seçer; birden fazla klasör seçilebilir. **"Tümünü seç" düğmesi bulunmaz.** Photos kütüphanesinin bir kaynak olarak seçilebilmesi, bütün Files klasörlerini otomatik seçmek anlamına gelmez.
- Files klasör erişimi ve Photos erişimi ayrı platform izinleriyle değerlendirilir. Photos kaynak seçiminin onaylanması, galeri içi albüm yönetimi veya arama kapsamı hakkında karar değildir.

### 5. Framework seçimi

- Mobile uygulama **React Native + Expo development build** ile kurulacaktır. Expo Go, uygulamanın development veya production dağıtım yolu değildir.
- Desktop uygulama **Electron** ile kurulacaktır.
- Her iki uygulama da TypeScript kullanır ve mevcut FSD katman sınırlarını korur.
- Expo development build, gerektiğinde native modül eklenmesine izin verir; bu karar belirli bir native API, paket veya minimum OS sürümü seçmez.
- Ortak native kripto bileşeni yönü Expo/Electron frontend seçimini değiştirmez; native PoC core veya SDK patch'i production dependency adoption değildir. [ADR0007](0007-matrix-verification-and-device-continuity.md) korunan continuity, [ADR0012](0012-kloda-owned-p256-device-identity.md) ayrı Kloda P-256 identity/hardware-preferred, ADR0013 backend-independent ilk QR trust yönünü kaydeder. Yerel pinning file grant değildir; same-account authorization/step-up/scope/capability ayrı kalır. Android device-local hardware signer dar CLOSED/PASS'tir; exact app/native API/background/minimum cihaz ve actual LAN kanıtı açık.
- Electron renderer'a doğrudan Node.js veya dosya sistemi erişimi verilmez; yetkili masaüstü API'leri main/preload sınırında kalır.

## Alternatives considered

| Alternatif | Değerlendirme |
| --- | --- |
| İlk girişim + 5 yeniden deneme (toplam 6) | Değerlendirildi; her iki politika için de ilk girişim dahil toplam 5 seçildi. |
| Erişim hatası ve OS ertelemesi için ortak sayaç / bekleme | Farklı hata nedenlerini karıştırır; ayrı 60 saniye ve 5 dakika politikaları seçildi. |
| Bütün platformlarda kesin dakikada başlama | iOS ertelemesi kabul edildi; seçilen saat hedef başlangıç olarak korunuyor. |
| Yalnız iOS 26+ desteği | Eski iOS ve Android cihazlarda kullanım gereksinimiyle uyuşmuyor. |
| iOS'ta yalnız Files klasörleri | Fotoğraf yedekleme önceliği nedeniyle Photos albümleri / kütüphanesi de kaynak kapsamına alındı. |
| React Native bare/native | Expo development build seçildi; bare/native, native proje yönetimini doğrudan üstlenmeyi gerektirirse yeniden değerlendirilebilir. |
| Tauri | Electron seçildi; Rust core ve işletim sistemi WebView farklılıklarının maliyeti bu başlangıç için seçilmedi. |

## Consequences

- Sync takibi yalnız bir `updated` bitinden ibaret olamaz: çalışmanın kuyruktaki, aktif, ertelenmiş, iptal edilmiş ve tamamlanmış durumlarını ayırt etmek gerekir. Bu ADR belirli bir veri tabanı, şema veya scheduler implementasyonu seçmez.
- Tamamlanmamış işin ve deneme durumunun süreç yaşam döngüsü nedeniyle kaybolmaması gerekir. OS'nin iptaline rağmen işi takip etmek, OS'nin uygulamayı sonlandırmasını veya askıya almasını engelleyebilmek demek değildir.
- **5 dakikalık kontrol bir ürün zamanlama hedefidir, koşulsuz OS garantisi değildir.** Uygulama/worker çalıştırılmıyorsa kendi timer'ıyla uyanamaz, kuyruğu kontrol edemez veya iptali anında öğrenemez. OS yeniden yürütme fırsatı verdiğinde tamamlanmamış işin durumu değerlendirilmelidir. Bu sınırlama, kararı uygulanmış veya kesin zamanlı çalışan bir mekanizma olarak sunmayı engeller.
- Push/bildirim teslim veya çalışma garantisi değildir; bu ADR push servisi seçmez. İlk kayıt backend rolünü açık bırakmıştı; artık [ADR0004](0004-certificate-bound-capability-and-authority-responsibilities.md) central control–PC enforcement rolü kabul edilmiştir, hosting/gerçek servis gate'i açık kalır.
- Eski cihaz desteği, platforma ve OS sürümüne göre farklı native yolların incelenmesini gerektirir. Expo development build seçimi, minimum sürümleri veya fallback davranışlarını varsayımla kesinleştirmez.
- Electron main/preload/renderer ayrımı, FSD renderer katmanlarının yetkili masaüstü işlemlerinden ayrılmasını gerektirir.
- Feature, paket, yapılandırma, native proje veya bağımlılık değişikliği bu ADR'nin önceki davranış kararının parçası değildi; framework scaffold'ı bu kararın ardından ayrı görevde kurulabilir. Diğer açık konuların karar durumu değişmez.

Platform sınırları için framework değerlendirmesinde kontrol edilen resmi kaynaklar:

- [Apple — earliestBeginDate: belirtilen zamanda başlama garantisi yok](https://developer.apple.com/documentation/backgroundtasks/bgtaskrequest/earliestbegindate)
- [Apple — kullanıcı eylemiyle başlayan uzun işler, ilerleme ve iptal](https://developer.apple.com/documentation/backgroundtasks/performing-long-running-tasks-on-ios-and-ipados)
- [Apple — background HTTP(S) dosya transferleri](https://developer.apple.com/documentation/foundation/downloading-files-in-the-background)
- [Android — Doze ve App Standby kısıtları](https://developer.android.com/training/monitoring-device-state/doze-standby)
- [Android — foreground service süre sınırları](https://developer.android.com/develop/background-work/services/fgs/timeout)

## Rejected alternatives

- İlk denemeyi saymayıp toplam 6 girişim yapmak veya sınırsız tekrar denemek.
- Sunucu erişim hatası ile OS erteleme/iptalini aynı hata ve deneme bütçesi saymak.
- Tamamlanmamış işi kuyruktan sessizce düşürmek; yalnız OS'ye teslim edildiği için `updated = 1` yapmak.
- Aktif uzun transferi sırf `updated = 0` kaldığı için iptal edilmiş sayıp tekrar başlatmak.
- iOS'un tam saatte başlamasını veya çalışmayan uygulamanın tam 5 dakika sonra kendisini uyandırmasını garanti etmek.
- Kullanımı yalnız iOS 26+ ile sınırlamak veya eski cihaz ihtiyacını değerlendirme dışında bırakmak.
- iOS kaynaklarını yalnız Files ile sınırlamak ya da kullanıcı yerine bütün klasörleri seçmek.
- React Native bare/native veya Tauri'yi framework kararı verilmemiş saymak; minimum OS sürümünü veya diğer açık mimari konuları bu framework kararından hareketle onaylanmış saymak.

## Session güncellemesi ve kanıt ayrımı

2026-10-04 kalıcılaştırması ilk karar ile sonradan seçilen destek hedefini ayırır. Tarihsel kaynak: `kloda-transport-analysis-plan.md` kullanıcı ortak native kripto/iOS16.4+/Android7+ seçimi; `kloda-android-poc-scope-freeze.md` deney minSdk24'ün product minimum olmadığını açıklar. [Transport kanıtı](../security/poc-transport-evidence.md) ve [production/physical gate kaydı](../security/production-gates.md) çalışmış senaryo ile release gereksinimini ayırır; bu doc işi yeni runtime veya minimum-OS kararı değildir.

## Desktop WebDAV retry clarification — 2026-10-20

Ayhan explicitly retained the existing WebDAV timeout behavior: total five access attempts, with each retry sixty seconds after an observed failure. No additional total timeout/deadline is introduced. An unanswered request is not an observed failure and this policy alone does not guarantee a bounded completion time. Existing native phone transport deadlines are separate and unchanged. The mobile OS deferral budget is not applied to the Desktop native receiver. Implementation/restart evidence is tracked in the [Desktop jobs handoff](../implementation/implementation-session-handoff.md#desktop-webdav-jobs-and-final-host-review--2026-10-20), separately from physical/platform acceptance.
