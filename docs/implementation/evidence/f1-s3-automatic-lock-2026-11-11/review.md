# 1.4b/F1 S3 — bağımsız GPT gerçek-diff review

Tarih: 12.11.2026. **Karar: KABUL EDİLMEDİ; S3 alt işi açık.**

Reviewer: GPT-6.1 Sol, `openai/gpt-6.1-sol`, bu kullanıcı-başlatmalı GPT review
oturumu. Harness oturum ID'sini göstermiyor; ID uydurulmadı. Bu oturumda uygulama
yapılmadı. Ayrı Opus uygulamasının devri MANIFEST.md:3'te kayıtlıdır; onun
aynı-oturum öz-review'u bağımsız kabul sayılmadı. Alt ajan kullanılmadı.

## Kapsam ve yöntem

- Başlangıç ve review HEAD: `650ec17f300ebdeee804bd4218f5b57356eecb21`.
- Staged alan boş. Altı tracked ürün/test/manifest dosyasının gerçek HEAD diff'i
  `tracked-scope.diff` ile byte-for-byte aynı; altısının `.orig` içeriği HEAD ile aynı.
- Beş untracked Kotlin dosyası da okundu: AutomaticPlan, AutomaticCoordinator,
  AutomaticPlanChecks, AutomaticLockChecks, AutomaticOsChecks. Toplam onaylı 11
  ürün/test dosyasının tamamı `final-sources.sha256` ile eşleşiyor.
- Plan SHA256 `94675d2d6f0839e64720db624bcb26266f6b8b32ece36245503098822492da53`:
  başlangıç kaydıyla aynı. Komutla gelen plan tekrar bütünüyle okunmadı.
- `baseline/start-status.txt` ile ilgisiz birikmiş değişiklikler ayrıldı; bunların
  diff'leri topluca okunmadı veya bu işe mal edilmedi. CURRENT başlangıç snapshot'ı
  mevcut; sonraki kompaktlaştırmanın tarihî satır aidiyeti tek başına engel sayılmadı.
- ADR0022 D1/D3, Step17/preserved boundaries/FTPS kararı ve B4 §5/§7 okundu.
  Vault, ABI, dependency, FTPS veya production manifest değişikliği bu diff'te yok.
- En dar doğrulama: kaynak/diff bütünlüğü + kaynak üzerinden deterministik olay
  sırası incelemesi. Aşağıdaki yeni negatif yollar cihazda çalıştırılmadı;
  kaynak bulgularıdır, yeni runtime FAIL/PASS iddiası değildir.

Dosya kısaltmaları: `K` = `apps/mobile/modules/my-module/android/src/main/java/com/kloda/sync/`;
`T` = aynı modülün `src/androidTest/java/com/kloda/sync/` dizini.

## Engelleyici bulgular / scoped düzeltme sözleşmesi

### R1 — Yüksek: stale onStart mevcut execution'ı devralıyor

**Yer:** `K/AndroidS3AutomaticCoordinator.kt:54–59,68–70,93–106,151–158`.
`onStart`, wake'in current olduğunu doğrulamadan önce önceki Exec'i `done` yapıp
`exec` alanını değiştiriyor. Aktif accepted A varken farklı params ile eski/revoked
wake B gelirse B ancak background'da stale bulunuyor. A'nın lease'i bu devirde
bırakılmıyor, run'ı durdurulmuyor; A callback'i `done` olduğu için yok sayılıyor.
B finish(false) ile owner'ı IDLE yapıyor. A'nın terminal callback'i lease end ve
next projection yapamayabilir; eski callback yeni sahipliği değiştirmiş oluyor.
Mevcut revoked-wake testi yalnız idle/pending durumda, aktif run ile değil.

