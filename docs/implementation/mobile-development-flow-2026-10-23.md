# Kloda mobil geliştirme akışı — 23 Ekim 2026

**Sonraki takip:** [lint kapanışı ve statik uyumluluk kanıtı](android-lint-and-compatibility-2026-10-25.md) ile explicit K1 tam lint ve dört ABI ELF16KB kontrolü PASS; aşağıdaki eski K2 BLOCKED kaydı tarihsel olarak korunur. Gerçek OS/cihaz kabulü ve kaynak tüketimi açıktır.

Güncel sıra kullanıcının sabitlediği [11-adım yürütme listesidir](mobile-execution-checklist-2026-10-24.md); aşağıdaki ilk plan teknik ayrıntı olarak korunur. Liste1 [Android iş/ayar bağlamı](android-run-context-2026-10-24.md) tamamlandı; [liste2 owner/kuyruk](android-background-owner-2026-10-25.md) kaynak/host kapsamında tamam. [Liste3 Live/program/OS](android-scheduling-2026-10-25.md) uygulandı; Android lint araç engeli ve liste4 runtime kabulü açık.

Güncel iOS LAN kapısı: [dar transport tasarımı](ios-lan-transport-design-2026-10-24.md) byte adaptörünün locality proof eksiğini çözmediğini gösterdi. Mevcut güvenlik korunur; alternatif iOS locality sözleşmesi kararı ayrı, I1 ve gerçek sender tamamlanmadı.

İzinli [iOS26.5 simulator ABI/decoder/ownership kontrolleri](ios-simulator-validation-2026-10-24.md) exit0. Bu I1 native pairing veya I2 sender tamamlanması değildir; güvenli LAN/provider/Expo entegrasyonu sıradadır.

24 Ekim güncellemesi: [iOS native ABI temeli](ios-native-bridge-2026-10-24.md) derleme/link/saf test kapsamıyla tamamlandı. Canlı iOS provider/Expo/route/foreground ve sender kabulü açık; [karar listesi](mobile-questions-2026-10-24.md) sıradaki bağımlılıkları korur.

## Güncel onay ve teslim önceliği

Kullanıcı mobil akışın hızla geliştirilmesini onayladı; Android ve iOS ilk teslimde
birlikte zorunlu. Önce ortak QR→ayrı PC grant→Files/Photos→gerçek ilerleme/güvenli
resume akışı; sonra platform background/program kapsamı. Sabit teslim tarihi
bildirilmedi; konuşmadaki4–8 hafta ölçülmüş takvim taahhüdü değildir.
[Android foreground retry dilimi](android-durable-retry-2026-10-23.md) uygulandı;
tüm A1/Android/iOS veya fiziksel ürün kabulü kapandı anlamına gelmez. Mobil Stitch
PC-first eşlemesi24 Ekim’de onaylandı ve [dar uyarlama](mobile-pc-first-stitch-mapping.md) uygulandı.
Aşağıdaki ilk plan değerlendirmesi ve ayrıntılı açık işler tarihsel bağlamıyla korunur.


Durum: kaynaklara dayalı geliştirme planı; implementasyon onayı veya yeni test
sonucu değildir. Android değerlendirmesi34dcbb8 kaynak tabanında yapıldı.
Windows D3 fresh-bootstrap/intent-activation writer çalışması Windows oturumunda
paralel ve açık kalır. Windows bitmiş veya gerçek alıcı hazır varsayılmaz.

## Mevcut temel

Android native QR, Files/Photos sender, immutable dosya işi/operation/ACK-offset,
private snapshot, ADR0017 sidecar/import/restore ve ADR0019 suppression/explicit
rebackup kaynakları var. Bunlar yeniden yazılmaz.13/14 Ekim API36/host/build ve
20 Ekim mobile32/Kotlin/host SQL sonuçları tarihsel kapsamlarıyla okunur; son
suppression/rebackup Android runtime kabulü yapılmış sayılmaz.

Android gerçek açıkları ve kaynak eşlemesi:
[Android geçiş değerlendirmesi](android-transition-assessment-2026-10-23.md).
Mevcut kuyruk Activity/Expo modülü ömrüne bağlı; background'da pause olur. Program
preference olarak saklanır; native kalıcı run/retry ve OS yürütücüsü bağlı değildir.
Ana UI source→schedule→WebDAV düzenindedir; tutarlı PC-first ana akış ayrı iştir.

