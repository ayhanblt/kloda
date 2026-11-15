# 1.4b/F1 S3 — Opus uygulama kanıtı (12.11.2026)

Rol: Opus uygulama + aynı oturum öz-review (bağımsız değil).
12.11.2026 ayrı GPT gerçek-diff review: **kabul edilmedi**, R1–R7 scoped düzeltme
bekliyor. Karar/bulgular/devir: [review.md](review.md); taze bütünlük kontrolü:
`review-integrity.log`. Aşağıdaki uygulama kanıtları tarihî devir olarak korunur;
eksik negatif yollar için PASS değildir. S3 ve 1.4b checkbox'ları açık.
R1–R7 uygulama turu ve sonraki bağımsız GPT review:
[fix-r1-r7/MANIFEST.md](fix-r1-r7/MANIFEST.md),
[fix-r1-r7/review.md](fix-r1-r7/review.md). Fix turu R8–R11 nedeniyle kabul edilmedi;
güncel scoped devir bu review'dadır. Aşağıdaki ilk devir tarihî olarak korunur.
Sonraki R8–R11 turu [manifest](fix-r8-r11/MANIFEST.md) ve bağımsız
[review](fix-r8-r11/review.md): R8–R11 hedefleri doğrulandı; R12 erken capture
nedeniyle kabul edilmedi. Güncel durum FIX, scoped devir son review'da;
1.4b açık. Önceki review'lar ve kanıtlar tarihî olarak korunur.
Güncel R12/R3 kararı (12.11): [R12 manifesti](fix-r12/MANIFEST.md) ve
[onaylı scoped sözleşme](../../plans/f1-r12-clock-reconcile-fix.md).
FIX uygulamaya hazır: ayrı clock reconcile, saf-clock aynı-config wake koruma,
5 dosya, kalıcı intent yok; kabul edilen restart gecikmesi sınırlaması açık.
Bu kayıt uygulama/review kabulü değildir; 1.4b checkbox açık kalır.
Plan: `docs/implementation/plans/next-plan.md` (hash `baseline/sha256.txt`).

## Başlangıç / diff kapsamı

- Start HEAD `650ec17f300ebdeee804bd4218f5b57356eecb21`; staged boş (başta ve sonda).
  Önceden var olan kirli ağaç `baseline/start-status.txt`; kapsam dosyalarından
  yalnız `CURRENT.md` başta değişikti (`baseline/CURRENT.md.start-vs-HEAD.diff`).
- Tracked (M): `K/AndroidS3Automatic.kt`, `K/AndroidS3Queue.kt`, `K/AndroidS3Runtime.kt`,
  `T/AndroidS3AutomaticChecks.kt`, `T/AndroidFilesQueueRecoveryInstrumentation.kt`,
  `androidTest/AndroidManifest.xml` → `tracked-scope.diff`; önceki içerik `baseline/*.orig`.
- Untracked (yeni): `K/AndroidS3AutomaticPlan.kt`, `K/AndroidS3AutomaticCoordinator.kt`,
  `T/AndroidS3AutomaticPlanChecks.kt`, `T/AndroidAutomaticLockChecks.kt`,
  `T/AndroidS3AutomaticOsChecks.kt`; bu evidence dizini; CURRENT checkpoint.
- Son kaynak hash'leri `final-sources.sha256`. Ek dosya/şema dışı kolon/build config/
  dependency/ABI/native rebuild yok (build loglarında cargo/Rust görevi yok).
