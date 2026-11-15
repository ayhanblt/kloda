# F1/S3 — R1–R7 düzeltme turu bağımsız GPT review

12.11.2026 — **KABUL EDİLMEDİ. S3 alt işi ve 1.4b açık.**

Reviewer: GPT-6.1 Sol (`openai/gpt-6.1-sol`), kullanıcı-başlatmalı bu ayrı GPT
review oturumu. Oturum ID'si araçlarda gösterilmiyor; uydurulmadı. Bu oturumda
ürün/test uygulaması yapılmadı. Ayrı Opus uygulaması `MANIFEST.md:3–4` ile
devredilmiş; onun öz-review'u bağımsız kabul sayılmadı. Alt ajan kullanılmadı.

## Gerçek kapsam / yöntem

- Başlangıç ve review HEAD: `650ec17f300ebdeee804bd4218f5b57356eecb21`.
  Staged alan boş. Tüm çalışma ağacının status'u kontrol edildi; ilgisiz birikmiş
  FTPS/JS/iOS/Rust/AGENTS değişiklikleri bu işe mal edilmedi veya topluca okunmadı.
- Onaylı 11 ürün/test/manifest dosyası `final-sources.sha256` ile aynı.
  Altı tracked dosyanın gerçek HEAD diff'i `../tracked-scope.diff` ile aynı.
  Beş untracked Kotlin dosyası incelemeye dahil; bu turda değişenler yalnız
  Coordinator, Plan, LockChecks ve PlanChecks. İki ürün dosyasının `.pre`
  snapshot'ları önceki review hash'leriyle eşleşiyor. İki testin tur öncesi kopyası
  yok; tam güncel içerikleri review edildi, eski test satır aidiyeti uydurulmadı.
- Plan hash'i `94675d2d6f0839e64720db624bcb26266f6b8b32ece36245503098822492da53`;
  önceki review ile aynı. Komutla gelen plan tekrar tam okunmadı. ADR0022
  D1/D3/Step17/preserved boundaries/FTPS ve B4 §5/§7 kontrol edildi.
- En dar taze doğrulama: hash/diff/başlangıç bütünlüğü, 300 satır sayımı ve
  kaynak üzerinde olay sırası incelemesi (`review-integrity.log`). Yeni runtime
  test/build/lint/emulator/ağ çalıştırılmadı. Aşağıdaki bulgular kaynak bulgusudur;
  çalıştırılmış yeni FAIL veya PASS iddiası değildir.

K = `apps/mobile/modules/my-module/android/src/main/java/com/kloda/sync/`;
T = aynı modülün `src/androidTest/java/com/kloda/sync/` dizini.

## Engelleyici bulgular ve scoped kabul sözleşmesi

### R8 — Yüksek: marker sonrası stale legacy callback OS sahipliğini devralıyor

**Yer:** `K/AndroidS3AutomaticCoordinator.kt:56–80,107–108,183–195`.

Protocol-0 (veya protocol/provider doğrulamasından geçmeyen) envelope `wake=null`
aday olur. `install` bu dalda legacy snapshot/marker/staleness doğrulamadan
`exec` ve `owner`'ı değiştirir, `unresolved=false` yapar. Marker sonrası `recover`
yalnız `Out.Finish` döndürür; `apply` owner'ı IDLE yapar. Örneğin current protocol-1
iş schedule failure sonrası OS backoff'a devredilmişken, stale legacy callback →
finish(false) → foreground + pending=null dizisi ikinci projection'a izin verir.
ProjectionUnresolved için de aynı stale callback belirsizlik korumasını kaldırır.
Aktif accepted A testi geçse de OSOwned/Unresolved sahipliği korunmuyor.

**Karşılanmayan kabul:** S4/S5; §6 marker sonrası legacy stale, §6.1.3 OSOwned
backoff'u foreground devralamaz, generic throw belirsizliği stale event ile açılmaz.

**Scoped düzeltme/kabul:** legacy adayın current/izinli olması sahipliği değiştirmeden
kanıtlansın. Marker sonrası stale legacy ve geçersiz envelope, existing OSOwned
backoff/ProjectionUnresolved state, epoch, wake, deadline ve exec'i değiştirmesin.
Her iki durumda stale delivery → tekrarlı foreground/pending=null için ek
schedule/cancel/finish(true)/admission=0; current yeni-params callback normal çalışsın.
Stale adaya ait exact finish(false), current sahipliği değiştirmemelidir.

### R9 — Yüksek: dirty clock fold → stop aralığında yeni plan teslimsiz kalıyor

**Yer:** `K/AndroidS3AutomaticCoordinator.kt:82–104,141–146,185,213–226`.