Apple modül kaydı yalnız KlodaSyncRuntimeModule içerir; Files bookmark/Photos
kaynak seçimi, tarama ve ilk kaynak günlüğü vardır. KlodaPairing native bridge
Apple tarafında kayıtlı değildir. `shared/api/file-transfer.ts` aktarım çağrılarını
Android ile sınırlar. Bu yüzden iOS native pairing/transfer/import/background
sadece test bekleyen tamamlanmış iş değil, gerçek uygulama açığıdır.

## Uygulama düzeni

Her dilimden önce kısa kapsam, kabul ölçütleri, etkiler ve gerçekten yeni kararlar
sunulur; kullanıcının geliştirme onayından sonra uygulanır. Mevcut ürün kararları
tekrar sorulmaz. Onaylı dilim içinde rutin alt adımlarda tekrar onay gerekmez.
Yeni güvenlik/mimari davranış veya veri etkisi gerekiyorsa somut seçenekle sorulur.
Her anlamlı dilimde ilgili otomatik kontroller, ayrı review ve handoff/roadmap/status
kanıtları güncellenir. Ayrı review için Astra varsayılan değildir; kullanıcı
Astra'yı yalnız gerektiğinde sonraki planlama desteği için istedi.

İşler Android→iOS→toplu fiziksel kabul sırasındadır. Windows'a bağımlı gerçek
uçtan uca kabul açık kalırken bağımsız kaynak ve sentetik otomasyon ilerleyebilir.
Fiziksel/cihaz/probe duraklatması açık kullanıcı talimatı olmadan kaldırılmaz.

## Android dilimleri

### A1 — Kalıcı çalışma ve retry

Mevcut AndroidSyncJournal/FilesQueue üzerinde dosya işini yürütme girişiminden
ayıran en küçük run/attempt kaydını bağla. İkinci aktarım günlüğü veya genel
scheduler oluşturma. Mevcut journal operation/ACK-offset/snapshot/Completed
kimliklerini korur; ek kapsam attempt/due/budget ve çalışma sahipliğidir.

Kabul: erişim ilk dahil5 deneme, gerçek hata sonucundan60s sonra tekrar; süreç
kapanınca sayaç veya due sıfırlanmaz; aynı çalışma çoğalmaz. Pause/OS ertelemesi
network hatası sayılmaz. Revoked/denied/source değişimi ve owner_deleted otomatik
retry almaz. Belirsiz create/finalize mevcut status/operation uzlaştırmasını
kullanır; yeni upload veya Completed varsayımı üretmez. OS5min/5 bütçesi ayrı
saklanır ve gerçek OS entegrasyonu olmadan kullanılmış gibi gösterilmez.

İlk dilim mevcut foreground sınırını kaldırmaz. Kontrollü saat, yeniden açılış,
CAS/duplicate, budget ve suppression regresyonlarıyla doğrulanır. Kaynak journal
schema değişimi eski dosya işleri ve suppression geçmişini kaybettirmez.

### A2 — Kaynak, hedef ve program bağlamı

Çalışmayı exact peer/record, seçili kaynaklar ve ilgili ayar/program revision'ına
bağla. Kaynak/izin/hedef değişince eski iş güvenli noktada durur; eski iş başka
hedefe taşınmaz. Eski çalışma yeni programın fırsatını tüketmez. Mevcut kaynak
kimliği/hash/izin kontrolleri ve ayrı foreground eşleşme/onay sınırları korunur.

Kabul: kaynak kaldırma/değiştirme, peer değişimi, permission kaybı, yeniden açılış,
eski program sonucunun yeni revision'a yazılması ve stale retry olumsuz testleri.

### A3 — Android native owner ve arka plan yürütme

Tek native owner/queue ömrünü Activity/React ekranından ayıracak Android yürütme
yolunu seç ve uygula. İş verisi JS timer/component belleğine bağlı kalmaz.
Kalıcı OS işi, uzun kullanıcı başlatmalı transfer, foreground notification ve
platform süre/başlatma sınırları güncel resmî belgeler ve mevcut dependency'lerle
karşılaştırılır. Yeni service/worker/dependency gerçekten gerekirse dar gerekçe
sunulur. WorkManager/foreground service veya genel framework peşinen seçilmedi.