- Satır sınırı (nonblank/noncomment): Coordinator 255, Queue 188, Plan 136,
  Automatic 59, Runtime 22, LockChecks 240, PlanChecks 137, OsChecks 79,
  AutomaticChecks 74, runner 300 (başlangıç 299; dispatch LockChecks.scope'a taşındı).

## Komutlar (hepsi taze, bu oturum)

| Adım | Komut / log | Sonuç |
| --- | --- | --- |
| Ana compile | `:my-module:compileDebugKotlin -PklodaS3Native=true -PreactNativeArchitectures=arm64-v8a` → `compile-main-1.log` | PASS |
| Test APK | `:my-module:assembleDebugAndroidTest …` → `build-androidTest-1…8.log` | 1: test compile hatası (Long/Int) düzeltildi; 2–8 PASS. applicationId `com.kloda.sync.test` |
| Emulator | KlodaCloud18 `-port 5590 -no-snapshot-save`; `emu avd name`=KlodaCloud18, ranchu, API 35 | İlk headless açılış secure keyguard nedeniyle test paketi başlatamadı (`run-s3-automatic-lock-1.log`, "not encryption aware"); kullanıcı pencereli açılışta bir kez kilidi açtı |
| İlk temsilci | `am instrument -e scope s3-automatic-lock …` → `run-s3-automatic-lock-5.log` | PASS (representative + interleavings/revocation/ownership/storage) |
| RED kanıtı | `red/f1-mutation.diff` (geçici özgün-F1: kilitte due tüketip yeniden kur) → `red/run-s3-automatic-lock-f1-mutation.log` | Beklenen FAIL: "F1 RED: locked delivery consumed/changed the occurrence" due 1700003600000→1700007200000. Kaynak geri yüklendi, `red/pre-mutation.sha256` OK |
| Batch | `s3-automatic-plan` → `run-s3-automatic-plan-2.log`; `s3-automatic-contract` → `run-s3-automatic-contract-2.log`; `s3-pause` → `run-s3-pause-1.log`; `s3-global-pause` → `run-s3-global-pause-1.log` | 4/4 PASS |
| Gerçek OS | `s3-automatic-os` → `run-s3-automatic-os-1.log`, logcat `run-s3-automatic-os-1.logcat.txt` | PASS; öncesi/sonrası job 2712 yok |
| Lint | `:my-module:lintDebug -PklodaS3Native=true [--continue]` → `lint-1.log`, `lint-2.log` | NOT_RUN: `:react-native-worklets:lintAnalyzeDebug` lint aracı çöküşü ("Cannot find a KaModule"), my-module raporu üretilmedi (rapor 29.10 tarihli, eski) |

Ara başarısızlıklar (kök neden kanıtlı, test beklentisi düzeltmesi; ürün kodu değişmedi):
- lock-3/4: manuel `pause()` context'i döndürüyor → sonraki wake doğru şekilde
  `plan_stale`→refresh; test bu adımı açıkça bekliyor.
- lock-4: fake OS `finish(false)` sonrası pending'i tutuyordu; gerçek JobScheduler
  non-periodic işi düşürür, yalnız storage testinde modellendi.
- plan-1: SQL `LIKE 's3_auto%'`'da `_` joker → `s3_automatic` eşleşti; tam ad listesi.
- contract-1: gate'li worker sourceLock tutarken status/pauseAutomatic çağrısı
  15s gate timeout'una düşüyordu; çağrılar gate dışına/pauser thread'ine alındı.

APK/varyant: lock-5 build-6 APK'sı, pause/global-pause build-7 (`apk-sha256-build7.txt`),
plan-2/contract-2/os-1 build-8 (`apk-sha256-build8.txt`). Ürün kaynakları lock-5'ten beri
aynı (mutasyon geri yüklemesi hash'le doğrulandı); sonraki değişiklikler yalnız
AutomaticChecks/PlanChecks testleri, lock/pause scope'larını etkilemez.

## Plan sapmaları / review'a açık noktalar

- `mayRunAutomatic` artık `ui.isNotEmpty() ||` yolunu içermiyor: otomatik iş yalnız
  exact lease sahibiyle sürer (exact fencing).
- Stale/legacy wake: callback `true` döner, `jobFinished(false)` asenkron gelir (stale);
  protocol≠1 legacy envelope `false` döner ve yalnız marker yoksa reconcile tetikler.
- `cancel(ctx)` = coordinator revoke (epoch++, wake disarm, exact stop, epoch-tagged cancel);
  coordinator kurulamazsa yalnız JOB cancel.
- Unresolved/StorageBlocked kapısı süreç içidir (in-memory fence); süreç yeniden
  başlatılınca recover + exact CAS geçerlidir.
- Gerçek OS'te replacement `schedule` çalışan işi durdurdu (`stop:false` gözlendi);
  tasarımın "schedule-as-completion" varsayımı bu emulator/API 35'te doğrulandı.

## Açık kapılar

- Bağımsız GPT review yapıldı; R1–R7 engelleyici bulgular nedeniyle kabul açık.
- R8–R11 scoped fix turu (12.11, Opus): [fix-r8-r11/MANIFEST](fix-r8-r11/MANIFEST.md);
  uygulandı, bağımsız GPT review bekliyor.
- Lint NOT_RUN (bağımlılık aracı çöküşü); scoped Kotlin compile/test PASS.
- Gerçek cihaz kilidi/vault + doğal Doze/teslim zamanlaması: Faz 3/4 fiziksel kapı.
- FTPS F1 kapsamı ayrı plan; 1.4b bütünüyle kapanmaz.
