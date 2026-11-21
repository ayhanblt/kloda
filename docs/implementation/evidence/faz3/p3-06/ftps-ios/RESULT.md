# P3-06 IOS-FTPS-1 — compile/link temsilcisi (21.11.2026, Sonnet Medium)

Sonuç: **IOS-FTPS-1 PASS (yalnız derleme/bağlama, offline).** Simulator başlatılmadı, kurulum/seed/servis/Docker/ağ yok; runtime kabulü değil. Commit/push yok; canlı ağaç ve üretim xcframework değişmedi. IOS-FTPS-2/3 koşulmadı. 16c iOS runtime reuse DEĞİL; Android PASS ve host Swift sözleşmeleri reuse.

## Tarif ve koşular
Tek tarif: [build-recipe.sh](build-recipe.sh) (`sh -n` OK; Android tarifi değişmedi). Komut: `sh build-recipe.sh /Users/ayhanblt/Desktop/projects/kloda`. Başlangıç=bitiş HEAD `b9be5156…`.
| Koşu | Sonuç | Kök neden / düzeltme |
|---|---|---|
| 1 ([run-1-fail-objc-header.log](run-1-fail-objc-header.log)) | RED: `kloda_ios_background_*` bulunamadı | Pod'da `NativePairing/KlodaPairingNative.h` public header; swiftc'e `-import-objc-header` verilmemişti → eklendi |
| 2 ([run-2-fail-stale-input-list.log](run-2-fail-stale-input-list.log)) | RED: `IosBackupTransport`/`IosRemoteChild`/`IosWebDavListing` yok | 16c girdi listesi bayat (`IosCloudTarget`, `IosWebDavListing` sonradan eklendi). Statik kanıt: Expo-dışı hiçbir dosya `ExpoModulesCore` import eden 10 dosyanın tiplerine başvurmaz → kapsam kuralı "`import ExpoModulesCore` içermeyen tüm üst düzey modül Swift'leri + NativePairing/*.swift + mevcut Files app" |
| 3 ([run-3.log](run-3.log)) | **PASS**, exit 0 (2m01s) | — |
Hata yolunda özel anahtarlar silinir (trap); 1. ve 2. koşu köklerinde `*.key/csr/srl` = 0 (doğrulandı).

## Kanıt (3. koşu, kök `/private/tmp/kloda-p3-06-ftps-ios.noenK1w3`, RUN `noenk1w3`)
- Test CA (public) sha256 `3c865f501b7879c582d78b26718b41f57af38dc11d7afaea400ae920a8c6febf` ([test-ca-public.pem](logs/test-ca-public.pem)); leaf `localhost`/`127.0.0.1` SAN, `openssl verify -x509_strict` OK.
- Test `.a` (`aarch64-apple-ios-sim`, release, `--features owned-fixture`, `KLODA_FTPS_FIXTURE_CA_DER`, `--locked --offline`): sha256 `da7abcc9786a64b527fa0d7018b6a2e735b6d6f78fc33c0848c0b50e9988e43d`; `lipo` = arm64; `_kloda_ftps_owned_fixture_marker`, `_kloda_ftps_publish_bound`, `_kloda_ftps_read_bound` var ([nm-test-a.txt](logs/nm-test-a.txt)); test CA DER baytları `.a` içinde gömülü.
- Üretim sim dilimi `e05f1132…ad1fad`: marker **yok**, test CA **yok**. Üretim xcframework (7 dosya: 2 dilim `.a`, plist/header, pairing `.a`) önce/sonra hash'leri **birebir aynı** ([production-before/after.sha256](logs)).
- Fixture app: `KlodaFtpsFixtureFiles.app/KlodaFtpsFixtureFiles` arm64, `platform IOSSIMULATOR`, `minos 16.4`, SDK 27.2 ([vtool.txt](logs/vtool.txt)); sha256 `7e1dd3a4974611e5d1781136ac9c3d556bb3e8c768d465ca3e6e69120a207c5b`; swiftc 0 hata/0 uyarı. Bundle `com.kloda.fixture.ftps16c.files.rnoenk1w3` (uygulamanın zorunlu öneki korunur), `FixtureNonce` benzersiz UUID, ad-hoc imza, `plutil -lint` OK. `OwnedLoopbackRoute.o` marker 16.
- Bağlanan 194 Swift girdisi ve hash'leri: [swift-inputs.txt](logs/swift-inputs.txt), [swift-inputs.sha256](logs/swift-inputs.sha256) (mevcut `IosFtpsLoopbackFilesApp.swift` + `OwnedLoopbackRoute.c` kaynağı değişmeden).
- Özel anahtarlar (`ca.key`, `server.key`, csr, srl) yalnız `…noenK1w3/pki` altında 0600, IOS-FTPS-2 sunucu leaf'i için tutuluyor; **repoda/logda yok**. IOS-FTPS-3 siler.