Kabul: ekran değişimi/background mevcut yetkili işi yanlışlıkla yok etmez;
Activity dönüşü ikinci owner yaratmaz; OS kesintisinde journal korunur. Yeni QR,
eşleşme onayı, kaynak/izin seçimi ve açık rebackup/restore eylemleri görünür kullanıcı
eylemi sınırını korur. Desktop ADR0018 olduğu gibi Android'e kopyalanmaz.

### A4 — Live, program, ağ ve bildirimler

ADR0005 Live default'unu ve12/24+saat alternatifini gerçek native yürütücüye bağla.
Sync Now programı kaydırmaz. Saat dilimi değişimi, reboot, uygun fırsatın kaçması,
uyku/Doze/OS ertelemesi ve yeniden açılış aynı işi çoğaltmadan ele alınır.

ADR0001 erişim5/60s ve OS erteleme5/hedef5min ayrı bütçelerdir. OS'nin tam60s/5min
veya seçilen saatte uyandıracağı garanti edilmez; çalışan uzun aktarım yeniden
başlatılmaz. Erişim bütçesi tükenince gerçek hata görünür; tamamlanmamış iş
kaybolmadan sonraki scheduled fırsata kalır.

İlerleme sessiz ama görünür; gerçek müdahale gerektiren hata ve bildirim izni
engeli doğru gösterilir. Cellular default-off ve explicit opt-in korunur. Bu
ayar V1 LAN için WAN/relay erişimi yaratmaz; remote ayrı açık kapsamdır.

### A5 — Android PC-first/Stitch ana akışı ve ayarlar

Mevcut QR, kaynak seçimi, transfer/Activity, own-backup list/restore ve explicit
rebackup bileşenlerini tutarlı ana akışta birleştir. Akış: PC'yi QR ile eşleştir;
PC'de ayrı yedek alanı/onayı gerektiğini göster; telefonda Files/Photos kaynaklarını
seç; gerçek izin/erişilebilirlik durumunu gör; manuel veya Live/programlı yedekle;
ilerleme/geçmiş/restore/retry ayarlarına eriş. Eşleşme dosya izni değildir.

WebDAV gelişmiş seçenek olarak korunur; hedef+credential+test geçerliliği atomik ve
kesinti-tutarlı kaydedilir. Eski başarılı test yeni hedefin geçerli testi sayılmaz.
WebDAV formu PC-first native alıcının kurulumu gibi gösterilmez. Mevcut mobil
WebDAV test/config ekranı gerçek otomatik WebDAV byte aktarımının kanıtı değildir;
advanced sender yürütme kapsamı ayrıca eşleştirilir ve gerekliyse ayrı dilim olarak
görünür tutulur, PC-first sender işiyle tamamlandı sayılmaz. Onaylı Stitch
renk/kart/tipografi/gezinme dili, TR/EN/DE, ekran boyutları ve erişilebilirlik korunur.
Referansın karşılamadığı ürün akışı tasarım varsayımıyla değiştirilmez.

Activity uygulama yeniden açılınca native journal ile tutarlı olur. Kuyruğa alma,
byte göndermek veya OS işini teslim etmek completion değildir. Kısmi/engelli/inceleme
gerektiren dosyalar toplu tam başarı arkasında gizlenmez. Device/PC adı ve çevrimiçi
bilgisi native kayıtta yoksa uydurulmaz. Çoklu hedef davranışı mevcut sözleşmenin
ötesine geçiyorsa ayrıca karar gerekir.

### A6 — Android kabul ve kalan runtime açıkları

ADR0019 unchanged-source suppression, explicit rebackup, changed-source/new version,
fresh QR sonrasında current grant ve Photos ortak resource/metadata ilişkilerini
ilgili izole runtime kapsamıyla doğrula. Kalıcı snapshot/journal/retry; izin kaybı,
alıcı offline/full, revoke/device removal, lostreply ve yeniden başlatma senaryolarını
kapsa. Cihazdaki orijinaller ve kullanıcı arşivi kullanılmaz/silinmez.

