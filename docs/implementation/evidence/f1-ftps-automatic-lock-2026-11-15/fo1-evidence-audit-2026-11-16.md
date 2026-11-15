# FO1 — önceki kanıt / mevcut diff karşılaştırması

16.11.2026 · GPT salt-okunur ürün incelemesi; runtime/build/fixture işlemi YOK.
HEAD `f26e425dd808daf206ee7bd8ec6fe9402fbd1119`; mevcut dirty değişiklikler korundu.
Bu kayıt bağımsız ürün kabulü, yeni fixture yetkisi veya FO1 erteleme kararı değildir.
Hash karşılaştırmaları ve tracked kayıt whitespace kontrolü: `fo1-evidence-audit-checks.log`.

## 1. Bulunan tarihî PASS ve varyant

- Kaynak manifest: `../ftps-native-step16c-2026-11-03/manifest.json`,
  `sourceHashes`, `checks.androidOwnedRuntime`, `devices` alanları.
  HEAD etiketi `67701e7895ca9d7d5d7efe66d23b09954a8bf690`; o tarihte uygulama
  değişiklikleri commit edilmemişti. Bu HEAD tek başına test edilen kaynak değildir;
  dosya hash'leri esas alınır (checkpoint 03.11:3).
- Ham log `../ftps-native-step16c-2026-11-03/android-sources-final.log:13–27`:
  `PASS ftps-product-factory-service`, `PASS ftps-owned-os-files`, sonuç kodu `-1`.
  Bu log `ftps-sources` grubunun sonucudur; ayrıca `ftps-product` adlı scope koştuğu
  iddia edilmez. Aynı OsChecks gövdesi her iki scope'ta da çağrılıyor.
- Log SHA256 yeniden hesaplandı ve manifestle eşleşti:
  `ca587e6c3f136d12f4ab7b69013a68cb980c6da09051d34215301bb1b96e3508`.
- Owned `KlodaFtps16c / emulator-5584`, `com.kloda.sync.test`; arm64 FTPS-enabled
  debug/instrumentation bağlamı. Gerçek JobScheduler, forced JOB `2710`;
  owned SAF 65537-byte payload, `10.0.2.2:27449`, özel fixture CA.
  Üretim public-root paketiyle aynı trust varyantı DEĞİL.
- Runtime loader `AndroidFtpsFixture.kt:9–16` test asset'ini hash doğrulayarak yükler.
  `.so`: `04cf489acbe98913c49b46e47d58ac721b80b3e25322633dfb3715e375504653`;
  OsChecks: `0e7d09cb3dafe4b30f7e8e14819186e30bfa5f36c4df69c096f8792d34bdd3cc`.
  Fixture loader, hostname/sha256 asset'leri ve OsChecks bugün bu eski hash'lere eşit.
- Eski manifestte bu runtime koşusunun APK hash'i yok: tam APK aidiyeti eksiktir;
  kaynak+asset+ham log aidiyeti vardır. Yeni APK'ya eski tam-runtime PASS aktarılamaz.

## 2. Eski testin gerçekten doğruladığı

`AndroidFtpsOsChecks.kt:35–59`: owned source/profile kurulumu → reconcile → pending
JOB → forced OS callback → gerçek aktarımın finished sonucu; automatic=true,
attempts=osAttempts=1, files/completedFiles/operations/completedOperations=1;
planın run'ı boş, lease bırakılmış ve sonraki JOB dispatch'i plan due'suna eşit;
due gelecekte, PC owner yok; disable ardından JOB/WATCH yok.

Bu, UI açmadan ilk OS aktarımı ve sonraki JOB'un kurulması kanıtıdır. Sonraki
JOB'un ayrıca çalışması, OS çağrı sayısıyla tek completion, WATCH replacement,
eski A finally→yeni B korunması veya lock→unlock kanıtı DEĞİLDİR. Poll döngüsünün
tam koşulu ayrı bir assertion değildir; bu sınırlama da yeni ölçüte aktarılmamalı.

## 3. Mevcut diff ve yeniden kullanılan kanıt

- Job eski koşulsuz `jobFinished(false)` + WATCH cancel + reconcile yerine
  `complete()` arbiter'ını kullanıyor; locked backoff, stopped/envelope eşlemesi,
  replacement-as-completion ve admission belirsizliği yeni davranışlar.
- Scheduler: `projects/dispatch/resolve/complete`, token-fenced `defer`, fresh
  capture→CAS `changed`, `rewatch`; Queue: metadata-only wake + throw-only hook.
  Runner'ın eski ftps-product çağrıları AutomaticChecks:21–25'e aynı sırayla delege.
- Eski→bugünkü Job hash: `07c24720…`→`a6638fcd…`, Scheduler:
  `23df8d47…`→`62532c75…`, Queue: `05b6362b…`→`06b0b00b…`.
- FTPS Files/Journal/Runtime/Schedule/Sources/Vault/publication/restore kaynakları
  ve eski FTPS test gövdeleri hash karşılaştırmasında eşit. Bunların değişmeyen
  davranışlarına ait eski scoped kanıt korunur; toplu yeniden test gerekçesi yok.
