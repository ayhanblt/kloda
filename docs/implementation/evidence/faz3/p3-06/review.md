# P3-06-FTPS-1…4 — bağımsız review, 21.11.2026

**FIX — yalnız tekrar üretim tarifi (FTPS-4; FTPS-1 sunucu kurulumu).** Tek
güncel Android arm64 JNI aktarımının gerçekleştiği ve fixture'ın kapandığı
kanıtlı. Ancak sözleşme bu aktarımı boş sahipli kökten tekrar üretilebilir
kılmayı da gerektiriyor. FTPS-1…4 toplu kabulü açık; CURRENT/MANIFEST'te
kapanış yapılmadı. Yeni ürün/test değişikliği veya koşu gerekmiyor.

- Bağımsız reviewer: GPT-6.2 Sol (`openai/gpt-6.2-sol`), `ses_e02b92a99ffeq0YRpAWUiBcSB2`.
  Uygulama: ekip manifestinde aynı Sonnet 5.5 Medium `ses_e04dba005ffeLlgijB58tGGxLQ`.
- Başlangıç [`start-head.txt`](ftps-android/start-head.txt):
  `508b3f0486a7ce04628ec0c3681d995573e5721d`; canlı HEAD ve geçici klon
  HEAD aynı, canlı staged boş. `git status --short` inceleme başlangıcında
  canlıda 89 girdi; ilgisiz birikmiş diff bu kapsama alınmadı. Canlı
  [`live-baseline.sha256`](ftps-android/live-baseline.sha256) 10/10,
  [`test-copy.sha256`](ftps-android/test-copy.sha256) 6/6 eşleşti.
  Klonun `packages/ftps-native` kaynakları (üretilmiş `target` hariç)
  canlıyla byte-eş; Android modülünün `src/` ağacındaki gerçek fark yalnız
  iki test Kotlin dosyası ve üç test asset'i. İki Kotlin dosyasının
  gerçek unified diff'i, başlık zaman/yol satırları dışında
  [`selector.diff`](ftps-android/selector.diff) ile birebir. Pozitif erken
  dönüş kalıcı yeniden açma kontrolünden sonra; mevcut `ftps-files` çağrısı
  default `false` ve diğer gruplar değişmiyor. DB/FD cleanup çalışmaya devam
  eder. Seçiciyi canlı ağaca taşımak kabul şartı değil.

## Bağımsız kanıt eşlemesi (yeni koşu yok)