API24 ve güncel Android destek hedefleridir; resolved toolchain/dependency minimumu
ve desteklenen image/video/SAF/MediaStore/hardware kimlik davranışı kontrol edilir.
Bir minSdk değeri veya API36 emulator sonucu tüm sürümlere destek kanıtı değildir.
OS backup/restore, yeniden kurulum ve key/pin/epoch kaybında journal geçmişinin
yeni güven veya izin üretmediği ayrıca kontrol edilir; kurtarma politikası icat edilmez.
Emulator/cihaz/runtime izni ve gerçek platform kabulü mevcut duraklatmayla açıkça
ayrılır. Root/mobile/shared/Kotlin/JNI kontrolleri değişiklik etkisine göre çalışır;
yalnız bridge değişmedi diye native değişiklik atlanmaz. Görsel/erişilebilirlik ve
uygulama kaynaklı startup/izin hata davranışları da kabul tablosunda yer alır.

Android kapanışında uygulanan/doğrulanan/platform engelli/fiziksel kabul bekleyen
maddeler ayrı raporlanır; iOS başlamadan gerekli kalan Android işleri saklanmaz.

## iOS dilimleri

### I1 — Toolchain, custody ve native pairing

Önce mevcut Swift kaynak/bookmark/Photos scanner'ını koru; iOS16.4+ hedefini gerçek
Expo/RN/SDK/deployment minimumuyla karşılaştır. Sessiz minimum yükseltme yapma.
Apple uygulama kimliği, signing/entitlement, hardware key erişimi ve güvenli
kalıcılık gereksinimleri somutlaştırılır. Eksik provisioning hesap açma/ödeme,
ad-hoc güvenlik veya software-key fallback ile aşılmaz.

Ortak Rust pairing/kimlik/TLS sözleşmelerine iOS native bridge/provider bağla.
QR scan, current candidate, açık onay, pin/ACK ve yeni QR gerektiren state-loss
sınırlarını uygula. Backend login/JWT/KMS LAN şartı olmaz. QR completion ayrı file
grant değildir. Simülatör software fixture'ı gerçek Secure Enclave/hardware kabulü
sayılmaz. Android veya macOS'a özgü path/provider kodu iOS'a kopyalanmaz.

### I2 — Kalıcı Files sender ve own restore

Mevcut iOS source bookmark/scanner temelini gerçek native sender, private snapshot,
SHA256/source-target kimliği, immutable operation ve ACK-offset journal'ına bağla.
Android'in doğrulanmış sözleşmelerini paylaş; Kotlin/Android handle modelini Swift'e
taşıma. Dosyalar seçili scope/SAF eşdeğeri erişim ömrü içinde kalır.

Kabul: upload/status/resume/finalize, own-list ve kullanıcı başlatmalı restore;
source/provider değişiminde ret; kayıp yanıtta duplicate/fakecompletion yok;
hedef çakışmasında overwrite yok. Gerekli belge izinleri ve bookmark sürekliliği,
yerel/iCloud dosyanın gerçekten erişilebilir orijinali ve staging/disk-full davranışı
görünürdür. iCloud varlığı local byte erişimi gibi gösterilmez.

### I3 — Photos metadata, import ve geri yükleme

ADR0017 manifest/resource/asset/album/favorite sözleşmesini PhotoKit tarafına bağla.
Kaynak platform asset kimliği hedef Photos kimliği değildir. Desteklenen fotoğraf,
video ve çok kaynaklı asset/organizasyon özelliklerini somutlaştır; temsil edilemeyen
özelliği sessizce başarılı sayma. Limited permission tam kütüphane erişimi değildir.

Import intent ve hedef receipt'i platform creation/publication ile güvenli sırada
kaydet; kayıp receipt ve süreç kesintisinde owned hedefi doğrulamadan ikinci kopya
oluşturma. Belirsizlik review-required kalır. Tekil/tüm own Photos restore, exact
byte/resource doğrulaması ve izin/iCloud erişimi olumsuz senaryolarla doğrulanır.

ADR0019 suppression/explicit rebackup ve changed-version davranışı iOS sender'a
uygulanır; Desktop yönetim kararı telefona remote delete yetkisi vermez. Ortak medya,
aktif/trash sürümleri ve sidecar ilişkileri korunur. Telefonda orijinal silinmez.

### I4 — iOS kalıcı retry, background ve program

I1/I2 güvenlik sözleşmesini koruyan OS destekli transfer/iş yürütme yaklaşımını
seç. In-process Rust işi OS transfer daemon'una devretmek eşdeğer kabul edilmez;
pinned TLS, client identity ve nonexportable signer/certificate ilişkisinin
seçilecek background yoluyla uyumu kanıtlanmalıdır. Uyum yoksa security downgrade
yapılmadan somut mimari seçenek kullanıcıya sunulur.

