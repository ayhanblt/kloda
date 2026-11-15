# F1-FTPS FIX R1/R2 — bağımsız GPT review, 16.11.2026

## Karar ve kapsam

**REJECTED → DECISION.** Tek FTPS goal'u ve üst F1 geliştirme checkbox'ı açık.
R1/R2'de ilerleme ve yeni GREEN kanıtı var; bütün invariant kabulü sağlanmadı.
**R3 dar lint kanıtı kabul edildi**; tam modül lint/build/release PASS'i değildir.
FO1 ertelemesi korunur; S3 scoped kabulü yeniden açılmadı.

- Reviewer: **GPT-6.1 Sol / `openai/gpt-6.1-sol`**, önceki review ile aynı GPT sohbeti;
  burada ürün uygulaması yapılmadı. Opus uygulaması ayrı devirden alındı. Bu GPT ve
  Opus opaque session ID'leri bilinmiyor; uydurulmadı. Bağımsızlık product-code
  implementer self-review'u ile karıştırılmadı; kabul verilmedi.
- Start/review HEAD `f26e425dd808daf206ee7bd8ec6fe9402fbd1119`; staged boş.
  `start/` altı kaynak hash'i önceki review'un `fs-rest/source-final-2.sha256` değerlerine
  eşit. Yeni altı final hash OK; runner/OsChecks eski hash'leri değişmemiş.
- Gerçek FIX kapsamı: K/AndroidFtpsJob.kt, K/AndroidFtpsScheduler.kt; untracked
  T/AndroidFtpsAutomaticChecks.kt, T/AndroidFtpsLifecycleChecks.kt,
  T/AndroidFtpsPolicyChecks.kt. `start→working-tree` GNU diff gövdesi `fix-diff.patch`
  ile birebir doğrulandı; HEAD→working-tree toplam iş kapsamı önceki review ile
  birlikte incelendi. Queue bu tur değişmemiş; önceki dar metadata wake kanıtı korunur.
  K/T kökleri üst dizindeki ilk `review.md` içindedir.
- S3/AGENTS/commands/diğer dirty işler alınmadı. Planın yalnız goal/kapsam ve
  FS1/FS2/FP2, §4.4–8, §5–6 ilgili hükümleri açıldı; tarihî CURRENT/research bütünü okunmadı.
  Runtime exact lease, sourceLock admission, ortak WATCH helper komşuları kontrol edildi.
- Taze statik kayıt: `review-checks.log`. Yeni runtime/build/lint **NOT_RUN**;
  aşağıdaki Opus iş kanıtı yeniden kullanıldı, başarılı matris tekrar koşulmadı.

## Tek konsolide engelleyici liste

### FTPS-R1 kalan — HIGH — stale ownership / OS stop-handoff

**K/AndroidFtpsScheduler.kt:63–78; K/AndroidFtpsJob.kt:44–46,56–65.**
Kabul: **FL1 / FS2**, plan §4.5–7 (stop ile OS kararı serialize; stopped callback
finish etmez, güncel pre-admission stop gerekli retry kararını verir).
Yeni hedef veya yeni hata ailesi değil: ilk R1'in finalization penceresi daralmış,
fakat OS teslim sınırında kapanmamış.

`complete()` monitorü aldıktan sonra ilk iş `retire()` ile E'yi map'ten siliyor.
Bu CAS, OS'un completion/retry kabulü değildir. `onStopJob` aynı monitorü kullanmıyor;
E bulunmazsa false dönüyor. Yorumdaki "completion already made the single decision"
yerel kararı OS completion'ı yerine sayıyor.

Somut izinli olay sırası:

1. A güncel, due P/run=null, credential_locked; `complete` monitorüne girer ve
   `retire()` kazanır. P/token henüz değişmemiştir; OS finish henüz işlenmemiştir.
2. Worker `:64` ile `:78` arasında veya Os.finish'in OS'a teslimi önünde durur.
   Platform main-thread `onStopJob(A)` çalışır; `executions[A]` yok → **false**.