R3'ün active clock→stop→backoff testi, backoff değerlendirmesinin tamamını senkron
bitiriyor. Backoff callback'inde `fold` dirty clock değişimini `plan.arm(...,true)`
ile W1→W2 olarak kalıcılaştırıp `read()` ile `planWake=W2` yapar; Exec hâlâ W1'dir.
Bu noktadan replacement main event'i uygulanmadan önce exact `onStop(W1)` gelirse
`planWake == e.wake` false olduğundan retry=false. Sonraki `apply`, stopped Exec'i
yok sayar. Yeni W2 SQLite'ta vardır fakat schedule yoktur; eski OS işi de retry
almaz. Aynı pencere accepted run completion'ının `project()->fold` yolunda vardır.
Bu, ilk R3'e benzer UI'sız devam kaybını başka bir geçişte bırakır.

**Karşılanmayan kabul:** S1/S4; §6.1 clock revision'ın tek completion/handoff'a
katılması, exact stop'ta current geçerli planın OS devam yolunun korunması.

**Scoped düzeltme/kabul:** dirty revision ve OS handoff tek sahiplik protokolünde
serialize edilsin; eski envelope'u retry etmek tek başına çözüm değildir (W2 onu
stale yapar). Deterministik bariyerle (a) stopped A→W1 backoff fold ve (b) terminal
completion fold sonrası, replacement öncesi stop'u araya koy. Her iki sırada da
pending unaccepted occurrence için tek geçerli OS continuation veya planın
değişmeden güvenli handoff'u kanıtlansın; lease/run/accept duplicate ve çift OS
completion olmasın. Sleep veya yalnız tam senkron pump bu aralığın kanıtı değildir.

### R10 — Yüksek: migration uncertainty manuel queue başlangıcını engellemiyor

**Yer:** `K/AndroidS3AutomaticPlan.kt:65–71,94–113`;
`K/AndroidS3Queue.kt:19–20,63–74,100–102`;
`T/AndroidS3AutomaticPlanChecks.kt:175–191`.

Migration commit ack kaybı + failed proof yalnız Plan.uncertain ve coordinator
blocked alanlarını kurar. Queue.uncertain yalnız `startAutomatic` transaction
hatasında atanır; manuel `start` Plan.fenced'i veya migration gate'ini kontrol
etmez. Bu yüzden aynı migration unresolved iken foreground/manual guard'ları
sağlanırsa yeni manuel run yazılıp worker başlatılabilir. Yeni fence testi yalnız
automatic callback/projection'ı sınar; bu durumda manual start assertion'ı yoktur.

**Karşılanmayan kabul:** S2/S3; §3.1.5 migration belirsizliğinde §4.1 storage fence
ve kullanıcı onayındaki çözülmemiş DB belirsizliğinde manuel dahil yeni başlangıç
yasağı. Bu automaticPaused'ın manuele uygulanması değil ortak storage gate'idir.

**Scoped düzeltme/kabul:** migration belirsizliği ilgili queue'nun manuel ve otomatik
admission'ını tutarlı proof'a kadar engellesin; enable/toggle/status açamasın.
Gerçek migration commit+lost ack+read fault sonrasında manual `start` için
storage_failure, run/accept/worker=0 ve status.canRun=false doğrulansın. Fault
kalkıp aynı DB'de exact proof sonrası normal manuel davranış geri gelsin; manuel
başlangıç automatic plan/accept yazmasın. Yeni global gate/ABI/dosya eklenmesin.

### R11 — Yüksek: uyuşmayan migration proof sonraki reconcile'da aşılabiliyor

**Yer:** `K/AndroidS3AutomaticPlan.kt:94–100,107–111`;
`K/AndroidS3AutomaticCoordinator.kt:245–264`.

Migration catch'i yalnız proof read **başarısızsa** Uncertain kaydeder. Read
sonlanmış transaction'da marker+beklenenden farklı geçerli state kanıtlarsa
`:100` storage_failure atar fakat fence kurmaz. Coordinator `fence()` yalnız
plan.fenced'e baktığı için hiçbir gate oluşmaz. Sonraki reconcile marker'ı görüp
exact import proof'unu atlar ve bu uyuşmayan state'i arm/project/admit edebilir.
Örnek: mevcut gerçek-boundary `state-mismatch` fault'u migration'a uygulanırsa
commit edilen due beklenenden +1'dir; ilk çağrı hata, sonraki çağrı yetki üretir.
Bu mismatch, kanıtlanmış rollback/marker absence ile aynı sonuç değildir.

**Karşılanmayan kabul:** S2/S3; §3.1.5/§4.1 eksik veya uyuşmaz kalıcı kanıtta
storage gate, otomatik reset/adoption yok. İlk hata sonraki basit marker okumasıyla
başarıya çevrilemez.

**Scoped düzeltme/kabul:** marker+uyuşmaz plan proof'u fenced/unresolved kalsın;
`settle` mismatch'i kabul etmesin. Gerçek SQLite migration+ack loss+state-mismatch
ile tekrarlı reconcile/toggle/current callback/manual start sonrasında projection,
cleanup ve yeni run/accept=0 kanıtlansın. Kanıtlanmış marker absence/rollback'ın
izinli yeniden değerlendirilmesi ve exact committed import yolu korunmalıdır.

