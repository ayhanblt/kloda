# Faz3 — kaynak kimliği, açık yürütme yolları ve komutlar

Ek; kabul tablosu yalnız [next-plan §3](next-plan.md#3--faz3-tek-tam-regresyon--19112026).
19.11 plan turu: yalnız kaynak/evidence okuma ve SHA256; hiçbir preflight komutu,
test, build, simülatör, capture veya hesap işlemi başlatılmadı. Luna
(`openai/gpt-6-luna`) B1–B4 ve native/provider kanıtını salt-okunur eşledi;
kritik iddialar B1 review, §20–21, actual test scope ve 18–20 checkpoint'te
doğrulandı. Süre/token görünür değil. Dış API araştırması gerekmedi.

## Kesin eksikler ile şarta bağlı önkoşullar

- **Görsel (P3-10/11):** `matrix.json` 50×12=600 hücre envanteri; dosyada
  sadece 2 Desktop ve 3 iOS satırı nominal `ready`; hücre override'ları ayrıca
  uygulanır (ör. Desktop large). M11 satırları 184–213 native hook/seed ve
  etkileşim ister; M13 altı 279–283 scroll ister; G24 pairing 169–183 ve
  storage 289–303 native model/gesture/diagnostic ister. `apps/mobile/capture`
  yalnız `ready` başlangıç ekranlarını bağlar. Android legacy sürücü runnable
  değildir; gerçek uygulama Bağlantılar betiği bu ekranlara eşdeğer değil.
  Bu eksik için aşağıdaki capture-only genişletme onaylandı. Hücreyi üretip
  kanıtlamadan READY, hücre atlama, zoom, QR, gerçek save/probe, ürün durumuna
  veri enjekte etme veya yeni runner/fixture yok.
- **F1 RED (P3-04):** `fix2/start/AndroidFtpsScheduler.kt.start:32` içindeki `Os`
  `pending` tanımlamaz; final `AndroidFtpsPolicyChecks.kt:181–184` `override` ve
  `super.pending` çağırır. Altı eski dosyanın tamamını kullanmak yeni assertion'ları
  kaldırır; yalnız eski üretim + final testler birebir derlenebilir RED değildir.
  Aşağıdaki izole **start-compat RED varyantı** onaylandı; derlenebilirlik ve
  davranış henüz doğrulanmadı. Derleme hatası RED değildir. R1/R2 tarihî 2 ret korunur;
  2.5 R2=4 kapanmış history, yeniden açılmaz.
- **B1 ve provider:** B1 `smbRequest/sftpRequest/ftpsRequest` hazır Expo
  `Function`'lar, ama 2.5 fixture B1 bridge probu değildir; 11-android-bridge
  iki CDP denemesi kararına bağlı. Yeni CDP turu yok. `test-android-dropbox-live.py`
  `cloud18-dropbox-live` (publication) çalıştırır, otomatik delivery kanıtlamaz.
  18–20 checkpoint §18B/5 ve §18B/5r: büyük iOS dosyası, Photos/ekli hedef,
  Android upgrade ve görünür recovery için kanıt yok; hazır izole app/owned
  fixture yolu ve varsa izin doğrulanmadan koşturulabilir sayılmaz.
  [18–20 §18A/4d](../step18-20-checkpoint-2026-10-31.md#dilim-18a4d--android-köprü-çalışma-testi--endea11y-yakalama-411)
  gerçek elle başlatılan JobService ve Bağlantılar capture'ını belgeler, otomatiği değil.
  [Tarihî açık listede](../current-history-2026-11-11.md#181920--claude-alanı-açık-işler-0411)
  Nextcloud ürün girişi CA nedeniyle ayrı karar, çok hedef DAV HTTPS fixture
  anahtarları eksik; güncel mevcudiyet/izin preflight'ta teyit edilir. CA eklemek,
  kişisel hesap/medya kullanmak, ADR0029'u onaylanmış saymak veya `tools/regress.py`
  yazmak bu plan kapsamında değil.
- `fix-r2/ios-fixture/fixture.json`, FIX-R4 iki `run.json`/PNG, renderer index,
  Android Gradle wrapper, iOS `Podfile.lock` ve tsc dosyaları mevcut. Mevcudiyet
  fixture READY/scratch app/input hash'i, çalışma sağlığı veya boş disk kanıtı değildir.

## En dar kapsam kararı

**19.11 kullanıcı kararı: iki sınır da ONAYLI.** Yalnız sözleşme güncellendi;
uygulama/önkoşul kontrolü/koşu başlamadı. Yeni kapsam veya üçüncü istisna yok.

**Görsel / P3-10:** `screens.tsx:20–24` yalnız Welcome, M13 üst ve generic provider
mount eder; `entry.tsx:86–106` ekran/ölçüm bildirir, gesture veya alt durum
doğrulamaz. M13 altı tek başına mevcut Settings içindeki `MobileSurface`
ScrollView'un salt okunur kaydırmasıyla elde edilebilir; ama runner bunu
scripted hücre olarak yapıp doğrulayamaz. `WebDavPage:23–28` field hint'leri
zaten görünür; G24 form+help için yeni etkileşim tipi gerekmez: aynı gerçek
formda hint'lerin görünürlüğünü kanıtla, ayrı envanter hücrelerini silme.
Diagnostic prop'tan gelir, fakat içte `WebDavBackupPanel:10` native hook
kullanır. M11 `ActivityPage:26–27` ve G24 `PairingPage:19–21` de native
hook'larla mount olur; Jest mock'u veya PNG crop bunların yerine geçmez.

Onaylı sınır: **yalnız gerekli görsel hücreler için, mevcut 2.5 aracında
capture-only kapsam genişletme**. Tek yazar; ilk kesin sınır
`apps/mobile/capture/`, `tools/ui-capture/{matrix.json,ios.py,test_matrix.py,test_capture.py}`.
Gerçek ekranları tekrar çizmeden, mevcut render testlerindeki sentetik
durumları yalnız capture entry'de kullan; M13 için tek doğrulanmış scroll,
M11 için mevcut tab/filter kontrolleri, G24 için form+hint ve sentetik
diagnostic/pairing sunumu. Native hook'lar için capture-only, fail-closed
bağlantı bu sınırda kanıtlanamıyorsa ürün props/hook'u gevşetme: kapsamı
tekrar GPT'ye getir. Phase raporu doğru alt durumu/viewport'u kanıtlamalı;
genel komut köprüsü, yeni bağımlılık, yeni fixture kimliği/recipe, gerçek
pairing/probe/save, kullanıcı verisi veya izin isteme yok. Önce M13 altı tek
TR/light/normal ile layout→hareket→doğru içerik→cleanup/provenance; sonra
yalnız ilgili hücreler. Bunun iOS görseli dışındaki Desktop/Android veya
diğer bloklu hücreleri de kapattığı varsayılmaz.

**F1 / P3-04:** start `Job:43–65` ve `Scheduler:63–78` A'yı finish'ten önce
retire eder. Start `Scheduler:136–156,159–166` ordinary WATCH için shared
helper ve doğrudan pending okuması kullanır. Bu iki yol yeni `Os.pending`
üyesine **çağrı eklemeden** korunabilir. Onaylı sınır: sadece ayrı,
geçici start-compat kaynak kopyasında eski **Job + Scheduler** ve final
testleri kullan; tek uyumluluk farkı `Scheduler.Os`'a final ile aynı imzalı,
doğrudan `scheduler.getPendingJob(id)` döndüren üyeyi eklemek. Eski çağıranları
ona yönlendirme; R2 bypass'ı bizzat RED'in hedefidir. Queue ve diğer girdilerde
start/final hash farkı varsa kayıtlı start girdisini kullan veya farkı
ayrı kanıtla. Sonuç **start-compat**, orijinal byte-identical start değil.

`AndroidFilesQueueRecoveryInstrumentation:54–58` ilk hatada scope'u keser;
`AndroidFtpsAutomaticChecks:39–43` FL1'i R2'den önce çağırır. İki beklenen RED
tek çağrıda gözlenemez. Aynı dar izin içinde yalnız **start-compat test
kopyasındaki** `AndroidFtpsAutomaticChecks.kt` lifecycle dalında mevcut `group`
callback'ini seçici kullan: FL1 ve R2 clean için iki ayrı koşuda sadece ilgili
adı dispatch et. Aynı Gradle ve `-e scope` komutu, aynı fixture load/reset,
gövde/assertion değişmez; yeni kalıcı selector veya test dosyası yok. Scoped
çıkışın özeti seçilmeyen grupları PASS göstermemeli.

Önce mevcut scope'u derle; FL1'de olayın gerçekten finish bariyerine
ulaştığını ve retry assertion'ını, R2 `clean` varyantında ordinary
reconcile'a ulaşıldığını ve recorder'ın
beklenen ikinci WATCH schedule'ı görmediğini kanıtla. `unreadable` eski
kodda yeni read seam'ine uğramaz; tek başına karşılaştırılabilir start-RED
kanıtı diye kullanılmaz. Compile/timeout/yanlış grup RED değildir. Finalde
aynı FL1/R2 temsilcileri ve mevcut tüm lifecycle/lock karşıtları değişmeden
GREEN olmalı. Beklenen ayrışma çıkmazsa ilk kesin hata kaydedilir; ikinci
compat katmanı eklenmez. Ortam doğrulaması yapılmadı ve çalışabilirlik
testten önce iddia edilmez.

## Sabitlenmiş snapshot / reuse dayanağı

Algoritma: `git ls-files -z --cached --others --exclude-standard -- apps packages
tools assets .github package.json package-lock.json eslint.config.mjs
docs/ui/lovable-design-reference.md docs/ui/lovable-reference/c144e98938da`.
NUL ayrılmış raw yolları tekilleştir, byte sıralı her kayıt için toplam SHA256'ya
`path + NUL + mode + SHA256(content).digest()` ver. Mode tek byte:
`l` symlink (content = link hedefinin FS byte'ları), `x` owner-executable, `f`
normal, `-` eksik (boş). Normal dosyada ham byte, EOL dönüşümü yok. HEAD ve
staged boşluğu ayrıca kaydet. Ignored build output/deps bu kaynak kimliği değildir;
native generated config/SDK/Pods/link girdi ve artifact hash'ini kendi satırına bağla.
Bu hash kilittir; git'e yazma veya çalışma ağacını değiştirme komutu değildir.

| Kanıt | P3-S0 karşılaştırması / sınır |
| --- | --- |
| 2.5 FIX-R5 final; FIX-R4 temsilciler | 17/17 eşit; 71/71 + reviewer üç retry reuse. `fix-r4/{desktop,ios}-smoke/run.json` ve PNG mevcuttur; cell/stamp/fixture hash'ini mevcut `resume` kurallarıyla doğrula; fixture source/Xcode/Ruby recipe/bundle/Keychain/app tree, JS fingerprint ayrı. Geçerli native fixture'ı JS değişti diye rebuild etme. |
| G1 FIX-R1, G456 | G1 2/3 (panel/spec match; ActivityPage farklı), M11 render komşusunu tam mobil suite'de tekrar; G456 3/6 (Settings/spec/config match, üç locale farklı), mevcut render mantığı reuse, ilgili key/parametre ve gerçek görsel yeniden/ilk. |
| G23, G24 | G23 FIX-R1 6/11; App spec, API ve üç locale G24 zincirinde değişti. Eski 334/FIX19 final tam suite değil; G24 20/20 INITIAL etkilenmeyen + FIX-R1b 2/2 + locale 6/6 eşit. 377 renderer suite reuse için config/closure ve artifact logu eşle; Electron test kapsamını `vitest.config.ts` ile ayrı doğrula. İlgili key aynıysa D12/D13 görüntüsünü topluca tekrar etme. |
| 1.5, B1, B3, F1 | H15/P15 audit 23/23 host girdi eşit (+ aynı harness; L15 metin reuse); B1 18/18 kaynak eşit, B3 9/9 Rust girdisi eşit; eski ürün binary'si güncel native değişiklikler nedeniyle otomatik reuse değil. FTPS fix2 Windows final 6/6 LF eşit, yeni runtime/lint hiç koşmadı. R3 scoped, S3 scoped ve FO1 prior sınırları korunur. |

## Kalan yürütme önkoşulları

19.11 devam: yalnız dosya/kurulum varlığı, lock eşitliği ve belgelenmiş
çağrı yolu incelendi. Runner `check/list`, build, cihaz, servis, hesap ve
ölçüm başlatılmadı. Var olan dosya çalışabilirlik kanıtı değildir.

| Mevcut kabul ID | Doğrulanan / açık | Koşuda giriş koşulu ve bağımlılık |
| --- | --- | --- |
| P3-00/01/02/04/05 | Workspace Jest/Vite, renderer stamp, Xcode/Pods, Android wrapper/SDK/adb/NDK ve SDK env mevcut; Podfile/Pods lock byte-eşit. Yerel iOS `READY` fixture kaydı ve işaret ettiği `.app` mevcut. Android `local.properties` yok ama SDK env var. | Komut çalıştırma onayı sonrası bir kez etkin JDK/SDK/ABI, Xcode ve installed runtime, Playwright/Chromium, port/disk, aidiyetli AVD/Simulator ve artifact/source hash'lerini teyit et. Disk anlık 84 GiB; süre/yer garantisi değil. Önce P3-00; RED/final build çıktıları ayrı. Bilinen TS2882 ve lint çıktıları kabul bulgusu, preflight/install gerekçesi değil. |
| P3-03 | **NOT_RUN — izole prob kapsamı onaylı; binary/entry bağlantısı doğrulanmadı.** `shared/api/{smb,sftp,ftps}.ts::newRequest` gerçek Expo modülüne gider; mevcut capture entry bu çağrıları yapmaz. | Yalnız aşağıdaki tek kullanımlık test girişini kullan. Sahipli ürün binary'siyle bağ doğrulanamazsa P3-03 açık; ürün edit'i, kalıcı araç ve üçüncü CDP denemesi yok. Diğer native satırlar sürer. |
| P3-06/08/12 | **BLOCKED-ENV (DAV çok hedef):** public test CA var, eşleşen sunucu seti/yetkili yedek yok. Yeni izole set onaylı, henüz üretilmedi. FTPS/LAN ve B4 bundan bağımsız. | Koşu başlangıcı ayrıca istendiğinde yalnız aşağıdaki izole sınırda `prepare`; özel anahtarları repo/loga alma. Nextcloud için ayrı pinned container/loopback `18443` ve doğru hedef/fiş/güven zinciri gerekir; DAV fault server veya androidTest CA kalıcı app trust yerine geçmez. |
| P3-07/08 | **NOT_RUN — 20.11 kullanıcı kararı:** Yalnız test amaçlı Dropbox hesabı ve sentetik dosya/fotoğraf kullanımı onaylı. Hesap/hedef ve senaryo girdileri doğrulanmadı. Dropbox live script yalnız publication kanıtıdır. | Koşu ayrıca başlatıldığında sahipli test hedefini, sentetik >150 MiB kaynak+hash'i, sentetik medyaya ayrılmış yazma kapsamını ve boş restore hedefini doğrula. Otomatik teslim ve session tamamlanması için sırsız journal/OS/UI kanıtı gerekir. Bu izin Nextcloud, kişisel hesap/veri veya diğer sağlayıcılara yayılmaz. Önceki Files PASS kendi kapsamındadır. |
| P3-09 | Mevcut `app-debug.apk` var; **eski sürüm baseline'ı** veya onun imzasıyla eşleşme kanıtı yok. Kotlin migration scope ve `recovery29`, kurulu upgrade ve gerçek Android göster/kopyala yerine geçmez. | Eski APK revision/hash/package/signing/version + sentetik eski kurulu durum ve adayla uyum; aynı disposable AVD üzerinde silmeden upgrade. Recovery için ayrı sahipli test profili ve test deseni, pano temizliğini sır kaydetmeden gözleme. Doğru eski artifact yoksa yeni APK'ya “eski” etiketi verme. |
| P3-10/11 | Frozen `c144e98938da…` referansı var; `matrix.json` kapsamı biliniyor, tüm hücreler runnable değil. Onaylı capture delta yalnız dar iOS alt durumları için. | M13 temsilcisinden sonra `list` hücrelerini frozen page-map ile eşle; hazır hücre, aynı provenance'lı reuse ve hâlâ bloklu Desktop/Android/durum hücrelerini ayrı yaz. TalkBack/VoiceOver, klavye ve ölçüm için owned hedef ve aynı iş yükü/baseline gerekir. Android resource-costs host örneği ayrı; UI timing/CPU/bellek kanıtı yoksa NOT_RUN, yeni ölçüm altyapısı veya uydurma eşik yok. |

İlk somut ortam girdisi: **onaylı izole DAV setinin hazır olması**. Bu yalnız
bağlı dalı açar. P3-03/07–11'in farklı açıkları
yukarıdaki satırlarda kalır. Hiçbiri iki onaylı dar kapsamı yeniden açmaz veya
Faz4/step19/release kapılarını Faz3'e taşımaz.

### 20.11 — DAV fixture geri getirme kararı

**P3-06/08/12, yalnız DAV fixture'a bağlı alt kontroller: BLOCKED-ENV.**
Tarihî açık liste (`current-history-2026-11-11.md:581`) özel anahtarların
silindiğini kaydediyor. Beklenen `kloda-step15/https-fixture` kökü, ilgili
geçici dizin/cache ve proje komşuluğundaki hedefli adaylar ile kayıtlı
worktree/arşiv yollarında set bulunmadı. Git'te yalnız public
`androidTest/res/raw/kloda_dav_fixture_ca.crt` var; bu dosyayla eşleşen
sunucu sertifikası ve özel anahtar geri getirilemedi. Kullanıcının ayrıca
sakladığı, burada görünmeyen yetkili yedek hakkında iddia yok. Anahtar
içeriği okunmadı; fixture üretilmedi, servis/test başlatılmadı.

**20.11 kullanıcı kararı — ONAYLI:** Yetkili yedek yok. Yalnız Faz3'ün
izole test kopyasında mevcut `tools/mobile-webdav-https-fixture.py prepare`
ile bir defalık loopback DAV test seti oluşturulabilir. Sabit
scratch kökü boş ve ayrılmış değilse dur; mevcut dosyaları silme/ezme.
Tek kaynak farkı o kopyanın `androidTest/res/raw/kloda_dav_fixture_ca.crt`
dosyasındaki yeni public CA olabilir. Özel anahtarlar scratch dışına
çıkmaz; canlı ağaç, ürün trust store'u, sertifika doğrulaması ve Nextcloud
değişmez. Mevcut pozitif ve negatif sertifika varyantlarını koru. Public
CA/test APK hash'i ile eski/yeni fixture varyantını ayır; yalnız bağlı
test APK'sı ve DAV kontrolleri etkilenir. Bu oturum yalnız sözleşme
güncellemesidir; fixture üretimi veya regresyon başlatılmaz. Diğer Faz3
satırları ve iki önceki onay aynen kalır.

### 20.11 — B1/P3-03 yetkili koşu yolu

**NOT_RUN / kapsam ONAYLI.** İncelenen mevcut araçlarda P3-03'ü karşılayan hazır
koşu yolu bulunmadı; kullanıcı aşağıdaki tek kullanımlık probu onayladı.
B1 manifestinin kaynak hash'leri 18/18 eşit; önceki
Jest ve build/link kanıtı kendi kapsamıyla reuse. `shared/api/{smb,sftp,ftps}.ts`
`newRequest()` üzerinden gerçek Expo fabrikalarını çağırır; Jest bunları mock'lar.
Ürün çağıranları `use-{smb,sftp,ftps}-items.ts` içinde alınan ticket'ı yerel
tutup copy/restore başlatır; UI altı değeri doğrulamaz ve bu amaçla aktarım
başlatmak gerekmez. 2.5 capture registry bu çağrıları yapmaz. İki eski CDP
başarısızlığı ve duruş kararı geçerli; üçüncü deneme veya inspector ayarı yok.
Native sembol/link ve native-only çağrı, JS→native çalışma kanıtı değildir.

**20.11 kullanıcı kararı — ONAYLI:** Yalnız izole Faz3 kaynak kopyasının mevcut,
test amaçlı JS girişinden tek kullanımlık B1 probu kullanılabilir. Yeni fixture
recipe, yeni kalıcı runner/dosya, ürün kaynak/binary değişikliği veya
native modül/hook değişikliği yok. Mevcut sahipli Hermes Android arm64 ve
iOS arm64 Simulator **ürün** Debug binary'lerinde, gerçek sarmalayıcıların
her birini ikişer çağır; altı geçerli ve birbirinden farklı UUID'yi
platform başına doğrula. Yalnız protokol adı, çağrı sayısı, format/benzersizlik
sonucu ve kaynak/binary/entry hash'i kaydedilir; UUID değerleri, kişisel
veri, transfer, pairing, hesap ve izin kullanımı yok. Binary/entry bağlama
yolu doğrulanamazsa P3-03 açık kalır; scope genişlemez. Bu oturum yalnız
sözleşme güncellemesidir; prob ve regresyon başlatılmaz. Diğer Faz3
satırları bu kontrole bağlı değildir.

### 20.11 — B1 binary ve giriş noktası incelemesi

- **Android: bağlama yolu statik olarak mevcut; runtime NOT_RUN.** Yerel
  `app-debug.apk` SHA256 `1f873905da7fc900f0e577ce61ce4f1b6ddd4078c415c3955e5dc3d3dbe98145`
  B3 kaydıyla eşleşir. APK'da arm64 Hermes, `exp+kloda` scheme, launcher ve
  DEX'te üç fabrika adı mevcut. Yerel `DevLauncherController.kt:304–341`
  dev-client URL'sini yükler; `DevLauncherAppLoaderFactory.kt:26–32` raw
  bundle yolunu seçebilir. Sonraki onaylı koşuda yalnız owned Android hedefi
  ve izole Metro bundle'ı; kayıtlı APK geçmiş varyanttır, P3-S0/P3-02 binary
  eşleşmesi ve bundle'ın gerçekten seçilmesi henüz doğrulanmadı. CDP yok.
- **iOS: giriş yolu mevcut, uygun yerel ürün binary'si yok.** Ürün
  `AppDelegate.swift:57–66` Debug Metro yolunu destekler; yerel
  `EXDevLauncherController.m:227–241` Simulator'da `--initialUrl` yüklemesini
  destekler. 2.5 `ios.py:239–250` bunu fixture kimliğinde kullanmıştı; o
  fixture ürün binary'si sayılmaz. İki yerel `com.kloda.app` Simulator Debug
  adayında Hermes/launcher var, fakat executable, debug dylib ve paketli
  framework'lerde üç fabrika adı da bulunmadı. Önceki B3 manifestindeki
  üç fabrikanın bağlı olduğu `/tmp/kloda-b3-ios-dd` çıktısı yok. Bu adaylarla
  prob başlatılmaz. Doğru girdilerle önceden planlanmış P3-02 normal ürün
  build'i veya doğrulanabilir eşdeğer ürün artifact'i gerekir; B1 için ikinci
  build/fixture açılmaz. Altı çağrı/platform kabulü değişmez.

Bu tur yalnız paket/hash ve yerel kaynak okumasıdır. Hiçbir app, Metro,
fixture, prob veya regresyon çalıştırılmadı.

### 20.11 — P3-07/08 girdi yeterliliği

| Açık kontrol | Doğrulanan dayanak ve sınırı |
| --- | --- |
| P3-07 Android otomatik Dropbox | `AndroidDropboxChecks.kt:73–107` doğrudan publication çalıştırır. §18A/4d, elle “Şimdi yedekle” ile JobService'e girer. İkisi de otomatik teslimi kanıtlamaz; scheduled delivery ve sonraki planın mevcut journal/OS/UI yolunda gözlenmesi açık. |
| P3-07 iOS >150 MiB | Android testi `SINGLE + 1` boyutlu deterministik sentetik stream ve hash kullanır. iOS queue kaydının büyük girdisi 2.000.000 byte; iOS için eşik üstü dosya/hash çifti ve oturum tamamlanma kanıtı doğrulanmadı. |
| P3-08 Dropbox Photos | Dropbox Files hash/readback ve step15 WebDAV PhotoKit restore kendi kapsamlarında reuse. Dropbox'a bağlı sentetik fotoğraf fişi ve boş restore hedefi doğrulanmadı; başka sağlayıcının fişini kullanma. |
| P3-08 eklenmiş Nextcloud | Mevcut Nextcloud testleri giriş; `cloud18-targets` çoklu DAV kuyruk kanıtıdır. Ekli hedef restore değil. Beklenen `/tmp/kloda-step18/nextcloud` sunucu cert/key seti mevcut değil. Yeni DAV seti onayı Nextcloud'u kapsamaz; hedef/fiş ve güven zinciri açık. |

Yalnız salt okunur inceleme yapıldı. Hiçbir girdi üretilmedi, hesaba
bağlanılmadı, servis veya koşu başlatılmadı. Kabul satırları NOT_RUN;
Nextcloud fixture eksikliği yalnız bağlı alt kontrollerde BLOCKED-ENV.

### 20.11 — P3-08 Nextcloud için dar kapsam

**20.11 kullanıcı kararı — ONAYLI.** Yalnız aşağıdaki izole kapsam;
sertifika üretimi, servis veya koşu bu oturumda başlatılmaz.

- Yalnız mevcut `tools/nextcloud-fixture.py` ve digest'e sabitlenmiş mevcut
  Nextcloud imajı; `127.0.0.1:18443`, sahipli boş scratch ve disposable
  cihaz hedefleri. Onaylı izole DAV CA'sı yalnız bu Nextcloud sunucu
  sertifikası için kullanılabilir. Yeni CA/sağlayıcı hesabı
  yok; fixture hesabı ve özel anahtar yalnız scratch'te. Araç sabit container
  adını `rm -f` ile kaldırır (`:27–30,48`): başlangıçta bu ad/port boş veya
  aidiyeti kesin değilse başlatma; yalnız bu koşunun oluşturduğu kaynağı temizle.
- Normal ürün PHP/HTTPS uçları ve gerçek ekli `nextcloud` hedefi; bir
  sentetik **Files** girdisini mevcut ürün akışıyla yayınla, `Completed`
  fişini o `targetId` ile bağla, hedef kartından boş sahipli dizine geri
  yükle. Boyut/SHA256, hedef/fiş ayrımı, tekrar ve sözleşmedeki negatif
  dallar korunur. Dropbox Photos ayrı; fixture login/queue PASS veya
  doğrudan sunucuya dosya koyma ürün restore kanıtı değildir.
- TLS doğrulaması/hostname kontrolü ve canlı ürün güveni değişmez. iOS
  mevcut test yolu disposable Simulator'da CA kullanımını gösterir;
  Android public CA yalnız `androidTest` paketine bağlı, normal app
  için hazır güven yolu yok. Varsa **yalnız disposable hedefte**, mevcut
  doğrulanabilir güven yolu kullanılabilir; kullanıcı/host trust store'u,
  ürün kaynak/manifest'i, TLS bypass veya yeni test harness'i onay dışı.
  Bu sınırda gerçek ürün restore yolu kanıtlanamazsa ilgili platform
  `BLOCKED` kalır; test paketi sonucu ürün PASS'i sayılmaz.

Yalnız kapsam kararı kaydedildi. Sertifika üretilmedi; hesap, container,
cihaz veya test başlatılmadı.

**Android ürün güveni — salt okunur bulgu:** `AndroidNextcloudLogin.kt:32–39`
ve `AndroidWebDavClient.kt:33–40` varsayılan TLS güvenini kullanır; ağa bağlı
socket factory özel TLS trust manager değildir. Fixture CA'sını yalnız
`androidTest/AndroidManifest.xml` ve `kloda_dav_fixture_network.xml` bağlar.
İncelenen yerel ürün Debug APK'sında bu CA kaynağı veya `networkSecurityConfig`
yok. Mevcut onaylı kapsam içinde ürün güven yolu bulunmadı: yalnız Android
P3-08 Nextcloud restore **BLOCKED-ENV**. Test paketi ürün PASS'i değildir.
Ürün/OS güveni değiştirilmedi; sertifika, servis, cihaz ve koşu NOT_RUN.

## Mevcut komut kartı — yalnız sonraki onaylı koşu için

`E=docs/implementation/evidence/faz3` anlamında; aşağıdaki `<…>` değerleri
doğrulanmış yerel input/output ile doldurulur. Build/preflight kaydı olmayan
yol PASS sayılmaz. Bu kart yeni giriş betiği değildir.

- **P3-00/10:** `python3 -I tools/capture-ui.py check`, önce tek `list --format json`;
  yalnız stamp uyuşmazsa ve çıktı yolu güvenliyse `prepare-desktop`. Mevcut
  doğrulanmış temsilci şablonu:
  `python3 -I tools/capture-ui.py run --driver desktop-renderer --screen settings --locale tr --theme light --size normal --width 1440 --out <E/desktop-rep>`.
  İlk iOS batch: `python3 -I tools/capture-ui.py run --driver ios-native-entry --screen settings --locale tr --theme light --size normal --fixture <matching-fixture.json> --runtime com.apple.CoreSimulator.SimRuntime.iOS-26-5 --device-type com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro --out <E/ios-rep>`.
  Yalnız `ready` hücreleri aynı şablonda ekran/dil/tema/size ve benzersiz `--out`
  ile grupla; `list` durumlarını sakla, sonuç/confirmation/ölçüm/cleanup ayrı
  denetlenir. Uygun fixture zaten var ise `prepare-ios` yok; bağımsız eksik/stale
  native input nedeninde mevcut onaylı `prepare-ios --out <E/ios-fixture>` tarifini
  değerlendir. `cleanup --run <owned-run>`, `resume --run <owned-run>`; resume
  yeni hücre üretmez ve onaysız/eski kanıtı geçerli yapmaz.
- **P3-01/02:** `node_modules/.bin/tsc --noEmit -p <apps/mobile/tsconfig.json|apps/desktop/tsconfig.main.json|apps/desktop/tsconfig.json>`;
  `npm test --workspace @kloda/mobile` (gerektiğinde `-- --runTestsByPath <spec>`);
  `npm test --workspace @kloda/desktop`, `npm run lint --workspace <app>`;
  G24 §3–5 scoped lint/locale parity ve `git diff --check`. Desktop
  `npm run build:main --workspace @kloda/desktop` ancak tam main kanıtı
  etkilenmiş/eksikse; `prepare-desktop` Vite üretimini karşılarsa tekrar Vite yok.
  Mobil `../../node_modules/.bin/expo export --platform <ios|android> --output-dir <out>`
  (`apps/mobile`); yalnız 2.4 JS girdileri ve logu eşleşmiyorsa. Ürün iOS build
  komutu/flags [B1 `21-ios-sim-build.log`](../evidence/b1-uuid-2026-11-11/)
  ve 18–20 §18A/4d; arm64 Simulator normal workspace/scheme, capture fixture
  değil. Android `:app:assembleDebug` + gereken mevcut ARM64 native opt-in flag'leri;
  F1 dar ve ürün build'lerini ortak task/output kanıtıyla birleştir, varyantları karıştırma.
- **P3-04/05:** `apps/mobile/android`:
  `./gradlew :my-module:compileDebugKotlin :my-module:assembleDebugAndroidTest -PklodaFtpsNative=true -PreactNativeArchitectures=arm64-v8a --console=plain`.
  [FTPS manifest §fs-rest](../evidence/f1-ftps-automatic-lock-2026-11-15/MANIFEST.md):
  `adb -s <owned-api35-arm64> install -r -t <androidTest.apk>` →
  `adb -s <owned-api35-arm64> shell am instrument -w -r -e scope <ftps-automatic-lifecycle|ftps-automatic-lock> com.kloda.sync.test/com.kloda.sync.AndroidFilesQueueRecoveryInstrumentation`.
  Grupların gerçekten çalıştığını ve assertion/`INSTRUMENTATION_CODE`'u sakla;
  sadece adb exit yeterli değil. Dar lint:
  `./gradlew :my-module:lintDebug -x :react-native-worklets:lintAnalyzeDebug -PklodaFtpsNative=true -PreactNativeArchitectures=arm64-v8a`.
  Tam lint için [önceki offline, K2Uast=false tam komut](../android-lint-and-compatibility-2026-10-25.md#bu-takipte-çalıştırılan-kontroller)
  ve tarihî worklets çöküşünü girdiyle karşılaştır; eşdeğer koşulda iki aynı
  çöküşü kör tekrarlama. Tam görev/rapor açık kalabilir.
- **P3-06/07–09/12:** B3 manifestteki offline Rust komutları yalnız source/toolchain
  farkı gerekçesi varsa; mevcut FTPS/LAN, TLS, custody, S3/SFTP/SMB native fixture
  komutları kendi önceki manifest ve onaylı scope'undan. §20 mevcut `python3 -I
  tools/test-ios-<recovery-catalog|recovery-code|destination-migration|oauth|live-activity>.py`
  tariflerini argümanlarıyla kullan; step19 OS kart capture'ı değil. H15
  `test-ios-webdav-journal.py` reuse. Android `cloud18-destination`, `cloud18-dropbox`,
  `cloud18-oauth`, `cloud18-nextcloud`, `cloud18-targets`, `recovery29` ve
  `webdav-photos-restore` mevcut instrumentation scope'ları; gerçek fixture/CA
  isteyenleri sırf scope var diye hazır sayma. `test-android-dropbox-wiring.py`,
  `test-android-destination-migration.py`, `test-android-recovery-catalog.py`,
  `test-android-nextcloud.py`, `test-android-dav-targets.py` hazır alt kontroller;
  ürün senaryosu yerine geçmezler. `tools/check-android-apk.py <app-debug.apk>` ve
  `tools/check-android-elf-alignment.py` kod/paket katmanı için; B2'nin
  gerçek Release `nm`/flag/hash şartı [§20](../20-21-acceptance-collection-2026-11-04.md#20--claude-bildirimi-sonrası-hizalama-ve-genel-kapanış).
- **P3-11:** `python3 tools/check-android-resource-costs.py` mevcut scanner
  cursor/membership ve SQLite büyüme ölçümü; [ölçülmüş baseline](../android-validation-step4-2026-10-25.md).
  Girdi aynıysa reuse; gerçek UI timing/CPU/bellek ve font/semantik kanıtı ayrı,
  aynı fixture/viewport/cihazla mevcut ölçüm yolu doğrulanamazsa NOT_RUN.
  `capture-android-connections.py` yalnız kendi tarihî Bağlantılar standardının
  kanıtı; kullanıcı app/hesabına otomatik bağlanma veya başka ekrana genelleme yok.