**Karşılanmayan kabul:** S4/S5; §5 exact Execution/lease fencing, §6 stale wake no-op.
**Düzeltme/kabul:** stale envelope sahipliği değiştirmesin. Held accepted A + stale
B + A completion/stop dizisinde A lease/completion/next projection'ı tam bir kez
korunsun; B admission/schedule/cancel veya A state değişimi yapmasın. Aynı params'ın
geç tekrarı ve eski completion için de exact fencing kanıtlansın.

### R2 — Yüksek: ilk callback hazırlık öncesi durursa OS devam yolu kayboluyor

**Yer:** `K/AndroidS3AutomaticCoordinator.kt:57–59,70,175–186`;
`T/AndroidAutomaticLockChecks.kt:182–187`.
Yeni process/coordinator'da `liveWake` null. Geçerli current callback'in background
hazırlığı başlamadan `onStop` gelirse retry yalnız `liveWake == e.wake` nedeniyle
false oluyor. Hazırlık sonradan stopped Exec için hiçbir projection yapmıyor.
Durable pending occurrence kalıyor fakat izinli OS backoff teslimi istenmiyor;
foreground olmadan devam kaybolabiliyor. Mevcut test bu hatalı false'u özellikle
beklediğinden test PASS'i planın doğru davranışını kanıtlamıyor.

**Karşılanmayan kabul:** S1/S4; §6 OS onStop current enabled/config/plan uygunsa retry.
**Düzeltme/kabul:** pre-admission stop için geçerli envelope/plan ve revoke/storage
durumuna göre güvenli tek OS handoff kurulsun. Fresh process + held background +
current due callback + stop: run/accept=0, aynı occurrence, uygun retry=true;
revoke/paused/storage/stale karşıtları false. Foreground backoff'u devralmasın.

### R3 — Yüksek: active clock revision dirty olmadan önce durable planı değiştiriyor

**Yer:** `K/AndroidS3AutomaticCoordinator.kt:203–206,229–234`;
`K/AndroidS3AutomaticPlan.kt:103–104`.
`reconcile(true)` önce `plan.arm(... changed=true)` ile yeni occurrence/wake/due
yazıyor; active Exec için dirty-only kararı bundan sonra alınıyor. Accepted A/W1
çalışırken clock event'i W2'yi DB'ye yazar ama schedule etmez. Ardından OS stop
gelirse A/W1 için true dönebilir; A completion stopped olduğu için W2'yi project
edemez. OS backoff W1 ile gelince stale finish(false) olur; W2 için pending OS işi
yoktur. Test :214 yalnız schedule sayısı/dirty kontrol ediyor, durable planı ve
stop/backoff dizisini kontrol etmiyor.

**Karşılanmayan kabul:** S1/S4; §6.1.5 active clock/mode değişimi completion'a dirty
olarak katılır, önceden wake/plan revision yapılmaz.
**Düzeltme/kabul:** active owner kararı arm'dan önce serialize edilsin; clock event'i
aktifken plan/wake'i değiştirmesin. Completion ve OS stop/backoff alternatifleri
ayrı kanıtlansın; pending planın UI'sız teslim yolu hiçbirinde kaybolmasın.

### R4 — Yüksek: kilitli legacy-recovery kendi callback'ini rearm etmeyebiliyor

**Yer:** `K/AndroidS3AutomaticCoordinator.kt:49–52,261–270`.
Protocol-0 callback reconcile'ı background'a gönderip false döner. Kilitli
reevaluation sırasında pending sorgusu hâlâ teslim edilmiş aynı protocol-0/wake'i
görebilir; :269 bunu korunmuş gelecek iş sayıp schedule etmeden döner. Sonrasında
callback'in false dönüşü işi bitirir; replacement/backoff yoktur. Background ile
OS completion sırasına bağımlı bu yol legacy'den SQLite'a geçiş öncesinde F1'i
yeniden üretir. Ayrıca callback'in snapshot token'ı current legacy snapshot ile
doğrulanmadan reevaluation başlatılıyor. Mevcut scope'larda legacy coordinator
delivery/locked rearm assertion'ı yok.

