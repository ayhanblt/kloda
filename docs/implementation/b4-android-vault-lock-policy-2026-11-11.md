# B4 — Android S3/FTPS vault kilit politikası değerlendirmesi — 11.11.2026

Kapsam: backlog 1.4 / review B4 (`setUnlockedDeviceRequired(true)` yokluğu). Yalnız
değerlendirme/belgeleme; ürün/test kodu, ADR ve anahtar politikası değişmedi.
Kanıt: [manifest](evidence/b4-vault-lock-2026-11-11/manifest.json). Etiketler:
**K** = kaynak (bu oturumda okundu, hash'li), **D** = resmî doküman beklentisi,
**O** = gerçek OS gözlemi — bu oturumda hiçbiri yapılmadı (NOT_RUN).

## 1. Ortam (K)

- Uygulama `minSdk 24`, `targetSdk 36` (`node_modules/react-native/gradle/libs.versions.toml:3–4`).
  `android/` git-ignored; mevcut üretilmiş merged manifest
  `apps/mobile/android/app/build/intermediates/merged_manifests/debug/processDebugManifest/AndroidManifest.xml:8–9`
  de 24/36 (mtime 04.11, SHA256 manifestte). Modül `minSdkVersion 24` (`modules/my-module/android/build.gradle:26`).
- Runtime koşulları (kaynak): FTPS yalnız `KLODA_FTPS_NATIVE && SDK_INT >= 33`
  (`AndroidFtpsRuntime.kt:18`); S3'te SDK kapısı yok, yalnız `KLODA_S3_NATIVE`
  (`AndroidS3Runtime.kt:12`) → S3 etkinleştirildiği bir build'de API 24+ cihazlarda çalışabilir.
- **İncelenen build çıktısı (etkin varyant kanıtı değil):**
  `apps/mobile/modules/my-module/android/build/generated/source/buildConfig/debug/com/kloda/sync/BuildConfig.java:11–13`
  (mtime 11.11 20:38, SHA256 manifestte): debug, `KLODA_FTPS_NATIVE=true`,
  `KLODA_S3_NATIVE=false`. Yani mevcut debug çıktısında FTPS açık, **S3 kapalı**. Bu,
  çalışan veya dağıtılmış bir binary'nin kanıtı değildir (build/cihaz NOT_RUN).
- Bu nedenle §2–§4'teki S3 değerlendirmesi yalnız **kaynak** değerlendirmesidir; S3 için
  etkin-runtime kanıtı yoktur. FTPS için de kanıt yalnız üretilmiş bayrak dosyasıdır.
- Uygulama bileşenleri direct-boot-aware değil; vault dosyaları `noBackupFilesDir`'de.

## 2. Temsilci S3 zinciri (K): save → read/capture → otomatik admission → current

1. **Anahtar:** `AndroidS3Vault.kt:25–35` AES-256/GCM, yalnız ENCRYPT|DECRYPT; kilit/
   kullanıcı-doğrulama bayrağı yok. Alias varsa aynen döner (`:27`); yalnız yokken ve
   `create=true` iken üretilir (`:28–34`). Eksik anahtar okumada `storage_failure`.
2. **Uygulama kilit guard'ı:** her `read()`/`write()` başında
   `KeyguardManager.isDeviceLocked` → `credential_locked` (`:22–24,37,53`). `write()`
   önce `read()` ile okunamayan custody'yi ezmeyi reddeder (`:54–55`).
3. **save:** `AndroidS3Profiles.kt:9–14` read → journal prepare → write → confirm.
4. **capture/current:** `:15–23` her çağrıda `vault.read()` (dolayısıyla kilit guard'ı)
   + journal context/generation eşitliği. Tek seferlik başlangıç kontrolü değildir.
5. **Admission:** `AndroidS3Runtime.kt:10,16–17` manuel = UI sahibi ∧ unlocked;
   otomatik = unlocked ∧ pause yok ∧ (UI ∨ OS lease). `AndroidS3Queue.kt:61,64`
   admission önce, sonra `profiles.capture()`.
6. **Çalışma sırası tekrar doğrulama:** `AndroidS3Queue.kt:84–90` `check()` admission
   (unlocked dahil) + `profiles.current` (vault yeniden okuma). `AndroidS3Publisher.kt:21–27,35`
   kaynaktan her `InputStream.read` öncesi `requireCurrent()` → `check()` + `current()`;
   `AndroidS3Files.kt:13`, `AndroidS3Photos.kt:12` iş başında.
7. **Etkin ağ iptali:** `AndroidS3Publisher.kt:49` istemciyi `::requireCurrent` ile kurar.
   `AndroidS3Client.kt:31–35` `currentNetwork()` = bu `check` (queue `check()`: admission/
   unlocked + `profiles.current` → `vault.read()`) + Wi-Fi ağı kontrolü. Çağrı yerleri:
   istek öncesi (`:82`), istek gövdesi yazma döngüsü (`:60`), yanıt akışı döngüsü (`:94`),
   DNS lookup (`:38`) ve **100 ms programlanmış aralıklı `TimerTask`** (`:80–85`): hata olursa
   nedeni saklar ve `call.cancel()` çağırır; `IOException` saklanan `S3Failure`'a çevrilir
   (`:109`). 100 ms yalnız programlanmış aralıktır; kesin durdurma süresi, soketin anında
   kapanması veya sırrın bellekten silinmesi garanti edilmez (O: NOT_RUN).
8. **Otomatik iş:** `AndroidS3Automatic.kt:51–71` JobService lease `begin/end`; `onStopJob`
   → `AndroidS3Runtime.stop()` = bellek iptali + `pause("os_interrupted")`.

**FTPS farkları (K):**
- `AndroidFtpsRuntime.kt:14–16` admission'da **kilit şartı yok**: manuel = `visible`,
  otomatik = run-bound lease `valid()` (`AndroidFtpsJob.kt:51–52`: durdurulmamış,
  global pause yok, dispatch token güncel). Kilit yalnız vault üzerinden uygulanır:
  `AndroidFtpsVault.kt:21–23,36,52`; `AndroidFtpsProfiles.kt:22–33` capture/current.
- `AndroidFtpsQueue.kt:102,112–118` start/check `profiles.current` ile vault'u okur.
  Otomatik yolda `AndroidFtpsJob.kt:53–56` `matches()` → `destination()` → `capture()`.
- Native oturum: `AndroidFtpsProfiles.kt:34–41` parola Rust'a verilir; Rust `owner.current()`
  her kontrol/veri bağlantısı ve 32 KiB okuma döngüsünde JNI `onEvent(0)` →
  `current(captured)` → `vault.read()` çağırır (`packages/ftps-native/src/bridge.rs:19–25`,
  `session.rs:61,85,94,100,108`, `transfer.rs:20–142`; `AndroidFtpsPublication.kt:37–42`).
- Hata sınıfı: `credential_locked` `FtpsRun.delay` içinde 300 s geri-dönüşlü
  (`FtpsRun.kt:49`), `osAttempts` 5'te `exhausted`. Native callback reddi ise
  `native_<n>` olarak döner (`AndroidFtpsPublication.kt:50`); journal fazı native koda
  bağlı — Intent sonrası bilinmeyen ACK review'da kalır. Bu faz eşlemesi bu oturumda
  uçtan uca izlenmedi (Faz 3 test kapsamına).

## 3. Durum tablosu

Hücreler **K** (kaynak çıkarımı) dir; **D** işaretli olanlar doküman beklentisi.
Hiçbir satır için **O** yoktur (NOT_RUN). Üç sonuç ayrı tutulur: **kalıcı run fazı**
(run store'a yazılan), **UI durumu** (native `status()` yanıtının `run.state` değeri) ve
**operasyon journal'ı** (iş başına Intent→Uploaded→Verified / S3 creating→…→completed veya `review`).

**`status()` kilit koşulu (K):** iki protokolde de `status()` durum üretmeden önce
`profiles.capture()` çağırır (`AndroidS3Queue.kt:109–110`, `AndroidFtpsQueue.kt:182–183`);
capture `vault.read()`'e gider (`AndroidS3Profiles.kt:15–16`, `AndroidFtpsProfiles.kt:22–23`),
o da `unlocked()` guard'ını çalıştırır (`AndroidS3Vault.kt:22–23,36–37`,
`AndroidFtpsVault.kt:21–22,35–36`). Cihaz kilitliyken `status()` başarılı yanıt üretmez;
`credential_locked` ile reddedilir. Dolayısıyla "UI durumu" sütunundaki değerler yalnız
kilit açıkken okunabilen `run.state` değerleridir. Kilitliyken gerçek ekranda ne gösterildiği
(eski state'in tutulması, hata gösterimi vb.) kaynakta ayrıca izlenmedi; gerçek OS/UI
gözlemi O: NOT_RUN.

Kaynak dayanakları: S3 kalıcı faz `AndroidS3Queue.kt:40,97–99` (`os_interrupted`/`cancelled`/
`settings_changed`/… → `paused`; diğer kodlar, ör. `credential_locked` → `needs_attention`),
UI `:116`. FTPS kalıcı faz `FtpsRun.kt:23–31,49` (`cancelled`/`settings_changed`/`user_pause`/
`target_pause` → `paused`; `os_interrupted`/`credential_locked` → 300 s `waiting`,
`osAttempts ≥ 5` veya boot sayacı yoksa `exhausted`; diğerleri `needs_attention`), UI
`AndroidFtpsQueue.kt:190`: `active?.run?.id != run.id` iken (bu run aktif execution değilse)
`running` veya manuel `waiting` → `paused`; aktif execution bu run ise faz aynen döner. Manuel
olmak tek başına `paused` gösterimi için yeterli değildir. S3 UI `:116`: `pauseFailed` ise
`needs_attention`; aksi halde aktif olmayan `running` → `paused`, diğerleri faz aynen.
S3 operasyon journal'ı hata sonrası `completed/aborted/review` değilse `review` olur
(`AndroidS3Publisher.kt:96–99`); FTPS'de `markIssue` + bilinmeyen ACK review'da kalır.

| Durum | Yeni vault okuma/yazma | Bellekteki captured credential | Admission / lease | Kalıcı run fazı | UI durumu | Operasyon journal'ı | Tekrar doğrulama / devam |
|---|---|---|---|---|---|---|---|
| (a) ön plan + açık | izinli | var (JVM profil; FTPS'de ayrıca Rust parola) | manuel: UI (+S3 unlocked); otomatik: lease (+S3 unlocked) | `running` → `finished`/hata koduna göre | `running` | normal ilerler | her check/chunk/callback ve S3 100 ms timer'da geçer |
| (b) UI arka plan + açık | izinli | korunur | manuel düşer; otomatik: S3 UI yoksa OS lease şart, FTPS lease ile sürer | manuel S3 `os_interrupted` → `paused`; manuel FTPS `os_interrupted` → `waiting` (veya `exhausted`); otomatik değişmez | manuel S3 `paused`; manuel FTPS `waiting` run aktif execution değilse (`pause()` sonrası `active=null`) `paused`, aksi halde `waiting` (`:190`) | kesilen işte S3 `review` olabilir; FTPS bilinmeyen ACK review | otomatik geçer |
| (c) ekran kapalı, kilit **yok** (timeout dolmamış veya güvenli kilit yok) | izinli (`isDeviceLocked=false`) | korunur | (b) ile aynı (activity arka planda) | (b) ile aynı | (b) ile aynı | (b) ile aynı | (b) ile aynı |
| (d) cihaz kilitli | `credential_locked` reddi | **silinmez**; bir sonraki check'e kadar kullanılabilir | S3: `mayRunAutomatic=false`; FTPS: admission'da kilit yok, vault reddi | S3 otomatik: check önce admission'ı gördüğünde `os_interrupted` → `paused`; vault reddi önce gelirse `credential_locked` → `needs_attention`. FTPS: `credential_locked`/`os_interrupted` → `waiting`/`exhausted`; native callback reddi `native_<n>` → `needs_attention` | kilitliyken `status()` iki protokolde de `credential_locked` ile reddedilir; başarılı `run.state` dönmez. Soldaki kalıcı fazlar ancak unlock sonrası `status()` ile okunabilir (`:116`/`:190` kuralıyla). Gerçek ekran gösterimi O: NOT_RUN | S3 `review` olabilir; FTPS bilinmeyen ACK review | ilk check/chunk/callback/timer sınırında |
| (e) reboot, ilk unlock öncesi | uygulama süreci beklenmez (direct-boot-aware değil, CE depolama) **D: doğrulanmadı** | yok (süreç yeni) | yok | S3: queue açılışında `running` → `paused`/`os_interrupted` (`AndroidS3Runs.kt:30`). FTPS: plana bağlı otomatik `running` reconcile/job'da `os_interrupted` → `waiting`/`exhausted` (`AndroidFtpsScheduler.kt:57`, `AndroidFtpsJob.kt:73`) | ilk unlock öncesi `status()` vault guard'ı nedeniyle `credential_locked`; unlock sonrası S3 `paused`, FTPS aktif execution olmayan `running` → `paused` (`:190`) okunabilir | FTPS tamamlanmamış upload'lar `restart_review_required` (`AndroidFtpsJournal.kt:172`); S3 önceki `review` kalır | — |
| (f) tekrar unlock | izinli | koşullu: mevcut execution/capture veya yeni capture | koşullu (aşağıda) | koşullu (aşağıda) | koşullu | eski bilinmeyen ACK review'da kalır; kör retry yok | `profiles.current` + generation/context |

**(f) dalları (K, koşullu):**
- **FTPS manuel, aynı execution:** `finish()` yalnız run `waiting` ∧ manuel ∧ `mayRun` (UI görünür)
  ise `arm()` kurar (`AndroidFtpsQueue.kt:148`); `arm` → `retried` → `launch` aynı `Execution` ve
  aynı `captured` ile, önce `mayRun` + `profiles.current(value.captured)` kontrolüyle devam eder
  (`:158–176`). UI kaybıyla `pause()` edilen run'da `active=null` olduğundan bu yol kurulmaz.
- **FTPS otomatik, aynı run kimliği:** job `waiting` run'ı `retried` ile `running` yapar ve
  `queue.start(prior=candidate)` yeni `capture()` alır; binding eşleşmezse `settings_changed`
  (`AndroidFtpsJob.kt:67–83`, `AndroidFtpsQueue.kt:102–105`). Yalnız job hâlâ planlıysa (§5 F1).
- **S3:** her `start` yeni `S3Run` ve yeni capture (`AndroidS3Queue.kt:64–66`); otomatikte yalnız
  job hâlâ planlıysa (§5 F1), manuelde açık kullanıcı aksiyonu.

## 4. Uygulama guard'ı ↔ Keystore bayrağı

**Bugün (K):** kilit şartı uygulama kodunda, her vault erişiminde; Keystore anahtarı
kilitliyken de kullanılabilir. Pencereler:
- check→decrypt arası: `isDeviceLocked` ile `doFinal` arası mikro pencere (aynı çağrı).
- check→sonraki check arası: S3'te gövde/yanıt döngüsünde bir 64 KiB tampon ve ayrıca
  100 ms programlanmış `TimerTask` kontrolü; hata halinde etkin `call.cancel()` (§2 madde 7).
  FTPS'de bir 32 KiB döngü veya bloklu soket işleminde timeout'a kadar; FTPS'de timer tabanlı
  etkin iptal kaynakta yok. Bu aralıklarda ağ işi sürer; kesin durdurma süresi O: NOT_RUN.
- Bellekteki kopyalar: `S3Capture`/`FtpsProfileCapture` JVM nesneleri ve FTPS Rust
  `Zeroizing` parola (B3) çalışma süresince yaşar; kilit bunları silmez.
- Guard yalnız `unlocked()` çağıran yolları kapsar; uygulama sürecinde kilitliyken kod
  çalıştırabilen bir saldırgan anahtarı doğrudan kullanabilir.

**Bayrağın kazandıracağı (D, `02/03-ctx7`):** kilitliyken gizli anahtar işlemi
Keystore tarafından reddedilir → süreç içi kod da kilitliyken diskteki custody'yi
çözemez. Simetrik **şifreleme** kısıtı yalnız API 31+ (Android 11 ve altında yalnız
çözme kısıtlı). API 28'de eklendi; S3'ün API 24–27 cihazlarında yok.

**Bayrağın yapmayacağı:** JVM/Rust/TLS kopyalarını silmez, çalışan soketi durdurmaz,
uygulama guard'ının yerine geçmez (aynı kilit tanımı: `isDeviceLocked`).

**Resmî uyarı (D):** Android 12–14'te: güvenli kilit yoksa anahtar üretilemez/
kullanılamaz; güvenli kilit kaldırılırsa kullanıcının tüm unlocked-device-required
anahtarları **silinir**; zayıf biyometrik (ör. yüz) ile açılış anahtarı yeniden
yetkilendirmez. Google yalnız Android 15+ kullanımını öneriyor.

**Bu kodla etkileşim (K + D):**
- Kilit kaldırma silmesi → `key(false)` `storage_failure` → `write()` okunamayan custody'yi
  ezmeyi reddeder; S3/FTPS vault için silme/reset yolu yok (grep boş) → profil kalıcı
  kilitlenir. Bu "missing-key replacement yok" sınırıyla çakışır; yeni ürün kararı ister.
- Zayıf biyometrik açılış: guard `unlocked` der, Keystore reddeder → `Exception` →
  `storage_failure` (yanıltıcı; hata eşlemesi değişikliği ister).
- Güvenli kilidi olmayan kullanıcı (API 31–34): bugün çalışır, bayrakla S3/FTPS kullanılamaz.

**Mevcut alias'lar (K + D):** `key(true)` var olan alias'ı aynen döndürür; spec
"anahtarın yetkili kullanımlarını belirler" (D, `05-…excerpt`) ve üretimde verilir.
Builder'a bayrak eklemek yalnız **yeni** alias'ları etkiler; mevcut kurulumlar bayraksız
kalır. Sessiz migration yok; migration yeni alias + yeniden şifreleme = alias/format
değişikliği → korunacak sınırın dışında. Mevcut alias üzerindeki gerçek davranış O: NOT_RUN.

## 5. Ek kaynak bulgusu (B4 dışı, düzeltilmedi)

**F1 — kilitliyken tetiklenen otomatik iş planı iptal eder (K, fail-closed, erişilebilirlik):**
- S3: job → `consume()` vadeyi ilerletir → `start` `candidate_stale` → `finish` →
  `reconcileAsync` → `profiles.capture()` `credential_locked` → `catch { cancel(app) }`
  (`AndroidS3Automatic.kt:27,39,57–60,67`).
- FTPS: `execute` → `matches()` vault reddi → `finally reconcile` → `destination()` reddi →
  `cancel` + `ftpsAutomaticError=credential_locked` (`AndroidFtpsJob.kt:26–34`,
  `AndroidFtpsScheduler.kt:41,96–98`).
- Yeniden planlama: uygulama ön plana gelişi/OnCreate, ayar değişimi, BOOT_COMPLETED/
  USER_UNLOCKED/TIME receiver (`AndroidManifest.xml:49–56`). Her kilit açılışında
  çalışan bir tetikleyici kaynakta yok (D: USER_UNLOCKED anlamı bu oturumda doğrulanmadı).
- Sonuç: kilitli gece otomatik yedeği beklenmiyor ve uygulama açılana kadar plan
  düşebilir. Güvenlik açığı değil; ürün beklentisi açık (§7).

## 6. Sonuç ve öneri

- **Mevcut davranış onaylı gereksinimle çelişmiyor:** ADR0022 D1/D3, Step17 ve 16c/17
  belgelerinde kilitliyken aktarım gereksinimi yok (grep: yalnız review B4 ve emülatör
  kilit notu). Kilitli custody fail-closed; her vault erişimi guard'lı; otomatik iş
  cihaz kilidini aşmıyor.
- **Öneri: şimdi bayrak ekleme.** Android 12–14 hataları + reset yolu olmayan custody ile
  silme riski, kazanılan savunma derinliğinden ağır; mevcut alias'lar zaten etkilenmez.
- **Kalan risk (kullanıcı 11.11'de kabul etti, §7; implementer onaylamadı):** Keystore düzeyi zorlama yok;
  check aralığı pencereleri; kilitliyken bellekte kalan JVM/Rust kopyaları; F1.

**İleride istenirse (onay bekleyen seçenek, plan değil):** yalnız `SDK_INT >= 35` ve yalnız
yeni alias üretiminde bayrak; mevcut alias/AAD/format değişmez; Keystore reddi
`credential_locked`'a eşlenir, overwrite/yeniden üretim yok. Hedef: iki Vault dosyası.
Test: `AndroidS3ProfileChecks.kt`/`AndroidFtpsProfileChecks.kt` mock guard'dan ayrı olarak
gerçek Keystore `KeyInfo.isUnlockedDeviceRequired()` (yeni alias) ve mevcut alias'ın
değişmediği; gerçek kilitli-cihaz reddi API 35 emülatör/cihazda Faz 3/4. Kesin dosya/test
sınırı ayrı GPT planı ve açık kullanıcı onayı olmadan başlamaz.

## 7. Açık karar ve kapılar

- **Kullanıcı kararı (11.11, grill-me):** "Kabul + F1 ayrı iş". S3/FTPS için
  `setUnlockedDeviceRequired` şimdilik eklenmez; uygulama guard'ı ile Keystore zorlaması
  farkı ve §4/§6 kalan riskleri kabul edilerek belgelenir. F1 ayrı backlog maddesi ve
  GPT planıdır: kilitliyken güvenli bekleme korunarak kilit açıldıktan sonra planın
  kaybolmaması/yeniden çalışabilir olması değerlendirilir; OS arka plan sınırları altında
  anında çalışma garantisi verilmez. F1 bu oturumda uygulanmadı. B4 kararının kapanışı
  F1'in veya fiziksel güvenlik kabulünün tamamlandığı anlamına gelmez.
- **NOT_RUN:** tüm O sütunu; gerçek kilit/reboot/biyometrik davranışı; native faz eşlemesi.
- Bu belge runtime veya fiziksel güvenlik PASS'i değildir; Faz 3/4'e açık. Aynı-oturum
  incelemesi bağımsız değildir; 1.4 GPT gerçek-diff review kabulüne kadar açık.
