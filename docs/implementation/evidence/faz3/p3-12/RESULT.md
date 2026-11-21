# P3-12 sonuç — 20.11.2026 (Sonnet 5.5; MANIFEST/CURRENT/plan işlenmedi)

Ham kanıt: bu dizin (`*.log` komut+zaman+`EXIT=`, `*.sha256`). Kota kesintisi: bu oturumda gözlenen yeni bir kota/araç hatası yok; devamda yalnız durum doğrulandı, test/FIX sayacı artmadı. Effort: görünen tek değer sayısal `reasoning_effort = 10`; medium/high karşılığı doğrulanamıyor, tahmin edilmedi.

## 1. Devam kontrolü (aidiyet)
Başlangıçta yalnız benim başlattığım iki süreç vardı: fixture sunucusu pid 77450 (komut `-I tools/mobile-webdav-https-fixture.py serve`, pid dosyam `/tmp/p3-12-server.pid`) ve emülatör `KlodaFtps16c` (-read-only, port 5590). Başka kaynağa ait süreç/dosya yok. İki koşu logu tam. Scratch `/tmp/kloda-step15/https-fixture` bu koşuda ben oluşturdum (önceden yoktu: `ls` hata); dolu scratch ezilmedi, ikinci fixture üretilmedi.

## 2. Kaynak/fixture provenance
- İzole kopya `/private/tmp/kloda-p3-12` (APFS klon; modül `src` + `tools` canlıyla eşit). Tek kaynak farkı `androidTest/res/raw/kloda_dav_fixture_ca.crt`: eski `bc88c4f2…` → yeni public CA `25db2982a4c820a5…` (CN "Kloda disposable DAV fixture CA", CA:TRUE, 10 yıl). **Canlı ağaçta CA hâlâ `bc88c4f2…`**, ürün/TLS/trust/Nextcloud değişmedi, canlıda ek değişiklik yok.
- `prepare` (`python3 -I tools/mobile-webdav-https-fixture.py prepare`, klonda) exit 0 (`prepare.log`). Özel anahtarlar yalnız `/tmp/kloda-step15/https-fixture/*.key` (0600); repo/klon/log içinde anahtar yok (arama 0, loglarda `BEGIN…PRIVATE` 0).
- **Varyant:** FTPS-bayraklı değil; `assembleDebugAndroidTest` 4 native bayrak + arm64 (`-PklodaSmb/Sftp/Ftps/S3Native=true -PreactNativeArchitectures=arm64-v8a --offline`) exit 0, 2m22s (`build-androidtest.log`). androidTest APK sha256 `09765e5f469ccf55c326af5bc0777d562a124cc1f1f9fe5fb0af112eda154e7c`; APK içindeki CA `25db2982…` ile eşit. Bu yeni fixture varyantıdır; P3-02 androidTest APK (`e75ddfa3…`, eski CA) ve P3-04 varyantlarıyla karıştırılmaz. F1 iki test dosyası canlıyla eşit (P3-04 FIX klona dahil, koşulmadı).

## 3. Cihaz — somut aidiyet bulgusu
Plan/kayıtlar DAV cloud18 testleri için `KlodaCloud18`'i anar. Bu AVD açıldığında **user 0 `RUNNING_LOCKED`**: `am instrument` → `SecurityException: Package com.kloda.sync.test is not encryption aware!` (`startInstrumentation`); test kodu çalışmadı (`run-webdav-os-cloud18-locked-ABORTED.log`, bekleyen komutu ben sonlandırdım, EXIT=143). Kilit açmak PIN/kimlik bilgisi gerektirir → yapılmadı, AVD'ye dokunulmadı (`-read-only`). Bunun yerine **sahipli, kilitsiz `KlodaFtps16c`** (API35 arm64 ranchu, ekran kilidi devre dışı, `RUNNING_UNLOCKED`) kullanıldı: testler `com.kloda.sync.test` paketi, `10.0.2.2:26443` ve DAV'dan bağımsız; hedef değişimi sınır dışı değil (loopback, sentetik veri, sahipli AVD) ama planın "KlodaCloud18" ifadesinden farklı → koordinatör notu. `KlodaCloud18` kilit durumunun nedeni (Kas 15 sonrası PIN/kilit?) kanıtlanmadı.

