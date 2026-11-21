# Faz3 MANIFEST — 20.11.2026 (devam: P3-00 → P3-01)

## Ekip devam kaydı — 20.11

- 21.11 FTPS-4 **DECISION**: [bağımsız review](p3-06/review.md) son inert
  probda 10 ms ADB temizlik payına 50 ms uyku, emülatör için üst son
  tarihten bağımsız süre ve alt çağrıda çift saat okuması buldu. İlk
  yaklaşım=2; yeni yürütücü mutlak süre FIX başarısız=2. Üçüncü aynı
  yaklaşım yok. Runtime PASS reuse, tarif gerçek ortamda denenmedi.
  Tek devam: GPT tasarım kararı. FTPS-1…4 kabul/commit/push açık.

- 21.11 FTPS-4 yeni yürütücü dar FIX review dönüşü: Docker aidiyeti ve
  temizlik sinyali karşılandı; mutlak süre açık (10 ms → 120 ms inert).
  İlk yaklaşım=2, yeni yürütücü dar FIX başarısız=1. Tek devam: plandaki
  kalan süre hesabını aynı Sonnet'e devret ve ardından aynı reviewer;
  runtime kanıtı reuse, kabul/commit/push yok.

- 21.11 yeni FTPS-4 yürütücüsü bağımsız review **FIX**: belirsiz create,
  grup kapatmaya ayrılmış bütçe ve temizlikte sinyal açık. Yeni tasarım
  inceleme başarısız=1, önceki tarif yaklaşımı=2, runtime kanıtı reuse.
  Tek devam: plandaki üç dar hata yolunu aynı Sonnet ile yalnız tarifte düzelt
  ve inert doğrula; aynı reviewer. Kabul/commit/push henüz yok.

- 21.11 FTPS-4 yeni tasarım `next-plan.md` §3 FTPS-4 DECISION'da: önceden
  kayıtlı sahiplik, mutlak zaman bütçesi, tek temizlik yürütücüsü. Tarif
  başarısız=2 ve önceki runtime PASS korunur. Tek devam: mevcut Sonnet
  oturumunda yalnız tarif uygulaması ve sahte komutlarla dar doğrulama.

- 21.11 FTPS-4 tarif **DECISION**, [bağımsız review](p3-06/review.md):
  başarısız=2. Sunucu oluşturulup başlatılamazsa temizlik atlanabiliyor;
  boot döngüsünde takılan ADB çağrısı zaman aşımını engelleyebiliyor.
  Üçüncü aynı yaklaşım/FIX ve yeni koşu yok. Host/Android runtime kanıtı
  geçerli, yeni tarif uçtan uca koşulmadı. Tek sonraki adım: farklı hata
  yönetimi tasarımı kararı; FTPS-1…4 scoped kabulü açık.

