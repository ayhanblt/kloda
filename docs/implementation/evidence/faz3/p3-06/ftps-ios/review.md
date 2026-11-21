# P3-06 IOS-FTPS-1…3 — bağımsız review, 21.11.2026

**FIX — tek birleşik bulgu: tarifin Simulator bundle sahipliği ve
temizlik sonucu fail-closed değil (IOS-FTPS-3; IOS-FTPS-1 kimlik sınırı).**
Run-14'ün pozitif veri yolu kanıtı korunur; toplu kabul açık.

Reviewer GPT-6.2 Sol (`openai/gpt-6.2-sol`),
`ses_e02b92a99ffeq0YRpAWUiBcSB2`; uygulama manifestte Sonnet Medium
`ses_e04dba005ffeLlgijB58tGGxLQ`. Başlangıç/canlı HEAD
`b9be515607e54967d452574ae1f9f20501f39100`.
[`build-recipe.sh`](build-recipe.sh) SHA-256
`2518a8c3eac78a35b942314f2d9a10a34d966997a3814cbeceab4a2a7b1c90c8`;
`sh -n` geçti. Scoped fark evidence tarifi ve ayrılmış klondaki
tek Swift cleanup modu; canlı ürün/test dosyaları ve Android tarifi
değişmedi. Gerçek klon unified diff'i başlıklar dışında
[`cleanup-mode.diff`](logs/run14/cleanup-mode.diff) ile aynı.

- **IOS-FTPS-1:** Run-13 logundaki arşiv, executable ve public CA
  SHA'ları diskle eşleşti (`8faa8ceb…51d2`, `3ea89fe7…834a`,
  `eda054fb…d5ebc`). 194 Swift girdisi ve 7 üretim baseline dosyası
  hash eşleşti; önce/sonra production listeleri byte-eş. Sim `arm64`
  IOSSIMULATOR, test marker/exports ve test CA DER doğrulandı; üretim
  sim diliminde marker/CA yok. Gerçek plist bundle
  `com.kloda.fixture.ftps16c.files.rjbnxibhh`, nonce
  `8707ddb8-4507-4c97-be62-a6158e4c86cf`; ledger UDID
  `61A45399-D0F9-43C0-B356-E1EF6712E960`.
- **IOS-FTPS-2:** [Run-14 terminali](run-14-run.log) iki ayrı gerçek
  picker fazını ve exit 0'ı kaydediyor. Kaynak seçilen dizini kendi
  Source/Restore yollarıyla eşleştirip gerçek security-scoped bookmark
  kullanıyor. `localhost` ve yeni CA ile host explicit TLS verify OK;
  ürün trust değişmedi. Seed/reopen, alıcı dosyası ve bağımsız
  hesaplanan 4097 B `(i%251)` SHA-256
  `a16560d668b843fb3be99ace41dbd18471f342bd3255a1d21204b35e43f74436`
  eş. `terminate → launch reopen` ve ayrı terminal JSON'ları,
  `41dcb219-2a32-46fb-9101-fd17d34ed56b` aynı kalıcı işini gösteriyor;
  kaynak her modda restore içeriğini ve tekrar restore'da aynı inode'u
  doğruluyor. Seed/reopen/picker davranışı klon yamasında değişmedi.
- **IOS-FTPS-3:** Asenkron klon cleanup kodu `IosFtpsVault` ile aynı
  generic-password service/account (`…rjbnxibhh.ftps.native.v1`,
  `profile`, `synchronizable=false`) ve attributes-only yokluk
  kontrolünü kullanır. [Run-14 sonucu](logs/run14/cleanup-result.json)
  `deleteStatus=0`, `absentStatus=-25300`; uninstall bunun yerine
  sayılmadı. Terminal/ledger ve Sonnet'in kapanış kaydı run-14
  uninstall, Shutdown ve tam-ID konteyner sökümünü destekliyor;
  yeniden sorgu yapılmadı. Yerel `pki/`/`conf/` altında private key
  yok. Anahtarsız public PKI/log ve klon/build scratch'i ile yerel
  `kloda-p3-06-ftps-pro:2dc9d74b` imajı tekrar kullanım için duruyor;
  önceki anahtarsız kökler de silinmedi. Tek tarif `compile/relink/run`;
  Xcode 27/DeviceHub, kayıtlı imaj ve insan picker etkileşimi gerekir,
  sistem güveni veya ürün signing değişmez.

