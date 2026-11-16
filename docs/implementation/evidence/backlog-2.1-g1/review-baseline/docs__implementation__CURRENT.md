# CURRENT — 11.11.2026

Tek başlangıç işaretçisi. Tarihî PASS taze kabul değildir. Kurallar: kök AGENTS.md.

## Aktif iş / sıradaki adım

**16.11 kullanıcı yönlendirmesi:** F1 fix2 ve 1.5 kapanmadan Mac doğrulama kuyruğunda
bekler; Windows'ta sıradaki iş **2.1/G1 için GPT planı** (uygulama henüz onaylı değil).
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
- [ ] **1.5:** iOS WebDAV host testini onar; cesu8/instant-xml/instant-xml-macros lisansları; B2 release iOS fixture-CA marker kontrolünü kabul kapısına bağla.
  16.11 Opus INITIAL: **KISMİ / BLOCKED-ENV — review-ready değil.** H15 harness kaynağı, L15 notices, B15 §20 kapısı
  uygulandı; H15/P15 macOS koşusu NOT_RUN (Windows'ta xcrun/swiftc yok). Kanıt: [1.5 MANIFEST](evidence/backlog-1.5/MANIFEST.md).
  Sıradaki: macOS'ta kod değiştirmeden `python3 -I tools/test-ios-webdav-journal.py` (aynı Opus rolü); GREEN sonrası GPT review.
- [ ] **2.1/G1:** gerçek journal ile Mobil Etkinlik Şu an/Geçmiş. Sözleşme: next-plan §2.1/G1 (D-G1 onaylı).
  16.11 Opus INITIAL: **KISMİ / BLOCKED-ENV — review-ready değil.** JS-only selector/panel/segment + TR/EN/DE
  uygulandı; G1-01–06 ve G1-07 render/a11y fresh PASS (Jest 39/39, tsc, scoped ESLint, iOS/Android export).
  Açık: G1-07 görsel karşılaştırma NOT_RUN (Windows'ta emulator/simulator yok). Kanıt: [G1 MANIFEST](evidence/backlog-2.1-g1/MANIFEST.md).
  Sıradaki: cihazlı ortamda kod değiştirmeden G1 Etkinlik Şu an/Geçmiş görsel capture (aynı Opus rolü); sonra GPT review.
- [ ] **2.2/G2–G3:** gerçek Desktop tray, sürüm/kapanış eşlemesi; ADR0018 foreground ve Linux görünür kontrol sınırları.
- [ ] **2.3/G4–G6:** gerçek mobil ayar yetenek/kapsamı; D10 birleşimini belgele; kilit ekranı step19 kapısında.
- [ ] **2.4:** eşleşme/aktarım metinleri, WebDAV endpoint/port/yol ve sır sızdırmayan teşhis; kök neden olmadan retry/fence gevşetme yok.
- [ ] **2.5:** mevcut betiklerle eksik ekran/dil kapsamını kalıcı batch capture'a tamamla.
- [ ] **3:** tek tam regresyon; önce fixture/tek temsilci; JS/native/build, güvenlik/B2, a11y/görsel/performance. Lint açık: DeviceCheck:40/45 MissingPermission, S3Automatic:46 NewApi ve worklets bağımlılık analizi (FTPS MANIFEST §R3 dış-kapsam lint bulguları); FTPS dar lint kabulü genel lint PASS'i değil. Dropbox Android JobService, iOS >150 MiB upload_session, Dropbox Photos/Nextcloud restore, Android yükseltme ve recovery göster/kopyala açık kontrolleri dahil. Hesaplar ayrı izinli; bağımsız review ve dağıtım kapıları korunur.
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
(UNKNOWN tek başına durdurmaz), uygun düşük riskli işte kullanıcı seçimiyle tek
`/implement-pilot` Sonnet denemesi. F1 pilot değil, Opus/model effort değişmez.
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
