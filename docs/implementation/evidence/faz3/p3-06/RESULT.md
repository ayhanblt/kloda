# P3-06 sonuç — 20.11.2026 (Sonnet 5.5; MANIFEST/CURRENT/plan işlenmedi)

Ham log/exit: bu dizin (`*.log`: komut + zaman damgası + `EXIT=` içinde), `source-hash-map.json`.
Effort: bu çağrıda görülebilen tek değer sayısal `reasoning_effort = 10`; medium/high karşılığı ve konfigürasyon yüklemesi doğrulanamıyor, tahmin edilmedi.

## Kapsam / ortak kaynak
Yalnız host koşuları; emülatör, Simulator, Gradle, xcodebuild, DAV `prepare`, servis, anahtar üretimi **yok**. Koşu başında/sonunda ortak süreç yok. Cargo `/private/tmp/kloda-p3-04/packages` (CoW klon; testin ihtiyacı olan `docs/security` salt-okunur kopyası klona eklendi) içinde koştu; canlı ağaç ve P3-02 artefaktları değişmedi (P3-02 dört hash'i önce/sonra aynı). Ürün/test kaynağı, suppression, ürün TLS/trust değişikliği yok. P3-04 WATCH/test deltası ve P3-05 lint dokunulmadı.
Aday: HEAD `508b3f04…` + çalışma ağacı (P3-02/05'teki aday); P3-04 test deltası (iki test dosyası) bu satırı etkilemez.

## 1. Provenance / reuse eşlemesi (`source-hash-map.json`)
| Kanıt | Karşılaştırma | Karar |
| --- | --- | --- |
| B3 `sourceSha256After` (9 FTPS Rust kaynağı) | **9/9 eşit** | B3 Rust Drop/unit/Clippy sonuçları (host `--lib` 6 passed/2 ignored, android-jni 6/2, Clippy `-D warnings` exit 0) **REUSE**; toolchain aynı (`rustup 1.99.0`, `rustc 1.99.0 b940084d7`). Tekrarlanmadı. |
| 16c `sourceHashes` (138 girdi) | 100 eşit, **38 değişmiş** (F1/S3/1.x/B3: Android FTPS Job/Queue/Scheduler/Module, `KlodaSyncRuntimeModule`, iOS `IosFilesSnapshot/IosWebDavContext/KlodaFtpsModule/Automatic*`, FTPS Rust/`.a`, mobil FTPS TS/locale…) | 16c Android/iOS owned runtime ve Photos/Files PASS'leri **güncel adaya reuse edilmez**; tarihî varyant. |
| B4 `10-source-sha256.txt` (26 girdi) | 20 eşit, **6 değişmiş** (`AndroidFtps{Job,Queue,Scheduler}.kt`, `AndroidS3{Queue,Runtime,Automatic}.kt`: F1 fix2/S3) | B4 belge kabulü kalır (runtime değil); bu 6 dosyanın değişimi sonrası lock-politika davranışı yalnız P3-04 sentetik-denial koşularıyla (aşağıda) ve statik okumayla desteklenir. |
| L15 `backlog-1.5/source-final.sha256` (3 girdi) | 3'ünün de güncel hash'i kayıtlıdan **farklı**; güncel = HEAD (`508b3f04` checkpoint) | Bu dosya L15 kaynak eşitliğini **kanıtlamıyor**; `20-21` doc, `test-ios-webdav-journal.py`, S3 NOTICE sonradan değişmiş. L15 reuse için ayrı kayıt gerek; bu çağrıda yeniden doğrulanmadı (açık). |

## 2. Taze host koşuları (hepsi exit 0)
| Kontrol | Komut | Sonuç | Log |
| --- | --- | --- | --- |
| LAN/TLS çekirdeği (pairing-native, rcgen+rustls loopback, in-memory CA; kabul/ret, kimlik, revoke, resume, publication, ACL) | `rustup run 1.99.0 cargo test --locked --offline --lib` | **162 passed / 0 failed** (tls 12, identity 6, file_receiver 27, store_acl 9, installation chain 5, backup_retention 18 …) | `rust-pairing-lib.log` |
| Aynı, JNI özelliğiyle host derleme/test | `… --lib --features android-jni` | **162/162** | `rust-pairing-lib-android-jni.log` |
| iOS LAN soket harness (route double; gerçek OS LAN kabulü değil) | `… --test ios_lan_socket` | **3/3** | `rust-pairing-ios-lan-socket.log` |
| iOS Swift FTPS kaynak/restore/Photos codec sözleşmeleri (host `swiftc`; ağ/cihaz yok) | `python3 -I tools/test-ios-ftps-contracts.py` | source/seed/reopen, restore build/seed/reopen, photos build/codec-authority **PASS**, exit 0. Yeniden gerekçe: girdi `IosFilesSnapshot.swift` 16c'den beri değişmişti | `ios-ftps-contracts.log` |
| ELF LOAD ≥16 KB (4 ABI pairing lib) | `python3 -I tools/check-android-elf-alignment.py` | PASS (arm64-v8a/armeabi-v7a/x86_64/x86) | `check-android-elf-alignment.log` |
| APK ELF/RELRO — P3-02 androidTest APK (`e75ddfa3…`) | `python3 -I tools/check-android-apk.py <apk>` | **PASS**, 30 ELF64 (14 aligned-end, 16 own-load-no-writable-overlap) | `check-android-apk-androidtest.log` |
| APK ELF/RELRO — P3-02 **app** APK (`2966a0d0…`) | aynı araç | **araç assertion hatası exit 1: "Missing Kloda ABI"** — araç `x86_64`+`arm64` ister, aday yalnız arm64 (**FAIL-TEST/varyant uyumsuzluğu**, ürün bulgusu değil) | `check-android-apk-app.log` |
| Aynı app APK, arm64 kütüphaneleri (aracın kendi `self_test/check/relro_safety` fonksiyonları, araç değişmeden) | ad-hoc `python3 -I` | **PASS**: tüm `lib/arm64-v8a/*.so` LOAD ≥16 KB + RELRO düzeni (5 `libkloda_*` aligned-end/own-load) | `check-android-apk-app-arm64.log` |

Not: ilk temsilci denemesi (`file_receiver_revoke_tests` filtresi) iki ayrı nedenle değer üretmedi: klonda `docs/security` yoktu (`include_str!` derleme hatası, exit 101, ortam eksiği; log sonraki koşuyla üzerine yazıldı) ve filtre 0/162 test eşledi (`rust-pairing-rep.log`, exit 0, "0 passed"); bunlar PASS sayılmadı, tam `--lib` koşusu esas.

Reuse (tekrarlanmadı): P3-02 taze build/içerik (Android DEX 3 fabrika + 5 arm64 `libkloda_*`, iOS arm64 Simulator `debug.dylib` 3 fabrika + `kloda_ftps/sftp/storage` export); **P3-04 final lock 7/7 taze koşusu** sahipli emülatörde (JNI yüklü owned-fixture `.so`, **`ftps-product-factory-service`** gerçek ürün factory/service grubu dahil; FTPS-bayraklı P3-04 varyantı APK `7d87bc10…`) — P3-06 koşusu değil, kapsam/varyantı o kayıtta.

## 3. Statik eşleme (runtime değil)
- B4 lock politikası: `AndroidFtpsVault.kt:21–22,36,52` ve `AndroidS3Vault.kt:22–23,37,53` `KeyguardManager.isDeviceLocked` → `credential_locked`; WATCH/JOB/S3 coordinator bu kodu tek kilitli yola (`AndroidFtpsJob.kt:61–62,153`, `AndroidS3AutomaticCoordinator.kt:150,158`) bağlar. Pairing anahtarında `setUnlockedDeviceRequired(true)` yalnız `KlodaPairingPlatform.kt:108`. Modül manifestinde `directBootAware` **0** (direct-boot bağı yok; doküman doğrulaması hâlâ açık — B4 açık kapısı).
- Android emülatör/host lock davranışı: yalnız P3-04 sentetik denial (`captureFault`) FL1–FL3 7/7; **gerçek Keyguard/Doze/reboot/direct-boot NOT_RUN (Faz4)**.
- B2: kod/paket katmanı yukarıdaki ELF/RELRO + P3-02 paket içeriği; gerçek Release `nm`/flag/hash şartı ve B15 §20 ayrı kapı (bu çağrıda yok).

## 4. BLOCKED-ENV / NOT_RUN (bağımsız parçalara devam edildi)
- **Gerçek FTPS wire/TLS (Android JNI + iOS Simulator), `ftps-files/ftps-sources/ftps-owned-os-files/ftps-photos-owned`, Rust `#[ignore]` fixture testleri: BLOCKED-ENV.** Nedeni kanıtlı: 03 Kas'ta kullanılan loopback sunucusu `/private/tmp/kloda-ftps16c-engine/fixed-fixture-server.py` yok (taranan `/private/tmp` ve proje kökünde eşleşen dosya bulunmadı), CA/sunucu özel anahtarları kayıtlı olarak silinmiş (`server-teardown.json`), androidTest `kloda-ftps16/libkloda_ftps_native.so` o CA'yı gömüyor (`sha256.txt` `04cf489a…`); testler `10.0.2.2:27449` ve `hostname.txt=localhost` bekliyor. `ftps-preflight-2026-11-03/practical.py` eksik `check.py`'ye bağımlı. Yeniden üretmek yeni FTPS fixture recipe'i + yeni owned-fixture `.so`/CA olur (planın "yeni fixture recipe yok" sınırı; DAV `prepare` onayı FTPS'i kapsamaz) → **yapılmadı, özel anahtar üretilmedi**.
- **DAV `prepare`:** P3-06'nın hiçbir alt kontrolü DAV'a bağlı çıkmadı (DAV çok hedef P3-08/P3-12 satırları) → **çalıştırılmadı**; fixture/anahtar/CA değişmedi.
- Android emülatör ve iOS Simulator koşusu bu satırda yok (bağımsız, fixture'sız bir native kontrol kalmadı; fixture'lı olanlar yukarıda bloklu).
- iOS S3 native (P3-02'de derlenmedi), L15 kaynak eşitliği, gerçek Release B2/B15, gerçek LAN/OS ağ: açık.

## 5. Reuse / taze / açık özeti
- **Taze PASS:** pairing-native 162/162 (iki özellik kümesi) + iOS LAN soket 3/3, iOS Swift FTPS sözleşmeleri, ELF/RELRO (androidTest APK ve app arm64), ELF alignment 4 ABI.
- **Reuse:** B3 Rust (9/9 eşit), P3-02 build/içerik, P3-04 lock 7/7 (JNI product factory/service).
- **FAIL-TEST/varyant:** `check-android-apk.py` arm64-only app APK'da (araç x86_64 bekler).
- **Açık:** FTPS wire/TLS Android+iOS (BLOCKED-ENV), B4 gerçek lock/direct-boot (Faz4), L15 hash eşitliği, B2/B15 gerçek Release.

## 6. Tek sonraki adım
Koordinatör kararı: FTPS wire/TLS satırı için yeni loopback FTPS fixture + eşleşen owned-fixture `.so`/CA recipe'i **onaylanacak mı** (onay yoksa satır BLOCKED-ENV açık kalır, P3-06 kapanmaz). Bağımsız sıradaki satır: **P3-12** (DAV `prepare` ilk kez gerçekten bağımlı olacak satır).