**Karşılanmayan kabul:** S1/S3/S4; §6 locked legacy-recovery >=5dk tekrar projection
ve değişmiş snapshot için stale no-op.
**Düzeltme/kabul:** exact legacy execution/snapshot ile teslim edilen işi gelecek
pending işten ayır; kilitte marker/vault/run/accept olmadan tek gecikmeli continuation
koru. Pending'in running envelope'u göstermesi ve completion sonrasında absent
olması sıralarını, changed snapshot ve unlocked fresh migration'ı test et.

### R5 — Yüksek: migration OutcomeUnknown bir sonraki reconcile ile atlanıyor

**Yer:** `K/AndroidS3AutomaticPlan.kt:80,85–94`;
`K/AndroidS3AutomaticCoordinator.kt:199–209`;
`T/AndroidS3AutomaticPlanChecks.kt:74–77`.
Marker commit olur, acknowledgment kaybolur ve consistent read başarısız olursa
migrate storage_failure atıyor; coordinator bunu sessizce yutuyor. `blocked` veya
migration uncertainty kaydı yok. Sonraki reconcile `marked()==true` gördüğü için
migrate/consistent proof'u atlayıp arm ve projection yapabiliyor; queue'nun uncertain
fence'i de migration için kurulmamış. Hâlâ resolution-read-fault varken otomatik
admission tekrar açılabilir. Mevcut test fault'u kaldırdıktan sonra tekrar çağırıyor;
kanıt olmadan ikinci lifecycle çağrısının yasak kalmasını sınamıyor.

**Karşılanmayan kabul:** S2/S3; §3.1.5 migration acknowledgment belirsizliğinde §4.1'in
sonlanmış transaction + consistent read kanıtı olmadan import/admission yok.
**Düzeltme/kabul:** migration belirsizliğini açık fenced state olarak koru; basit
marker/current okumaları çözüm kanıtı sayılmasın. Real commit + lost ack + read fail
sonrası tekrarlı lifecycle/callback ve toggle projection/admission açamasın;
transaction sonu + tutarlı proof sonrası tek otoriteyle devam kanıtlansın.

### R6 — Orta: negatif legacy due bozuk veri yerine yeni yetkili plan üretiyor

**Yer:** `K/AndroidS3AutomaticPlan.kt:82–84`.
Tipi Long olan negatif due storage_failure olmuyor; `takeIf(value>=0)` başarısızlığı
`next(now)` ile yeni occurrence/wake yaratıyor ve ardından legacy temizleniyor.
Bu, missing due veya geçerli fakat farklı binding ile aynı durum değildir.

**Karşılanmayan kabul:** S3; §3.1.3 bozuk legacy tip/değer storage/outcome hatasıdır,
sessizce yeni yetki üretmez.
**Düzeltme/kabul:** negatif due için marker/import/cleanup/admission yok ve açık
storage sonucu; missing due ve binding mismatch'in onaylı davranışı korunsun.

### R7 — Yüksek: non-execution projection generic throw'u tekrar schedule'a açıyor

**Yer:** `K/AndroidS3AutomaticCoordinator.kt:237–258` (karşılaştırma :163–171).
`replace` generic throw'da nonce proof/ProjectionUnresolved uygular; ilk projection,
recovery ve explicit revision ise ayrı `schedule` yolunu kullanıyor. Bu yol yeni
nonce'u saklamadan throw'u null'a indiriyor ve owner=IDLE yapıyor. Adapter'ın
uygulayıp uygulamadığı belirsizken pending absent/unknown ve yeni foreground
çağrısı ikinci schedule yapabilir; nonce proof veya OSOwned uncertainty fence yok.
Mevcut unknown-throw testleri yalnız Exec replacement kolunu çalıştırıyor.