3. OS false stop acknowledgment'ını önce işler; işi retry olmadan kapatır.
   A'nın sonraki `jobFinished(params,true)` çağrısı artık stale callback'tir.
   P korunmuş olsa bile sonraki otomatik wake kaybedilebilir: FL1/FS2 karşılanmaz.

API35 resmî kaynak doğrulaması: `research-stop-completion.md`.
JobServiceContext `doAcknowledgeStopMessage→doCallback` false'u taşır;
`handleFinishedLocked(false)` cleanup ile running callback'i null yapar;
sonraki `doJobFinished` verifyCaller'dan geçmez. Local CAS'ın platform stop
ack'inden önce OS retry olarak kabul edildiği bir garanti yoktur.

Yeni `T/AndroidFtpsPolicyChecks.kt:31–54` testi A'yı **monitorü almadan önce** tutar;
stop map kaydını o sırada kazanır. Bu GREEN korunur; retire kazandıktan sonra
finish tesliminden önceki karşıtı kapsamaz. "report" testi B.error sentinel'ı kurar,
gerçek ikinci B Execution'ı başlatmaz; aynı-token E sahiplik karşıtı tam runtime
kanıtı olarak raporlanamaz. live(E) kontrolleri stopped-before-entry açığını düzeltmiştir.

Reviewer yeni runtime repro yapmadı; bu kaynak+resmî OS protokolüyle kanıtlanan
bir interleaving'dir, taze RED testi değildir.

### FTPS-R2 kalan — HIGH — OS handoff / WATCH recovery protokolü bypass

**K/AndroidFtpsScheduler.kt:138–156,160–166;
komşu K/AndroidBackupScheduler.kt:181–191.**
Kabul: **FP2 / FW1-FW2**, plan §4.7–8 ve onaylı OS sonuç protokolü
(null/foreign/unreadable unknown'da ikinci cancel/finish yok; recovery tek seri
turda aynı sonuç protokolüyle yapılır). İlk R2'nin aynı OS-handoff ailesinden kalanıdır.

`rewatch()` artık tri-state/unknown kullanıyor; dört yeni normal fault testi bu dar
düzeltmeyi kanıtlıyor. Ancak unknown WATCH'ın **ordinary recovery kurulumu**, sonuç
protokolü yerine doğrudan ortak `AndroidBackupScheduler.watch()` kullanıyor.
Bu helper `scheduler.schedule()` çağırıyor; Os portunu, Rewatch sonucunu ve
unresolved kaydını bypass ediyor. `resolve(WATCH)` de recovery schedule'dan önce
unresolved kaydını kaldırıyor.

Somut olay sırası:

1. A WATCH replacement throw/null → `unresolved[WATCH]`, finish/cancel yok (GREEN).
2. Sonraki ordinary reconcile exact null/old'u çözer; eski kaydı emekli eder ve
   helper ile yeni WATCH kurmaya geçer.
3. Yeni WATCH'ın schedule'ı **kabul edildikten sonra throw** eder veya sonucu
   belirsiz bir exception verir. Helper bu sonucu sınıflandırmaz.
4. Reconcile generic catch `cancel(context)` ile JOB+WATCH'ı iptal eder, unresolved
   kayıtlarını temizler ve generic hata yazar. Kabul edilmiş olabilecek yeni WATCH
   kör cleanup ile silinir; unknown admission fence'i de kalmaz. Aynı olay `rewatch`
   içinde olsaydı exact-new/unknown protokolü uygulanacaktı.

`T/AndroidFtpsPolicyChecks.kt:118–123` recovery öncesi Os/capture enjeksiyonunu
`restore()` ile kaldırıyor; sadece **başarılı** recovery'yi sınar. Recovery'nin
schedule fault'u Recorder portundan geçmediği için kayıtlarla da görünmez.
Başarılı dört rewatch sonucu recovery throw'unun kanıtı değildir.
Yeni runtime repro NOT_RUN; source path açıkça aynı generic catch'e gidiyor.

## R3 kararı — dar lint kanıtı yeterli, eski hatalar açık izlenecek

**FTPS-R3 kapandı (scoped validation evidence accepted).** Kullanıcının bu review'da
istediği dar kapsam kararı verildi; lint tamamen yeşil/ertelendi denmedi.

