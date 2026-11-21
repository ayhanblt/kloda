# CURRENT — 11.11.2026

Tek başlangıç işaretçisi. Tarihî PASS taze kabul değildir. Kurallar: kök AGENTS.md.

**Model kararı (18.11):** ileriye dönük GPT plan/review seçimi **GPT-6.2 Sol**
(`openai/gpt-6.2-sol`, Fast değil). Proje/global komutlar ve repodaki Codex model
seçimleri güncellendi; mevcut effort korunur.
Tarihî review kayıtları gerçek reviewer modelini göstermeye devam eder.
**Son model kararı (18.11):** mevcut Opus çalışması tamamlandıktan sonra ana
uygulama/FIX **Sonnet 5.5**, geliştirme araştırma/düşük-riskli alt işler **Haiku 5.5**.
Çalışan Opus turu ve onun Sonnet desteği korunur. Sonraki devirlerde eski Opus/Sonnet
rol etiketleri bu karara göre okunur; plan/review Sol 6.2, destek Luna olarak kalır.

## Aktif iş / sıradaki adım

**17.11 kullanıcı kararı ve sonuç:** F1 fix2 compile/RED-GREEN/dar lint doğrulaması
**Faz3'e DEFERRED / NOT_RUN**; aşağıdaki eski Mac F1→1.5 sırası artık yürütülmez.
1.5 için onaylı 10 dakikalık pencerede host testi **6.01 saniye / exit 0**: H15/P15
derleme+seed/reopen PASS. [Kanıt](evidence/backlog-1.5/mac-2026-11-17/result.txt),
ham log aynı dizinde `host-check.log`. Kod değişikliği/tekrar koşu yok.
**1.5 REVIEW / ACCEPTED — bağımsız GPT review ile goal kapandı:**
H15/P15 Mac PASS reuse; L15 kaynak/metin ve B15 release kapısı statik doğrulandı.
[Review](evidence/backlog-1.5/review.md), [manifest](evidence/backlog-1.5/MANIFEST.md).
Gerçek release/lisans paketleme/fiziksel kapılar açık. **2.2/G2–G3: GPT planı onaylandı,
18.11 INITIAL + FIX-R1 bağımsız GPT review ACCEPTED; 2.2 geliştirme goal'u kapandı**;
[review §FIX-R1](evidence/backlog-2.2-g2-g3/review.md#fix-r1-bağımsız-devam-reviewu--18112026),
[manifest](evidence/backlog-2.2-g2-g3/MANIFEST.md). G23-R1 RESOLVED; G23-01–08 karşılandı.
Reviewer probe 3/3 GREEN; uygulayıcı regression RED→GREEN/19 test ve dar kontroller reuse.
INITIAL ret=1, başarısız FIX=0. Gerçek OS/native/release kapıları açık.
**2.3/G4–G6 (18.11): REVIEW / ACCEPTED — bağımsız GPT geliştirme kabulü.**
D-G456 (next-plan §2.3) G456-01–06 ve 07 render/a11y karşılandı; engelleyici bulgu yok.
Spec 8/8, tsc, scoped ESLint, locale ve iki export REUSE; final hash 6/6 taze doğrulandı.
G456-07 scripted M13 görsel karşılaştırması 18.11 kullanıcı kararıyla **Faz3 DEFERRED / NOT_RUN**
(izole capture yolu yok). Reviewer yeni test/build NOT_RUN; üst ürün/fiziksel kapılar açık.
[Review](evidence/backlog-2.3-g4-g6/review.md), [manifest](evidence/backlog-2.3-g4-g6/MANIFEST.md).
INITIAL ret=0, başarısız FIX=0. **Tek sonraki adım: yeni GPT plan sohbetinde 2.4**; hazır prompt:
`2.3/G4–G6 geliştirme kabul edildi. CURRENT'teki 2.4 eşleşme/aktarım metinleri,
WebDAV endpoint/port/yol ve sır sızdırmayan teşhis için mevcut kanıtı kullanarak
tek goal/ortak kabul tablosuyla GPT planı hazırla; kök neden olmadan retry/fence
gevşetme. F1/Faz3–4/step19 ertelemelerini koru. Ürün kodu değiştirme.`
Burada sonraki iş başlatılmadı. F1 fix2 PASS/kabul değildir;
2.1 kabulü, R3 önceki scoped lint ve FO1 Faz4 ertelemesi korunur. Token/kota UNKNOWN.
**Güncel (18.11): 2.4 INITIAL + FIX-R1 + FIX-R1b → REVIEW / ACCEPTED.**
G24-R1 RESOLVED; G24-01–06 ve 07 render/a11y karşılandı. Tek sunum sınırı
Back/jobs/activity/hide yollarını kapsıyor. RED3→GREEN15, reviewer probe5,
desktop377/scoped lint/build REUSE; reviewer yeni runtime koşmadı.
2/2 final hash/diff→FIX-R1 zinciri ve etkilenmeyen 20/20 code + 6/6 locale taze doğrulandı.
[Son review §FIX-R1b](evidence/backlog-2.4/review.md#fix-r1b-devam-reviewu-ve-kapanış--18112026),
[manifest](evidence/backlog-2.4/MANIFEST.md). INITIAL ret=1, stale ownership failed FIX=1 korunur.
G24-07 visual kullanıcı onayıyla 2.5 hazırlığı sonrası **Faz3 DEFERRED / NOT_RUN**.
Genel renderer tsc iki başlangıç CSS TS2882 ile exit2; tam typecheck/ürün PASS değil.
**Güncel (18.11): 2.5 D25-M FIX-R2 reddedildi; DECISION onaylı → scoped FIX-R3.**
[Son bulgular](evidence/backlog-2.5/review.md#fix-r2-engelleyici-bulgular),
[manifest §onaylı devir](evidence/backlog-2.5/MANIFEST.md#onaylı-decision-ve-scoped-devir).
G25-R1–R4 açık; INITIAL ret=1, başarısız FIX=2; G25-R5 değişmedi. Diff replay
16/16 ve dar reviewer probları taze; 65 test/temsilci/resume/SIGKILL reuse.
Faz3 görselleri DEFERRED / NOT_RUN; F1/FO1/step19 ertelendiği gibi kalır.
**Tek sonraki adım:** mevcut uygulama sohbetinde ana Sonnet 5.5 ile tek scoped
FIX-R3 / G25-R1–R4: kalıcı CLI çıkış onayı + kaynak bazlı cleanup; kanıtlanamayan
kaynak RESTORE_PENDING, 16 dosya sınırı. Sonuç aynı GPT review'a döner; kutu açık.

**16.11 kullanıcı yönlendirmesi:** F1 fix2 ve 1.5 kapanmadan Mac doğrulama kuyruğunda
bekler; Windows'taki **2.1/G1 INITIAL + G1-R1**, **bağımsız GPT review ile geliştirme kabulü aldı**.
G1 durumu **REVIEW / ACCEPTED**; görsel Faz3 DEFERRED / NOT_RUN. Son kayıtlar:
[review](evidence/backlog-2.1-g1/review.md), [manifest](evidence/backlog-2.1-g1/MANIFEST.md).
16.11 tarihî 2.2 plan yönlendirmesi karşılandı; güncel tek sonraki adım üstteki
**2.4 GPT planı**dır; 2.2 ve 2.3 geliştirme review'ları kapandı.
Mac'te sıra: **F1 fix2 → 1.5 H15/P15**; [güncel kuyruk ve komutlar](windows-handoff-2026-11-16.md#güncel-mac-doğrulama-sırası--1611-kullanıcı-kararı).
Alttaki F1 uygulama yönlendirmesi yalnız o iş Mac'te sürdürüldüğünde geçerlidir.

**Durum: FIX / KISMİ (BLOCKED-ENV) — fix2 R1/R2 kaynağı + regression testleri Windows'ta
tamamlandı; compile/androidTest/RED-GREEN/lint NOT_RUN (Windows'ta Android SDK/JDK17/prebuild yok,
disk yetersiz; kullanıcı kararı: yalnız kaynak). Review-ready DEĞİL. Kayıt: MANIFEST §fix2 Windows
devamı, `fix2/resume-win/`. Sıradaki: Android ortamında (Mac) kod değiştirmeden build + start-RED +
final-GREEN + dar lint; aynı Opus uygulama rolü. Önceki devir: [checkpoint](windows-handoff-2026-11-16.md). Checkbox açık.
Dar çözüm sözleşmesi: [R1/R2 stop/recovery](plans/f1-ftps-r1r2-stop-recovery-contract.md)
**KULLANICI ONAYLI / SCOPED FIX READY**. Worker yetkisi ve retained stop bilgisi ayrıldı;
slot temizliği stop tüketimi/yeni delivery/kanıtlı replacement/revoke/service teardown ile sınırlı.
WATCH initial/replace/recovery tek sonuç protokolü; UNKNOWN generic catch ile temizlenmez.
Son review: [FIX review.md](evidence/f1-ftps-automatic-lock-2026-11-15/fix-r1r2/review.md).
Son manifest: [FTPS MANIFEST](evidence/f1-ftps-automatic-lock-2026-11-15/MANIFEST.md) §Onaylı scoped FIX devri.
FTPS-R1: E retire→OS finish teslimi öncesi stop retry penceresi kaldı (FL1/FS2).
FTPS-R2: WATCH ordinary recovery schedule sonucu shared helper/generic catch ile protokolü bypass ediyor (FP2/FW).
Final lifecycle 32/32, lock 7/7 ve build PASS reuse; yeni reviewer runtime yok.
FTPS-R3 dar lint kabul: altı diff dosyası 0/0; tam görev 3 mevcut dış-kapsam error ile exit 1,
worklets analizi hariç. Teşhisler MANIFEST §R3 dış-kapsam lint bulguları ve Faz3'te açık.
Yeni ürün hedefi/dosya/fixture yetkisi yok. S3 scoped kabulü korunur.
FO1 önceki PASS reuse; yeni success-completion zinciri §21/Faz4 fiziksel kabulüne DEFERRED / NOT_RUN.**
16.11 onaylı süreç: UNKNOWN durma nedeni değil; kalan kapsam tek uygulama işi,
satır başına onay/sohbet yok. Yeni FO1 koşusu/fixture kurulumu yok. Dosya sınırı sekiz
  (16.11 kullanıcı onayı `AndroidFtpsPolicyChecks.kt`, FP1); hepsi ≤300 (`fix-r1r2/lines-final.txt`). Kanıt/baseline:
[FTPS MANIFEST](evidence/f1-ftps-automatic-lock-2026-11-15/MANIFEST.md).
- [ ] **F1-FTPS:** [onaylı sözleşme](plans/next-plan.md) §1–6; tek goal ve FL1–FO1
  ortak durum-geçiş tablosu esas alınır. §2'deki sekiz kaynak sınırı (Lifecycle + 16.11 Policy test dosyaları).
- İlk temsilci FL1 tamamlandı; yeniden uygulama yok. Mevcut Opus `/implement` yalnız
  onaylı R1/R2 dar sözleşmesine yönelir; kullanıcı bu sohbetten otomatik başlatmayı yasakladı.
- Kilitli WATCH mevcut occurrence/due/run'ı korur; erken istek ayrıca saklanmaz.
  Ayrı SP-STOP S3 kaynak kaygısı [araştırma ekinde](plans/f1-ftps-research-2026-11-15.md#s3-kabulü--açık-kapı-ayrımı);
  FTPS kapsamında S3 düzeltme veya kabulü yeniden açma yetkisi yok.
- FTPS kanıtı: MANIFEST'te FL1+FL2 RED/GREEN (`fl2/`), final FIX 7/32 GREEN reuse; R3 dar lint kabul, tam görev exit 1. Üst F1 ve fiziksel kapılar açık.
- **15.11 FS1-JOB checkpoint:** eski A JOB finally→reconcile, B'nin JOB/WATCH'ını iptal ediyordu (RED) → `reconcileCurrent(token)`
  ile GREEN; FL/FW aynı APK'da fresh. Tarihî: 16.11'de `reconcileCurrent` yerini tek `complete()` arbiter'ına bıraktı (MANIFEST §fs-rest).
- Önceki FL/FW sonuçları, kaynak/varyant hash'leri ve sayaçlar FTPS MANIFEST'te;
  etkilenmeyen başarılar yeniden kullanılır. Eski token'sız report FS1 kapsamındadır.
  **SNAPSHOT-OPEN** ayrı açık bulgu; bu işe eklenmedi. Tarihî UNKNOWN duruşları güncel yetki değildir.

**16.11 FO1 kanıt checkpoint'i:** [önceki PASS / mevcut diff / FO1 eşlemesi](evidence/f1-ftps-automatic-lock-2026-11-15/fo1-evidence-audit-2026-11-16.md).
03.11 gerçek OS aktarım PASS'i korunur; güncel WATCH/stop/defer gerçek-OS kanıtı reuse.
Sekiz final kaynak hash'i eşit. Kalan: değişen başarılı JOB completion'ının gerçek
aktarım/tek completion/UI'sız sonraki JOB zinciri; bütün FO1 kanıtsız değildir.
**Son kullanıcı kararı:** bu dar açık fiziksel test aşamasına taşındı; eski PASS
reuse ile geliştirme review'u yapılacak. Yeni fixture planı/kurulumu veya tekrar test yok.
Plan §1'deki onay §5/§6 eski kapanış engellerini supersede eder; ürün PASS'i uydurulmaz.

### Korunan S3 scoped kabulü — yeniden uygulama yok

- [x] **F1-S3-R13R14 scoped goal:** G13/G14/GP kanıtları kabul edildi; üst 1.4b/F1'in bütünü değildir.
Son review: [r14-c1/review.md](evidence/f1-s3-automatic-lock-2026-11-11/fix-r12/clock-reconcile/r13-r14/r14-c1/review.md).
Son manifest: [r14-c1/MANIFEST.md](evidence/f1-s3-automatic-lock-2026-11-11/fix-r12/clock-reconcile/r13-r14/r14-c1/MANIFEST.md).
Üst matris: [r13-r14/MANIFEST.md](evidence/f1-s3-automatic-lock-2026-11-11/fix-r12/clock-reconcile/r13-r14/MANIFEST.md).
Start/review HEAD `f26e425`; staged boş; üç-dosya C1 diff'i baseline'dan tam yeniden oluşturuldu.
Final source ve APK `02488fa5…` hash doğrulandı. İki gerçek reconcile temsilcisi invariant wake
rotate RED→GREEN; final plan ve lock başarıları Opus kanıtından yeniden kullanıldı.
Tek recovery critical section ve `blockedAttempt === attempt` cleanup kaynak incelemesinde uygun;
authority capture/OS dışarıda. Kimlik-eşitsizliği dalı için özel runtime testi NOT_RUN;
normal attempt recovery final lock kapsamında. Reviewer yeni runtime/build/lint NOT_RUN.
OS önceki g14c kanıtı/prior-source olarak yeniden kullanıldı; taze C1 OS PASS iddiası yok.
Onaylı tamamlanan sınır: [R14-C1 sözleşmesi](plans/f1-r14-c1-atomic-recovery-fix.md),
[G13/G14 korunacak yollar](plans/f1-r13-r14-clock-reconcile-fix.md); yeniden uygulama yok.
C1 CURRENT başlangıç snapshot'ı yok: idari aidiyet sınırlaması, ürün diff/kanıt doğruluğunu engellemiyor.
Sayaçlar: early=1 çatışma, stale=2 tarihî tur, clock-stop=1, migration=1, clock-proof=2 tarihî ret;
atomik yaklaşım deneme 1 kabul, reset yok. Lint iki-deneme NOT_RUN; fiziksel keyguard/Doze/doğal teslim,
ilk unlock/CE/reboot/force-stop/production signing/storage, RAM intent/geri saat sınırlaması ve
FTPS/Faz3–4/B4/P5 açık. Scoped kabul tam ürün PASS değildir.
**Sıradaki / mevcut Opus uygulama sohbeti:** `/implement` — yalnız onaylı
`plans/f1-ftps-r1r2-stop-recovery-contract.md` §1–4 ve MANIFEST §Onaylı scoped FIX devri.
Önce yeni baseline ve R1 completion→stop temsilcisi; ardından tek R1/R2 kapsamı.
Devir hazırdır; bu GPT sohbeti uygulamayı/ajanı başlatmaz. Opus sonucu REVIEW/unchecked
bırakır; bağımsız değerlendirme bu mevcut GPT review sohbetinde yapılır.
Start HEAD `f26e425`, final FIX hash'leri `fix-r1r2/source-final.sha256`;
R1/R2 sayaçları 2, R3 dar kabul. FO1 eski PASS reuse/yeni zincir §21/Faz4 DEFERRED;
tekrar koşma/fixture yok. S3 kabulü korunur; FTPS/üst F1 checkbox'ları açık.
S3 review kaydı için ek Opus oturumu gerekmez. Commit/push yok.

## Teslim backlog'u

- [x] **Faz 0:** backlog/kapsam donduruldu.
- [x] **1.1/B1:** native UUID + bağımsız GPT review kabul; JS→native runtime açık, Faz 3.
- [x] **1.2/Jest:** AppState listener spec düzeltmesi + bağımsız GPT review kabul.
- [x] **1.3/B3:** FTPS Drop-zeroize + bağımsız GPT review kabul; P3 belge notu, FTPS/JNI runtime ve fiziksel kapılar açık.
- [x] **1.4/B4:** vault politikası belge review kabul; bayrak eklenmedi, kalan risk kabul. R1 tarihî CURRENT aidiyeti sınırlaması korundu; runtime güvenlik PASS'i değil.
- [ ] **1.4b/F1 geliştirme:** R1/R2 dar tasarım kullanıcı onaylı → fix2 kaynağı tamam, doğrulama BLOCKED-ENV (NOT_RUN); iki ret sayacı korunur. R3 dar lint kabul ve S3 kabulü korunur. FO1 prior PASS reuse/yeni zincir ve diğer fiziksel/release kapıları Faz4'te; yalnız bu ertelemeler geliştirme kapanışını bekletmez.
- [x] **1.5:** iOS WebDAV host onarımı + üç lisans metni + B2 gerçek release app kabul kapısı.
  **17.11 REVIEW / ACCEPTED:** H15/P15 macOS compile+seed/reopen PASS reuse, 6.01 sn / exit0;
  L15/B15/V15 bağımsız GPT review kabul. [Review](evidence/backlog-1.5/review.md),
  [MANIFEST](evidence/backlog-1.5/MANIFEST.md). Üç kaynak baseline/hash zinciri doğrulandı;
  eksik tarihî yardımcı loglar yeni statik audit ile karşılandı, tarihî RED uydurulmadı.
  Reviewer host testi/build tekrar etmedi. Release/fiziksel kapılar ve F1 ertelemeleri açık.
- [x] **2.1/G1:** gerçek journal ile Mobil Etkinlik Şu an/Geçmiş. Sözleşme: next-plan §2.1/G1 (D-G1 onaylı).
  16.11 INITIAL + G1-R1 FIX: **bağımsız GPT geliştirme review KABUL.** G1-01–06 ve G1-07 render/a11y
  karşılandı; son Jest 40/40, tsc, scoped ESLint ve iOS/Android export uygulama kanıtı REUSE.
  G1-07 görsel karşılaştırma kullanıcı kararıyla **Faz3 DEFERRED / NOT_RUN**, geliştirme engeli değil.
  [Review](evidence/backlog-2.1-g1/review.md): G1-R1 M11 header dropdown RESOLVED; 8/8 son hash,
  INITIAL→FIX baseline zinciri ve komşu yollar taze statik doğrulandı. Reviewer yeni test/build NOT_RUN.
  [Manifest](evidence/backlog-2.1-g1/MANIFEST.md) §Bağımsız GPT kapanışı; görsel/runtime veya üst F1/1.5 kabulü değil.
- [x] **2.2/G2–G3:** gerçek Desktop tray, sürüm/kapanış eşlemesi; ADR0018 foreground ve Linux görünür kontrol sınırları.
  **18.11 INITIAL + FIX-R1 bağımsız GPT REVIEW / ACCEPTED.** next-plan §2.2 D-G23/G23-01–08 karşılandı.
  G23-R1 RESOLVED: hata+aktif gözlemi doğru; mounted regression RED→GREEN, FIX 19/19 test,
  scoped ESLint/renderer tsc/build/tek capture reuse; reviewer probe 3/3 GREEN.
  INITIAL 334 test/main tsc/26 capture kendi kaynaklarında reuse; final tam suite iddiası yok.
  Start/review HEAD `508b3f0`, 11/11 final hash/diff zinciri doğrulandı; INITIAL ret=1, başarısız FIX=0.
  Yalnız 2.2 geliştirme kabulü; F1/native/OS/Faz3–4/release kapıları açık. Sonraki ayrı iş 2.3 GPT planı.
  [Review](evidence/backlog-2.2-g2-g3/review.md), [MANIFEST](evidence/backlog-2.2-g2-g3/MANIFEST.md).
- [x] **2.3/G4–G6:** gerçek mobil ayar yetenek/kapsamı; D10 birleşimi belgeli; kilit ekranı step19 kapısında.
  18.11 INITIAL bağımsız GPT REVIEW / ACCEPTED; G456-01–06 ve 07 render/a11y karşılandı.
  Final hash 6/6 taze; spec 8/8/tsc/scoped lint/locale/iki export REUSE, reviewer yeni koşu yok.
  G456-07 görsel Faz3 DEFERRED / NOT_RUN; tam ürün PASS değil.
  [Review](evidence/backlog-2.3-g4-g6/review.md), [manifest](evidence/backlog-2.3-g4-g6/MANIFEST.md).
- [x] **2.4:** eşleşme/aktarım metinleri, WebDAV endpoint/port/yol ve sır sızdırmayan teşhis; retry/fence gevşetilmedi.
  **18.11 INITIAL + FIX-R1 + FIX-R1b bağımsız GPT REVIEW / ACCEPTED.**
  G24-R1 RESOLVED; G24-01–06 ve 07 render/a11y karşılandı.
  Regression15/reviewer5/desktop377/lint/build REUSE; final hash/diff zinciri taze, yeni reviewer runtime yok.
  G24-07 visual G24-V1 kullanıcı onayıyla **Faz3 DEFERRED / NOT_RUN**.
  [Review](evidence/backlog-2.4/review.md), [manifest](evidence/backlog-2.4/MANIFEST.md).
  INITIAL ret=1, stale ownership başarısız FIX=1 korunur; yalnız 2.4 geliştirme kabulü.
  Renderer tsc başlangıçtaki iki CSS TS2882 ile exit2; genel typecheck/ürün/fiziksel kapılar açık.
- [ ] **2.5:** mevcut betiklerle eksik ekran/dil kapsamını kalıcı batch capture'a tamamla.
  D25-M **DECISION onaylı → scoped FIX-R3**: [manifest](evidence/backlog-2.5/MANIFEST.md#onaylı-decision-ve-scoped-devir). Goal açık.
- [ ] **3:** tek tam regresyon; önce fixture/tek temsilci; JS/native/build, güvenlik/B2, a11y/görsel/performance. Lint açık: DeviceCheck:40/45 MissingPermission, S3Automatic:46 NewApi ve worklets bağımlılık analizi (FTPS MANIFEST §R3 dış-kapsam lint bulguları); FTPS dar lint kabulü genel lint PASS'i değil. Dropbox Android JobService, iOS >150 MiB upload_session, Dropbox Photos/Nextcloud restore, Android yükseltme ve recovery göster/kopyala açık kontrolleri dahil. Hesaplar ayrı izinli; bağımsız review ve dağıtım kapıları korunur.
  **F1 fix2 — 17.11 kullanıcı onaylı erteleme:** Kotlin compile/AndroidTest build,
  R1/R2 start-RED→final-GREEN ve değişen kapsamın dar lint'i burada yapılacak;
  mevcut fix2 runtime NOT_RUN, geliştirme kabulü verilmedi. Eski PASS'ler yalnız
  kendi kaynak/varyantlarında korunur. FO1 delta ayrıca Faz4'tedir.
  **G1-07:** Etkinlik Şu an/Geçmiş + filtreler; TR/EN/DE, light/dark, büyük yazı ve Lovable M11
  görsel karşılaştırması 16.11 kullanıcı kararıyla burada **DEFERRED / NOT_RUN**. Kalıcı batch capture
  script açığı 2.5'te açık; hazır olmayan runnable komut varsayılmaz.
  **G456-07 (2.3 M13):** frozen M13'e karşı TR/EN/DE, light/dark, büyük yazı scripted görsel
  karşılaştırma 18.11 kullanıcı kararıyla burada **DEFERRED / NOT_RUN**.
  **G24-07 (2.4):** yeni WebDAV form/pairing metinleri TR/EN/DE, light/dark, büyük yazı
  dar scripted görsel karşılaştırması aynı GPT review sohbetindeki 18.11 kullanıcı
  onayıyla burada **DEFERRED / NOT_RUN**; 2.5 capture hazırlığı sonrası. G24-R1 kod bulgusu çözüldü.
- [ ] **4:** Android fiziksel tam kapsam; Desktop OS/signing/storage ve saha kesinti teşhisi. iOS Simulator ayrı kanıt; fiziksel iOS yoksa custody/OS/Photos/iCloud/signing açık. Kullanıcı veri/eşleşmesi korunur, cihaz/hesap/medya izni varsayılmaz.
  F1-FO1 dar kontrol: gerçek success → tek completion → UI'sız sonraki JOB callback'i;
  16.11 kullanıcı kararıyla buraya taşındı, NOT_RUN. Ayrıntı: 20–21 koleksiyonu §21.

## Korunan kararlar / açık kapılar

- Açıklık/teşhis teslimde; WebDAV uzak klasör gezgini, yeni CA/auth/mTLS ve okunabilir export kapsam dışı. CloudMe engelli; Kolab Now/Box/MEGA/GCS V1 dışı.
- **A5 teslim notu:** Finder'da özgün ad/uzantı/cihaz etiketiyle export yok. Fingerprint/operation-ID düzeni ve retained `.part` hardlink journal/inode bağları korunur; yeniden adlandırma/silme yok. A5 düzelmiş sayılmaz.
- ADR0029, iOS16, P5 production/at-rest, sağlayıcı/depolama ve release imzaları açık. Yetkili liste: [20–21 kabul koleksiyonu](20-21-acceptance-collection-2026-11-04.md).
- [Saha bulguları](field-findings-2026-11-05.md), [geçmiş review](claude-review-2026-11-11.md). Kanıt dizinleri: `evidence/b1-uuid-2026-11-11/`, `evidence/jest-1.2-2026-11-11/`, `evidence/b3-zeroize-2026-11-11/`, `evidence/b4-vault-lock-2026-11-11/`.

## Akış / kompakt checkpoint

**16.11 süreç checkpoint'i:** kullanıcı onayıyla AGENTS, plan/implement/review ve
bütçe/araştırma politikası uyumlandı. Tek goal, tüm kapsam uygulaması, review öncesi
hazırlık ve toplu bağımsız review. FIX'te kök neden→regression→düzeltme; mevcut rol
sohbetleri kullanılır. Dış araştırma düşük maliyetli subagent; ana model değişmez.
Belge/komut tutarlılığı kontrolü kayıtlı; ürün/runtime test yapılmadı. FTPS mevcut kanıtları
korunur; lint NOT_RUN ve üst F1/fiziksel kapılar açık. Kanıt: evidence/workflow-2026-11-16.md.
[Windows devir notu](windows-handoff-2026-11-15.md) yalnız ihtiyaç halinde tarihî
ortam/artifact referansıdır; eski R13/R14 uygulama veya commit/push yönlendirmesi
güncel yetki değildir. Aktif kapsam bu CURRENT ve onaylı FTPS next-plan'dır.

**Güncel maliyet politikası:** [uygulama politikası](execution-budget.md):
hazır tasarım, ilk temsilci regression/minimum fix, 15k ajan içi verimlilik kontrolü
(UNKNOWN tek başına durdurmaz). **18.11 sonraki iş döngüsü:** düşük riskli net iş
normal `/implement` altında Sonnet 5.5'e devredilebilir (§4); ayrı pilot komutu kaldırıldı.
Tek doğrulama seçimi, dar compile→runtime ve review öncesi çağıran/hata yolu taraması
§5'te; 18.11 araç/teşhis disiplini ve `/implement` referansı güncellendi.
Plan/review destek Luna; uygulama destek Sonnet. Mevcut review/devir kapsamı
değişmez; F1 hassas uygulaması Opus'ta, ana model/effort aynı kalır.
Önceki R13/R14 FIX yönlendirmesi tamamlanan S3 scoped kabulüyle supersede edildi;
güncel INITIAL/FIX yetkisi yalnız yukarıdaki aktif iş bölümünden okunur.

OpenCode: GPT plan → ayrı Opus uygulama → ayrı GPT review+kapanış.
Aynı iş/rolde araştırma, açıklama ve kayıt aynı sohbette. Opus checkbox kapatmaz;
GPT kabul ölçütleri sağlandığında kaydı kapatır. Her devir: Durum / AYNI–YENİ–DUR /
Rol / komut. Varsayılan medium; Faz 3/4 planları ve custody/journal/TLS uygulama
ve review high. Model/effort otomatik değişmez. İki-deneme sayacı oturumla sıfırlanmaz.

**11.11 kullanım düzenlemesi:** CURRENT kısaltıldı; geçmiş ayrıntılar
[tarihî kayda](current-history-2026-11-11.md) taşındı. Bu kayıt topluca okunmaz;
yalnız ilgili başlık seçilir. Gelecek planlarda tarihî araştırma ayrı ek, uygulama
sözleşmesi kısa olacak. Aktif FTPS sözleşmesi next-plan'dır; S3 tarihî planı ayrı dosyada korunur.