## 4. Taze koşular (sunucu 127.0.0.1:26443/44/45, yalnız loopback; `pm clear` sonrası temiz test paketi)
| Kontrol | Komut | Sonuç |
| --- | --- | --- |
| `webdav-os` (gerçek JobService/JobScheduler lease, MediaStore sentetik PNG+1 MiB, HTTPS DAV yedek, kalıcı sonraki plan, global Pause) | `adb -s emulator-5590 shell am instrument -w -r -e scope webdav-os com.kloda.sync.test/com.kloda.sync.AndroidFilesQueueRecoveryInstrumentation` | **PASS**, `INSTRUMENTATION_CODE -1`, EXIT 0 (`run-webdav-os.log`); counts photos 1/1, operations 2/2 |
| `webdav-photos-restore` (sahipli MediaStore PNG → DAV; favorite-only revizyon medya yeniden yüklemeden; makbuz-bağlı Photos restore, aynı süreç reopen, tekrar duplicate yok, kaynak-bağlam/belirsiz-create çitleri) | aynı komut, `-e scope webdav-photos-restore` | **PASS**, CODE −1, EXIT 0 (`run-webdav-photos-restore.log`) |

Normal restore yolundaki hash/boyut zorlaması üretim kodundadır (`AndroidWebDavDownload.kt:25–27`: `reply.sha256/size != value` → `hash_mismatch`) ve `photos-restore` bu yolu normal akışta çalıştırır. Not: bu iki scope'un kendi içeriğindeki mevcut olumsuz dallar (çit/belirsiz-create) harness'in parçasıdır; benim eklediğim yük/enjeksiyon yok. `webdav-files`/`webdav-https`/`webdav-saf` (fixture'ın lost-put/lost-move/redirect/excess fault modlarını bilerek sürer) ve `cloud18-targets`/`nextcloud` **koşulmadı**: bu dilimin "yalnız normal aktarım" sınırı ve tek-temsilci kuralı.

## 5. Reuse
- **H15/P15 host (17.11 Mac, 6.01 s exit 0):** `review-audit.txt` 23/23 host girdisi güncel hash'e **eşit** (tekrar hesaplandı); harness `tools/test-ios-webdav-journal.py` LF-normalize `d089bd64…` eşleşiyor. Tekrar koşulmadı. Not (L15 ile karıştırılmadı): P3-06'da "değişmiş" görünen 3 L15/H15 dosyası ham `source-final.sha256` ile CRLF-ham farkıdır; `review-audit` LF-normalize eşitliği zaten kaydetmiş. L15 kaynağı için ayrı bir not olarak: açık görünmesi büyük olasılıkla EOL normalizasyonu, ürün farkı değil (tek-dosya doğrulama P3-06 kapsamı).
- 03.11–04.11 Android DAV runtime kayıtları (`webdav-native-step15`): güncel Android DAV kaynakları 11-04'ten beri değişmemiş (`git log`), ancak yeni CA varyantı olduğundan bu koşular eski kayıtların yerine geçmez, onları genişletir.

## 6. Cleanup
Fixture sunucusu 77450 durduruldu (komut doğrulanarak), emülatör kapatıldı (`adb devices` boş), Gradle daemon durduruldu, 26443–26445 dinleyen yok. AVD verisi `-read-only` ile değişmedi. P3-02 dört artefaktı hash olarak aynı. **Bilinçli olarak bırakılan:** scratch `/tmp/kloda-step15/https-fixture` (benim oluşturduğum, 4 özel anahtar 0600 + objects: yalnız sentetik `owned-os.png`/`owned-source.png` ve manifest JSON'ları). Kalma nedeni: aynı APK'nın gömülü CA'sına eşleşen sunucu ancak bu anahtarlarla yeniden başlatılabilir (P3-08/yeniden koşu); silinirse yeni `prepare` = yeni CA = yeni APK varyantı gerekir. Silme komutu: `rm -rf /tmp/kloda-step15` (kararı koordinatörde).

## 7. Özet ve açık
- **Taze PASS:** `webdav-os`, `webdav-photos-restore` (yeni CA varyantı, KlodaFtps16c, yalnız loopback/sentetik).
- **Reuse:** H15/P15 host 23/23.
- **Açık/NOT_RUN:** DAV Files restore ayrı koşusu (`webdav-files`, fault modları içerdiği için kapsam dışı bırakıldı), çok hedef `cloud18-targets` (sunucu 26443 ile kurulabilir, KlodaCloud18 kilitli; KlodaFtps16c'de yalnız koşturulabilir ama bu dilimde istenmedi), Android Nextcloud restore (BLOCKED-ENV, ürün güven yolu yok), iOS DAV Simulator, gerçek hedef-sunucu uyuşmazlığı iptali; scratch anahtarları duruyor.
- Başarısız FIX/test sayacı: 0 (bir ortam engeli: KlodaCloud18 kilitli, test çalışmadı).

## 8. Tek sonraki adım
Koordinatör kararı: scratch'i (4 özel anahtar) silinsin mi yoksa P3-08/`cloud18-targets` için tutulsun mu; ve `KlodaCloud18` yerine `KlodaFtps16c` kullanımı kabul mi. Sonra bağımsız sıradaki satır **P3-07/P3-08** (Dropbox test hesabı girdileri doğrulanmadan koşulmaz).