## Hazırlanan (KOŞULMADI) IOS-FTPS-2/3 akışı
Önkoşul farkı: Android tarifinin ownership/deadline/cleanup yürütücüsü Android'e özgü adımlarla tek dosyada; iOS için aynı Docker bölümü (14 `.deb` pin, `proftpd.conf.final`, `probe`/`unused`, 27449–27451 loopback, ledger, tam-ID söküm, `CLEANUP_INCOMPLETE`) bu tarife **kopyalanarak** eklenmeli (Android tarifi değişmez). Simulator host loopback'ini paylaştığından `adb reverse` yok.
1. Servis başlat (yukarıdaki PKI `server.pem/key` mount, test CA = `.a`'daki CA).
2. `xcrun simctl boot 61A45399-D0F9-43C0-B356-E1EF6712E960` (kayıtlı sahipli, şu an Shutdown); `simctl install` fixture `.app`.
3. `simctl launch <udid> com.kloda.fixture.ftps16c.files.rnoenk1w3 seed` → hemen `Caches/fixture-password` (içerik `unused`, 0600) app data container'ına yazılır (`simctl get_app_container … data`; uygulama ikinci picker sonrası okur/siler).
4. **Kullanıcı adımları (iki gerçek picker):** (a) açılan klasör seçicide uygulamanın `Source` klasörü açıktır → **Open/Seç**; (b) ikinci seçicide `Restore` klasörü açıktır → **Open/Seç**. Başka dokunuş gerekmez; iptal = `fixture_picker_cancelled`. Beklenen gözlem: `Documents/select-source-result.json`, sonra `seed-result.json` `status=PASS`.
5. Doğrulama: `seed-result.json` (`bytes=4097`, `hash`, `relativePath`, `catalogCount=1`, `unchangedReuse`, `restoreRepeatSameInode`); sunucuda tek dosya 4097 B ve `(i%251)` SHA-256 (hesaplanır); `Restore/owned.bin` içerik eşit.
6. Ayrı süreç: `simctl terminate`, `simctl launch … reopen`; `reopen-result.json` PASS.
7. Temizlik: terminate, `simctl uninstall`, servis/konteyner, anahtarlar, Simulator'ı yalnız biz boot ettiysek `shutdown`. Test Keychain girdisi: **uninstall Simulator'da Keychain'i silmeyebilir** (16c "testProfileKeychainDeleted" yapmıştı, yöntemi kayıtlı değil) → silme yöntemi koordinatör kararı (örn. kaydın nonce/servis adıyla hedefli silme); tüm cihaz `keychain reset` kapsam dışı sayılırsa kullanılmaz.

## Açıklar / sayaç
Tek yeni kod yok; seçici/kaynak değişikliği yok. Derleme 3 deneme (iki farklı kök neden düzeltildi, aynı yaklaşım iki kez başarısız değil). IOS-FTPS-2/3, picker, hedefli Keychain silme yöntemi, Docker yürütücü kopyası açık. Tam P3-06/iOS runtime kabulü değil; ayrı GPT review bekliyor.

---
# Güncelleme 21.11 (Sonnet Medium) — IOS-FTPS-2/3 **PASS (run-14)**, runtime tek koşu

Sonuç: sahipli `Kloda-Ftps16c-Disposable` (`61A45399-D0F9-43C0-B356-E1EF6712E960`), gerçek Source ve Restore picker'ları (kullanıcı dokunuşuyla), tek normal FTPS Files aktarımı **PASS**; hedefli Keychain yokluğu, uninstall, Simulator shutdown, servis ve özel anahtar temizliği **doğrulandı**. Tam P3-06 / Faz3 kabulü değil; commit/push yok; ürün TLS/trust, Android, Photos, başka cihaz dokunulmadı. Ayrı GPT review bekliyor.

## Koşular (bu oturumda, sayaç açısından)
| Koşu | Sonuç | Not |
|---|---|---|
| run-5 | RED `open -a Simulator` yok | Xcode 27'de `Simulator.app` yok; UI uygulaması `DeviceHub.app`. Düzeltildi. |
| run-6 | probe: `fixture_assertion_38` | Cleanup modu `require` OSStatus'u gizliyordu; açık durum raporu eklendi. |
| run-8 | probe: `-34018` (`errSecMissingEntitlement`) | Ad-hoc imzalı fixture'da `application-identifier` yok; `__TEXT,__entitlements` (`KLODAFIX00.<bundle>`, ürün Simulator uygulamasıyla aynı yöntem) eklendi. |
| run-10 | probe PASS (`-25300`/`-25300`) | Seed öncesi cleanup modu doğrulandı (probe, kabul değil). |
| run-12 | zaman aşımı exit 3 (kullanıcı yoktu) | Test/FIX başarısızı **sayılmadı**; kendi temizliği geçerli (Keychain `-25300/-25300` PASS, anahtar/servis/app yok). |
| **run-14** | **PASS, exit 0** (19:27:42Z–19:29:33Z) | Yeni aidiyetli PKI/app (`run-13-compile.log`) |

## Taze kanıt (run-14, kök `/private/tmp/kloda-p3-06-ftps-ios.jBnXibhh`, kopyalar `logs/run14/`)
- Aday: HEAD `b9be5156…` (başlangıç=bitiş); tarif sha256 `2518a8c3eac78a35…`; test CA (public) sha256 `eda054fb67314b060f827c584795f5d9c8f27fa9048bef23973e6786f92d5ebc`, leaf `localhost`/`127.0.0.1` SAN, strict doğrulama OK; test `.a` `8faa8ceb…51d2` (owned-fixture + CA gömülü, marker var); fixture app exec `3ea89fe7…834a`, bundle `com.kloda.fixture.ftps16c.files.rjbnxibhh`, nonce `8707ddb8-4507-4c97-be62-a6158e4c86cf`. Üretim xcframework/pairing `.a` hash'leri compile öncesi=sonrası=**şu an** baseline ile aynı.
- Servis: `kloda-p3-06-ftps-ios-srv-jbnxibhh` (kayıtlı ProFTPD imajı `8e6060ae…`, reuse), yalnız `127.0.0.1:27449–27451`, gerçek CA+`localhost` doğrulamalı explicit TLS ([host-tls.log](logs/run14/host-tls.log)).
- Seed ([seed-result.json](logs/run14/seed-result.json)): `status=PASS`, 4097 B, `catalogCount=1`, `unchangedReuse`, `restoreRepeatSameInode`, `sourcePicker`/`restorePicker` true, hash `oWVg1mi4…3RDY` = sentetik `(i%251)` payload SHA-256'nın base64url'ü.
- Alıcı ([receiver-readback.txt](logs/run14/receiver-readback.txt)): tek dosya, **4097 B**, sha256 `a16560d6…4436` = beklenen; sunucuda toplam dosya sayısı tam 1 (tarif doğruladı).
- Ayrı süreç reopen ([reopen-result.json](logs/run14/reopen-result.json)): `PASS`, aynı job `41dcb219-…`, aynı hash/bayt.
- Hedefli Keychain ([cleanup-result.json](logs/run14/cleanup-result.json)): service `com.kloda.fixture.ftps16c.files.rjbnxibhh.ftps.native.v1`, account `profile`, synchronizable=false; `deleteStatus=0` (girdi vardı, silindi), `absentStatus=-25300` (`errSecItemNotFound`), değer okunmadı; ham sır log'da yok.
- Temizlik (salt-okunur çapraz kontrol): Simulator **Shutdown** (yalnız biz boot ettik), uygulama kaldırıldı (`get_app_container` başarısız), konteyner 0, 27449–27451 dinleyen 0, `*.key` 0 (`pki/` yalnız public `ca.pem`, `server.pem`, `ext.cnf`), süreç yok; ProFTPD imajı korundu (reuse).

## Reuse / taze
Taze: bu koşunun PKI/test `.a`/app, seed, picker'lar, reopen, alıcı SHA, Keychain silme/yokluğu. Reuse: üretim xcframework hash baseline, host Swift sözleşmeleri, ProFTPD imajı/konfig/ownership-deadline çerçevesi, Android PASS. 16c iOS runtime reuse edilmedi.

## Tarifin son hali / diff
Tek tarif [build-recipe.sh](build-recipe.sh) (`sh -n` OK, sha256 `2518a8c3…`): `compile`, `relink`, `run`. Klon-yalnız fixture yaması [logs/run14/cleanup-mode.diff](logs/run14/cleanup-mode.diff) (cleanup modu; seed/reopen/picker satırlarına dokunmaz). Canlı Swift/vault, üretim kaynakları ve Android tarifi değişmedi (`git status`: yalnız admin dosyaları ve yeni `ftps-ios/`). Hata yolu inert doğrulaması: 8 senaryo (`/private/tmp/p3-06-ios-inert/`, repo dışı) rc/temizlik beklendiği gibi.

## Açıklar
1. Tek koşu, tek Simulator; çoklu hedef, background, gerçek LAN, Photos, release signing açık. Tam P3-06/iOS runtime kabulü değil.
2. Ad-hoc imza + sahte `KLODAFIX00` application-identifier yalnız fixture; ürün imzası/entitlement kanıtı değil.
3. Eski kökler (`E6Ef9Ynq`, `kQr4joy6`, `noenK1w3`, `FfYSpH3W`) anahtarsız duruyor (silinmedi; yerel scratch).
4. `DeviceHub.app` yolu Xcode 27'ye özgü; picker adımı hâlâ insan dokunuşu.

---
# Güncelleme 21.11 (Sonnet Medium) — gerçek install+sorgu probu (run-18): DataContainer/listapps şeması **KANITLANDI**

Kapsam: kullanıcı izniyle yalnız **bir** install/query probu; seed/staging/parola/Keychain/uygulama açma/FTPS/Docker yok. Bu, IOS-FTPS-2/3 runtime kabulü veya yeni receipt/cleanup-modu runtime kanıtı DEĞİL (uygulama hiç açılmadı).

## Önkoşul ve koşu
- Aday: run-17 anahtarsız compile-identity kökü `/private/tmp/kloda-p3-06-ftps-ios.Rlk4Hz8Q`, bundle `com.kloda.fixture.ftps16c.files.rrlk4hz8q`, nonce `48ab1c93-9bb7-4957-bcc7-06ad4ffd208f`, exec sha256 `108ebc00…c8f8`, test `.a` `8faa8ceb…51d2` (reuse). `check_identity` önceden `IDENTITY_OK`; kökte `*.key` 0; Simulator `61A45399-D0F9-43C0-B356-E1EF6712E960` **Shutdown**; recipe/xcodebuild süreci ve Docker konteyneri yok (yalnız kullanıcının DeviceHub'ı ve CoreSimulator servisi çalışıyordu).
- Komut: `KLODA_IOS_PROBE_INSTALL_ONLY=1 sh build-recipe.sh <repo> run <kök>` ([run-18-install-probe.log](run-18-install-probe.log), 20:09:18Z–20:10:07Z, exit 0). Tarife yalnız bu mod eklendi (`PROBE_INSTALL`: cihaz Shutdown şartı, yapılandırılmış `listapps` belirsizse küçük sırsız tanı ve install yok, install sonrası dur); 83 satırlık diff, normal akış inert regresyonu (8 senaryo) aynı. Tarif sha256 `5f2bfc25d76f400c…`.
- Akış (ledger [ownership-run.json](logs/run18/ownership-run.json)): bu koşu boot etti (`booted_by_us=true`) → exact yeni bundle'ın yokluğu yapılandırılmış `listapps` kaydından doğrulandı (`app_absent_verified=true`) → install → gerçek `own_check` → temizlik: kendi doğrulanmış adayı kaldırıldı, yokluk bağımsız `listapps` ile doğrulandı → yalnız bu koşu boot ettiği için shutdown. Stale `rjbnxibhh` bundle'ına hiçbir komut gönderilmedi (log'da geçmiyor); `staging_intent=false`, `seed_launched=false`, `password_placed=false`, uygulama açılmadı.

## Gerçek şema bulguları ([install-probe.json](logs/run18/install-probe.json); yalnız bu bundle'ın alanları)
- `listapps` plist→JSON ayrıştırması çalıştı (`plutil -convert json`); kayıt anahtarları: `ApplicationType, Bundle, BundleContainer, CFBundleDisplayName, CFBundleExecutable, CFBundleIdentifier, CFBundleName, CFBundleShortVersionString, CFBundleVersion, DataContainer, GroupContainers, IsAppClip, IsDeveloperApp, IsFirstParty, IsHidden, IsRemovable, Path, SBAppTags`. **`DataContainer` mevcut** (file URL), `Path` mevcut.
- `field_canonical` (DataContainer realpath) == `get_app_container … data` realpath (`canonical_equal=true`); yol `…/Devices/61A45399-…/data/Containers/Data/Application/7E506E56-…`; dizin **var**, `dev/ino` iki taraftan aynı `[16777233, 166377686]` (`ident_equal=true`).
- Kurulu plist bundle ve `FixtureNonce`, kurulu exec hash beklenenle aynı (`installed_*_ok=true`); `own_check = own`.
- Tarifin `own_check`/`dir_ident`/`data_field` kodu gerçek biçimi doğru ayrıştırdı; uyuşmazlık, düzeltme veya ikinci probe gerekmedi.

## Temizlik doğrulaması
`CLEANUP_DONE` (4,2 s): uygulama kaldırıldı ve exact yokluk doğrulandı, Simulator **Shutdown**, kök `ca.pem/ext.cnf/server.pem` (özel anahtar 0), Docker konteyneri 0, üretim xcframework/pairing `.a` baseline ile aynı, canlı `apps/packages/tools` temiz (`git status`: yalnız admin dosyaları ve `ftps-ios/`). Çıktıda sır yok; ilgisiz cihaz uygulamaları loga yazılmadı (yalnız bu bundle'ın alan adları).

## Hâlâ açık
Gerçek seed/reopen + yeni sandbox receipt/Keychain/parola cleanup modu runtime'ı (uygulama açma, picker'lar) bu probda koşulmadı. `simctl listapps` şeması artık bu Xcode 27.2'de kanıtlı; yeni Swift cleanup modunun gerçek Simulator'da çalıştığı kanıtlı değil. Run-14 eski varyant reuse, tarihî aidiyet sayacı 2, bağımsız review koordinatörde.

---
# Güncelleme 21.11 (Sonnet Medium) — tek sandbox-cleanup koşusu (run-19): **KÖK ENGEL, önkoşulda durdu, hiçbir mutasyon yok**

Sonuç: **REVIEW-READY değil; kök engel.** Hedef (mevcut disposable UDID + run-17 anahtarsız test app/`.a`, seed/picker/reopen/FTPS/Docker yok, yalnız cleanup challenge) çalıştırılamadı: tarifin kendi kapısı kuruluma izin vermedi (fail closed, beklenen davranış). Run-14 gerçek delete=0 (eski varyant) ve run-18 gerçek şema kanıtı reuse; aidiyet sayacı 2; commit/push yok.

## Ne oldu ([run-19-sandbox-cleanup.log](run-19-sandbox-cleanup.log), 20:18:10Z–20:18:23Z, `KLODA_IOS_PROBE_CLEANUP=1`)
- Önkoşul geçti: `IDENTITY_OK` (rrlk4hz8q, nonce `48ab1c93-…`, exec `108ebc00…`), test `.a` `8faa8ceb…`, kökte özel anahtar 0, cihaz Shutdown, Docker/recipe süreci yok, canlı ağaç temiz.
- Tarif cihazı boot etti ve exact bundle yokluğunu doğrularken **`com.kloda.fixture.ftps16c.files.rrlk4hz8q` kaydını "present" buldu** → `refusing to install (no install/uninstall attempted)`, exit 1. Ledger ([logs/run19/ownership-run.json](logs/run19/ownership-run.json)): `app_absent_verified=false`, `install_attempted=false`, `staging_intent=false`, `seed_launched=false`; yalnız bu koşu boot ettiği için shutdown yapıldı (Shutdown doğrulandı). Staging, parola, cleanup launch, uninstall, Keychain: **hiçbiri**.

## Kök neden (kanıtla daraltıldı)
- Aynı bundle run-18'de kurulup kaldırılmış ve **aynı boot oturumunda** exact yokluk doğrulanmıştı. Yeniden boot sonrası `listapps` kaydı geri geldi.
- Cihazı başlatmadan, yalnız bu bundle kimliğine ait `.com.apple.mobile_container_manager.metadata.plist` dosyaları salt-okunur tarandı: **hem Bundle hem Data container klasörü yok** (0/0). Eski `rjbnxibhh` için de 0/0 — kullanıcının daha önce "DataContainer var, iki dizin ve exec yok (stale)" bulgusuyla aynı desen.
- Sonuç: Simulator `uninstall` sonrası bu bundle için **kayıt kalıntısı (stale `listapps` girdisi) bırakıyor ve reboot'ta yeniden görünüyor**; dizinler gitmiş. Yani "exact yokluk" yalnız **oturum içi** kanıt; aynı bundle kimliği ikinci kez kullanılamaz (tarifin `app_absent_verified` kapısı bunu doğru yakaladı, ürün/test hatası değil, run-18 PASS'ini geçersiz kılmaz).

## Gerekli tek önkoşul (yapılmadı, onay bekliyor)
Her gerçek koşu **benzersiz, daha önce hiç kurulmamış bundle** ister: yeni RUN'lı bir `relink` kökü (offline Swift derleme+link ≈1 dk, Rust/PKI yok, mevcut `.a`/CA reuse; `relink` zaten yeni RUN için bundle+nonce yeniden üretiyor). Bu "tekrar derleme gerektirmeyen yol" sınırının dışında olduğundan koşulmadı. Alternatif (kalıntı kaydın temizlenmesi) cihaz durumunu değiştirir ve kapsam dışıdır.

## Tarif değişikliği (bu turda, scoped)
`KLODA_IOS_PROBE_CLEANUP=1` modunda seed'siz durmadan önce staged `Caches/fixture-password` dosyasının varlığı HOST tarafından salt-okunur (pinned FD, `O_NOFOLLOW`, dir-fd) doğrulanıp `logs/cleanup-probe-staging.json` yazılır (regular, 6 B, 0600, içerik `unused`); doğrulanamazsa Fail. 31 satırlık ek diff; sahte komutlarla: geçerli makbuz → uninstall PASS, parola kalan/makbuz eksik → `CLEANUP_INCOMPLETE` retained. Gerçek koşuda bu dal çalışmadı (önkoşulda durdu).

---
# Güncelleme 21.11 (Sonnet Medium) — benzersiz bundle ile tek gerçek sandbox-cleanup koşusu (run-20 relink + run-21): **PASS (absent dalı)**

Run-19'un kök nedeni (aynı bundle kimliği reboot sonrası stale kayıt olarak görünür) bu turda yeni benzersiz RUN/bundle ile aşıldı; ayrı kök neden/çözüm, aynı bundle'ın kendisi düzeltilmedi. Seed/FTPS/picker/reopen/Docker/ağ yok; uygulama yalnız `cleanup <challenge>` ile açıldı. Run-14 (gerçek `delete=0`, eski varyant) ve run-18 (gerçek şema) reuse; aidiyet sayacı 2; commit/push yok. Tam IOS-FTPS-2/3 runtime kabulü DEĞİL.

## Yeni aday (run-20 offline relink, [log](run-20-relink-unique.log))
- Kök `/private/tmp/kloda-p3-06-ftps-ios.Wn5Tq2Xe` (run-17 kökünün APFS kopyası; PKI/Rust/paket yok): `IDENTITY_REISSUED rrlk4hz8q -> rwn5tq2xe`, yeni nonce `d778741c-934c-4a85-81df-9e247aa04618`, exec sha256 `99f9cd11206262ee6c8f4bea82ddeb34f64bfd3769f32bbf654dfcfa88452b77`, `IDENTITY_OK` (bağımsız `check_identity` de geçti); test `.a` `8faa8ceb…51d2` ve CA reuse (CA DER gömülü), kökte `*.key` 0; cleanup kodu ikilide (`cleanup-`, `passwordAbsent`, `challenge`); üretim xcframework/pairing `.a` önce=sonra=baseline; run-17 kökü `out/so` hash'leri değişmedi. Eski/stale kayıtlara dokunulmadı (cihaz bu relink sırasında Shutdown'dı).

## Gerçek koşu ([run-21-sandbox-cleanup.log](run-21-sandbox-cleanup.log), 20:21:41Z–20:22:34Z, `KLODA_IOS_PROBE_CLEANUP=1`, exit 0)
Ledger ([logs/run21/ownership-run.json](logs/run21/ownership-run.json)): cihaz Shutdown'dı → bu koşu boot etti → yeni bundle'ın **exact yokluğu yapılandırılmış `listapps` kaydından doğrulandı** (`app_absent_verified=true`) → install → exact data container + dizin kimliği pin'lendi (`dev/ino` `[16777233, 166619424]`) → FD-doğrulamalı staging → seed hiç başlatılmadı (`seed_launched=true` yalnız tarifin probe modundaki **cleanup niyeti**; picker/seed launch yok) → cleanup.
- Pre-cleanup varlık (host salt-okunur, pinned FD zinciri; [cleanup-probe-staging.json](logs/run21/cleanup-probe-staging.json)): `fixture-password` var, düzenli dosya, 6 B, 0600, içerik sentetik `unused`.
- Cleanup challenge makbuzu ([cleanup-receipt.json](logs/run21/cleanup-receipt.json), challenge `cc38ec8961f36a7328b8e56e0ac6ffcc`): `mode=cleanup`, `phase=finished`, `status=PASS`, bundle/nonce/UDID exact, `service=<bundle>.ftps.native.v1`, `account=profile`, **`deleteStatus=-25300`, `absentStatus=-25300`** (yeni Keychain öğesi oluşturulmadı; **absent dalı**), `passwordAbsent=true`; host bağımsız parola yokluğu da `true` → `valid=true`.
- Sonra own gate yeniden → uninstall → bağımsız `listapps` yokluğu → yalnız bu koşu boot ettiği için Shutdown (`CLEANUP_DONE` 8,3 s). Sonrası: cihaz Shutdown, bu bundle için Bundle/Data container klasörü 0, Docker 0, kökte özel anahtar 0, canlı `apps/packages/tools` temiz.

## Oturum sınırı (garanti verilmez)
"Exact yokluk" **yalnız bu boot oturumu içinde** doğrulandı. Run-19'da gözlendiği gibi aynı bundle kimliği reboot sonrası stale `listapps` kaydı olarak geri görünebilir (dizinler yok). Bu bundle'ın ikinci bootta yokluğu **kanıtlanmadı/garanti edilmez**; sonraki her gerçek koşu yeni benzersiz bundle gerektirir.

## Kanıt ayrımı
- **Bu tur (taze):** yeni bundle'ın exact-yokluk doğrulaması, FD-pinli staging + varlık, challenge makbuzu, `delete=-25300`/`absent=-25300` (absent dalı), uninstall + oturum içi yokluk, Shutdown.
- **Reuse:** run-14 gerçek `delete=0` (eski varyant, silinen Keychain öğesi), run-18 gerçek `listapps`/DataContainer şeması.
- **Hâlâ açık:** gerçek seed/picker/reopen ile yeni sandbox modunun delete=0 dalı (varolan öğeyi silme) bu varyantta, tam akış runtime'ı, çoklu hedef/background/LAN.