- `lint-3-scoped.log`: `lintAnalyzeDebug`, `lintAnalyzeDebugAndroidTest`, unit-test
  analizi ve `lintReportDebug` tamamlanmış; `lintDebug` exit 1. Worklets analizinin
  hariç tutulduğu komut açık, dependency/config değişikliği yok. Eski iki crash'in
  aynı komutla kör tekrarı değil; dry-run ile seçilmiş dar yol.
- XML yeniden parse edildi: 81 issue içinde **3 Error**. Değişen altı FTPS kaynak
  dosyasına 0 error / 0 warning düşüyor. Değişmeyen FTPS Runtime vb. uyarılar bu
  "diff'te 0/0" ifadesiyle gizlenmiyor; genel rapor temiz değil.
- Üç Error'un dosyaları taze HEAD karşılaştırmasında **birebir aynı**:
  - `AndroidDeviceCheck.kt:40,45` — `MissingPermission` (USE_BIOMETRIC), iki teşhis.
  - `AndroidS3Automatic.kt:46` — `NewApi` (API26 çağrı/min24), bir teşhis.
- Ayrı açık izleme: MANIFEST §R3 dış-kapsam lint bulguları; CURRENT Faz3.
  Bunların runtime etkisi bu review'da doğrulanmadı; false positive denmedi.
  S3 düzeltme/kabulü açılmadı. Üç hata ve worklets analizi genel regresyon/release
  kapısında açık; FTPS diff review'unu R3 nedeniyle yeniden döndürmek gerekmiyor.

## Ortak goal kabul eşlemesi / kanıt

| ID / gerekli alt yollar | Kanıt (Opus bu FIX turu, reviewer reuse) | Karar |
|---|---|---|
| FL1 locked pre-admission | `run-final-ftps-automatic-lock.log`, locked JOB | Normal P/run/lease/backoff GREEN; stop-after-retire R1 açık |
| FL2 pending/absent/disabled | Aynı log, üç FL2 test | GREEN reuse; kaynakta metadata/admission ayrımı korunmuş |
| FL3 due/future | Aynı log, iki FL3 test | GREEN reuse; admission guards ve replacement completion korunmuş |
| FW1 locked WATCH | `run-final-ftps-automatic-lifecycle.log` | Normal replacement GREEN; R2 recovery fault açık |
| FW2 valid/capture-fail/CAS/claimed | Aynı log, dört FW2 | GREEN reuse; expected-P CAS ve fresh capture korunmuş; R2 açık |
| FS1 yedi stale branch + destroyed WATCH | Aynı log; `red/green1` destroyed-watch | Yeni-token/stopped-before-entry karşıtları GREEN; whole lifecycle R1 açık |
| FS2 platform stop + held report/finalization | Aynı log; üç FS2 grup | stop-before-monitor GREEN; retire→OS delivery karşıtı yok, R1 açık |
| FP1 busy/retry/old-wake busy-defer/pause/disable/revision | Aynı log, altı FP1 grup | GREEN reuse, ürün bütçeleri değişmemiş |
| FP2 JOB altı fault + CAS + WATCH dört outcome | Aynı log + FW2 CAS | Normal faults GREEN; WATCH recovery schedule fault R2 açık |
| FO1 | Önceki `fo1-evidence-audit-2026-11-16.md` | Prior PASS reused; yeni success→tek completion→sonraki JOB zinciri §21/Faz4 DEFERRED/NOT_RUN; blocker değil |
| Build/typecheck | `build-final.log`, Kotlin compile ve AndroidTest assembly | PASS reuse; JS/TS/iOS değişikliği yok, ilgisiz typecheck tekrarı yok |
| Lint/standart | `lint-3-scoped.log`, XML; `lines-final.txt`, diff-check | FTPS dar R3 kabul; tam görev exit1; dosyalar ≤300, whitespace temiz |