| ID | Gözlem |
| --- | --- |
| FTPS-1 | [ProFTPD host sonucu](ftps-host-representative/proftpd/RESULT.md), [son config](ftps-host-representative/proftpd/proftpd.conf.final), [probe](ftps-host-representative/probe.py), iki [probe kaydı](ftps-host-representative/proftpd/probe-pro-1.json) ve [sunucu TLS kaydı](ftps-host-representative/proftpd/server-log-excerpt.txt) uyumlu. Yerel arm64 imaj `sha256:8e6060ae84838fffd36be6bbe0f3cb3f7bfafe84f57b09a49045ee489c18a27b`, `.deb` 14/14 eşleşti. İki explicit AUTH TLS + PROT P aktarımı, readback ve sağlıklı kapanış kayıtlı. Public CA SHA `722370f2539e9b33553e3295799ea39d65038cf904f87a0caf5686175c518dc0`; korunan public sertifikayı CA ve `localhost` ile salt-okunur doğruladım. Host Python probe'u için `NoSessionReuseRequired` yalnız loopback sunucu config'inde. |
| FTPS-2 | [Rust build](ftps-android/build-so.log) ve [Gradle](ftps-android/build-androidtest.log) kayıtları reuse; APK SHA `6381ec71fc30185516e07e63c50d6f5526900604b389eaa18ae602f221503005` diskte eşleşti. APK self-target `com.kloda.sync.test`; `assets/kloda-ftps16` içindeki AArch64 `.so` SHA `2de8ab367952cce8e73b9137cb242e60998ca1fdc0a23d6f00e23cf7bf843b55` staging ve `sha256.txt` ile aynı, eski `04cf489a…` değil. Gerçek `.so` export'larında JNI `publishBound`/`readBound` ve fixture marker; public CA DER yalnız test asset'inde. APK çok ABI içeriyor; dört `lib/*/libkloda_ftps_native.so` girdisinde marker ve fixture CA yok. Üretim checker'ının marker reddi değişmemiş; canlı JNI hash'leri eşleşiyor, klondaki kopyalanmış app APK ve karşılığı byte-eş (`1f873905…`), bu app APK taze build/runtime kanıtı değil. |
| FTPS-3 | [Cihaz/eşleme](ftps-android/device-setup.log), [komut ve ilk auth sonucu](ftps-android/run-ftps-files-positive.log), [ikinci sonuç](ftps-android/run-ftps-files-positive-2.log), [alıcı](ftps-android/receiver-readback.txt) ve [tam TLS günlüğü](ftps-android/server-tls-full.log) aynı temsilciye ait: instrumentation `PASS ftps-owned-positive`, kod `-1`, exit 0; tek 1.048.576 B `android-owned-…-complete.bin`, yeniden hesaplanan sentetik SHA-256 `631b84027d6b9e52b539c4e8373622d23032dfadc64d60af87339c9037e4f769`. Test `AndroidFtpsPublication.runBound` → JNI → mevcut journal receipt; DB yeniden açıldıktan sonra `completed && step == 3`, sonra PASS. `session.rs` kök/hostname doğrulaması sürüyor; fixture özelliği yalnız test kökü ekliyor. Veri TLS 1.3 `resumed session` gözlendi; bu koşu **reuse zorunlu ayarla yapılmadı**. |
| FTPS-4 | [Temizlik kaydı](ftps-android/RESULT.md#temizlik-ftps-4) reuse: aidiyetli AVD, reverse'lar, test paketi, konteynerler ve özel anahtar/parola kaldırılmış. Salt-okunur çapraz kontrolde ilgili konteyner/qemu/listener yok; scratch'te `*.key` veya `pw` yok. Kalan anahtarsız scratch, klon ve yerel imajlar belgeli. **Tekrar üretim kısmı açık** (aşağıda). |

## Tek engelleyici bulgu — tekrar üretilebilirlik

**FTPS-4 / FTPS-1 tarif — scoped, ürün hatası değil.**
[`build-recipe.sh:2–12`](ftps-android/build-recipe.sh#L2-L12) zaten var olan
`$S/pki/ca.pem` dosyasını tüketerek `.so` ve asset hazırlıyor. Temizlikte
eski CA'nın özel anahtarı silindi (doğru); aynı CA ile yeni sunucu sertifikası
üretilemez. [ProFTPD sonucu](ftps-host-representative/proftpd/RESULT.md#provenance--izolasyon)
ve `entry.sh` önceki scratch'ten `/run/kloda` sertifika/anahtar/parola
beslemesini varsayıyor, `entry.sh` yalnız `kloda_probe` oluşturuyor. Bu
haliyle yeni boş kökten CA + `localhost` SAN sunucu sertifikası, sabit
imajın başlatılması/doğru mount ve üç loopback portu, Android `probe`
hesabının aynı yazılabilir köke alınması ve sahipli AVD'nin exact
hazırlık/temizlik adımları tek, tam komut kaydından tekrar edilemiyor;
ilk koşu zaten bu hesap ayrımında auth hatası verdi.

En küçük kapatma: mevcut **tek** evidence tarifini uçtan uca tamamla;
saklı/yerel bir anahtara veya çalışır konteynere dayanmadan, boş sahipli
kök → yeni geçici CA/leaf ve doğru `localhost` → sabit ProFTPD config ve
loopback host kontrolü → Android hesabı/kökü → klona mevcut seçici ve
aynı CA ile test build → read-only AVD/install/reverse/pozitif komut →
alıcı/fiş ölçütü → yalnız ait kaynakların başarı/hata temizliği.
Mevcut alt parçaları linkle; ikinci araç/tarif, sır veya üretilen binary
ekleme. Kapatma için önce yalnız komut kaydını mevcut log ve config ile
çaprazla; cihaz/FTPS/çökme koşusunu yeniden istemiyorum. Gözlenmiş PASS
korunur, eksik belge için yeni ürün FIX döngüsü açılmaz.

**Sayaçlar ve açıklar:** RUSTC seçimi 1 build aksaması, `native_9`
fixture hesap uyumsuzluğu 1 Android koşu aksaması (instrumentation kodu 0,
shell exit 0 PASS değildi); ikisi ayrı ve düzeltilmiş. vsftpd aynı
kararlılık yaklaşımı 2 başarısız, ayrı kapanış tanısı çözüm değildir; üçüncü
deneme/restart/debugger yok. iOS, gerçek LAN/fiziksel, release, karışık
`ftps-files`/`ftps-sources` ve hata/OS/profil kolları, üst P3-06 ve Faz3
açık. Review yalnız salt-okunur diff/artefakt/log denetimi; yeni build,
lint, probe, cihaz veya çökme koşusu yok.

## Scoped FIX-1 dönüşü — 21.11.2026

**FIX — aynı FTPS-4 tekrar üretim invariantı, hata yolları açık.** Aynı
bağımsız GPT-6.2 Sol (`openai/gpt-6.2-sol`),
`ses_e02b92a99ffeq0YRpAWUiBcSB2`; HEAD değişmedi (`508b3f0486a7ce04628ec0c3681d995573e5721d`).
Değişen scoped aday yalnız evidence altındaki
[`build-recipe.sh`](ftps-android/build-recipe.sh), SHA-256
`d1cd67e3f9f20240fb504c2a6c14ae43832002804511149cfd41b11f8a29393e`;
`sh -n` exit 0, dosya çalıştırılmadı. Yukarıdaki gerçek runtime kanıtı
reuse; yeni paket, build, FTP, Android veya çökme koşusu yok.

Yeni happy path statik olarak tamam: yeni kısa ömürlü CA/localhost SAN,
yalnız leaf/key'in salt okunur mount'u, kayıtlı base image ID ve 14 `.deb`
hash/adet pin'i, üç loopback portu, klona seçici ve aynı CA ile JNI,
AVD ve alıcı ölçütü bağlandı. `User kloda_probe` kilitli süreç hesabı;
`probe` ayrı UID'li oturum hesabı ve `/srv/ftp/upload` sahibi
(`:84–89`), ProFTPD oturumda kimliği auth kullanıcısına geçirir; iki
hesabın aynı UID olması gerekmiyor. Kayıtlı alıcı da `probe` sahipli.
`:96–98` yalnız yeni CA ve hostname ile explicit TLS **kontrol**
kanalını doğrular; veri/byte+SHA ve sağlıklı kapanış önceki host
kanıtından, Android fişi ve resumption önceki Android koşusundan gelir.
`NoSessionReuseRequired` yine yalnız loopback fixture ayarıdır.

**Tek bulgu — tarif kritik araç hatalarında kapalı kalıp kendi
kaynaklarını temizlemiyor (FTPS-4).**

- [`:74–76`](ftps-android/build-recipe.sh#L74-L76) iç konteynerde `dpkg -i`
  hatası `;` ile geçiliyor: paket açıldıktan sonra yapılandırma başarısız
  olsa bile `dpkg-query` ve `mod_tls.so` kontrolü başarılı olabilir ve
  imaj commit edilir. Tersine kurulum/commit gerçekten nonzero dönerse,
  `"$SRV-inst"` için `:49–58` cleanup yolu yok; explicit `docker rm`
  erişilmeden script çıkar ve aidiyetli kurulum konteyneri kalır.
- [`:53`](ftps-android/build-recipe.sh#L53) boot timeout'unda serial ADB'ye
  hiç görünmemiş ama emülatör süreci çalışıyorsa `emu kill` başarısızlığını
  yok sayıp sınırsız `wait` yapıyor. Bu dalda sunucu ve özel anahtar
  temizliğine hiç ulaşılamayabilir.
- [`:138–150`](ftps-android/build-recipe.sh#L138-L150) export grep'i listedeki
  **her** gereken sembolü değil en az birini arıyor; marker yokluğu
  kontrolü `llvm-nm` hata verip stdout boş olduğunda da `0` alıyor.
  APK asset SHA kontrolü klonun fişine bakıyor, APK içindeki fiş ve
  `localhost` içeriğini doğrulamıyor. Bunlar eski artefaktın doğrulanmış
  sonucunu değiştirmez, fakat yeni tarifin aynı kabulü güvenilir biçimde
  denetlediğini göstermez.

Sonraki dar düzeltme yalnız mevcut tarifte: kurulum statüsünü geçir,
aidiyetli installer ve doğrudan başlatılan emülatör PID'si için hata
temizliğini garanti et (ADB yokken de; diğer cihazları hedefleme);
sembol incelemesi hatasını marker-yok sayma ve paket içi asset
sözleşmesini doğrula. Salt statik çapraz kontrol yeter; yeni koşu
istenmiyor. İlk scoped tarif düzeltmesi karşılamadı (1); vsftpd
kararlılık 2, RUSTC 1 ve auth 1 aynen, sayaçlar birbirine eklenmez.
CURRENT/MANIFEST kabul kaydı yok; üst P3-06/iOS/Faz3 açık.

## Scoped FIX-2 dönüşü — 21.11.2026

**DECISION — kabul edilmedi; FTPS-4 hata temizliği invariantı başarısız=2.**
Aynı bağımsız GPT-6.2 Sol (`openai/gpt-6.2-sol`),
`ses_e02b92a99ffeq0YRpAWUiBcSB2`. Başlangıç ve canlı HEAD
`508b3f0486a7ce04628ec0c3681d995573e5721d`. Kapsam yalnız evidence
[`build-recipe.sh`](ftps-android/build-recipe.sh), SHA-256
`bc287d3d66ca5a12eeff4d94a04a72cda7088fd02a76b2307c4a1bb95add4520`.
Önceki kopyanın hash'i FIX-1 kaydıyla, gerçek diff başlıklar dışında
`/private/tmp/p3-06-recipe-neg/fix2.diff` ile eşleşti. Bağımsız `sh -n` exit 0.

**İyileşen kontroller ve kanıt sınırı.** `/private/tmp/p3-06-recipe-neg/`
altındaki `harness.sh`, `results.txt` ve `fix2.diff` statik çaprazlandı;
harness tekrar çalıştırılmadı. Harness gerçek dosyadan helper/cleanup ve
installer bloklarını alıyor. Sahte Docker nonzero sonucu commit'i atlıyor
ve installer kaldırma çağrısı yapılıyor; gerçek `dpkg` çalışmıyor, ancak
`:109–121` içindeki açık `dpkg` exit kontrolü ve `installed` testi statik
olarak önceki maskelemeyi gideriyor. Sahte ADB'nin hemen hata verdiği
TERM/KILL senaryolarında doğrudan başlatılan PID sonlanmış, geçici anahtar
kalmamış, adb çağrıları kayıtlı seriyle sınırlı. Bu, aşağıdaki gerçek
akış dallarını veya Docker kaldırma başarısını sınamıyor. Sahte `nm`
hata/boş çıktı/eksik export/marker sonuçları helper koduyla uyumlu;
`:183–184,194–213` gerçek tarifte tek tek export, marker yokluğu, APK içi
SHA fişi, birebir `localhost` ve aynı CA DER gömümü kontrollerini bağlıyor.
Bu APK aşaması inert harness'te çalıştırılmadı.

**Tek kalan engel — aidiyetli kaynak başlatma/temizlik geçişi tarifin
gerçek akışında kapanmıyor (FTPS-4).**

- [`:137–140`](ftps-android/build-recipe.sh#L137-L140) `docker run -d`
  bir konteyner oluşturduktan sonra başlatmada (ör. port publish
  çakışması) hata dönebilir. `set -e` nedeniyle `STARTED_SRV` atanmaz;
  [`:64–66`](ftps-android/build-recipe.sh#L64-L66) o koşuya ait etiketli
  konteyneri hiç kaldırmaz. Bu komutta `--rm` da yok. Installer için
  düzeltilen create/start aralığı gerçek servis yolunda kalmış. Harness
  sahte emülatör senaryosunda `STARTED_SRV=1` değerini doğrudan atadığı için
  bu geçişi sınamıyor.
- [`:219`](ftps-android/build-recipe.sh#L219) AVD boot sayaç sınırı
  yalnız `adb shell getprop` **döndükten sonra** işler. Bir çağrı takılırsa
  timeout ve EXIT cleanup'a ulaşılmaz; inert harness çağrısı hemen `1`
  döndürüyor ve boot döngüsünü zaten yürütmüyor. Ayrıca `:63–66,84`
  kaldırma hatasını/timeout'u ayırmadan `CLEANUP_DONE` yazar; harness
  yalnız kaldırma çağrısını sayar, temiz durumu doğrulamaz.

İki scoped tarif denemesi aynı hata temizliği invariantını kapatmadı.
Bu oturumdan üçüncü FIX veya yeni koşu önerilmez; karar koordinatöre.
Önceki gerçek host/Android runtime PASS ve fiş/temizlik kanıtı reuse;
yeni tarif uçtan uca koşulmadı. vsftpd kararlılık 2, RUSTC 1, auth 1
değişmedi. CURRENT/MANIFEST'e kabul işlenmedi; FTPS-1…4 toplu kabulü,
iOS, üst P3-06 ve Faz3 açık.

## FTPS-4 DECISION tasarımı — bağımsız dönüş, 21.11.2026

**DECISION — scoped kabul yok; yeni yürütücü terminal temizlik durumunu
kanıtlamadan kapanabiliyor.** Ayrı reviewer GPT-6.2 Sol
(`openai/gpt-6.2-sol`), `ses_e02b92a99ffeq0YRpAWUiBcSB2`. Başlangıç/canlı
HEAD `508b3f0486a7ce04628ec0c3681d995573e5721d`. Yalnız mevcut
[`build-recipe.sh`](ftps-android/build-recipe.sh) değişti; SHA-256
`b1e82c94aefa5e36377a3ed9677f4adc6cc5e401cf031431998a510ed49a0d05`.
FIX-2 tabanı `bc287d3d…` ve gerçek diff başlıklar dışında
`/private/tmp/p3-06-recipe-fix3/fix3.diff` ile aynı; inert başarı
kopyasının hash'i gerçek tarifle eşleşti. Bağımsız `sh -n` ve gömülü
Python AST ayrıştırması geçti.

`/private/tmp/p3-06-recipe-fix3/{fake.py,harness.py,results.json}` salt
okunarak çaprazlandı, yeniden çalıştırılmadı. Gerçek yürütücüyle inert
kayıtlar: start hatası ve önceden oluşmuş ID'siz create timeout'unda
sonlu çıkış ve kaldırma; askıda ADB boot'ta emülatör grubu kapalı;
yabancı etiket değişmeden kaldı ve rc 4; erişilemeyen Docker rc 4;
teardown askısı sonlu; create sırasındaki INT/TERM 130/143; installer
hatasında commit yok; `nm` hatası, üretim marker'ı ve yanlış hostname
reddedildi. Bu kayıtlar Docker daemon/ADB/PKI/derleme davranışı değil:
örn. `fake.py:159–165` ID'siz create için nesneyi **timeout'tan önce**
diske yazıyor, `harness.py` temizliğe girildikten sonra sinyal vermiyor.
Statik olarak PKI, 14 paket hash pin'i, loopback/CA/hostname, clone
seçici, arm64 JNI export/marker, test APK içi SHA/hostname/CA ve
instrumentation sonucu + alıcı SHA/boyut zinciri korunmuş. Önceki
gerçek host/Android PASS ve fiş reuse; yeni tarif uçtan uca koşulmadı.

**Tek birleşik engel — terminal sahiplik/temizlik ve süre kabulü
([FTPS-4 DECISION](../../plans/next-plan.md), şart: belirsizlikte
`CLEANUP_INCOMPLETE`, bağımsız temizliği dene, doğrulanmış ID kullan):**

- [`:173–185,194–210,316–332`](ftps-android/build-recipe.sh#L173-L210):
  zaman aşımı/sinyalde `run` yerel Docker CLI grubunu öldürüyor, daemon
  isteğinin tamamlandığına dair sonuç yok. ID'sizken ilk `No such`
  cevabı terminal `absent` sayılıyor. Create daemon'da sürüyorsa bu
  **create timeout → anlık absent → geç create** sırasına izin verir;
  tarif yükümlülüğü temiz sayar, geç oluşan sahipli konteyner kalabilir.
  Mevcut inert `create-noid-timeout` nesneyi baştan görünür kıldığından
  bu yolu ayırt etmiyor. Ayrıca tam `inspect` ID'si doğrulanmadan 12
  karaktere kesiliyor ve `rm` o kısaltmayı kullanıyor; tasarımın
  doğruladığı nesne kimliği kaldırma çağrısında aynen taşınmıyor.
- [`:94–125,252–267,281–314,549–562`](ftps-android/build-recipe.sh#L252-L314):
  süre sınırı her alt beklemeye taşınmıyor. `communicate` timeout'undan
  sonra ek 5 saniye reap bütçesi, ADB sorgusunun 5 saniye/kalan boot
  bütçesinin dışında. Cleanup `cl()` kalan süreyi en az 1 saniyeye
  yuvarlıyor; ADB alt adımları ve 10 saniye bekleme bütçe dolunca
  kesilmiyor. Sonraki `step()` emülatör grup TERM/KILL adımını tümden
  atlayabiliyor; örneğin izinli kısa cleanup bütçesi ve takılan ADB
  doğrulamasında yalnız `emulator-group:budget-exhausted` raporlanır,
  aidiyetli gruba kapatma denenmez. Inert 90 saniye cleanup bütçesi bu
  geçişi sınamıyor.
- [`:603–629`](ftps-android/build-recipe.sh#L603-L629): finally içinde
  INT/TERM 'not edilir' denmesine rağmen handler no-op. Pipeline
  başarılıyken cleanup esnasındaki INT/TERM sinyali yutulur; temizliğin
  sonucu boşsa rc 0 ve `FTPS_POSITIVE_RECIPE_PASS` çıkar. Mevcut sinyal
  kayıtları yalnız pipeline sırasında sinyal gönderdi.

Önceki yaklaşımın başarısız sayacı **2** korunur; bu farklı DECISION
tasarımıdır, sayacı sıfırlamaz. vsftpd kararlılık 2, RUSTC 1, auth 1
değişmedi. Sonuç koordinatöre; kabul, ürün/araç kodu değişikliği, gerçek
resource/egress işlemi, commit/push yok. CURRENT/MANIFEST scoped kapanış
yok; FTPS-1…4 toplu kabulü, üst P3-06/iOS/Faz3 açık.

## Yeni yürütücü dar FIX — bağımsız dönüş, 21.11.2026

**DECISION — scoped kabul yok; reap dahil mutlak süre hâlâ aşılıyor.**
Reviewer GPT-6.2 Sol (`openai/gpt-6.2-sol`), `ses_e02b92a99ffeq0YRpAWUiBcSB2`.
HEAD `508b3f0486a7ce04628ec0c3681d995573e5721d`. Gerçek değişiklik
yalnız [`build-recipe.sh`](ftps-android/build-recipe.sh), SHA-256
`21cc06ae380a31f7cf27d604df60b825c5207221a37a7918f39e2e9db8d80788`.
`/private/tmp/recipe-before-fix4.sh` önceki review SHA'sıyla (`b1e82c94…`),
gerçek unified diff başlıklar dışında
`/private/tmp/p3-06-recipe-fix3/fix4.diff` ile eşleşti. `sh -n` exit 0;
gömülü Python AST ayrıştırması geçti.

`/private/tmp/p3-06-recipe-fix3/{harness4.py,results4.txt,results4.json}`
statik çaprazlandı, mevcut koşular yenilenmedi (15 inert senaryo;
JSON SHA `9b3f534bf17a1bb99c665f349e890d0c15ff4dbcc9fc361fc3f4aad6432f0f84`).
ID'siz create + `NotFound` artık `CLEANUP_INCOMPLETE`/4; sonradan
görünme kaydı bunu destekliyor. `:203–224,346–376` inspect ile doğrulanmış
tam 64 hex ID'yi `rm` ve sonrasındaki inspect'e taşıyor; isim yalnız keşif,
yabancı etiket sökülmüyor. Cleanup INT/TERM kaydediliyor, temizlik sürüyor;
başarıdan sonraki inert INT/TERM 130/143 ve PASS yok (`:649–691`).
Emülatör grubunun ayrılmış payı ve koşulsuz çağrısı var (`:229–230,304–344`);
inert kısa bütçe örneğinde Docker belirsiz kalırken grup kapandı ve rc 4.
Önceki PKI/artefakt/pozitif fiş ve gerçek host/Android PASS reuse;
yeni tarif gerçek ortamda uçtan uca koşulmadı.

**Tek kalan engel — süre sınırı göreli parçalara bölünüyor ama
alt beklemeler mutlak son tarihe bağlanmıyor.** `:103–131` süreyi
`Popen` öncesinde örnekliyor, süreç açıldıktan sonra yeniden ölçmeden
`communicate` ve `wait` çağrılarına ayrı 50 ms alt sınır koyuyor.
Bağımsız inert prob yalnız gerçek dosyadan AST ile alınan `run()` gövdesini,
sahte `Popen` ve sanal saatle yürüttü; gerçek alt süreç yok:

| Kalan bütçe | Sahte açılış | `communicate` + `wait` | Sanal toplam |
| --- | --- | --- | --- |
| 10 ms | 20 ms | 50 ms + 50 ms | 120 ms |
| 1 s | 20 ms | 800 ms + 200 ms | 1,02 s |

`Popen` zaten 20 ms sürmüş ilk örnekte yeni bekleme başlatılmaması
gerekirken iki bekleme daha başlıyor; fark zamanlayıcı toleransı değil,
programın talep ettiği bekleme. ADB boot döngüsünün son iterasyonu ve
cleanup Docker çağrıları pozitif ama 50 ms'den küçük kalan süreyle
aynı yardımcıya ulaşabiliyor. Emülatör grubunda da `:251–265` son
tarihe kalan süreyle kırpılmamış 50 ms polling ve bağımsız reap timeout'u
aynı sorunu taşıyor. Mevcut 6 s cleanup / 14 s toplam inert örnekleri
bu son-dilim sınırını sınamıyor. §3 açıkça iç beklemelerin TERM/KILL
ve reap dahil **kendi mutlak son tarihini aşmamasını** gerektiriyor.

İlk tarif yaklaşımı başarısız=2 aynen. Yeni yürütücü dar FIX'in bu
invariantı karşılamaması ayrı kayıttır (1); önceki yeni-tasarım review
ret kaydı silinmez. vsftpd kararlılık 2, RUSTC 1 ve auth 1 ayrı kalır.
Karar koordinatöre; CURRENT/MANIFEST'e kabul işlenmedi. FTPS-1…4 toplu
kabulü, üst P3-06, iOS ve Faz3 açık. Gerçek Docker/ADB/Android/FTPS/build/
paket/egress işlemi, kaynak düzenleme ve commit/push yok.

## Mutlak zaman sınırı dar FIX — bağımsız dönüş, 21.11.2026

**DECISION — kabul yok; aynı mutlak süre invariantı ikinci dar FIX'te
de açık.** GPT-6.2 Sol (`openai/gpt-6.2-sol`),
`ses_e02b92a99ffeq0YRpAWUiBcSB2`; başlangıç/canlı HEAD
`508b3f0486a7ce04628ec0c3681d995573e5721d`. Tek aday
[`build-recipe.sh`](ftps-android/build-recipe.sh), SHA-256
`ea70a603deaa0220742676547dc5001132a40c2f425e518a9812903f96ebc2db`.
FIX-4 taban hash'i `21cc06ae…` ile, gerçek diff başlıklar dışında
`/private/tmp/p3-06-recipe-fix3/fix5.diff` ile eşleşti. `sh -n` exit 0;
gömülü Python AST ayrıştırması geçti.

`/private/tmp/p3-06-recipe-fix3/{harness5.py,results5.txt}` çaprazlandı;
gömülü kodla sahte saat/süreç kullanan önceki A–L koşularında `FAILS=0`.
`run()` Popen dönüşünde yeniden hesaplıyor; bütçe bittiyse KILL/poll
dışında bekleme yok, pozitif bütçede reap yeniden ölçülüyor.
Yerel emülatör TERM/KILL/reap helper'ında 50 ms sabit taban kaldırılmış;
ölmeyen grup yerel dilim sonunda canlı raporlanıyor. Harness yalnız bu
iki fonksiyonu çağırıyor; cleanup ADB polling veya parent çağrı
geçişini sınamıyor.

**Tek engel — dış temizlik ve parent son tarihi tüm beklemelere
aktarılmıyor.** [`:358–360`](ftps-android/build-recipe.sh#L358-L360),
`adb emu kill` döndükten sonra kalan süre 50 ms'den az olsa bile
`sleep(0.05)` istiyor. Bu, ADB payını aşar; `stop = ext_end` ise
emülatör grubuna ayrılmış zamana girer. Üstelik grup
[` :254`](ftps-android/build-recipe.sh#L254) (satır 254) kendi yeni
`now + EMU_SLICE` tarihini açar, cleanup `cend` ile sınırlamaz.
Bağımsız inert prob gerçek dosyadan `adb_teardown` AST'sini aldı;
ADB ve `EMU.poll()` sahte, saat sanal: **10 ms ADB payı → tek
50 ms uyku, 50 ms toplam**. Gerçek alt süreç/cihaz çağrısı yok.
Aynı parent aktarım sorunu [`:104–107`](ftps-android/build-recipe.sh#L104-L107):
`END`'e kalan süre bir monotonik örnekten, yeni son tarih ikinci
örnekten alınıyor; aradaki gecikme parent-bound tarihini `END`'in
ötesine taşır. Bu Popen'ın kaçınılmaz gecikmesinden ayrı, kodun
oluşturduğu bekleme hakkı. §3 kapsamındaki mutlak süre koşulu kapanmadı.

İlk tarif yaklaşımı başarısız=2, yeni yürütücünün mutlak süre dar
FIX'leri başarısız=2; birbirine eklenmez/sıfırlanmaz. vsftpd kararlılık
2, RUSTC 1, auth 1 ayrı ve değişmedi. Yeni FIX/koşu başlatılmadı.
Önceki gerçek host/Android PASS reuse; yeni tarif gerçek uçtan uca
çalıştırılmadı. CURRENT/MANIFEST kapanışı yok; FTPS-1…4, üst P3-06,
iOS ve Faz3 açık. Kaynak değişikliği/commit/push yok.
