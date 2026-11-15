# R13/R14 scoped FIX — bağımsız GPT review

15.11.2026 · **KABUL EDİLMEDİ — DECISION: R14 concurrency/storage-proof açığı.**
Goal `F1-S3-R13R14` ve üst 1.4b `[ ]` kalır. R13 temsilcisinin karşılanması üst işin kabulü değildir.

## Reviewer / gerçek kapsam

- Reviewer: GPT-6.1 Sol (`openai/gpt-6.1-sol`), kullanıcı-başlatmalı ayrı GPT review sohbeti.
  Bu sohbet uygulama yapmadı. Oturum ID'si görünmüyor; uydurulmadı. Opus self-review'ı bağımsız kabul sayılmadı.
- Start/review HEAD: `f26e425dd808daf206ee7bd8ec6fe9402fbd1119`; staged boş.
  Beş Kotlin `.pre` dosyası HEAD içeriğiyle, beş final hash güncel kaynakla eşleşiyor.
  `round-r13-r14-final.diff` gerçek HEAD→working-tree beş-dosya diff'iyle byte-exact eşleşiyor.
  Dört kaynak değişmiş; OsChecks değişmemiş. Yeni schema/ABI/dependency/ürün dosyası yok.
- Tracked/staged/untracked status incelendi. Başlangıçtaki üç command, AGENTS ve plan diff'i
  dosya bazında aynı; review kapsamına ürün değişikliği olarak alınmadı. Untracked tur evidence'ı incelendi.
  CURRENT başlangıç kopyası var; mevcut durumu kaynak ve kanıtla kontrol edildi.
- Satır sınırı kayıtları: Coordinator 300, Plan 179, LockChecks 300, PlanChecks 281, OsChecks 85.
  Araştırma eki/tarihî CURRENT açılmadı. İlgili scoped sözleşme §§1–3, eski sınır §§3–6 ve
  ADR0022 D3/V1/korunan sınırlar esas alındı; ADR/ürün kararı değişmiyor.

K = `apps/mobile/modules/my-module/android/src/main/java/com/kloda/sync/`;
T = aynı modülün `src/androidTest/java/com/kloda/sync/` dizini.

## Ortak goal / ölçüt tablosu

| ID | Review sonucu | Kanıt / açık |
|---|---|---|
| G13 | Hedeflenen eski-stop ve eski-result yolu destekleniyor | `LockChecks.stale`: throw/success/nonce/inflight; red1 ve red2 invariant FAIL, final g14c GREEN; revision emekliliği ve ticket-result fencing kaynakta doğrulandı |
| G14 | **Karşılanmıyor** | Sequential committed/context-refresh temsilcisi RED→GREEN; rollback/mismatch/config/revoke karşıtları mevcut. Aşağıdaki R14-C1, aynı committed wake'i paralel recovery'de bozuyor |
| GP | Kayıtlı dar komşu kontroller başarılı; tam PASS değil | final lock/plan/os logları, R12 early capture=0, exact lease/manual gate, config/revoke, nonce, migration/cleanup ve reopen kaynak/test incelemesi; concurrency recovery eksik |

## R14-C1 — Orta / engelleyici: proof tüketimi ile request'e bağlama atomik değil

**Aile:** clock transaction proof / storage fence. **Köken:** R14'ün aynı invariant ailesinde
kalan paralel recovery alt yolu; bu tur ilk kez bulgu, yeni ürün hedefi değil.

**Yer:** `K/AndroidS3AutomaticCoordinator.kt:288–294` özellikle `:291–293`;
`K/AndroidS3AutomaticPlan.kt:119–124,156–157`.
Üretim reachability: `K/AndroidS3Automatic.kt:24,34` her background/reconcile için yeni Thread
açar; tek seri executor yok. Test fixture'ının varsayılan background'u synchronous'tur
(`T/AndroidAutomaticLockChecks.kt:87`); mevcut R14 testi iki reconcile'ı yarıştırmaz.

**Başlangıç → olay sırası → gerçek sonuç (kaynak-temelli interleaving):**