- Rust kaynaklarının bir bölümü eski manifeste eşit değil; mevcut dirty FTPS işi
  Rust değişikliği içermiyor. Eski fixture binary'si ise birebir aynı. Dolayısıyla
  eski runtime, güncel Rust kaynaklarının/production binary'nin PASS'i sayılmaz;
  bu audit B3 veya release kapısını yeniden açmaz/kapatmaz.
- `fs-rest/source-final-2.sha256` sekiz girdisi yeniden hesaplandı: hepsi eşit.
  Scheduler/Job/Queue ayrıca lock koşusunun `source-green.sha256` değerlerine eşit.
  Mevcut FL/FW/FS/FP kanıtı sırf fixture server artık yok diye geçersiz değildir.

## 4. FO1 sözleşmesine eşleme — plan §3 FO1, §4.7–8

| Davranış | Mevcut kanıt / yeniden kullanım | Değişen veya kanıtsız kalan / tekrar gerekçesi |
|---|---|---|
| Gerçek başarılı JOB aktarımı → completion → sonraki JOB | 03.11 OsChecks PASS, değişmeyen engine asset/aktarım alt katmanı için prior-source reuse | Yeni `complete(self)`/schedule-as-completion başarılı ağ sonucuyla henüz koşmadı. Dar güncel success entegrasyonu ve tek-completion kaydı gerekir; eski log yeni completion'ı kanıtlamaz. |
| JOB pre-admission backoff ve defer | `fs-rest/run-green-1-ftps-automatic-lock.log` FL1/FL3; `run-fp1-3-lifecycle.log` busy/retry/old-wake-busy-defer | Gerçek OS callback + üretim yolunda mevcut. Bu davranış için yeni server veya aynı matrisin tekrarı gerekmez. |
| WATCH replacement ve eski finally'nin B'yi silmemesi | Aynı lifecycle logunda FW1/FW2 ve FS1 stale-watch PASS; gerçek `run -f 2711`, gerçek replacement/OS cancel, barrier ve OS recorder | Test sentetik denial/capture ile ağa girmiyor, fakat WATCH sahipliği/aynı URI/yeni token/finish-cancel yok ölçütünü doğrudan sınar. Bu satır için bağımsız yeni network-fixture gereksinimi gösterilmedi; reuse. |
| OS stop / eski cleanup | Aynı log FS2 gerçek `cmd jobscheduler timeout`, FS1 WATCH replacement eski A'yı OS cancel ile durdurur | OS stop'u bütünüyle NOT_RUN saymak yanlış. Sentetik onDestroy, OS kill kanıtı değildir; fiziksel kapı ayrıca açık. |
| UI açılmadan sonraki JOB | Eski OsChecks sonraki pending JOB'u; FL3 denial kaldırıldıktan sonraki forced callback'i UI'sız doğrular | Başarılı gerçek aktarımın yeni completion'ından sonra kurulan JOB'un sonraki callback'i tek zincirde gösterilmemiş. Dar success entegrasyonunda bu zincir gözlenmeli; doğal/Doze teslimi veya fiziksel unlock bu dar kapıya eklenmez. |

Güncel lock APK kaydı `fs-rest/apk-green-1.sha256`: `45b145b4…`;
lifecycle/FP1 APK kaydı `fs-rest/apk-fp1-3.sha256`: `0dbab472…`.
Manifest ortamı owned `emulator-5590`, API35 arm64; FTPS-enabled debug AndroidTest.
Bunlar mevcut kayıtların aidiyetidir; bu audit APK kurmadı veya runtime tekrarlamadı.
FO1 etiketiyle eski tam PASS bulunmadı; FO1 öncesi OS PASS ve bugünkü kısmi kapsam bulundu.

## 5. Sonuç / checkpoint

FO1 henüz kapanmaz; ancak **FO1 bütünüyle kanıtsız değil**. Kalan gerekçe,
değişen başarılı JOB completion'ının gerçek aktarım + tek completion + sonraki
JOB zinciriyle entegrasyonudur. Eski aktarım/restore/Photos/TLS matrisini yeniden
kurmak veya FW/FS/FP başarılarını tekrar koşmak bu bulgudan çıkmaz.

Fixture özel anahtar/betik yokluğu yalnız bu dar success koşusunu bugün çalıştırma
engelidir; tek başına yeni CA/.so/asset kapsamı için gerekçe/yetki değildir.
Bu audit fixture yeniden kurma planı açmadı; mevcut INITIAL/BLOCKED, lint NOT_RUN,
bağımsız review ve fiziksel/üst F1 kapıları korunur.

Sonraki prompt (aynı GPT plan sohbeti): `FO1 kanıt auditindeki yalnız başarılı
JOB completion → tek completion → UI'sız sonraki JOB açığı için en dar doğrulama
seçeneğini değerlendir; mevcut reuse kanıtlarını koru. Yeni fixture/CA/native asset
gerekiyorsa kesin dosya/varyant sınırını ve nedenini onaya sun; onaysız kurma.`