## R1–R7 durumu / S1–S5

- R1 kısmi: aktif accepted execution korunuyor; R8 OS-owned/legacy karşılığını açık
  bırakıyor. R2'nin current/stale/paused/revoked pre-admission stop assertions'ları
  mevcut. R3 kısmi: ilk active-plan değişimi giderilmiş; R9 fold/stop penceresi açık.
- R4'ün locked legacy running/absent + snapshot/unlocked migration assertions'ları
  mevcut. R5 kısmi: okunamayan proof'ta automatic gate korunuyor; R10/R11 açık.
  R6 negatif due reddi ve R7 ortak nonce-proof submit yolu/testleri mevcut.
- S1: locked/busy/early representative kanıtı korunur; R9 nedeniyle tam değil.
  S2: real commit/rollback admission kanıtı korunur; R10/R11 nedeniyle tam değil.
  S3: migration/provider kanıtı korunur; R10/R11 nedeniyle tam değil.
  S4: real OS synthetic-clock smoke korunur; R8/R9 nedeniyle tam değil.
  S5: fresh capture/guard/CAS sınırları korunur; R8 stale sahiplik şartı eksik.
- Bunlar bağımsız tam kabul değildir; yalnız bu turda düzelmiş yolların kaynak ve
  mevcut test karşılığıdır. Önceki bulgular yeniden tümüyle açık ilan edilmedi.

## Taze / reused / açık kapılar

**Taze:** `review-integrity.log`: HEAD/staged, 11 hash, tracked diff eşleşmesi,
round başlangıç/pre-copy hash'leri, değişmemiş plan hash'i, satır sayımları;
kaynak olay sırası incelemesi. Coordinator/runner 300 sınırında, diğerleri altında.
Ham loglar bağlama taşınmadı. Ürün/test değişmedi.

**Yeniden kullanılan:** bu tur `build-5.log` BUILD SUCCESSFUL;
`run-s3-automatic-lock-4.log`, `run-s3-automatic-plan-1.log`,
`run-s3-automatic-os-1.log`, `run-s3-automatic-contract-1.log` PASS satırları
kontrol edildi (OS/contract instrumentation code=-1). Güncel 11 kaynak hash'i
devirle aynı. APK-varyant/build5 eşlemesi `MANIFEST.md:37–53` uygulama devridir;
cihaza yeniden install/run veya APK yeniden üretimi yapılmadı. Queue/Runtime
değişmediği için `../run-s3-pause-1.log`, `../run-s3-global-pause-1.log` code=-1
sonuçları ve önceki `../red/` F1 regression kanıtı yeniden kullanılır.
Mevcut PASS bu review'da bulunan dört eksik sırayı kapsamaz.

**NOT_RUN/açık:** yeni R8–R11 runtime negatif testleri; lint (önceki dependency
lint crash, iki-deneme sayacı korunur, üçüncü deneme yok). Fiziksel keyguard/vault,
ilk unlock/CE, reboot/force-stop/Doze, doğal delivery, production service ve
signing/storage Faz3/4'te açık. FTPS F1, B4 kalan riskleri, P5 ve diğer önceki
kapılar kapanmaz. Kod review'u tam ürün PASS'i değildir.

## Checkpoint / devir

Ürün kodu/test/ADR/plan değiştirilmedi. Yalnız bu review/evidence, manifest ve CURRENT
durum kayıtları güncellendi. Hiçbir checkbox kapatılmadı; commit/push/index yok.
İdari kayıt eksikliği nedeniyle ek review turu istenmiyor; engeller ürün davranışı.

**Durum:** bağımsız fix-turu review tamam; R8–R11 nedeniyle kabul edilmedi.
**Devam:** YENİ SOHBET — yalnız uygulama rolüne geçiş.
**Rol:** GPT review → Opus uygulama.
**Tam prompt:** “AGENTS.md → CURRENT.md aktif 1.4b/F1 →
docs/implementation/evidence/f1-s3-automatic-lock-2026-11-11/fix-r1-r7/review.md oku.
Onaylı next-plan.md dosya/şema/policy sınırını genişletmeden yalnız R8–R11 scoped
düzeltmelerini uygula. OSOwned/ProjectionUnresolved stale legacy sahipliği,
dirty clock fold→stop aralığı, migration uncertainty'nin manuel queue storage
fence'i ve mismatched migration proof için review'daki deterministik negatif
sıraları shared production seam üzerinde kanıtla. Başlangıç HEAD/diff/önceki içerik
hash'lerini ve etkilenen dar test loglarını aynı evidence grubunda yeni alt dizinde
kaydet. Değişmeyen başarılı scope'ları tekrarlama; lint NOT_RUN ve iki-deneme
sayacını koru. Kapsam genişlemesi gerekiyorsa dur. Checkbox kapatma; FTPS/Faz3–4
kapılarını koruyup ayrı GPT gerçek-diff review'una devret. Commit/push yok.”
