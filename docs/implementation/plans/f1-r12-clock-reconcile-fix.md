# F1/S3 R12 + R3 — ayrı yetkili clock reconcile FIX sözleşmesi

12.11.2026 · GPT plan · HEAD `650ec17f300ebdeee804bd4218f5b57356eecb21`.
**İlk uygulama onaylı; son review R13/R14 ile reddedildi.** Güncel executable devam:
[R13/R14 scoped FIX — READY](f1-r13-r14-clock-reconcile-fix.md). İlk planı yeniden uygulama.
Kullanıcı ayrı clock reconcile'ı, aşağıdaki beş dosyayı, aynı configuration'da
saf clock revision için wake korumayı ve RAM intent kaybı sınırlamasını onayladı.
Wake tek başına kabul yetkisi değildir; kalıcı clock intent eklenmez.

## 1. Yetki ve dar supersession

- R13/R14 kök neden/tasarım kapısı 12.11 GPT netleştirmesiyle tamamlandı; yukarıdaki
  devam sözleşmesi lifecycle/projection kimliği ve clock-proof sırasını bağlar.
  Son review/manifest yolları ve ilk temsilci/bütçe kapısı o belgededir; kalan §§3–6
  invariant/onay sınırları, bu dar açıklama dışında aynen korunur. READY ürün kabulü değildir.

- Aktif giriş CURRENT; son review `../evidence/f1-s3-automatic-lock-2026-11-11/fix-r8-r11/review.md`.
- Son tur/çatışma/kanıt: `../evidence/f1-s3-automatic-lock-2026-11-11/fix-r12/MANIFEST.md`.
- Bu sözleşme eski plan §6.1 clock-dirty taşıma ve ilgili §8.2/R3/R9 test beklentisini
  yalnız burada açıklanan olay ayrımı ve saf-clock wake semantiğinde supersede eder.
- Erken capture yasağı, atomic admission, migration, storage fence, exact stop,
  ADR0022/B4, manuel davranış, provider ve remote unknown/recovery sınırları değişmez.
- İlk uygulama planı yeniden uygulanmaz. Önceki R8–R11 düzeltmeleri geri alınmaz.

## 2. Kesin dosya/simge sınırı — 2 ürün + 3 test

K = `apps/mobile/modules/my-module/android/src/main/java/com/kloda/sync/`;
T = aynı modülün `src/androidTest/java/com/kloda/sync/` dizini.

| Dosya | İzinli hedef/sorumluluk |
|---|---|
| K/AndroidS3AutomaticCoordinator.kt | admit/fold/project/reconcile/onStop/revision: erken gate; açık clock request; tek execution/projection arbiter; epoch/config fencing |
| K/AndroidS3AutomaticPlan.kt | arm veya ayrı internal clock-CAS; aynı-config wake koruma; transaction sonucu/proof ve mevcut fenced gate entegrasyonu |
| T/AndroidAutomaticLockChecks.kt | R12 counter regression'ı koru; active/fold R3/R9'u ayrı clock revision, stale event ve tek continuation testlerine ayır |
| T/AndroidS3AutomaticPlanChecks.kt | saf-clock CAS, rollback/ack-loss/proof, config/reopen ayrımı |
| T/AndroidS3AutomaticOsChecks.kt | mevcut disposable harness'te açık revision + eski lifecycle + tek gerçek pending JOB |

Önceki R12'nin iki dosyasından beşe genişleme kullanıcı tarafından açıkça onaylıdır;
beşi de ilk 11 dosyalık üst sınır içindedir. Yeni ürün/test dosyası yok; her Kotlin
dosyası ≤300 nonblank/noncomment satır. Yeni helper dosyasıyla sınır aşılmaz.
Queue/Runtime/Automatic facade/receiver/runner/manifest/Vault/Journal/Runs/Profiles,
FTPS/JS/iOS/Rust/ABI/dependency/build config salt-okunur. İki tablo/sütunlar değişmez.
Belge izni: bu sözleşme, CURRENT, eski planın yönlendirme notu, işin manifest/evidence'ı.

## 3. İki olay; tek coordinator/sahiplik

1. OS teslimi yalnız envelope değerlendirmesidir. Current plan okunur; now<eligibleAt
   ise lease/source/profile/vault capture/admission=0. Aynı occurrence/due/retry korunur,
   kalan latency ile tek replacement; dirty clock olsa da reconcile başlatılmaz.
2. Açık saat/timezone olayı mevcut receiver'ın `reconcile(changed=true)` girişidir.
   Request'in nedeni, monoton kimliği ve epoch/config bağı RAM'de ayrılır; sıradan
   dirty/foreground/unlock/pending=null bu yetkiyi yaratamaz. Poll/timer/yeni receiver yok.