1. R exact committed, ack/read kaybından sonra `blocked=true`, `blockedAttempt=null`,
   Plan.uncertain=R, aynı epoch'ta request.proof=(old,R); proof artık okunabilir.
2. T1 `unblock` kontrolünü geçer; `plan.settle` sourceLock altında R'yi kanıtlar,
   uncertain'ı temizler ve ClockCommitted döner. Plan monitor'ü bırakılır; Coordinator
   henüz `:292` kilidine girip committed'ı request'e bağlamamış/blocked'ı temizlememiştir.
3. T2 ordinary reconcile bu arada `blocked=true` okur. `settle` artık NoFence döner;
   `else -> plan.disarm()` R.wake'i null yapar. T2 blocked'ı temizler.
4. T2 fresh authority ile arm çalıştırır: config aynı olsa da wake=null dalı yeni wake
   üretir ve rotated revision epoch'u ilerletir. T1'in geç gelen proof'u artık eski
   request'e bağlanamaz. R'nin committed wake'i config/revoke olmadan değişmiştir.

**Karşılanmayan ölçüt ve etki:** G14; scoped plan §3:104–113 proof bağlama sırası,
tek devam ve committed due/wake/retry koruma; eski sözleşme §4:91–95 clock proof'un
migration/disarm ile karıştırılmaması. Committed clock recovery sıradan foreground
ile disarm/rearm'a dönüşüyor. Due'nun mutlaka değiştiği, credential sızıntısı veya çift
run gerçekleştiği iddia edilmiyor. Bu olay dizisi runtime'da koşulmadı; bulgu gerçek
üretim thread/call/lock sınırlarının kaynak incelemesine dayanıyor.

## DECISION — aynı GPT sohbetinde kök neden / en küçük çözüm

- Kök neden snapshot eşitliği artık değil: Plan fence'inin tüketilmesi, exact Clock
  request'e bağlama ve Coordinator blocked durumunun temizlenmesi ayrı critical section'lar.
  İkinci recovery aynı blocked durumunu eski okuyup NoFence'i genel recovery sanıyor.
- Sözleşme çelişkisi yok: NoFence genel recovery disarm kuralı korunur; ancak aynı clock
  proof'unu tamamlamakta olan iki çağrı iki ayrı recovery yetkisi değildir.
- En küçük öneri: Coordinator'un **plan-proof recovery** dalında sourceLock altında
  blocked/blockedAttempt durumunu yeniden doğrula; settle → exact epoch/request/pair
  binding → blocked/owner temizliğini tek atomik karar yap. Önceden okunmuş blocked'a
  güvenme. İkinci çağrı tamamlanmış recovery'yi görüp NoFence/disarm'a girmemeli.
  Authority capture ve OS çağrılarını monitöre taşıma. Admission-attempt recovery,
  migration cleanup, genuine NoFence recovery ve revoke/config fencing korunmalı.
- Dar regression: mevcut PlanBoundary instance'ı/latch ile T1'i **gerçek shared**
  settle dönüş sınırında tut; T2 reconcile'ı başlat; sonra T1'i bırak. Clock commit
  önceden ack-loss/read-deny ile hazırlanmış olmalı. R.due/wake/retry, fresh context,
  tek recovery projection, clock-CAS tekliği, run/accept artmaması sınanmalı. Aynı
  global lock doğru tutulduğunda T2'nin beklemesi deadlock sayılmamalı; sleep yok.
- İzinli hedefler: Coordinator.unblock ve mevcut LockChecks/PlanChecks seam'i; gerekli
  olursa aynı onaylı Plan.settle sınırı. Yeni dosya/schema/ABI/policy yok, ≤300 satır.
  Uygulamadan önce dar sözleşme bu karar ve temsilciyle netleştirilmeli; satır/kapsam
  genişlemesi gerekiyorsa ayrıca onay. **Bu kayıt otomatik yeni Opus FIX yetkisi değildir.**

## Kanıt ve sayaçlar