Live/12/24+saat ve iki retry bütçesi iOS'un fırsat modeline bağlanır; exact alarm,
kesintisiz realtime, force-quit sonrası koşulsuz çalışma veya tam5min uyanma
sözü verilmez. OS expiration, process termination/relaunch, cihaz kilidi/ilk unlock,
network/permission/iCloud değişimi ve storage/key erişimiyle kalıcı iş tutarlılığı
ayrı kabul senaryolarıdır. Yeni trust/onay/izin/restore açık kullanıcı eylemi ister.

### I5 — iOS ana akışı ve kabul

Android'de oturan ortak PC-first/Stitch akışını iOS gerçek yeteneklerine bağla;
native_unsupported placeholder'ı başarılı UI ile maskeleme. Gelişmiş WebDAV ayar
atomikliği, TR/EN/DE, Dynamic Type/VoiceOver ve farklı ekran boyutlarını doğrula.
İlgili Swift/Rust/TS/build ve otomatik/simülatör kontrollerini çalıştır; gerçek key,
signing/background/PhotoKit/PC kabulünün hangi ortamda yapıldığını açık kaydet.
Hedef eski/güncel iOS runtime desteğini deployment sayısından çıkarma. OS backup,
app reinstall ve veri geri yüklemesiyle kimlik/izin sürekliliği ayrıca doğrulanır;
geçmiş aktarım veya import receipt'i yeni yetki sayılmaz.

## Ortak son kabul ve mobil kapanış

Kaynak geliştirmeleri ve uygun otomasyon tamamlandığında, hazır platformlarla
**yalnız açık kullanıcı izninden sonra** toplu fiziksel uçtan uca kabul yapılır.
Windows henüz hazır değilse onun testleri BLOCKED kalır; host fixture başarısı
Windows desteği sayılmaz. macOS signing ve Linux provider engelleri ayrı kalır.

Ortak kabul zinciri: temiz kurulum → QR → PC'de ayrı scope/izin → Files/Photos
kaynak seçimi → ilk aktarım/ilerleme → interruption/restart/resume → PC revoke ve
cihaz kaldırma → Desktop seçili sürüm silme/30gün restore → suppression/explicit
rebackup → tekrar background/programlı çalışma. Eski izin/geçmiş current authority
sayılmaz; eski/yeni source veya hedef karışmaz. Telefon orijinalleri korunur.

Tamamlanma tablosu her platform için kaynak, otomatik, izole runtime, gerçek cihaz,
uçtan uca ve signing/release kanıtını ayrı tutar. Çalıştırılmamış kontrol PASS olmaz.
Gerçek süre/disk/kota/büyük medya/staging kapasitesi ve timeout-retry etkileşimi
anlamlı boyutlarla değerlendirilir; kullanıcı arşivi test verisi değildir.

## Ayrı izlenen geniş ürün açıkları

- Medya E2EE ve key lifecycle.
- Account/MFA/recovery ve merkezi revoke ile offline grant ilişkisi.
- Remote erişim/signaling/TURN/provider ve final remote authorization.
- Files two-way, conflict, versions ve kapsamlı migration.
- Tam galeri/arama/thumbnail ve daha geniş Photos organizasyon özellikleri.

Bunlar silinmez veya tamamlandı sayılmaz; mobil temel LAN akışını bitirme gerekçesiyle
bu sıraya onaysız eklenmez. Windows cert renewal/replacement, rollback witness ve
korunmuş eski backup'ların verified erişimi de ilgili Desktop takip kayıtlarında kalır.

## Her dilimin teslimi

Kısa rapor: tamamlanan kod/akış, gerçek komut/sonuç/ortam kanıtı, bulunan/düzeltilen
review bulgusu, açık karar/engel, sonraki tek iş. Handoff/roadmap/status ve yalnız
incelenmiş public evidence güncellenir; ham .local-evidence komple Git'e konmaz.
Git add/commit/push/reset/clean/stash yapılmaz; kullanıcı ayrıca isterse yalnız
istenen Git işlemi uygulanır. Model/effort değişmez. Bu plan için test/build yoktur.