## Birleşik engel: tarif sadece o koşunun bundle'ını hedeflediğini ve söktüğünü garanti etmiyor

- [`build-recipe.sh:380–386,437–445`](build-recipe.sh#L380-L386):
  run `<root>`'tan okunan bundle'a yalnız önek testi uygular; köke
  ait exact bundle/nonce bağı veya aynı UDID'de önceden kurulu exact
  bundle yokluğu sınanmaz. `installed=True` **install'dan önce**
  yazılır. Başka bir fixture aynı exact bundle ile zaten kuruluysa,
  kurulum başarısız olsa bile `:324–330` onu uninstall etmeye gider;
  başarılıysa da mevcut kurulumu değiştirebilir. Bu bir run-14
  çakışma iddiası değil; IOS-FTPS-3'ün “yalnız bu koşunun” sınırı
  mevcut tek tarifte korunmuyor.
- [`build-recipe.sh:324–330`](build-recipe.sh#L324-L330):
  uninstall nonzero sonucu yutulur, ardından **herhangi** bir
  `get_app_container` nonzero sonucu yokluk sayılır. Arka arkaya
  servis/erişim hatasında uygulama hâlâ kurulu olabilir ama cleanup
  ilgili kimliği kalanlara eklemez. `:307–309` ayrıca cleanup
  JSON'unun `mode/phase/service/account` alanlarını beklenen exact
  kimliğe bağlamadan PASS/OSStatus kabul eder; run-14 JSON'u doğru
  kimliği taşıyor, tarif bu kontrolü zorunlu kılmıyor.

En dar kapatma yalnız evidence tarifinde: exact compile-root
bundle/nonce ve hedef UDID bağını, install öncesi doğrulanmış yokluğu
ve cleanup sonucunun exact kimliğini denetle; sökümde yalnız
doğrulanmış yokluğu PASS say, bilinmeyende aidiyetli kimlikle
`CLEANUP_INCOMPLETE`. Dar inert çakışma/araç-hatası ve gerçek
run-14 kayıtlarının yeniden eşlenmesi yeter; yeni gerçek runtime
gerekmiyor. Önceki gerçek run-14 sonuçları geçerli.

Run-12 kullanıcı gelmediği için timeout; test/FIX başarısızı değil.
Run-1/2 ayrı compile RED'leri, run-5 UI RED, run-6/8 tanı ve run-10
probe geçmişi korunur; Android/vsftpd sayaçları değişmedi. Yeni
Simulator/Docker/ADB/build/FTPS/paket/crash koşusu veya kod değişikliği
yok. CURRENT/MANIFEST kapanışı yok; üst P3-06/Faz3, gerçek LAN,
Photos, release ve diğer platform/arka plan kolları açık. Commit/push yok.

## Bundle sahipliği FIX — bağımsız dönüş, 21.11.2026

**FIX — IOS-FTPS-3: uninstall için eklenen aidiyet kontrolü, aynı
bundle'a dokunan Keychain ve parola temizliği yollarında yok.**
GPT-6.2 Sol (`openai/gpt-6.2-sol`), `ses_e02b92a99ffeq0YRpAWUiBcSB2`;
başlangıç/canlı HEAD `b9be515607e54967d452574ae1f9f20501f39100`.
[`build-recipe.sh`](build-recipe.sh) SHA-256
`6a3056ed92557f8504504879f0c7c9097ea57387914fe6df295187af05ca13c2`;
`sh -n` geçti. Gerçek değişen `check_identity`, listapps, install ve
cleanup yolları incelendi. `/private/tmp/p3-06-ios-inert/` altındaki
`fix7.diff`, `fake2.py`, `harness2.py`, `results2-RED.txt`,
`results2-GREEN.txt`, `remap-run14.txt` statik çaprazlandı.

Compile/relink metadata exact kök bundle/nonce/UDID ve aday executable
hash'ini bağlıyor; run-14 kayıtları bunlarla uyumlu. Install niyeti
ancak exact listapps yokluğundan sonra kaydediliyor. Yabancı/unknown
önkontrolde bundle install/uninstall yok (sahipli servisi başlatma ve
simulator boot bu kontrolden önce); partial install'da aday hash'i
eşleşmezse uninstall yok. Sonraki listapps hatası yokluk sayılmıyor.
Keychain sonucu eski dosya silindikten sonra, mtime ve exact
mode/phase/service/account/PASS/OSStatus ile sınanıyor. Bunlar gerçek
Simulator listapps biçiminin veya yeni tarifin runtime kanıtı değil.

**Somut kalan geçiş:** [`:322–342,372–379`](build-recipe.sh#L322-L342)
yalnız geçmiş `install_attempted` / `seed_launched` /
`password_placed` kayıtlarına dayanarak terminate, cleanup launch ve
container dosyası silme yapıyor. Exact bundle seed sonrasında
değişmişse veya kurulu adayın kimliği artık okunamıyorsa bu yollar
güncel sahipliği doğrulamadan mutasyon yapar. `:392–405` hash
kontrolü ancak sonraki uninstall'da çalışır; daha önceki Keychain
cleanup launch'ını veya parola/result dosyası silmeyi engellemez.
Exact Keychain sonuç şeması sonradan doğrulanıyor; yanlış kurulu
bundle'da işlem başlamasını önleyen bir gate değil. GREEN'deki
`install-partial` seed niyeti yazılmadan hata veriyor,
`wrong-keychain-id` ise yalnız sonuç JSON kimliğini değiştiriyor;
hiçbiri seed sonrası yabancı/unknown kurulu bundle'ı sınamıyor.

En dar kapanış: mevcut exact `listapps` + aday kimliği kontrolünü
cleanup moduna ve data-container mutasyonlarına da önkoşul yap.
Seed sonrası yabancı/unknown bundle'da terminate/launch/dosya
silme/uninstall olmadan kalan exact kimlikle `CLEANUP_INCOMPLETE`
çıktığını dar inert örnekle göster. Run-14 gerçek PASS, Keychain
`0/-25300` ve temizlik kanıtı reuse; yeni tarif gerçek ortamda
çalıştırılmadı, gerçek servis/cihaz/derleme yok.

Bu scoped aidiyet invariantında ilk FIX başarısız=1; run-12 kullanıcı
timeout'u ve önceki compile/UI RED, prob ve Android/vsftpd sayaçları
değişmedi. CURRENT/MANIFEST kapanışı yok. Üst P3-06/Faz3, gerçek
LAN, Photos ve release açık; kod/commit/push yok.

## Bundle/container aidiyeti FIX-2 — bağımsız dönüş, 21.11.2026

**DECISION — IOS-FTPS-3 aidiyet invariantı ikinci FIX'te de açık.**
Reviewer GPT-6.2 Sol (`openai/gpt-6.2-sol`), `ses_e02b92a99ffeq0YRpAWUiBcSB2`.
HEAD `b9be515607e54967d452574ae1f9f20501f39100`; yalnız
[`build-recipe.sh`](build-recipe.sh) aday SHA-256
`377165cadcf512ab3ed43566d3639d09595b5583d60e298fea0ce2a2ae2efdce`.
Taban `6a3056ed…`, gerçek diff başlıklar dışında
`/private/tmp/p3-06-ios-inert/fix8.diff` ile eşleşti; `sh -n`
geçti. `harness3.py`, `fake3.py`, `results3-RED.txt`,
`results3-GREEN.txt`, `results2-after-fix8.txt` statik çaprazlandı.

Yeni ortak gate, cleanup girişinde yabancı/belirsiz/yok app için
terminate/launch/uninstall'ı atlıyor; seed sonrası yokluk Keychain
yokluğu sayılmıyor. GREEN kayıtları bunları, exact Keychain sonucu
ve bağımsız sahipli servis/anahtar/shutdown temizliğini destekliyor.
Uninstall öncesi aday hash'i ve sonrasında exact yokluk korunuyor.

**Tek somut engel — kurulu executable aidiyeti, mutasyon hedefi
olan data container'ın aidiyetine bağlanmıyor.**
[`build-recipe.sh:265–271`](build-recipe.sh#L265-L271) dönen yolu
sadece UDID ve `Containers/Data/Application` alt dizgileriyle kabul
ediyor. Aynı UDID'deki *başka* uygulamanın data root'u da bu testi
geçer; yol, kurulu exact bundle'ın data-container kaydı veya bu
koşunun kaydettiği container kimliğiyle karşılaştırılmıyor.
[` :365–382`](build-recipe.sh#L365-L382) `get_app_container`
çağrısından **önce** executable'ı doğruluyor, dönen dizinde
`cleanup-result.json` dosyasını siliyor, ancak *sonra* bundle'ı
yeniden doğruluyor. Dolayısıyla lookup sırasında bundle/container
eşlemesi değişirse daha sonraki `CLEANUP_INCOMPLETE` foreign dosya
silinmesini geri alamaz. [`:414–427`](build-recipe.sh#L414-L427)
parola yolunda ikinci gate var, ancak o gate de dönen data path'i
doğrulamıyor: aynı UDID'de farklı container dönüp kurulu executable
hash'i değişmezse yabancı path'e unlink yine erişilebilir.

Inert `fake3.py:108–117` container lookup'ında her zaman aynı
`cont` değerini döndürüyor; “before launch” değişimi **terminate**
içinde, lookup'tan önce oluyor. `harness3.py:67–77` var olan
sentinel sonuç dosyasının silinmediğini sınamıyor (yalnız terminal
dosya varlığı ve çağrı sayıları). Bu nedenle GREEN, doğrulanmış
executable + yanlış aynı-UDID container veya lookup sırasında
değişim yolunu kapatmıyor. Bu bulgu Run-14'e atfedilmiyor.

Aidiyet FIX başarısız=2; üçüncü aynı yaklaşım yok, sonuç koordinatöre.
Run-14 gerçek runtime, exact `0/-25300` ve temizlik kanıtı reuse;
run-12 kullanıcı timeout'u başarısız test sayılmadı, önceki sayaçlar
korundu. Yeni tarif ve `listapps` biçimi gerçek Simulator'da
sınanmadı; gerçek koşu ve kod/commit/push yok. CURRENT/MANIFEST
kapanışı yok; IOS-FTPS-1…3 toplu kabul, üst P3-06/Faz3, gerçek LAN,
Photos ve release açık.

## Sandbox/tek kullanımlık makbuz tasarımı — bağımsız uygulama incelemesi

**FIX — offline link ve belirtilen inert dallar doğrulandı; yeni
tarif/IOS-FTPS-1…3 kabulü açık.** Reviewer GPT-6.2 Sol
(`openai/gpt-6.2-sol`), `ses_e02b92a99ffeq0YRpAWUiBcSB2`. HEAD
`b9be515607e54967d452574ae1f9f20501f39100`; aday
[`build-recipe.sh`](build-recipe.sh) SHA-256
`f9539f95eb1267e7c6c17055430979c98359d1bf8aeceddea279271fc9c598e4`,
`sh -n` geçti. `/private/tmp/p3-06-ios-inert/` altındaki `fix9.diff`,
`fix10.diff`, `results4-RED.txt`, `results4-GREEN.txt`,
`results2-after-fix9.txt` incelendi; son gerçek diff `fix10.diff` ile,
gerçek klon Swift farkı ise `logs/run16/cleanup-mode.diff` ile
başlıklar dışında eşleşti.

- Run-15 gömülü patch Python syntax RED; Run-16 offline relink exit 0.
  Diskte arşiv `8faa8ceb…51d2` ve **yeni** app `e04dfe57…5fd9`
  logla eşleşti; 194/194 Swift girdisi ve 7/7 üretim baseline hash'i
  doğrulandı. Run-14 executable `3ea89fe7…834a` farklı, eski
  cleanup `0/-25300` yeni challenge makbuzunun runtime kanıtı değil.
- `:247–308,624–639` bağımsız listapps bundle kaydı, plist
  nonce/executable ve exact data lookup eşleşmesi yoksa staging
  fail-closed; intent ilk yazmadan önce. `:312–336` alt dizinleri
  dir-fd/O_NOFOLLOW ve parolayı exclusive create ile açıyor; inert
  Caches symlink ve baştan yanlış/eksik alan yolları sınandı.
  Bu kanıt dosya sistemi yarışlarının veya gerçek DataContainer
  şemasının doğrulaması değil.
- Host cleanup container dosyası silmiyor; ayrılmış fixture kendi
  sandbox'ında parola ve exact Keychain kimliğini temizleyip 32 hex
  challenge'a özel atomik sonuç yazıyor. Host salt okunur identity,
  challenge/status/parola yokluğu denetimi yapıyor. İnert sonuçlar
  eksik/eski/yanlış/symlink makbuz, yanlış dizin, lookup ve parola
  kalması durumunda retention/nonzero; geçerli makbuz ve ayrı
  uninstall yokluğu dallarını destekliyor.

**Birleşik kimlik bağı bulgusu — offline artefaktın run önkoşulu ve
makbuzun staging kimliği bağlanmıyor.**

1. [`logs/run16/root-identity.json`](logs/run16/root-identity.json)
   ve Run-16 terminali aynı app'i gösteriyor, ancak kök
   `…Chk9Wq3x`, `run=chk9wq3x`, bundle `…rjbnxibhh`.
   `write_identity` kök sonekini yeniden türetirken relink eski
   plist bundle/nonce'u koruyor. Gerçek `check_identity():225–232`
   **`…rchk9wq3x`** bekliyor. Bu nedenle incelenen Run-16 app'i
   linklenmiş olsa da kendi tarifinde run-ready değil; gerçek
   DataContainer sorgusundan önce reddedilir. Link kanıtını koru,
   aday kimliğini inert olarak gerçek plist/metadata/kök üzerinden
   eşleştir; yeni Simulator koşusu gerekmiyor.
2. [`:629–639,388–435,483–499`](build-recipe.sh#L624-L639)
   staging intent yalnız boolean. Staging hedefi kalıcı aidiyet
   durumuna bağlanmadığından, sonraki lookup'lar **birlikte** yeni
   geçerli `B` container'ına geçerse cleanup onu başlangıç noktası
   alıp `B` için taze makbuz kabul edebilir; `A`'daki staged parola
   görülmez. `ctx["data"]` makbuzda kaydediliyor ama uninstall gate'i
   dönen yolu atmaktа. İlk doğrulanmış staging container kimliği,
   receipt kaynağı ve uninstall öncesi lookup arasında aynı bağı
   zorunlu tut; `A→B` değişiminde yeni makbuz olsa bile retention,
   nonzero ve `A` kimliği raporlansın. Mevcut testler tekil lookup
   mismatch/yanlış makbuzu sınar, iki lookup'ın birlikte değişimini değil.

Bu uygulama açığı kapatılsa da **gerçek ortam kapısı ayrı**:
exact Simulator kayıt alanının varlığı/anlamı ve yeni sandbox
makbuzunun gerçek runtime'ı kanıtlanmadı. Run-14 kendi varyantında
önceki gerçek veri yolu/cleanup kanıtı olarak reuse. İlk aidiyet
yaklaşımının sayacı **2** korunur; bu farklı sandbox tasarımının
ilk uygulama bulgusu. CURRENT/MANIFEST kapanışı yok; üst P3-06,
Faz3, gerçek LAN, Photos ve release açık. Gerçek ortam koşusu,
kod değişikliği, commit/push yok.

## Run-17 kimlik/pin ve Run-18 gerçek şema probu — bağımsız dönüş

**FIX — iki önceki bulgunun ana davranışları ve gerçek şema probu
doğrulandı; staging yazma sınırında açılan dizin pin'e bağlanmıyor.**
GPT-6.2 Sol (`openai/gpt-6.2-sol`), `ses_e02b92a99ffeq0YRpAWUiBcSB2`.
Başlangıç/canlı HEAD `b9be515607e54967d452574ae1f9f20501f39100`;
[`build-recipe.sh`](build-recipe.sh) SHA-256
`5f2bfc25d76f400cb5ea1f4b911c5c6c028b8f1e7d799cac94b29e40bcbc1df7`,
`sh -n` geçti. Gerçek identity, pin, install-only ve cleanup
yolları `fix11.diff` ve mevcut sonuçlarla çaprazlandı; son aday
ayrıca install-only modunu içeriyor.

- [Run-17](run-17-relink-identity.log) offline link exit 0; kök
  `Rlk4Hz8Q` → RUN `rlk4hz8q`, exact bundle `…rrlk4hz8q`,
  yeni nonce `48ab1c93-9bb7-4957-bcc7-06ad4ffd208f`.
  Yerel metadata, `IDENTITY_OK`, app hash `108ebc00…c8f8` ve
  üretim önce/sonra listesi eşleşti. Run-16 uyuşmazlığı ve önceki
  stale kayıt silinmedi, bu yeni kimliğe taşınmadı.
- `/private/tmp/p3-06-ios-inert/{fix11.diff,results5-RED.txt,results5-GREEN.txt}`
  RED/GREEN: lookup'ların birlikte `A→B` geçmesi ve aynı yola
  farklı inode gelmesi sonraki `own_check`'lerde `pin-mismatch`;
  makbuz/cleanup launch veya uninstall reddediliyor (olay
  adımına göre), `CLEANUP_INCOMPLETE`, geçerli `A` yolu korunuyor.
  `PIN` intent ile önce kaydoluyor; makbuz ve uninstall gate'i
  aynı global pin'i kullanıyor. Bu, aşağıdaki lookup→open
  aralığını sınamıyor.
- [Run-18](run-18-install-probe.log),
  [şema](logs/run18/install-probe.json),
  [ledger](logs/run18/ownership-run.json) birbirine ve scratch
  kopyalarına uydu. **Gerçek şema kanıtı**, yalnız Xcode 27.2,
  exact disposable UDID `61A45399-D0F9-43C0-B356-E1EF6712E960`
  ve Run-17'nin benzersiz bundle'ı: `Path` ve `DataContainer` var,
  gerçek parser/`own_check=own`, bağımsız canonical yol ve
  dev/ino `[16777233,166377686]` eş, kurulu nonce/bundle/hash eş.
  `:585–595,649–680` yalnız Shutdown başlangıcı ve exact yokluk
  önkoşuluyla install, ardından staging öncesinde dönüş; ledger
  `pinned=null`, staging/seed/parola false, Docker listesi boş.
  Ayrı uninstall yokluğu ve bu koşunun boot ettiği cihazın
  Shutdown sonucu terminal/uygulama kaydından reuse. App launch,
  picker, FTPS, sandbox makbuzu ve Keychain çalışma zamanı
  probun dışında. Yerel scratch PKI özel anahtarsız.

**Tek kalan scoped engel — açılan staging FD'si doğrulanmamış.**
[`build-recipe.sh:683–697`](build-recipe.sh#L683-L697) pin'i
doğruladıktan sonra yalnız yol dizgesini geçiriyor.
[` :325–341`](build-recipe.sh#L325-L341) `os.open(data, flags)`
sonrasında bu FD'nin `fstat(st_dev, st_ino)` değerini pin'le
karşılaştırmadan mkdir/create/write yapıyor. Aynı kanonik yolda
gerçek dizin `A` yerine gerçek dizin `B` lookup dönüşü ile open
arasında gelirse `O_NOFOLLOW` bunu engellemez; sonraki gate
seed'i durdurur ama yanlış staging yazması yapılmış olur.
Bağımsız inert prob yalnız gerçek `safe_stage_password` AST
gövdesini sahte OS ile çağırdı: pin inode `42`, açılan FD inode
`99`; buna rağmen `open Library → open Caches → create
fixture-password → write` gözlendi. Gerçek dosya veya süreç
işlemi yok. Dar kapatma: ilk mutasyondan önce açılmış root
FD'sinin exact pin'ini zorunlu kıl; aynı-yol değişiminde
mkdir/create/seed olmamasını inert doğrula.

Run-14 **eski fixture** runtime/temizlik kanıtı reuse. Gerçek
DataContainer şema kapısı belirtilen ortam için karşılandı;
**yeni sandbox cleanup makbuzu hâlâ gerçek runtime'da doğrulanmadı**.
FIX kapanmadan gerçek sonraki doğrulamaya hazır değil. Tarihî
aidiyet sayacı **2** korunur. IOS-FTPS-1…3 toplu kabulü yok;
üst P3-06/Faz3, gerçek LAN, Photos ve release açık. Yeni gerçek
Simulator/Docker/build/ağ koşusu, kod değişikliği veya commit/push yok.

## Staging FD doğrulaması — bağımsız dar FIX dönüşü

**REVIEW-READY — yalnız dar gerçek sandbox cleanup doğrulaması için.**
Son staging FD bulgusu kapanmıştır; IOS-FTPS-1…3 toplu kabulü değildir.
Reviewer GPT-6.2 Sol (`openai/gpt-6.2-sol`), `ses_e02b92a99ffeq0YRpAWUiBcSB2`;
HEAD `b9be515607e54967d452574ae1f9f20501f39100`.
[`build-recipe.sh`](build-recipe.sh) SHA-256
`db8f16f041933b8bd663fe8ca7c641a47278e1f0b8d18542a37c266735dd150e`.
Taban `5f2bfc25…`; gerçek diff başlıklar dışında
`/private/tmp/p3-06-ios-inert/fix12.diff` ile eşleşti.
`sh -n` ve gömülü Python AST ayrıştırması geçti.

- `:325–355,694–723`: `safe_stage_password` açılmış root FD'sine
  **ilk mutasyondan önce** `fstat` uygular; dizin türü ve exact
  pin dev/ino zorunlu. Yol yeniden açılmaz; doğrulanmış FD'den
  `Library`/`Caches` göreli `O_DIRECTORY|O_NOFOLLOW`, parola
  `O_EXCL|O_NOFOLLOW`, 0600. Yanlış FD veya `fstat` hatası
  mkdir/create/write öncesi `Fail`; root FD dış `finally` ile
  kapanır. Çağıranda hata, `password_placed`/seed launch'a
  ilerlemez; mevcut intent tabanlı cleanup korunur.
- `/private/tmp/p3-06-ios-inert/{harness6.py,results6-RED.txt,results6-GREEN.txt,results5-after-fix12.txt,results4-after-fix12.txt}`
  gerçek diff ile çaprazlandı. Yerel geçici dizin/inert fstat
  kanıtı RED 3 → GREEN 0: mismatch, fstat hatası ve regular mode
  için sıfır mkdir/write ve sıfır FD sızıntısı; eşleşmede 0600
  dosya ve kapanan FD'ler. Harness T4 hem mode hem inode'u
  değiştiriyor; bağımsız AST-only sahte OS probunda **aynı**
  dev/ino ile `S_IFREG` tek başına reddedildi, iz yalnız root
  open/close. Yeni gerçek dosya işlemi veya alt süreç probu yok.
  Önceki lookup swap/receipt-retention inert zinciri korunuyor.

Dar sonraki kanıt: yalnız exact Run-17 aday/Run-18'de kanıtlanan
Xcode 27.2 disposable ortamında, yetkili cleanup-only temsilcide
staging ve yeni gerçek sandbox challenge makbuzunu, parola yokluğunu,
exact Keychain OSStatus'larını ve ayrı uninstall/Shutdown sonucunu
doğrulamak. Seed/picker/FTP veya aynı install-only probunun tekrarı
bu boşluk için gerekli değil. Seed olmadan Keychain kaydı yoksa
`delete=-25300, absent=-25300` yokluk yoludur; gerçek var olan
girdiyi silme diye raporlanmaz. **Bu koşu yapılmadı.**

Run-18 gerçek şema/install-only kanıtı ve Run-14 eski fixture
runtime/temizlik kanıtı reuse; yeni sandbox receipt henüz gerçek
runtime'da doğrulanmadı. Tarihî aidiyet sayacı **2** korunur.
Üst P3-06/Faz3, gerçek LAN, Photos ve release açık. CURRENT/MANIFEST
kapanışı, gerçek Simulator/FTPS/Docker/build/paket/ağ koşusu,
kod değişikliği veya commit/push yok.

## Run-20/21 — bağımsız scoped kapanış, 21.11.2026

**ACCEPTED — yalnız P3-06 IOS-FTPS-1…3.** Kabul, aynı ürün
kaynaklarının Run-14 normal Files temsilcisi, güncel fixture link/şema
kanıtı ve değişen sandbox cleanup yolunun Run-21 gerçek dar kanıtına
dayanır; yeni varyantın tam seed/reopen veya `delete=0` koşusu değildir.

Reviewer GPT-6.2 Sol (`openai/gpt-6.2-sol`), `ses_e02b92a99ffeq0YRpAWUiBcSB2`.
Başlangıç/canlı HEAD `b9be515607e54967d452574ae1f9f20501f39100`.
[`build-recipe.sh`](build-recipe.sh) SHA-256
`4566102d5a0bc27d40f27e33cf788bdd3ce8254fb29aaf02f49a87e0d1c5ede5`.
Son scoped tarif farkı cleanup-only dalında salt-okunur staged
dosya gözlemidir; önceki fstat-before-write ve ortak lookup/pin
gate'leri, fixture-only Swift challenge yaması ve canlı ürün sınırı
korunuyor. Review yeni koşu yapmadı.

| ID | Bağımsız eşleme |
| --- | --- |
| IOS-FTPS-1 | [Run-20 offline relink](run-20-relink-unique.log) exit 0; `Wn5Tq2Xe` → exact `…rwn5tq2xe`, nonce `d778741c-934c-4a85-81df-9e247aa04618`, [metadata](logs/run21/root-identity.json), disk executable SHA `99f9cd11206262ee6c8f4bea82ddeb34f64bfd3769f32bbf654dfcfa88452b77` eş. Mevcut test `.a`/CA reuse (test-only marker ve Simulator varyantı); üretim önce/sonra listeleri byte-eş ve canlı baseline 7/7. [Run-18](logs/run18/install-probe.json) gerçek Xcode 27.2 `DataContainer` biçimini yalnız exact disposable ortamda kanıtladı. |
| IOS-FTPS-2 | [Run-14](run-14-run.log) eski fixture normal Files runtime reuse: iki gerçek picker, CA/localhost FTPS, 4097 B alıcı SHA, aynı iş için ayrı reopen, restore ve aynı inode. Yeni fixture'ın seed/reopen/picker gövdesi değişmedi; Run-21'de bunlar ve FTP yok. |
| IOS-FTPS-3 | [Run-21](run-21-sandbox-cleanup.log) gerçek cleanup-only; [ledger](logs/run21/ownership-run.json), [staging](logs/run21/cleanup-probe-staging.json), [makbuz](logs/run21/cleanup-receipt.json) scratch kopyalarıyla byte-eş. Exact aday/UDID, canonical data ve pin `[16777233,166619424]`, açılmış staging FD kontrolü; gerçek sentetik düzenli dosya 6 B/0600. Tek yeni challenge'ın exact bundle/nonce/UDID/service/account ve terminal receipt kontrolü, fixture ve host gözlemlerinde parola yokluğu. Sonuç `delete=-25300, absent=-25300`: **yalnız absent**, mevcut öğe silinmedi. [Run-14 `delete=0/-25300`](logs/run14/cleanup-result.json) eski fixture'da var olan öğeye ait ayrı gerçek kanıttır. Ortak sahiplik gate'i, geçerli makbuzdan sonra uninstall ve bağımsız exact listapps yokluğu; terminal/ledger'ın desteklediği Shutdown yalnız bu koşunun boot ettiği cihaz için. |

**Ledger semantiği:** `seed_launched=true` Run-21'de fiilî seed
değildir. `:710–736` probe dalı bu alanı cleanup niyeti olarak
yazar ve gerçek `seed` launch satırına ulaşmadan döner; terminal
`PROBE_ONLY` ile uyumlu. Alan adı yanıltıcı, runtime kapsamını
genişletmez; bu kayıt kalitesi notu ayrı FIX açmaz. Dar başarı,
ledger bayrağından değil gerçek staged dosya ve exact makbuzdan gelir.

[Run-19](run-19-sandbox-cleanup.log) eski bundle yeniden görünürken
fail-closed: install/uninstall/staging/launch yok; stale kayıt
korundu. Run-21 uninstall yokluğu **aynı boot oturumu** içindir,
reboot sonrası garanti yok; sonraki gerçek koşuda yeni benzersiz
kimlik gerekir. Run-12 kullanıcı timeout'u başarısız test değildir;
tarihî aidiyet sayacı **2**. IOS-FTPS-1…3 dar CURRENT/MANIFEST
kapanışı koordinatöre. Üst P3-06/Faz3, gerçek LAN, Photos, release,
çoklu hedef/background ve yeni varyantın tam akışı/`delete=0` ayrı
açıklar. Bu review'da kod, yeni gerçek koşu, derleme, commit/push yok.