- Taze: gerçek diff/baseline/final-source/APK hash ve log-sonuç incelemesi;
  `review-integrity.log`. APK `7ab691291e9ceb5220047f50acae0f2d36a853eb2d8625f6aa3cdb1258759236`
  diskte hash doğrulandı. İlk aggregate dirty-diff karşılaştırması CURRENT'ı dışladığı
  için false çıktı; dosya-bazlı düzeltilmiş karşılaştırmalar beş ilgisiz diff'in aynı olduğunu doğruluyor.
- Yeniden kullanılan: build-g14b/g14c BUILD SUCCESSFUL; final g14b plan ve g14c lock/os
  PASS + instrumentation code=-1; red1/red2/red-r14 beklenen invariant FAIL code=0.
  Bunlar implementer runtime kanıtıdır, taze reviewer testi değildir.
- Yeni build/runtime/lint/emulator/ağ testi **NOT_RUN**. Başarılı değişmeyen kontroller
  yeniden başlatılmadı. Paralel recovery regression'ı **NOT_RUN / eksik**.
- Clock-proof aile sayacı: önceki başarısız tur 1 + bu rejected tur = **2**.
  Snapshot→event düzeltmesi sequential yolu çözdü; atomik recovery alt yolu kaldı.
  Aynı atomic çözüm iki kez denenmiş denmez; aile sayacı yine sıfırlanmaz.
  Stale-ownership geçmiş 2 tur korunur, bu tur hedeflenen G13 GREEN; early=1 çatışma,
  clock-stop=1, migration=1 korunur. Oturum/finding adıyla reset yok.

Fiziksel keyguard/Doze/doğal teslim, ilk unlock/CE/reboot/force-stop, production
signing/storage, FTPS F1, Faz3–4/B4/P5 açık. RAM intent kaybı/geri saat gecikmesi
kabul edilmiş sınırlamalar. Lint iki-deneme NOT_RUN korunur.

**Durum:** DECISION — G14/R14-C1 nedeniyle scoped goal kapanmadı.
**Devam:** AYNI SOHBET — dar atomik recovery tasarımı/sözleşmesi onayı; yeni FIX başlatma yok.
**Rol:** GPT review.
**Tam prompt:** `R14-C1 dar sözleşmesini, internal test observer ve üç-dosya sınırı dahil onaylıyorum; CURRENT'ı FIX devrine hazırla, uygulamayı başlatma.`

### Aynı sohbet — tasarım netleştirme tamamlandı, uygulama onayı bekliyor

Kullanıcının yalnız atomik recovery isteğiyle [dar sözleşme](../../../../../plans/f1-r14-c1-atomic-recovery-fix.md)
yazıldı: aynı goal/ID'ler, fresh blocked kontrolünden proof binding ve cleanup sonuna tek
critical section; iki gerçek reconcile çağrısı, after-settle observer ve deterministik
blocked/completed bariyeri. Null internal instance test seam'i dahil üç dosya için onay
isteniyor. Authority capture/OS dışarıda; G13/sequential G14 değişmez. Ürün/test kodu,
runtime kanıtı ve review kabul kararı değişmedi. Durum DECISION, otomatik FIX devri yok.

### Kullanıcı onayı / güncel devir

Kullanıcı aynı sohbette dar sözleşmeyi onayladı ve Opus devir kayıtlarını istedi.
[R14-C1 sözleşmesi](../../../../../plans/f1-r14-c1-atomic-recovery-fix.md) **ONAYLI / READY**;
CURRENT/manifest **FIX**. Önceki review reddi ve açık G14 değişmedi; yeni uygulama/test yok.
Sonraki adım ayrı kullanıcı-başlatmalı Opus sohbetinde `/implement`; yalnız R14-C1,
üç dosya ve instance observer onayı. İlk planı tekrar uygulama; sayaçları sıfırlama.
**Durum:** FIX — uygulama yetkili, kabul henüz yok.
**Devam:** YENİ SOHBET — rol değişimi.
**Rol:** GPT review → Opus uygulama.
**Tam komut:** `/implement`.