3. Aynı configuration için işlenmemiş saat olayları en güncel clock ile coalesce
   edilebilir. Tek request/projection sahibi; eski hazırlık sonucu yeni request'i silemez.
4. Aktif run varsa durable plan/wake/due revision yapılmaz; explicit request bekler.
   Run terminal completion veya exact OS stop sonrası request, ayrı yetkili reconcile
   devamı olarak değerlendirilir; erken OS callback veya eski eligibleAt beklenmez.
5. Clock hazırlığı background'da; kısa karar/CAS sourceLock altında; OS lifecycle ve
   schedule/cancel/finish main lane'de, monitor dışında. Mevcut lease lock sırası korunur.
6. Completion/stop ve clock request aynı arbiter'da serialize edilir: clock sonucu
   normal next projection'a katılır veya normal handoff kazanıp açık clock olayı
   daha sonra OSOwned revision hakkını kullanır. Her olayın tek sonucu ve her anda
   tek JOB sahibi vardır; paralel normal rearm + clock rearm / çift finish yok.
   OSOwned'a devredilmiş sıradan foreground backoff'u hâlâ değiştiremez.
7. Revocation/config değişiminde epoch ve request bağı invalid olur. Gecikmiş hazırlık,
   callback/cancel/stop yeni işi değiştiremez. Saf clock revision'da da epoch ilerler;
   eski Execution completion'ı geçersizdir. Mode/source/profile değişimi saf clock değildir.

## 4. Clock transaction / wake / OS hata sonucu

- Yalnız current armed Amazon planı + taze enabled/automatic/source/profile/unlocked
  guard'ları + request epoch/config eşleşmesiyle exact snapshot CAS revision yapılır.
  Configuration = hedef ve profile/source schedule binding; pause'ın journal context
  yenilemesi configuration değişimi diye varsayılmaz, yeni context taze doğrulanır.
- Saf clock, aynı configuration: yeni pending occurrence + next(now) logical due;
  eski retry yalnız bu açık revision ile sıfırlanır; mevcut configuration-bound wake
  korunur. Run/accept eklenmez, accepted occurrence/run replay edilmez. Disarmed plan
  clock niyetiyle re-enable edilmez; config uyuşmazlığı eski request'i iptal eder.
- Eski snapshot ile admission CAS başarısızdır. Eski completion/params etkisizdir;
  aynı wake + yeni params OS teslimi ise güncel plan/eligibleAt/guard/lease ile
  yeniden değerlendirmedir; wake veya clock request tek başına run yetkisi vermez.
- Revision commit ve OS schedule atomik değildir. Schedule SUCCESS tek projection;
  mevcut Execution'ı replace ediyorsa ayrıca jobFinished yok. Kanıtlı FAILURE'da
  hâlâ lifecycle sahibi exact Exec için mevcut tek backoff fallback kullanılabilir:
  aynı wake yeni pending state'i değerlendirebilir, eski occurrence'ı değil.
- onStop sonrası finish çağrılmaz. Retry handoff veya explicit replacement seçimi
  owner'da kurulur; eski stop yeni projection'ı silemez. Lifecycle bitmiş/non-Exec
  projection FAILURE normal non-Exec recovery kuralındadır; kör retry/polling yok.
- Generic schedule throw yalnız exact yeni nonce proof'uyla başarı sayılır; yoksa
  ProjectionUnresolved/OSOwned. İkinci schedule/finish(true) yok; foreground açamaz.
- DB exception rollback sayılmaz: sonlanmış transaction'da tutarlı exact eski/yeni
  snapshot proof'u. Exact yeni → revision committed, tekrar revision yok; exact eski →
  request bekler; unreadable/mismatch → StorageBlocked, manuel dahil admission kapalı.
  Plan.fenced ve mevcut Queue attach gate'i yeniden kullanılır; migration proof ve
  legacy cleanup clock çözümüyle karıştırılmaz. Yeni schema veya Queue değişikliği yok.

## 5. Kilit, storage reddi ve process restart

- Clock niyeti guard'dan önce kaydedilebilir; kilitte authority capture/clock-CAS yok.
  Request RAM'de bekler. Güvenilir eski planın mevcut OS devam yolu korunur; gerekirse
  yalnız mevcut kurallarla tek projection/handoff. Normal eligible locked callback
  sınırlı defer yapar; early delivery deadline uzatmaz, run/accept yaratmaz.
- Sonraki açık unlocked lifecycle/reconcile veya terminal/stop devamı, yalnız kayıtlı
  explicit request'i taze doğrulayabilir. Yeni foreground clock niyeti yaratamaz.
