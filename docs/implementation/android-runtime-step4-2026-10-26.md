# Mobil liste4 — API36 emülatör runtime —26 Ekim2026

Kullanıcı yalnız yeni, geçici API36 emülatöründe test uygulamasını çalıştırmayı
açıkça onayladı. Bu dar çalışma tamamlandı: **11 grup PASS + ayrı süreç reopen
PASS**. Liste4'ün gerçek PC/LAN, eski OS,16KB runtime ve fiziksel kabulü açık.
[Sonuç/kaynak/APK hash'leri](evidence/android-runtime-2026-10-26/result.json).

## İzolasyon ve yürütme

API36 Google Play arm64 rev6, emulator35.5.10, SwiftShader; gerçek guest sayfa
boyutu **4096**. Yeni private temporary AVD/user/emulator dizinleri; snapshot yok.
ADB ayrı5059 portunda, eşleşmeyen USB serial filtresiyle başlatıldı. Her cihaz
komutu yalnız `emulator-5588` seçti; mevcut AVD/varsayılan ADB/fiziksel cihaz seçilmedi.
Başlangıç APK'ları25Ekim kanıt hash'leriyle eşleşti. Güncel testler için yeniden
derlenen final APK hash'leri yeni kapsüldedir. Başta detached başlatma açılış
kanıtı vermedi; denetimli oturum açılışı doğrulandı. Paket yokluğu ön kontrolündeki
`pm path` nonzero sonucu, test çalışmadan önce doğru kontrolle düzeltildi.

Testler yalnız self-instrumented `com.kloda.sync.test` UID'si, token-scoped
disposable journal ve sentetik MediaStore PNG/metadata kayıtlarını kullanır.
Gerçek kullanıcı arşivi/native owner/anahtar/pin/epoch/authority açılmadı.
Native kütüphane gerçekten Android'de yüklendi; owner/TPM/TLS custody testi değil.

## Gerçek Android'de geçen gruplar

1. Native kütüphane dinamik yükleme.
2. Files erişim retry ve iş/ayar kayıtları.
3. Scheduled occurrence/üyelik/attempt/deadline/terminal linked-run kayıtları;
   gerçek Android SQLite. Reboot kimliği burada enjekte edilir, OS reboot değildir.
4. Files migration, receipt/offset/hash/tombstone ve snapshot kurtarma.
5. Photos kaynak/izin/catalog erişimi.
6. Own restore.
7. Photos manifest/metadata ve kayıp yanıt publication.
8. Photos suppression ve explicit rebackup; aşağıdaki regression dahil.
9. Photos import ve import journal uzlaştırması.
10. Photos katalog/sürüm ayrımı.
11. Gerçek FGS/bildirim: nonexported test Activity resumed/focused iken acquire;
    Activity kapanınca1sn korunma, explicit stop ile servis/bildirim kalkması.

Scheduled grupta gerçek JobScheduler'a yaklaşık1saat sonraki persisted iş kaydı
verildi. Binding/service doğrulandı; internet zorunluluğu ve Live WATCH yok.
Gerçek Pause kaydı iptal etti; clock-change reconcile duruşu kaldırmadı; Resume
yeniden kaydetti. Finally test UID'sinin iki job ID'si iptal edildi. **Dispatch,
boot/Doze/kota veya native background transfer kanıtı değildir.**

FGS testinde POST_NOTIFICATIONS yalnız test UID'sine host'tan geçici verildi ve
sonunda ilk duruma döndürüldüğü doğrulandı. Bu gerçek izin diyaloğu/Expo foreground
grant fence veya yetkili native aktarım kabulü değildir. Test-only Activity üretim
manifestine eklenmedi; production grant/foreground sınırları değiştirilmedi.

ADB exit0 tek başına başarı sayılmadı:11 ayrı START/PASS ve final success metni
kontrol edildi. İlk başarısız koşular aynı ADB0 ile dönmüştü ve FAIL olarak saklandı.

## Bulunan arıza ve en küçük düzeltme

İlk koşu, testte kalmış eski schema3 beklentisinde durdu. Üretim schema6'ya
dokunulmadı; test6/new tables ve korunmuş legacy kayıtları doğrulayacak şekilde
güncellendi. Sonra mevcut yedi grup geçti.

Yeni Photos rebackup testi **gerçek bir production tutarsızlığını** gösterdi:
finalize native fixture'da tamamlanıp yanıt kaybolduğunda, explicit retry status
Completed doğrulasa bile local publication finalizing kalıyordu. Her iki erken
dönüşte mevcut exact ACK doğrulaması sonrasında yeniden `check()`, kalıcı
`journal.retain`, tombstone temizliği ve kendi snapshot temizliği bağlandı.
Yeni endpoint, journal, izin veya completion varsayımı eklenmedi.

Regresyon gerçek MediaStore/SQLite/publisher ile geçti: değişmemiş silinmiş sürüm
otomatik geri gelmiyor; explicit rebackup yeni bağlı intent oluşturuyor; eski
Completed ve ortak kaynak korunuyor; kayıp finalize yanıtından sonra aynı intent/
operation tamamlanıyor. Silinmiş resource remapping callback'i **sentetik Files
sender**; gerçek FilesQueue resource sender veya PC yetkilendirmesi değildir.
Eski FAIL çıktısı [ayrı saklandı](evidence/android-runtime-2026-10-26/photos-lost-reply-fail.txt).

## Ayrı süreçte reopen

Writer token-scoped journal'a offset2/size4, operation/hash/source/peer kimliği,
Completed+tombstone, aynı run/occurrence üyeliği ve waiting retry bütçesi yazar;
DB'yi düzgün kapatıp instrumentation'ı bitirir. Host yalnız test paketine force-stop
uygular; reader başka PID'de tüm alanları ve pause tercihini doğrular. Pending iş
tamamlandıya çevrilmez. İlk writer süreci bu anda zaten bitmişti: **aktif upload
kill, in-flight SQLite write crash veya power-loss testi değildir**. Pause flag
doğrudan preference kalıcılığıdır; OS registration Pause/Resume ayrıca yukarıda testlidir.

## Doğrulama ve kalan kapılar

Son production/app+test build ve explicit K1 lint: exit0/11sn. Final test-only
lifecycle/PID eklemesiyle build+K1 lint: exit0/10sn. App0hata/30uyarı,
modül0hata/34uyarı. Varsayılan K2 araç sınırı tarihsel kayıtta açık.
Final APK ELF64 kontrolü52PASS; ZIP hizalama ve debug imza kontrolleri exit0.
Mobil Jest/Rust testleri bu grupta yeniden koşulmadı; TS/Rust kaynak değişmedi.

Ayrı Sol kaynak/güvenlik ve sonuç review yapıldı. Testler sonrası yalnız bu AVD ve
5059 ADB sunucusu kapatıldı; varsayılan sunucuya dokunulmadı. Ham boot dump/private
AVD/anahtarlar veya APK binary'leri public kanıta alınmadı. Git mutation yok.
Kanıt seçimi ve süreç kapanışı sonrasında yalnız bu görevde yeni oluşturulan
geçici AVD/test dizini kaldırıldı; mevcut AVD veya kullanıcı verisi temizlenmedi.

Açık: gerçek PC TLS/ACL/revoke/aktarım, gerçek queue resource sender, Expo/UI tam
akışı, JobService dispatch/boot/Doze/lock, API24/OEM/16KB runtime ve release/fiziksel
kabul. Büyük arşiv IO/pil ve metadata büyümesi bulgusu hâlâ açıktır; cleanup/retention
politikası eklenmedi. iOS locality/provider/Files/Photos/background işleri ayrıca
açık kalır; bu dilim iOS'a veya fiziksel kabule kendiliğinden geçmez.