**Karşılanmayan kabul:** S4; §6.1 generic throw RESULT_FAILURE sayılmaz; exact nonce
kanıtı yoksa ProjectionUnresolved, aynı outcome'dan ikinci projection/backoff yok.
**Düzeltme/kabul:** bütün projection girişleri aynı belirsizlik protokolünü kullansın.
Initial/recovery/revision throw + pending absent/read-fail/exact nonce kombinasyonları;
tekrarlı foreground'da ikinci schedule/finish olmaması ve explicit revoke/fresh
epoch davranışı kanıtlansın. RESULT_FAILURE ile generic throw ayrımı korunsun.

## Kanıt ve açık kapılar

**Taze:** `review-integrity.log`: HEAD/staged, 11 kaynak hash'i, tracked diff ve
başlangıç içerik eşleşmesi, plan hash'i, beş untracked Kotlin kapsamı, önceki
test/build/lint sonuçlarının dar log teyidi. Yukarıdaki source/caller incelemesi.
Yeni runtime test/build/lint/emulator veya ağ işlemi yapılmadı. `kotlinc` PATH'te
bulunmadı; host Kotlin testi çalıştırıldığı iddia edilmiyor.

**Yeniden kullanılan:** MANIFEST'teki lock-5, plan-2, contract-2, pause-1,
global-pause-1, os-1 loglarının PASS satırları + instrumentation code=-1;
compile-main-1 ve build-androidTest-8 BUILD SUCCESSFUL. RED mutation logu ilgili
occurrence assertion'ında FAIL. Bu sonuçlar mevcut kapsanan yollar içindir;
R1–R7'nin eksik/yanlış beklenen yollarını PASS yapmaz. Kaynak hash'leri eşleşiyor;
APK build6/7/8 test-scope ayrımı MANIFEST'teki sınırlamayla yeniden kullanıldı.

**NOT_RUN/açık:** my-module lint raporu yok; lint-1/2 dependency lint crash
(`Cannot find a KaModule`) doğrulandı, scoped lint PASS sayılmadı. İki başarısız
lint yaklaşımı tekrar edilmedi. Gerçek OS harness'in mevcut API35 synthetic-clock
smoke sonucu korunur; yeni negatif lifecycle yollarının kanıtı değildir. Fiziksel
keyguard/vault, ilk unlock/CE, reboot/force-stop/Doze, production service ve
signing/storage Faz3/4'te açık. FTPS F1, B4 kalan riskleri ve P5 kapanmadı.

## Devir

Ürün kodu değiştirilmedi. Yalnız review/evidence ve CURRENT/manifest durum kaydı
güncellendi. Hiçbir kabul checkbox'ı kapatılmadı; commit/push/index işlemi yok.

**Durum:** bağımsız review tamam; R1–R7 nedeniyle S3 kabulü reddedildi.
**Devam:** YENİ SOHBET — yalnız uygulama rolüne geçiş.
**Rol:** GPT review → Opus uygulama.
**Tam prompt:** “AGENTS.md → CURRENT.md aktif 1.4b/F1 →
docs/implementation/evidence/f1-s3-automatic-lock-2026-11-11/review.md oku.
Onaylı next-plan.md kapsamını genişletmeden yalnız R1–R7 scoped düzeltmelerini
uygula; bu review'daki her negatif sıra için shared production seam üzerinde
deterministik assertion ekle. Özellikle active stale callback, fresh-process
pre-admission stop, active clock→stop→backoff, locked legacy pending-running,
migration ack/read-failure fence, negatif legacy due ve non-Exec schedule throw
yollarını kanıtla. Yeni başlangıç HEAD/diff/hash ve etkilenen test kanıtlarını aynı
evidence grubunda kaydet; değişmeyen başarılı scope'ları tekrarlama. Lint iki-deneme
sayacı ve NOT_RUN kapısı korunur; kör üçüncü deneme yok. Onaylı dosya/şema/policy
sınırına sığmayan çözümde dur, GPT plan kararı iste. Checkbox kapatma; FTPS/Faz3–4
kapılarını koru, ayrı GPT gerçek-diff review'una devret. Commit/push yok.”