- Storage hatasında request tüketilmez. Çözülmemiş proof'ta yeni projection/admission
  yok; exact OS lifecycle storage-blocked kuralıyla kapanır. Basit toggle/status
  proof yerine geçmez. Çözülen request hâlâ aynı epoch/config'e ait olmalıdır.
- Marker/import yoksa legacy/migration semantiği korunur; clock niyeti yeni automatic
  opt-in yaratmaz. Fresh authority/migration olmadan legacy due yeniden yorumlanmaz.
- Commit ÖNCESİ process death: RAM request kaybolur; durable eski plan otoritedir.
  Yeni process clock olayı uydurmaz, sırf restart oldu diye due'yu next(now)'ya atlamaz.
  Geri saat değişiminde uzun gecikme mümkün; kullanıcı bu sınırlamayı açıkça kabul etti.
- Commit SONRASI death: durable yeni plan otoritedir; pending envelope mevcut kuralla
  benimsenir veya kanıtlı absence'ta tek recovery projection. Accept/run recovery aynı.
  Reopen eski veya yeni tam snapshot görür; clock intent/proof için kalıcı kayıt eklenmez.
  OS reddi/force-stop/gerçek kilit/Doze için anında veya sınırsız liveness vaadi yok.

## 6. Test sözleşmesi — shared production seam, ağsız

- Önce R12 mevcut counter'lı foreground→dirty→early representative korunur; yeniden
  RED üretmek için başarılı değişmeyen geçmiş kontrol tekrarlanmaz, kayıt referanslanır.
- R3-A: açık clock + pending/OSOwned → tek revision; active→clock→completion ve
  active→clock→exact stop → tek geçerli devam. Capture clock-event lane'ine aittir;
  erken callback olmadan işlenir; run sırasında plan değişmez, yeni run/accept=0.
- R3-B: saf-clock wake aynı, occurrence/due yeni; eski params/completion/queued cancel
  yeni epoch'u değiştirmez. Config/revoke sonrasında eski request no-op; wake rotate/
  disarm mevcut kuralla. Yeni params same-wake current planı değerlendirebilir.
- R3-C: schedule FAILURE→exact backoff→new-params current state; pending=null foreground
  devralamaz. Generic throw nonce proven/unproven ayrılır. Çift schedule/finish yok.
- R9: revision hazırlığı/commit/main projection öncesi ve sonrası stop deterministik
  bariyerlerle; izinli clock sonuç kaybolmaz, stale owner lease/run'ı etkileyemez.
- Plan: real SQLite clock-CAS/rollback/commit-ack-loss/read-fail/mismatch; no run/accept;
  manual fence mevcut gate ile; proof sonrası tek devam. Reopen-before/after testleri
  RAM request kaybını kabul edilen davranış olarak sınar, kalıcı intent varsaymaz.
- Locked request→early callback capture=0→unlocked explicit continuation; storage ve
  config invalidation karşıtları. Tam S3 matrisi değil bu olayların dar negatifleri.
- Mevcut gerçek OS harness'te clock revision→tek pending JOB=2712, nonce/current wake,
  eski stop/completion no-op, current early delivery capture=0, exact cancel kanıtı.
  Synthetic clock/lock-deny gerçek keyguard veya doğal teslim PASS'i değildir.

## 7. Dar doğrulama ve devir

Başlangıç HEAD/status/staged + beş dosyanın gerçek içerik/diff snapshot'ı alınır;
strict R12 denemesi diskteki kullanıcı işi sayılır, kör restore/reset yapılmaz.
Mevcut manifest altında yeni devam alt dizini; tek invariant matrisi + ham loglar.
İlk compile/test APK mevcut S3=true arm64 varyantıyla; önce `s3-automatic-lock`
representative + ayrılmış R3/R9, sonra yalnız etkilenen `s3-automatic-plan`, en son
`s3-automatic-os`. Owned emulator/paket/hash preflight; yeni native rebuild'de dur.
Queue/Runtime/contract/pause başarılı değişmeyen kanıtını kullan; lint NOT_RUN ve iki
deneme korunur. Schema/300-line/ABI sınırı ayrıca kontrol edilir; yeni runtime PASS yok.
R12 strict deneme 1 çatışmayla bloke kaydı silinmez; stale=1, clock-stop=1, migration=1
önceki başarısız tur geçmişi korunur. Aynı yaklaşım iki kez başarısızsa DECISION.
Opus yalnız uygulama+dar verification+devir; CURRENT=REVIEW ve checkbox açık kalır.
Ayrı GPT gerçek-diff review kabulü gerekir; FTPS/Faz3–4/B4/P5 açık, commit/push yok.
**Devam: YENİ SOHBET · Rol: Opus uygulama · Tam komut: `/implement`.**