- 21.11 FTPS tarif FIX-1 bağımsız [dönüş](p3-06/review.md#scoped-fix-1-dönüşü--21112026):
  kritik hata yayılımı/aidiyetli temizlik/doğrulama eksik, tarif başarısız=1.
  Tek sonraki adım aynı Sonnet ile mevcut `ftps-android/build-recipe.sh`
  içinde hatada durma, sınırlı temizlik ve APK içi doğrulama; salt statik.
  Ardından aynı reviewer. Runtime PASS reuse; diğer sayaçlar değişmez.

- 21.11 P3-06-FTPS-1…4 **scoped FIX — yalnız tekrar üretim tarifi**:
  [bağımsız review](p3-06/review.md), GPT `ses_e02b92a99ffeq0YRpAWUiBcSB2`.
  Aktarım ve temizlik kanıtı doğrulandı; kapanış açık. Aynı Sonnet Medium ile
  `ftps-android/build-recipe.sh` içinde boş geçici kökten uçtan uca tek tarif.
  Salt statik kontrol; yeni build/cihaz/FTPS yok. Ardından aynı GPT reviewer;
  önceki sayaçlar ve runtime kanıtı korunur.

- 21.11 P3-06-FTPS-2…4 **REVIEW-READY** — aynı Sonnet Medium;
  [Android kanıtı](p3-06/ftps-android/RESULT.md). HEAD `508b3f04…`;
  klonda test-only JNI/APK ve pozitif seçici, canlı kaynak/asset değişmedi.
  İlk auth fixture uyumsuzluğu düzeltildi; ikinci koşuda tek sentetik aktarım,
  alıcı SHA/boyut ve kalıcı fiş doğrulandı. Geçici servis/AVD/reverse/anahtar
  temizliği kaydedildi. Tek sonraki adım: bağımsız GPT scoped review.
  Tam P3-06, iOS ve Faz3 açık; eski sayaçlar korunur.

- 21.11 P3-06-FTPS-1 alternatif [ProFTPD host temsilcisi](p3-06/ftps-host-representative/proftpd/RESULT.md)
  taze yeşil: iki normal explicit TLS aktarımı, doğrulanmış CA/hostname,
  byte+SHA ve sağlıklı kapanış. Session reuse zorunluluğu yalnız geçici loopback
  fixture'da kapalı; ürün trust değişmedi, reuse uyumluluğu kanıtlanmadı.
  Tek devam: aynı Sonnet Medium ile FTPS-2 ayrı test paketi → FTPS-3 tek
  Android pozitif aktarımı → FTPS-4 aidiyetli temizlik → bağımsız review.
  Android ve bağımsız kabul henüz çalışmadı; eski vsftpd sayaçları korunur.

- 21.11 P3-06-FTPS-1 **PARTIAL** — aynı Sonnet Medium `ses_e04dba005ffeLlgijB58tGGxLQ`.
  [Taze host kanıtı](p3-06/ftps-host-representative/RESULT.md): doğrulanmış CA/hostname ile
  explicit TLS, sentetik 1 MiB upload/readback boyut+SHA eşleşti; vsftpd master TLS
  veri oturumu sonunda SIGSEGV/139. Kararlılık yaklaşımı başarısız=2; ürün FIX sayacı
  değişmedi. Android koşulmadı. Sunucu durmuş, portlar boş.
  Tek kontrollü kapanış tanısı bitti: veri bağlantıları kapandıktan sonraki 5 sn
  süreçler canlı; QUIT ardından çocuklar çıktı ve konteyner 139 ile bitti.
  Sinyal alan PID ve çöken işlev bilinmiyor. Başarılı aktarım kanıtı reuse;
  tanı taze, kararlılık başarısız=2. Restart/Android yok.
  Kullanıcı geçici tanıyı ve kapsam içi rutin fixture kurulumlarını onayladı.
  Koordinatör kararı: debugger koşusu yok; çöken sürümle yeni koşu yok. Tek
  sonraki adım: aynı Sonnet ile güncel standart fixture adayını doğrula.
  FTPS-1 PARTIAL; kabul açık.

- 21.11 FTPS önkoşul dilimi tamamlandı: Sonnet Medium `ses_e04dba005ffeLlgijB58tGGxLQ`.
  Onaylı host temsilcisi çağrısı kota nedeniyle kesildi; sonuç yok.
  21.11 Türkiye saati 02:50 sonrası `/ekip devam`: aynı Medium oturumu,
  önce kısmi çıktı/konteyner aidiyeti. Test veya FIX sayacı değişmedi.

- `/ekip devam` alındı; Faz3 **KISMİ / UYGULAMA**.
- Sonnet `ses_e04f89720ffejRskA2hG9kjTdr` (`claude-agent/sonnet#medium`):
  dar D13 ve P3-11 ölçüm dilimi tamamlandı; aktif koşu yok. Önceki `ses_e06c2261affe7HUpgh59rZQgiH` P3-11
  klavye dilimiyle tamamlandı; bağlam yeni göreve taşınmadı. Reviewer
  `ses_e05b3160cffetF78VQHyjKxkcP` önceki scoped kabullerde kullanıldı, şu an aktif değil.
- P3-04 onaylı test düzeltmesi kısmi; iki WATCH senaryosu kapsam kararında.
  P3-05/P3-06 işlendi. P3-12 sonuçları kota sonrası aidiyet doğrulanarak
  korundu. P3-07/08 Dropbox ve P3-09 yükseltme koşuları önkoşulda bloklu.
  P3-11 host ölçümü, P3-03 Debug ve P3-01 paketleme/statik kanıtı kaydedildi.
  P3-10 Desktop render ve iOS capture kayıt uyumu kanıtı geldi. iOS temsilcisi
  referans/fixture önkoşulunda durdu. Önce görsel referans kararı; M13-alt
  tekrarı, referanssız build/capture ve ayrı review yok.
  Kota kesintisi başarısız test veya FIX denemesi değildir.
- Kullanıcının kafa karışıklığı: rutin test/rol sırası kendisine seçtiriliyor,
  teknik kanıt için yer tutuculu mesajlar veriliyor, engeller çözülmeden sona
  taşınabiliyor. Yeni ekipte kullanıcı ajanlar arası mesaj taşımaz.
- Sonnet talimatı: **bul → kök nedene göre grupla → çöz → dar doğrula**.
  Geçerli kanıtı reuse et, aynı nedene hücre başına FIX açma; zorunlu açığı sona
  yığma. Teknik DECISION koordinatöre; fiziksel eylem/gerçek kapsam kararı kullanıcıya.
- P3-10 5 FAIL geçmişi korunur; aynı mekanizmayı körlemesine tekrarlama.
  state_unavailable ve 35/35–73/73 araç testleri görsel kabulü kapatmaz.
- İlk devam: CURRENT ekip checkpoint'i ve plan §3; mevcut P3-04 önkoşul/dar compile
  sırası. P3-10 uygulanabilir yolunun kapsam değerlendirmesi koordinatörde.
- Bu kurulumda ürün/runner değişikliği ve regresyon/build/cihaz koşusu yok.
- Yapılandırma kanıtı: [team-setup-check.log](team-setup-check.log).
  `opencode debug agents` exit 0: koordinatör/reviewer GPT-6.2 Sol,
  uygulayıcı Sonnet 5.5 high, primary/subagent rolleri ve izinler yüklendi.
  Bu kurulum kaydı uçtan uca yürütme PASS'i değildir.

Aday: HEAD `508b3f0486a7ce04628ec0c3681d995573e5721d`, staged boş, P3-S0 = 1601 girdi,
SHA256 `ecf7b3ad25b799c165027308edc47d8988933935e7639b2f53977555d3a2f353`
(faz3-research.md algoritmasıyla bu oturumda yeniden hesaplandı, eşit; script `/tmp/p3s0.py`, repo dışı).
Kod/fixture/build değişikliği yok. Ham loglar `logs/`.

| ID | Sonuç | Kanıt |
| --- | --- | --- |
| P3-00 | **REUSE (eşleşti)** | `check` errors=[]; `list` 2.5 envanteri. FIX-R4 desktop-smoke 10/10 ve ios-smoke 17/17 fingerprint dosyası güncel kaynakla byte-eşit; Desktop PNG sha `5a6f372e…3594` kayıtlı. iOS fixture `ba35dad4…` READY, `.app` mevcut; Xcode 27.2/27B52, iOS 26.5 runtime. Taze capture koşulmadı (girdi değişmedi). |
| Önkoşul | Hedef/ortam | Simulator listesinde `Kloda-Capture25-*` yetim cihaz yok; 8081 dinleyen yok; `adb devices` boş (çalışan emülatör yok); AVD'ler `KlodaCloud18`, `KlodaFtps16c`, `Pixel_9_Pro` — **aidiyeti bu oturumda kanıtlanmadı**, kullanılmadı. JDK 17.0.19, `ANDROID_HOME` set, disk 84 GiB boş. |
| P3-01 | **FRESH PASS (JS/host kısmı)** | mobil Jest 54 suite / 322 test exit 0; Desktop Vitest 377/377 exit 0; mobil `tsc --noEmit` exit 0; Desktop `tsc -p tsconfig.json` exit 0 ve `tsc -p tsconfig.main.json` exit 0; mobil ve Desktop `npm run lint` exit 0. |
| P3-01 paketleme/statik | **Taze PASS — belirtilen kapsam** | [Kanıt](p3-01/RESULT.md): Android/iOS `expo export`, TR/EN/DE anahtar/değişken/boş değer parity, dar stil/ikon taraması; ≤300 ve FSD önceki ESLint kapsamıyla reuse. Sabit metin, kullanılmayan/eksik çağrı anahtarları ve nesne referanslı inline stil kapsanmadı. TS2882 yeniden üretilmedi, nedeni doğrulanmadı. Native lint ayrı. |
| P3-02 | **Taze build/link kanıtı + renderer REUSE** | [Sonuç ve hash'ler](p3-02/RESULT.md): Android arm64 app + androidTest, iOS arm64 Simulator Debug (SMB/SFTP/FTPS native varyantı), Desktop main exit 0; Desktop renderer stamp eşleşti. Ürün/test kaynağı değişmedi. Apk/uygulama klon yollarında; eski canlı artefakt kullanılmaz. P3-03 üç fabrika için statik önkoşul karşılandı, runtime NOT_RUN. iOS S3 native opt-in bu çıktının dışında; gerekliyse sözleşmeye göre ayrıca eşle, PASS sayma. |
| P3-04 | **PARTIAL** | [Sonuç, APK hash'leri ve ANR kanıtı](p3-04/RESULT.md): FL1 ve R2 clean taze davranış RED→GREEN; final lock 7/7, same-token B ve R2/FP2 taze GREEN. Lifecycle 31/39 grup kanıtlı (ayrı koşu/seçiciler, tek tam PASS değil); 8 grup için iki temsilci ANR ve ortak düzenek engeli. F1 kaynakları final 6/6; canlı kaynak değişmedi; AVD/Gradle temizlendi. Başarısız FIX sayacı değişmedi. |
| P3-04 aday ayrımı | **Capture deltası / F1 etkilenmedi** | Taze 1604 girdi `b6eddf88c9f1ca8d07b8b35af0a5d9969d7c3b19291d65148d1689fd8f0f9037` P3-S0 değil: onaylı P3-10 capture farkı ve iki üretilmiş `.pyc`; F1 final kaynak hash'leri eşit. P3-S0 ve varyantlar korunur; P3-04 klon build'i P3-02 ürün APK PASS'i değildir. |
| P3-04 test düzeneği | **SCOPED FIX KISMİ — 6/8, 2 WATCH açık** | [Diff, derleme ve koşu kanıtı](p3-04/logs/RESULT-fix.md): altı JOB senaryosu ve altı komşu kontrol taze PASS (temsilci + 11'li seçili koşu); iki WATCH fail-fast ile açık, ANR tekrarlanmadı. Üretim değişmedi; iki test dosyası değişti. Seçili koşular tam lifecycle PASS'i değildir. |
| P3-10 M13-alt TR/light/normal | **FAIL-TEST/FIXTURE (2/2, DUR)** | Capture-only delta (P3-S1): yeni `apps/mobile/capture/scroll.ts`; `entry.tsx`/`screens.tsx`/`protocol.ts` (`settings-bottom` + `scroll` raporu); `tools/ui-capture/{ios.py,matrix.json,test_capture.py,test_matrix.py}`. Satır `ready` yapıldı. Ürün kodu değişmedi. Python `unittest` 72/72 OK, capture tsc/eslint 0 (`logs/p3-10-*`). Native koşu 1: `p3-10-settings-bottom/` ve koşu 2 (fiber `alternate` taraması eklendi): `p3-10-settings-bottom-2/` → ikisi de FAIL, neden `no scroll measurement` (`scroll: null`); layout/font/dil/tema/appState geçti. Cleanup ikisinde `CLEANED`, yetim Simulator/Metro yok. PNG üretilmedi, hücre PASS sayılmaz. |
| P3-10 neden | Hipotez (kanıtsız) | `scroll: null` iki yoldan gelir: ScrollView örneği fiber taramasıyla bulunamadı, ya da `getNativeScrollRef()` sayısal scrollTop/scrollHeight/clientHeight vermedi. Rapor ikisini ayırt etmiyor. Aynı yaklaşım iki kez başarısız → üçüncü deneme yok; karar GPT'de. |
| P3-10 koşu 3 (yeni mekanizma) | **FAIL-TEST/FIXTURE** | Fiber yaklaşımı bırakıldı (2/2 ret). Yeni: `scroll.ts` DOM-benzeri `children` taraması + `ScrollViewCommands.scrollToEnd` + rapora `scrollNote`. Python 72/72, capture tsc/eslint 0. `p3-10-settings-bottom-3/` → FAIL `no scroll measurement (no-element)`: host altında `scrollHeight > clientHeight` olan düğüm bulunmadı. Cleanup `CLEANED`, yetim yok. Ürün kodu değişmedi. |
| P3-10 neden (güncel) | Daraltıldı, kanıtsız | `no-element` = ya Settings iPhone 17 Pro/TR/normal'da zaten taşmıyor (kaydırılacak içerik yok), ya DOM geometri API'si Fabric ScrollView için 0/eşit döndürüyor. İkisi ayrılmadı. Dördüncü deneme yok; karar bekliyor. |
| P3-10 teşhis koşusu (4) | **FAIL — kök neden daraldı** | `p3-10-settings-bottom-4/`: `no-element nodes=0 host=none best=none`. `hostRef.current` null: capture host `View` ref'i (nativewind `className` sarmalı altında) bağlanmıyor. Üç koşunun ortak nedeni bu; fiber/DOM/Settings taşması hipotezleri host olmadan test edilemedi, Settings'in sığıp sığmadığı HÂLÂ bilinmiyor. Capture tsc/eslint 0; cleanup `CLEANED`. Ürün kodu değişmedi. |
| P3-10 ref düzeltmesi (5) | **FAIL — varsayım çürüdü** | `entry.tsx`: ref className'siz düz `View style={flex:1}`'e taşındı. `p3-10-settings-bottom-5/`: yine `nodes=0 host=none`. Yani nativewind sarmalı kök neden DEĞİL; `hostRef.current` neden null kalıyor bilinmiyor (ref okuma zamanı, Fabric public instance veya rapor yolu olabilir; hiçbiri kanıtlanmadı). Capture tsc/eslint 0, `CLEANED`. 5 native koşu, hepsi FAIL; DUR. |
| P3-10 karar (20.11) | **DECISION → GPT plan (B)** | Kullanıcı: ref/fiber/DOM mekanizması bırakılır, GPT daha sade tasarım verir. Bu arada `mobile.settings-bottom` matrix satırı `ready` ama hücre doğrulanmadı (5/5 FAIL); PASS sayılmaz, GPT kararına kadar capture delta'sına dokunulmaz. Aday girdileri: `onLayout` içerik/görünür yükseklik ölçümü, `ScrollView` için capture-only `onContentSizeChange`/`onScroll` olayları. Hiçbiri denenmedi. |
| P3-10 M13-alt matris kararı | **`state_unavailable` — görsel kabul açık** | Kullanıcı onayıyla `mobile.settings-bottom` satırı ve 12 varyantı `ready` kapsamından çıkarıldı. Gerçek `MobileSurface` ScrollView olaylarını capture girişine açmıyor; dış `onLayout` alt konumu doğrulamaz. `mobile.settings` değişmedi. Beş tarihî `FAIL-TEST/FIXTURE` korunur; ref'in `null` kalma nedeni kanıtlanmadı. Ürün kodu veya capture mekanizması değişmedi; yeni native koşu yok. |
| P3-10 matris durumu | **DOĞRULANDI** | `mobile.settings-bottom` = `state_unavailable` (12 hücre, neden: gerçek Settings scroll sonuna doğrulanmış yol yok). `test_matrix.py` 35/35, tüm ui-capture 73/73 OK (bu oturumda yeniden koşuldu). 5/5 FAIL kaydı korunur; M13-alt görsel kabulü AÇIK. |
| P3-05 Android lint | **PARTIAL — exit 1, PASS yok** | [Taze kanıt](p3-05/RESULT.md): dar ve onaylı K1 tam raporda modül 3 error / 78 warning; K1 app 0 error / 28 warning ve worklets çökmedi. İki `MissingPermission` (`AndroidDeviceCheck.kt:40,45`) tek izin ailesi ve bir `NewApi` (`AndroidS3Automatic.kt:46`) aynı tarihî bulgular. Fix2 FTPS kapsamında yeni `UseKtx` warning'i var; önceki 0/0 güncel değil. Varsayılan K2 ve yeni P3-04 test deltası lint kapsamı doğrulanmadı. Kaynak, artefakt, lint suppression değişmedi; aynı koşuyu tekrar etme. Ürün FIX yetkisi yok; açıklar kapanıştan önce değerlendirilir. |
| P3-05 dar devam | **Biyometrik bildirim FIX / S3 ürün kararı açık** | [Kök neden](p3-05/lint-design-note.md): `USE_BIOMETRIC` birleşik Debug manifestte zaten var; modüldeki açık bildirim için aynı izin kümesi ve dar lint kanıtı gerekir. S3 setter API26, API24/25 çağrı yolu korunmuyor; otomatik S3 davranışı kararı olmadan S3 değişmez. Tam lint PASS yok. |
| P3-05 biyometrik bildirim | **ACCEPTED — yalnız bu FIX** | [Bağımsız inceleme](p3-05/biometric-fix/review.md), [kanıt](p3-05/biometric-fix/RESULT.md): tek `USE_BIOMETRIC` bildirimi, aynı Debug varyantında birleşik manifest byte-eş, izin öğe/nitelikleri 20=20 ve ADR0029 değişmedi. İki `MissingPermission` kapandı; dar lint exit 1, yalnız S3 `NewApi` kaldı. Reviewer yeni koşu yapmadı. Tam lint, diğer varyantlar ve Faz3 açık. |
| P3-05 S3 API 24/25 | **REVIEW → kanıt bekliyor (S3-3)** | [Bağımsız review](p3-05/s3-api-fix/review.md), [sonuç](p3-05/s3-api-fix/RESULT.md), [delta](p3-05/s3-api-fix/s3-api.diff). On dosya/hash, native guard kaynakları, mock JS 16/16 ve dar lint 0 hata (78 uyarı) doğrulandı. Ürün FIX bulgusu yok; yalnız derlenen API sınırı assertion'ı mevcut `s3-automatic-contract` ile yürütülecek. Bu gerçek API24/25 cihazı veya K2/worklets tam lint değildir. Başarısız FIX sayacı değişmedi. |
| P3-05-S3-1/2/3 | **ACCEPTED — yalnız S3 dar FIX** | [Bağımsız kabul](p3-05/s3-api-fix/boundary-run/review.md), [sınır koşusu](p3-05/s3-api-fix/boundary-run/RESULT.md): canlı 10/10 hash ve gerçek diff eşleşti. Sahipli arm64 API35 AVD'de `s3-automatic-contract` code −1/exit 0; SDK 24/25 false, 26/35 true parametre kontrolleri yürütüldü. Yeni reviewer koşusu yok. Gerçek Android 7 davranışı, Android 8+ planlayıcı teslimi, tam lint ve Faz3 açık; sayaç değişmedi. |
| P3-05 tam K1 lint | **FRESH PASS — app/modül K1** | [Kanıt](p3-05/full-k1-after/RESULT.md): exit 0; app 0 hata/28 uyarı, modül 0 hata/78 uyarı, androidTest derlendi. Worklets ana analiz UP-TO-DATE, AndroidTest/UnitTest analizleri başarılı; ayrı Worklets lint raporu yok. Suppression veya exclusion yok, üç tarihî hata kapandı. Varsayılan K2 ve gerçek cihaz davranışı bu koşunun dışında. |
| P3-06 native/TLS | **PARTIAL — host PASS; FTPS wire BLOCKED-ENV** | [Taze sonuç ve kaynak eşlemesi](p3-06/RESULT.md): pairing host/JNI-özellikli host 162/162 ayrı ayrı, iOS route harness 3/3, Swift host sözleşmeleri ve ELF/RELRO kontrolleri geçti. Tam APK denetiminin x86_64 beklentisi arm64 adayına uymadı; arm64 içerik dar kontrolde geçti. B3 Rust 9/9 kaynak eşit, reuse; 16c runtime güncel adaya taşınmaz. Android/iOS FTPS ağ koşusu yapılmadı: eski loopback sunucusu ve eşleşen test anahtarları yok; yeni FTPS fixture mevcut onay dışında. L15 eski hash kaydı güncel eşitliği kanıtlamıyor; B4 fiziksel ve B2/B15 release kapıları ayrı. |
| P3-06 FTPS yeniden kullanım | **Dar istisna onaylı / önkoşul denetimi** | [Dar kaynak eşlemesi](p3-06/ftps-wire-reusability.md): eski sunucu/anahtar yok, eski `.so` aday değil. §3 P3-06-FTPS-1…4: standart yerel sunucu → host TLS → arm64 yalnız test APK → tek Android aktarımı. Eski dosyalar ve ürün trust korunur; doğrulama/iOS açık, sayaç değişmedi. |
| P3-06 FTPS sunucu önkoşulu | **Geçici konteynerle edinim onaylı / host doğrulaması sırada** | [Önkoşul denetimi](p3-06/ftps-fixture-preflight.md): hazır sunucu yok; [Ubuntu 24.04 deposunda](https://packages.ubuntu.com/noble-updates/vsftpd) arm64 `vsftpd 3.0.5-0ubuntu3.1`. Kullanıcı yalnız bu geçici konteyner için Ubuntu deposundan edinimi onayladı; ana sistem/ürün kurulumu yok. Önce host TLS ve sentetik dosya; yalnız geçerse mevcut test yükleyicisi ve bir pozitif seçiciyle Android'e geçilir. |
| P3-12 DAV/recovery | **PARTIAL — iki taze temsilci** | [Kanıt](p3-12/RESULT.md): `webdav-os` ve `webdav-photos-restore` yeni test CA/APK varyantında sahipli API35 arm64 `KlodaFtps16c` read-only üzerinde PASS; genel Android DAV JobService/Photos için geçerli, `KlodaCloud18` veya çok-hedef eşdeğeri değil. `KlodaCloud18` kilitli, test kodu çalışmadı; Files restore, çok-hedef ve iOS DAV açık. H15/P15 host 23/23 reuse; L15 normalize eşitliği kesinleştirilmedi. Fixture sunucusu/AVD durdu; [scratch kararı](#p3-12-scratch-ve-cihaz-kararı). |
| P3-07/08 Dropbox | **BLOCKED / NOT_RUN** | [Önkoşul kanıtı](p3-07-08/RESULT.md): sahipli test hesabı/hedef ve kilitsiz uygun AVD doğrulanmadı; Android otomatik teslim, iOS >150 MiB ve Dropbox Photos için mevcut test desteği yok. Test hesabına giriş tek başına çözmez; yeni test kapsamı netleşmeden fiziksel adım istenmez. Önceki Files ve wiring kendi kapsamlarında. Hesap/ağ/cihaz koşusu yok, sayaç değişmedi. |
| P3-09 Android yerinde yükseltme | **PARTIAL / NOT_RUN** | [Önkoşul kanıtı](p3-09/RESULT.md): eski ve aday APK hash'leri, `com.kloda.app`, imza ve arm64 eşleşti. İki APK da versionCode 1; aynı-sürüm değişimi veri korunumuna kanıt olabilir, sürüm artışını kanıtlamaz. İzinli eski sentetik kurulu durum ve tarif bulunmadı; APK kurulmadı. Recovery UI kanıtı ayrı açık. Test/FIX sayacı değişmedi. |
| P3-11 erişilebilirlik/performance | **PARTIAL** | [Kanıt](p3-11/RESULT.md): sentetik host kaynak ölçümü exit 0; 25 Ekim baseline ile aynı, eşiksiz ölçüm, PASS değil. Erişilebilirlik ve gerçek UI açılış/etkileşim/CPU/bellek **NOT_RUN**; hazır yol doğrulanmadı. Fiziksel pil/ısıl ayrı. |
| P3-11 D12 klavye/odak | **Dar 21/21 — alternatif test köprüsüyle** | [Kanıt](p3-11/desktop-keyboard/RESULT.md): 1440×1000/TR/koyu, taze D12 kaynak damgası; gerçek Tab/ok tuşu, radio ad/rol/seçim, görünür odak ve Çık'a erişim (etkinleştirilmedi). Standart Proxy stub iki kez takıldı, neden izole değil; üçüncü koşu yok. Test betiğindeki salt-okunur düz nesne köprüsüyle geçiş gözlendi. Native, ekran okuyucu, kontrast ve tam P3-11 açık. |
| P3-11 Desktop açılış | **Taze gözlem — tek örnek** | [Ölçüm](p3-11/desktop-startup/RESULT.md): mevcut renderer, 521×849/TR/koyu; ilk içerikli çizim 128 ms, hazır ekran gözlemi 144,3 ms (bekleme dahil üst sınır). Exit 0; eşleşen baseline veya eşik yok, performans PASS değil. Native açılış, CPU/bellek/I/O, ekran okuyucu ve kontrast açık. |
| P3-03 JS→native UUID | **FRESH PASS — iki Debug platformu** | [Kanıt](p3-03/RESULT.md): P3-02 ile eşleşen binarilerde Android arm64 ve iOS arm64 Simulator, platform başına üç native fabrika × iki çağrı = 6 geçerli ve 6 benzersiz UUID; JS fallback yok. Değer kaydı yok. İki iOS launch düzenek hatası düzeltildi; CDP kullanılmadı. UI/Release/fiziksel cihaz sonucu değil. |
| P3-10 hazır temsilci | **PARTIAL — render var, görsel kabul açık** | [Kanıt](p3-10/RESULT.md): Desktop Ayarlar TR/light/normal 1440 px exit 0, CLEANED, taşma/console hatası yok; PNG eski smoke ile byte-eş. Sabit Desktop referans PNG yok, Lovable kaynak farkları onaylanmış sayılmaz. iOS `check` exit 1: ready olmayan M13-alt hâlâ capture registry'sinde. `list` exit 0; kapsam sayıları (48/60) henüz uzlaştırılmadı. |
| P3-10 iOS registry | **Dar FIX doğrulandı; native capture ayrı** | [Kanıt](p3-10/registry-fix/RESULT.md): yalnız `screens.tsx`; `check` exit 0, matris 35/35, capture tsc ve ESLint exit 0. 48/600 efektif hazır (Desktop 6+6, iOS 12+12+12); 60 kaba satır sayısı, Desktop large override'ları düşülünce 48. M13-alt 12 unavailable ve 5 FAIL aynı; görsel kabul yok. |
| P3-10 iOS Lovable temsilcisi | **BLOCKED / NOT_RUN** | [Önkoşul kanıtı](p3-10/ios-representative/RESULT.md): seçilebilen üç iOS ekranına eşleşen frozen JPG yok. `ba35dad4…` doğrulamasında 245/247 girdi eşit; kalan fark fixture tarif kimliği, mevcut uygulama yeniden kullanılmadı. Simulator, Metro, build veya capture çalışmadı. Önce bağlayıcı referans, sonra mevcut `prepare-ios` tarifi değerlendirilir; kaynak karşılaştırması görsel kabul yerine geçmez. |
| P3-10 sabit referans | **Karar bekliyor** | [Uygunluk kanıtı](p3-10/reference-image-eligibility.md): altı cb1143 görüntüsü emekli ve hedef ekranları kapsamıyor; c144 manifestindeki yedi JPEG de Karşılama, sağlayıcı, mobil/masaüstü Ayarlar ve tray için uygun değil. Ürün çıktısı referans sayılamaz. Revizyonların belge envanteri düzeltildi; tasarım/kabul sözleşmesi değişmedi. |
| P3-10 referans edinimi | **Beş prototip görüntüsü kaydedildi; kabul açık** | [Görüntüler ve hash'ler](p3-10/lovable-c144-preview/README.md): Lovable HEAD `c144e98938da96f698f378972290ff3d1dd311eb`; giriş sonrası beş HTTP yanıtında revizyon `c144e989`. TR/koyu prototip çekimleri; Desktop dar viewport (1440 px eşleşmesi yok), mobil web/native boyutları farklı. Ürün görsel PASS'i değil; tasarım, yayın ve fixture değişmedi. |
| P3-10 D12 tek karşılaştırma | **Render temiz / tasarım eşleşmesi açık** | [Aynı nominal 521×849, TR/koyu karşılaştırması](p3-10/desktop-settings-matched/RESULT.md): bölüm sırası ve çıkış düğmesi konumu farklı; pencere kapatma ve OS durumu farkları ADR0018 sınırında ayrı değerlendirilir. 15 px scrollbar farkı nedeniyle piksel eşleme yapılmadı. Standart matris veya geniş viewport PASS'i değil. |
| P3-10 D12 Lovable uyarlaması | **REVIEW → FIX (D12-1)** | [Bağımsız review](p3-10/d12-lovable-fix/review.md), [ilk scoped diff](p3-10/d12-lovable-fix/d12-scoped.diff), [kanıt](p3-10/d12-lovable-fix/RESULT.md). Tek kök: dar panel hiyerarşisi ve boşlukları. Bölüm sırası ve alt Çık doğru; Tema kartı, segment sırası ve Arka plan başlığı düzeltilir. D12-2 korunur; D12-3 mevcut kanıtı reuse, değişen yol için dar taze kontrol. İlk review ret=1; başarısız FIX=0; kota ayrı. Aynı Sonnet, ardından aynı reviewer `ses_e05b3160cffetF78VQHyjKxkcP`. Faz3/1440/native/M13-alt açık. |
| P3-10 D12-1 düzeltmesi | **ACCEPTED — yalnız D12-1/2/3** | [Bağımsız GPT kabulü](p3-10/d12-lovable-fix/fix/review.md), [FIX sonucu](p3-10/d12-lovable-fix/fix/RESULT.md), [dar delta](p3-10/d12-lovable-fix/fix/fix.diff). Önceki panel hiyerarşisi bulgusu kapandı; ADR0018 ve komşular korundu. Başlangıç 8/8 ve son 10/10 hash bağımsız eşleşti; taze uygulayıcı 19/19, dar lint/tsc, renderer ve tek 521×849/TR/koyu çekim reuse edildi, reviewer yeni koşu yapmadı. İlk ret=1, başarısız FIX=0. Bu ürün deltası yalnız ilgili Desktop kanıtlarına yansır; 1440/native/M13-alt/kalan matris/Faz3/Faz4 açık. |
| P3-10 M13-alt girdi yolu | **ONAYLI / tek manuel temsilci** | [Uygulanabilirlik kanıtı](p3-10/m13-bottom-feasibility.md): eski fixture geçersiz, otomatik iOS runner kaydırmıyor. Mevcut Debug artefaktında doğrulanmış Ayarlar yolu ve tek sahipli Simulator oturumunda kullanıcı kaydırması; TR/light/normal, önce/sonra görüntüsü, Hakkında/sürüm satırı tamamen görünür. Yeni otomasyon, OS izni, build veya ürün değişikliği yok. Bu yalnız alt duruma erişim; görsel kabul, matris statüsü ve 5 FAIL değişmez. |
| P3-10 M13-alt normal gezinme | **Alt duruma erişim kanıtlandı — tek manuel varyant** | [Koşu ve cleanup](p3-10/m13-bottom-manual/STATE.md), [üst PNG](p3-10/m13-bottom-manual/settings-top.png), [alt PNG](p3-10/m13-bottom-manual/settings-bottom.png). P3-02 Debug, iPhone 17 Pro Simulator, TR/koyu/normal, 1206×2622 px. Sürüm satırı üstte görünmüyor, gerçek kaydırmadan sonra alt çubuğun üstünde tam görünür. Dev-client Tools örtüşmesi var; eşleşen native referans yok. Simulator silindi ve Metro kapandı; görsel/matris PASS değil, `state_unavailable` ve 5 FAIL aynı. |
| P3-10 M13 yapısal karşılaştırma | **Gözlem — görsel kabul açık** | [Karşılaştırma](p3-10/m13-bottom-manual/comparison.md): ana bölüm sırası, kapalı hücresel kontrol ve yapılandırma sürümü uyarlaması tutarlı. Kart/satır ve başlık yerleşimi farklı; orta bölüm, Tema ve Bildirimler tam görünmedi. Dev-client örtüşmesi ve web/native boyut farkı var. Yeni çekim yok; matris, tarihî FAIL ve D12 kabulü değişmedi. |
| P3-10 D13 dar karşılaştırma | **Render temiz / görsel kabul açık** | [TR/koyu 521×849 koşulu](p3-10/desktop-tray-matched/RESULT.md). G23-01/04 kapsamındaki gerçek durum ve açıklamalı devre dışı duraklatma onaylı uyarlama; demo sayıları kopyalanmaz. Başlık/açıklama biçimi, eksik ikon örneği paneli ve kabuk farkı görsel fark olarak açık, onaylı sayılmaz; destek yoksa pencereyi koruyan açıklama kaybolmamalı. Ürün/runner değişmedi; native/1440/matris kabulü değil. |
| Kalan P3 satırları | **NOT_RUN / açık** | P3-10 görsel kapsam açık. P3-08 Android Nextcloud **BLOCKED-ENV** (ürün Debug APK'da test CA/güven yolu yok). |

### Kalan engeller — 21 Kasım

- **Android doğrulaması (P3-05):** Android 7.0/7.1 otomatik S3 dar FIX ve
  biyometrik bildirim ayrı ayrı kabul edildi. Gerçek sürüm/JobScheduler
  davranışı ve varsayılan K2 açık. İki düzeltme sonrası K1 app/modül lint geçti;
  K2 tarihî çöküşü körlemesine tekrar edilmez.
- **Eksik test düzenekleri / ortam (P3-04/06/07/08/09/12):** WATCH olay
  sırası, FTPS yerel test seti, Dropbox senaryoları ve sahipli hesap, eski
  APK'da sentetik durum, Nextcloud güveni ve eksik DAV senaryoları. Satırların
  kendi kanıtları ve ayrı sınırları geçerli; test hatası ürün hatası sayılmaz.
- **Eksik görsel ve ölçüm kanıtı (P3-10/11):** D12 dar kabul ve M13 tek manuel
  erişim korunur; eşleşen görsel varyantları, D13/M13 tasarım farkları, native
  erişilebilirlik ve karşılaştırılabilir performans ölçümleri açık. Host
  ve renderer gözlemleri bu kapıları kapatmaz.

Bu liste kabul/erteleme kararı değildir. Kapanıştan önce zorunlu ölçütler
kanıtlanmalı; Faz4 ve release kapıları kendi aşamasında kalır.

**P3-10 dar koordinatör kararı:** §3'ün onaylı capture-only sınırında yalnız
`apps/mobile/capture/screens.tsx`: `settings-bottom` çalıştırılabilir registry
ve scroll hedefi listesinden çıkarılır. Bu, onaylı `state_unavailable` kararının
uygulanmasıdır; matris satırı, 12 hücre, beş FAIL ve görsel kabul açık kalır.
Diğer üç iOS adapter, ürün ve runner davranışı değişmez. Yalnız güncel `check`,
dar tip/lint ve mevcut matris testi; yeni capture/build yok. Desktop render
kanıtı Lovable görsel kabulü yerine geçmez.

Log dosyaları: `logs/p3-01-*.{log,exit}`.
P3-10 matris doğrulaması: `python3 -B -m unittest discover -s tools/ui-capture -p test_matrix.py`
→ 35/35 PASS, exit 0 ([log](logs/p3-10-matrix-unavailable.log)). Matris PASS'i görsel kabul değildir.
Açık kapılar: F1 fix2 compile/RED-GREEN/lint, G1-07/G456-07/G24-07 görsel, FO1/Faz4, step19, OS/fiziksel/release.

### P3-12 scratch ve cihaz kararı

Mevcut sahipli scratch eşleşen test APK'sı için DAV'a bağlı kontrollerin
sonuçlandırılmasına kadar yerel ve kapalı tutulur. Özel anahtarlar 0600,
aktarılmaz veya loglanmaz; ikinci set, yeniden `prepare` veya toplu silme yok.
Bu kısıtlı reuse, ayrı Nextcloud güven sorununu çözmez. `KlodaFtps16c` kanıtı
yalnız çalıştırılan iki genel DAV temsiline bağlıdır; Cloud18'e bağlı senaryoda
hedef eşdeğerliği varsayılmaz, PIN/kilit değiştirme yok. Bağlı DAV işi bittiğinde
scratch'ın kapatılması için araçtaki sahiplik doğrulamalı yolu değerlendir.

### P3-04 test düzeneği kararı

Kullanıcı onaylı tek istisna: yalnız `AndroidFtpsLifecycleChecks.kt` (`staleOrigin`)
ve `AndroidFtpsPolicyChecks.kt` (`destroyedWatch`), sadece test senkronizasyonu.
Mevcut arbiter dışı gate/latch yolunu önce değerlendir; gate, her senaryonun
gerekli A aşamasına ulaştığını ve B/destroy olayından önce beklediğini kanıtlamalı.
Erken genel capture gate'i post-claim/commit kanıtı yerine geçmez; bu nokta
kanıtlanamıyorsa geçiş yapıp PASS verme. Geç A'nın B'nin durable P/run/token,
JOB/WATCH, hata veya yabancı lease durumuna dokunmaması ve OS çağrısı yapmaması
assertion'ları korunur; bütün bekleme yolları hata halinde de serbest kalır.
Üretim, test beklentileri, genel runner ve altyapı değişmez. Onay sonrası ayrı
test varyantı hash'i; temiz read-only AVD'de önce tek ANR temsilcisi, sonra
etkilenen 8 grup + gerekli FL1/R2 komşuları. Diğer geçerli kanıt reuse.
Post-claim kanıt boşluğu ve R2 owner/delivery eşlemesi ayrıca açık kalır.

İlk uygulama sonrasında: WATCH `changed()` capture'ı arbiter altında çalışır;
JOB'daki arbiter dışı capture gate'i burada güvenle kullanılamaz. İki WATCH
dalındaki fail-fast geçici blokajdır; assert'lere ulaşmaz, kabul edilemez.
Statik eşleme teşhis desteğidir, zorunlu gerçek teslim kanıtının yerine geçmez.
Sentetik `onStartJob` gerçek teslim kanıtı sayılmaz. Üretime dar test sıralama
noktası eklemek mevcut onayın dışında; şimdilik üretim değişikliği/aynı koşu yok.
Yeni aday ayrımı `4af8fbfc46ca…`, yalnız iki test kaynağı; P3-02 ürün artefaktları
etkilenmedi. WATCH için yeni yaklaşım veya başarısız FIX sayacı artışı kaydedilmedi;
mevcut fail-fast koşuları çözüm denemesi veya PASS değildir.