Final kaynak hash'leri eşleşti; GNU fix diff yeniden kuruldu. Final lock **7/7**,
lifecycle **32/32**, code -1; build PASS, aynı final APK kaydı `e2bb9663…`.
RED varyantında yedi testten altısı code 0, accepted-new throw zaten PASS; yedi
tekil GREEN code -1. Geçici selector'ın final kodda olmadığı ve final test suite
anlamı incelendi. Bunlar yeni reviewer runtime PASS'i değildir.

## Temizlik, sınırlar, açık kapılar

Ek helper/dependency/ürün dosyası yok; shared helper/Runtime/Queue bu tur değişmemiş.
Policy test dosyasında lifecycle regresyonları mevcut yardımcılarla kurulmuş;
ayrı fixture yaratılmamış, FL gövdeleri taşınmamış. Sekiz kaynak sınırı ve ≤300 korunur.
Eski kullanılmayan `journal` yerelleri isteğe bağlı temizliktir, blocker değildir.
TLS/LAN/custody/şema/lease sahipliği gevşetilmemiş; yeni product-code edit yapılmadı.
SNAPSHOT-OPEN ayrı; gerçek Keyguard/Doze/CE/reboot/force-stop, FO1 delta,
signing/storage/P5 ve Faz3–4 kapıları korunur. Üst F1 roll-up kapanışı yapılmadı.

## DECISION — kök neden / en küçük çözüm sınırı / sayaç

- **R1 / exact-E+OS-stop ailesi: ikinci başarısız bütün-invariant kabulü.**
  RAM map.remove tek kazananı, OS stop/finish tek kazananı değildir. Başlangıçtaki
  "completion kaydını silmeyi monitor içine taşı" çözümü tek başına yeterli değil.
  Tamamlanmakta olan E'nin **stop/retry yükümlülüğü**, OS completion'a devirden önce
  kaybolmamalı. En küçük aday: E'de running/completing-retry/retired gibi açık faz ve
  retained stop-intent; late stop doğru retry kararını bulmalı, worker live yetkisi
  ayrı kapanmalı. Main-looper sıralaması düşünülse bile yalnız `jobFinished` çağırıp
  hemen kaydı silmek yeterli sayılmaz: platforma mesaj teslimi/stop sırası kanıtlanmalı.
- **R2 / WATCH OS-handoff ailesi: ikinci başarısız bütün-invariant kabulü.**
  Sonuç protokolü yalnız rewatch'ta kalmış. En küçük aday: FTPS'e özel WATCH install/
  replace/recovery yollarını aynı sınıflandırılmış OS sınırından geçirmek; shared
  BackupScheduler'ı değiştirmeden current D/unknown kaydını sonuç kesinleşene kadar
  taşımak. Accepted-then-throw recovery'de kör cancel yok.
- Bunlar tasarım değerlendirmesi bulguları/çözüm adaylarıdır; otomatik üçüncü FIX
  yetkisi veya test edilmiş yeni tasarım değildir. Mevcut planın goal/expectation'ı
  değişmez. Normal successful completion, saved start params, parcel stop, same-token
  B ayrımı, lock-free current ve sourceLock kilit sırası korunmalı; queue/Runtime
  bekleme/interrupt monitor içinde yapılmamalı.
- Sonraki dar regression sınırı: (R1) locked due A, **retire sonrası / finish teslimi
  öncesi** barrier → gerçek stop false'a düşmemeli, aynı P/token için tek retry wake;
  (R2) unresolved null/old → ordinary recovery'nin schedule'ında accepted-then-throw
  veya belirsiz throw → yeni projection silinmeden doğru installed/unknown sonucu.
  Eski 7/32 başarıları yalnız değişen davranışa göre seçilir, tüm matris kör tekrarlanmaz.
- Sayaçlar resetlenmez; önceki dar başarılar korunur. R3 iki eski crash + bir dar
  sonuçlu koşu kaydı korunur; yeni lint tekrarı gerekmiyor.

**Devam: aynı GPT review sohbetinde R1/R2 için dar çözüm sözleşmesini netleştir;
CURRENT DECISION, `/implement` henüz yetkili değil.** Sonraki bağımsız işe geçilmez.
Commit/push yok; doküman kapanışı için ayrı Opus oturumu yok.
