# 2.5 / D25-M — bağımsız GPT INITIAL review (18.11.2026)

**Karar: REJECTED / DECISION.** G25-01–06 birlikte incelendi; runner goal'u kapanmadı.
Bu GPT review oturumunda implementasyon yapılmadı; reviewer GPT-6.2 Sol
(`openai/gpt-6.2-sol`), OpenCode `ses_e114ec1f6ffeyd5nJqucKIgX4g`.
Opus implementasyon oturumu kimliği bilinmiyor. Satır referansları INITIAL kaynaklarına aittir.

## Diff ve dayanak

- Başlangıç ve review HEAD `508b3f0486a7ce04628ec0c3681d995573e5721d`. Staged boş;
  ürün diff'i bu işte yok. Başlangıçta ABSENT olan 13 untracked runner/fixture dosyası
  (`tools/capture-ui.py`, `tools/ui-capture/*`, `apps/mobile/capture/*`) `final-files.sha256`
  ile 13/13 eşleşiyor. Bu evidence dizini ve CURRENT'ın 2.5 satırları ayrıca incelendi.
- CURRENT başlangıç kopyasıyla 2.5 delta ve ayrı model notu ayrıldı. Baseline status'a göre
  sonradan görünen üç `.codex/agents/*.toml` değişikliği kapsam dışı; 2.5 kanıtı olarak kullanılmadı.
  Ürün iOS before/after2 status kaydı eşit. Sözleşme: `next-plan.md` §2.5 / G25-01–06.

## Engelleyici bulgular

| ID / aile / önem | Yer ve somut etki | Dar regresyon / korunacak yol |
| --- | --- | --- |
| **G25-R1 — cleanup transaction/result, yüksek; G25-04/05** | `common.py:85–90,139–147,219–227`, `ios.py:230–233`, `capture-ui.py:235–263`. Kayıt lock'tan önce okunuyor; başka cleanup'ın son kaydından eski state ile devam edilebiliyor. Cleanup hatası `alive` yazıyor, retry yalnız `running`'i deniyor ve önceki hatayı sıfırlıyor: tüm hücreler PASS iken ikinci cleanup canlı süreç yeniden doğrulanmadan CLEANED/0 veriyor. Desktop'ta son hücre kaydedildikten sonra adapter teardown exception'ı da kayda yalnız `error` olarak geçiyor, CLI koşulsuz cleanup success ekleyip 0 dönüyor. | Kayıt okuma/lock interleaving, PASS hücreleri + canlı süreç→exit 3→retry (hâlâ canlıysa 3), son hücre sonrası browser teardown hatası→nonzero. Gerçek cleanup kanıtıyla geçiş, eksik hücre ve BLOCKED önceliği, offline retry ve ilk sağlıklı run korunmalı. İlk üç hata cihazsız probe ile gösterildi. |
| **G25-R2 — OS/process ownership, yüksek; G25-05, DECISION** | `common.py:130–137,159–208`, `capture-ui.py:123–137,254–263`, `desktop.py:110–125`. Onaylı live handle **veya** start-time+run marker yerine saniye çözünürlüklü `ps lstart`+ata tablosu yetki oluyor; `live.pid == pid` bir reaped handle'ı da kabul ediyor, kimlik snapshot'ı ile sinyal arasındaki PID değişimi tekrar sınanmıyor. Metro `Popen` ile kayıt arasında öldürülürse kayıt dışı kalır; Desktop browser için hard-kill recovery kaydı yok ve cleanup yokluğu varsayıyor. Uygulamanın hard-kill kaydı bu pencereleri veya PID yeniden kullanımını sınamıyor. | Önce onaylı aidiyet kanıtını sağlayan veya açıkça onaylanacak eşdeğer tasarım; belirsizde sinyal/silme ve CLEANED yok. Sonra cihazsız kesinti (launch→record arası, child reaped, PID reuse aynı lstart, yabancı üye, Desktop hard kill), mevcut SIGTERM/SIGKILL başarılı yolunu koru. Gerçek süreçlere karşı hata enjeksiyonu gerekmez. |
| **G25-R3 — capture provenance/reuse, yüksek; G25-02/03** | `matrix.py:254–278`, `capture-ui.py:266–287`, `desktop.py:57–75`, `matrix.json:7–29,253–262`. `resume` geçerli hücreyi/driver/config/ölçümü doğrulamadan row+locale hash ve dosya digest'iyle 0 verebiliyor; aynı row ID farklı ekran veya BLOCKED olunca da reuse. M13'ün render ettiği tab locale anahtarları (`mobile-shell/ui.tsx:14–21`) ve `app.json` sürümü (`app-version.ts:1,10`) fingerprint dışında; Desktop adapter da dışında. Desktop mtime, servis edilen build'in bu kaynaklardan geldiğini kanıtlamıyor; başka/eskiden kopyalanan bir build yeni stat tarihiyle fresh görünebilir. | Aynı kaynak/varyant ve ilgisiz locale düzenlemesi reuse; ekran/row gate, shell metni, sürüm veya driver davranışı değişikliği recapture/UNKNOWN ve neden; yanlış build source hash'inde taze PASS yok. Ölçüm/PNG/provenance eşitliği ve run-root sınırı için CLI resume karşıtları. Row değişikliğiyle reuse probe'da gösterildi. |
| **G25-R4 — çıktı ve deadline, yüksek; G25-02/04** | `common.py:49–58`, `desktop.py:90–104,144–156`, `capture-ui.py:100–101,125–128,148–162`, `ios.py:196–227`, `entry.tsx:64–77`. Yalnız 24 baytlık geçersiz PNG başlığı bile boyut döndürüyor ve PASS'e girebiliyor; Desktop verdict pozitif/uygun viewport ve ölçülen fontu doğrulamıyor. Simctl bootstatus/install/screenshot/cleanup çağrılarında timeout yok; Metro'nun tüm body okuması mutlak deadline'a bağlı değil, Desktop `evaluate` içinde beklenen fonts promise da açık uçlu. Native ACK `AppState.currentState` snapshot'ı; foreground geçişi effect'i tetiklemiyor ve host yeni ölçüm almadan eski aynı-phase ACK'i kabul edebiliyor. | Truncated/yanlış boyut PNG ve eksik/yanlış ölçüm nonzero; simulasyonla durmuş boot/screenshot/cleanup/ready adımları sınırlı sürede nonzero; doğru ekran/tema/font ve aktif layout kanıtı devam etmeli. PNG ve timeout probe'da gösterildi. |
| **G25-R5 — matrix inventory, orta; G25-01** | `matrix.json:98–108,243–252`, `matrix.py:204–215`. Desktop `BackupSetup.tsx:20,84–90,140–149` içindeki ayrı storage durumu listede yok; `jobs` açıklaması D10 kaynak/program adımını activity rotasına bağlıyor (`App.tsx:81`, tasarım referansı §M13/D10/G6). Mobil tek `provider-cloud` satırı Nextcloud'u gösteriyor; `cloud-provider-page.tsx:12–16,29–31` içindeki farklı DAV/parola ve OAuth form aileleri görünmüyor. Rota union testi bu alt ekranları kapsamaz. `list` de hücre durumunu yalnız toplamlar olarak veriyor, override nedenini/hangi varyanta ait olduğunu göstermiyor. | Frozen page-map ve gerçek branch → satır/12 hücre karşılaştırması; güvenle üretilemeyenler somut nedenle görünür, Faz3/step19/OS ayrımları korunur; cihaz/hesap/mutasyon yok. |

Hepsi INITIAL'da yeni; önceki 2.4 stale-ownership bulgusu yeniden açılmadı.

## Temizlik / yapı ve ek sınırlar

- Sorumluluk ayrımı matrix / driver / cleanup ve mobil test-only entry yönünde;
  13 dosya 300 kod satırı sınırında. Üretim route, native ACL/fence, App/Package/Xcode
  kaynakları değiştirilmedi. READY fixture readback'i ayrı Simulator hedefini
  gösteriyor; production signing değil.
- `ios.py:164–174` READY cache kontrolü, kaydedilmiş manifest ile app tree hash'
  eşitliğini denetliyor; manifestte bundle/fixture ID/readback/scratch bağını yeniden
  doğrulamıyor. G25-R2/R3 düzeltmesinde yanlış fixture path/kimlik karşıtı eklenmeli;
  mevcut kişisel app/Keychain'e erişim gerekmiyor.
- ARM64 sim build, onaylı hedefle uyumlu; başarısız generic build başarı sayılmadı.
  Cache scratch yeni fixture kökü altında, `--out` kanıtı ayrı; disk artıkları bu
  review'da silinmedi. Expo Tools overlay temsilciye ait bilinen sınırdır.
- İsteğe bağlı: cleanup başarılı kaydının yeniden açılışında ikinci `CLEANED`
  event'ini yazmamak (kanıt geçmişini sadeleştirir).

## Kabul ve kanıt özeti

| ID | Durum ve geçerli kanıt |
| --- | --- |
| G25-01 | **Açık/R5.** 47 satır / 564 hücre, parse/duplicate ve rota keşif kanıtı reuse; alt durum açığı sözleşmeyi karşılamıyor. |
| G25-02 | **Açık/R3/R4.** `desktop-smoke` ve `ios-smoke` PNG hash'leri run kayıtlarıyla eşleşti; sırasıyla 1440×1000 ve 1206×2622, TR/light/normal. Ölçüm ve fixture linked entitlement readback 8/8 reuse; tek temsilci korunur. |
| G25-03 | **Açık/R3.** `ios-smoke-resume` exit 0 ve saf değişen/UNKNOWN fixture'ları reuse; yanlış ekran/gate reuse karşıtı RED. |
| G25-04 | **Açık/R1/R4.** Stale renderer BLOCKED exit 2 ve mevcut saf enjeksiyonlar reuse; tam run hata yolu ve geçersiz çıktı/deadline açık. |
| G25-05 | **Açık/R1/R2.** `ios-interrupt`, `ios-hardkill` cleanup ve Simulator before/after eşitliği reuse; lock/restore retry/aidiyet pencerelerini kapatmıyor. |
| G25-06 | **Review kaydı mevcut; kapanış yok.** Diff/kanıt/devir kayda alındı; zorunlu diğer satırlar karşılanmadı. |

**Taze:** 13/13 hash, staged/scope, PNG hash/boyut ve kayıt kontrolü; cihazsız reviewer
probları `review-probes.log` (exit 0: problar çalıştı, gösterilen invariantlar RED);
izole capture tsc `review-tsc.{log,exit}` exit 0 (önceki `tsc-pre.log` boş ve exit kaydı yoktu).
**Reuse:** 42 unittest, Sonnet matrix, scoped ESLint, check/Ruby syntax, satır/whitespace,
Desktop Vite build, arm64 fixture build/readback, iki izole smoke, stale renderer,
resume ve iki iOS cleanup koşusu. Başarılı build/smoke/matris tekrar edilmedi.
**Açık:** Faz3 full capture/karşılaştırma (G1-07/G456-07/G24-07) ve F1 fix2;
FO1 Faz4, step19, gerçek OS/native/Android/fiziksel/release/signing/storage kapıları.
Yeni OS, cihaz, build, hesap veya ağ testleri NOT_RUN; ürün PASS verilmedi.

## Rota

INITIAL ret=1; herhangi bir invariant için başarısız FIX=0. G25-R2 aidiyet sözleşmesi
değişikliği örtük olarak kabul edilmez. Aynı GPT sohbetinde önce DECISION; bunun ardından
tek scoped FIX turunda G25-R1–R5 mevcut Opus sohbetine birlikte devredilir. Rota kararı
çıkmadan otomatik FIX veya Faz3 başlatılmaz. Commit/push yok.

**DECISION sonucu:** Kullanıcı yerel gözeticiyi ve gözetici kaybında kanıtlanamayan
süreç için RESTORE_PENDING/nonzero davranışını onayladı. [Plan §G25-R2](../../plans/next-plan.md#g25-r2-onaylı-fix-kararı)
ve [manifest §FIX-R1](MANIFEST.md#fix-r1--onaylı-toplu-devir) tek scoped devirdir.
INITIAL kararı değişmedi; bu kayıt uygulama veya kabul değildir.

## FIX-R1 bağımsız devam review'u — 18.11.2026

**Karar: REJECTED — G25-R1–R4 açık, G25-R5 scoped olarak çözüldü; 2.5 açık.**
Aynı bağımsız GPT-6.2 Sol (`openai/gpt-6.2-sol`) oturumu
`ses_e114ec1f6ffeyd5nJqucKIgX4g`; bu oturum ürün/runner kodu yazmadı.
Başlangıç/review HEAD `508b3f0486a7ce04628ec0c3681d995573e5721d`; staged ve
runner tracked delta boş. `fix-r1/baseline/initial-hash-check.txt` INITIAL zincirini
kaydediyor; INITIAL dosya gövdeleri mevcut değil. Gerçek 16 untracked final kaynak
incelendi ve `fix-r1/final-files.sha256` ile 16/16 eşleşti; üç ek dosya kullanıcı
onaylı (`supervision.py`, `ios_build.py`, `test_supervision.py`). Önceki kapsamın
ürün/native proje dosyaları bu FIX'e katılmadı.

### FIX-R1 devam bulguları

| Bulgu / invariant / önem | Güncel yer ve etki | Dar regresyon / korunacak yol |
| --- | --- | --- |
| **G25-R1 · cleanup transaction/result · yüksek · G25-04/05** | **Kalan aile, yeni supervisor→CLI yolu.** `capture-ui.py:115–127`: gözetici çıkış kodu yalnız yazdırılıyor; gözetici `CLEANED/PASS` yazdıktan sonra abort ederse public CLI exit 0. Bu yalnız varsayım değil: `fix-r1/logs/desktop-smoke-abort.{log,exit}` önceki gerçek abort+0'ı, final kaynak üzerinde probe `_report(...,-6)`→0'ı gösteriyor. Önceki lock-before-read ve canlı süreç retry hataları düzelmiş. | Durable PASS → gözetici abnormal exit → public nonzero, PASS diye raporlama yok. Normal CLEANED/PASS ve intentional FAIL/BLOCKED/RESTORE_PENDING ayrımı ile temizliği kanıtlanmış eski run recovery'si korunmalı. |
| **G25-R2 · OS/process ownership · yüksek · G25-05** | **Kalan aile, yeni bootstrap yarışı.** `capture-ui.py:130–152`, `supervision.py:25–35,52–63`: EOF izleyicisi `SIGUSR1` handler'ından önce başlıyor; erken CLI SIGKILL'de varsayılan sinyal gözeticiyi sonlandırabilir. Handler kurulmuş fakat henüz armed değilse sinyal düşüyor; `parent_gone` capture'dan önce okunmadığından ölmüş CLI için browser/Simulator/Metro başlatılabiliyor. Final probe erken EOF'ta hem handler'ın kurulmadığını hem driver'a girildiğini gösterdi. | Public CLI kaybı watcher öncesi/handler–arm arası/launch öncesi → yeni sürücü yan etkisi yok, doğrulanmış yoklukta CLEANED+FAIL; launch sırasında → tek gözetici own cleanup. Canlı gözeticide reap edilmemiş lider ve ayrı session; kayıp gözeticide sinyal yok, belirsiz kayıt pending. Grup dışına çıkan torun bilinen sınır: desteklenen Metro/driver yolu bunu yapıyorsa sessiz CLEANED değil, sürücü kanıtı veya pending. |
| **G25-R3 · capture provenance/reuse · yüksek · G25-02/03** | **Kalan aile.** `desktop.py:21–23,74–81,105–115`: damga mtime'dan iyi fakat global CSS'in kullandığı Inter varlıkları (`apps/desktop/src/app/global.css:3–6`) girdilerde yok; font değişince eski renderer `fresh=True` (probe). `desktop.py:226–233`: tüm kaynak+renderer digest'ini reuse şartı yapmak, ilgisiz locale anahtarı değişikliğiyle bile önce stale, rebuild sonrası farklı digest nedeniyle recapture dayatıyor. `ios_build.py:42–45,64–81`: tarif `_stage_mirror`'ı hash'liyor ama çağırdığı build helper `_link_all`'ı hash'lemiyor (probe). | Inter değişimi → stale; güncel build damgası gerçek dosyalara bağlı kalmalı, mevcut alakasız locale istisnası korunmalı. Build helper değişikliği → fixture tarif hash değişir; yalnız `ios.py`/JS runtime değişikliği → native fixture geçersiz sayılmaz. Bu turun bir kerelik rebuild'i makul: INITIAL tüm `ios.py`'yi input sayıyordu ve yeni fixture kimlik/tarif şeması farklı; sonraki rebuild otomatik varsayılmasın. |
| **G25-R4 · output/deadline · yüksek · G25-02/04** | **Kalan aile.** `ios.py:77–90`: blocking `response.read` başladıktan sonra mutlak deadline zorlanmıyor; geç EOF hatta kabul ediliyor (probe: 90 s sınırına karşı 200 s clock). `common.py:52–84`: CRC/zlib/uzunluk doğrulaması başlık-only hatasını kapatıyor ama geçersiz scanline filter `255` hâlâ geçerli `(1,1)` dönüyor; böylece bozuk çıktı cell PASS'e girebilir. `ios.py:159–170` artan sample şartı iyileşme; `before.sample`'dan büyük ama screenshot başlamadan gönderilmiş gecikmeli paket de «sonra» sayılabiliyor. | Mutlak deadline'ı geçen sıra EOF dahil reddedilir; invalid filter/PNG reddedilir. Screenshot bittikten sonra başlatıldığı kanıtlanabilen ölçüm ile positive/running/active şartları korunur; gecikmiş aynı-phase ACK karşıtı cihazsız. |

**G25-R5 çözüldü (G25-01).** `matrix.json:109–116,254–268` storage ve ayrı DAV/parola/OAuth
ailelerini gösteriyor; JSON liste hücre override kimliği/nedeni sunuyor
(`matrix.py:215–233`); Sonnet 33 test ve 50×12 liste kanıtı yeniden kullanıldı.
Bu, bütün goal'un veya görsel matrisin kabulü değil.

### Kabul ve kanıt — FIX-R1

| Kabul | Sonuç |
| --- | --- |
| G25-01 | R5 çözüldü; frozen envanter/override/cihazsız liste kanıtı reuse. |
| G25-02 | Açık R3/R4; Desktop ve iOS M13 TR/light/normal PNG hash/boyut kayıtları eşleşti; fixture 8/8 link readback'in ve 16px/native font ölçümlerinin kanıtı reuse. |
| G25-03 | Açık R3; iki normal resume exit 0 ve changed-row karşıtı reuse; eksik build girdileri ve ilgisiz locale davranışı açık. |
| G25-04 | Açık R1/R4; kayıtlı normal/negatif kontroller reuse, yeni probe karşıtları RED. |
| G25-05 | Açık R1/R2; native CLI SIGKILL exit 137→gözetici CLEANED+FAIL ve Simulator before/after eşitliği reuse. Kayıp gözeticide PID sinyali yok; bootstrap ve abnormal completion karşıtları açık. |
| G25-06 | Diff/handoff/kanıt kaydedildi; üst goal için bağımsız kabul yok. |

**Taze:** hash/scope, PNG digest ve log/exit/Simulator durum karşılaştırması;
`fix-r1/reviewer-probes.log` cihazsız hedefli karşıtlar (komut exit 0, gösterilen
invariantlar RED). **Reuse:** 56 test, izole tsc, ESLint, check/Ruby/line kontrolleri,
Desktop prepare/smoke/resume, iOS fixture/smoke/resume/SIGKILL; yeni build/lint/runtime
matrisi tekrarlanmadı. Yeni haricî API araştırması gerekmiyor; onaylı süreç
tasarımı kanıtı reuse. Mevcut modül ayrımı ve kod satırı sınırı korunuyor.
**Açık:** G1-07/G456-07/G24-07, Faz3/F1 fix2, Faz4/FO1, step19, gerçek OS/fiziksel/release.

INITIAL ret=1; FIX-R1 sonrası R1–R4 ailelerinde başarısız FIX=1, R5=0.
G25-R2'nin onaylı gözetici tasarımı değişmiyor; bootstrap ve sonuç yolu mevcut
Opus sohbetinde G25-R1–R4 tek scoped FIX-R2'de giderilir. Bu yaklaşım/invariant
bir kez daha başarısız olursa GPT tasarım değerlendirmesi gerekir. Kutu açık.

## FIX-R2 bağımsız devam review'u — 18.11.2026

**REJECTED → DECISION.** Aynı bağımsız GPT-6.2 Sol (`openai/gpt-6.2-sol`) oturumu
`ses_e114ec1f6ffeyd5nJqucKIgX4g`. Implementer kaydı: Claude Opus 5.5.
Start/review HEAD `508b3f0486a7ce04628ec0c3681d995573e5721d`, staged boş,
16 runner dosyası untracked, FIX-R2 delta 10/16. FIX-R1 kaynak kopyası 16/16
hash eşit; `fix-r2.diff` kopyaya uygulanınca elde edilen 16/16 hash final ve
working tree ile eşit. G25-R5 matrix üçlüsü ve kalan üç dosya değişmedi.

### FIX-R2 engelleyici bulgular

| Bulgu, önem, kabul | Kalan invariant ve somut etki | Karşıt / korunan |
| --- | --- | --- |
| **G25-R1 · yüksek · G25-04/05** | `tools/capture-ui.py:118–147,187–211,216–247`. Public CLI yaşarken `_settle` artık çıkış uyuşmazlığını reddediyor. Ama `_finish` önce durable `CLEANED/PASS` yayımlıyor; normal çıkış onayını yalnız canlı CLI bekleyebiliyor ve eşleşen çıkış için kayıt bırakmıyor. CLI kaybolursa gözeticinin bu yazıdan sonra normal/abnormal çıkışları diskte ayırt edilemez; offline cleanup/reuse `supervisorAbnormal` yokluğunu yeterli sayıyor. | Sonuç diskte → CLI yok → gözetici çıkışı doğrulanamadı: cleanup kanıtı olsa bile sonuç/reuse yeşile dönmemeli. Offline probe mevcut `CLEANED/PASS` kaydının exit-onayı olmadan reuse=0 verdiğini doğruladı; gerçek süreç çökmesi enjekte edilmedi. Normal beklenmiş exit ve FAIL/BLOCKED ayrımı korunur. |
| **G25-R2 · yüksek · G25-05** (R1 cleanup retry'ı da etkileniyor) | `tools/ui-capture/supervision.py:117–144,147–161`, `ios.py::cleanup`, `capture-ui.py::cmd_cleanup`. İlk cleanup kaçan canlı torunu `escaped` olarak kaydediyor ve nonzero; sonraki cleanup yalnız root PID/PGID yokluğuna bakıyor, `escaped` kaydını okumuyor. Kök grup yokken kaydedilmiş torun hâlâ canlı olsa bile `gone` → `CLEANED`; bütün hücreler PASS ise exit 0. Aynı yokluk varsayımı Desktop recovery'de yalnız Chromium PID/grubunu kapsıyor; ayrı Playwright sürücüsünü veya gruptan ayrılıp yeniden ebeveynlenen yardımcıyı doğrulamaz (manifest §Sınırlar). | Kalıcı `escaped=[P]`, root gone, P canlı → her retry pending/nonzero ve sıfır sinyal. Gözetici kayıp + browser yok + ayrı sürücü durumu belirsiz → pending; doğrulanmış normal `browser.close`/driver shutdown korunmalı. Cihazsız probe ilk karşıtı doğrudan public cleanup yolunda exit 0/CLEANED olarak gösterdi. Bootstrap handler/pending ve erken EOF karşıtları, unreaped group ve kayıp gözeticide sinyal yasağı bu turda korunuyor. |
| **G25-R3 · yüksek · G25-03** | `tools/ui-capture/desktop.py:202–205,249–263`, `matrix.json:121–126`, `apps/desktop/src/features/desktop-background/AppearanceSettings.tsx:16–20`. Global hash artık font ve build girdilerini kapsıyor, ama tüm `src` reuse kontrolü yerine kullanılan satır fingerprint'i M/settings ekranında gerçekten çizilen `ui.language` ve `ui.languages.*` anahtarlarını içermiyor. Yalnız görünen `ui.languages.tr` değişince hem fingerprint reuse hem global hash aynı: eski ekran güncelmiş gibi reutilize ediliyor. | Görünen dil adı değişimi recapture/UNKNOWN, ilgisiz anahtar reuse, font stale ve build stamp pozitif yolu korunur. Probe gerçek Settings fingerprint'inde reuse'u doğruladı. iOS tarifinin `_link_all` kapsaması düzeldi; `ios.py`/JS ayrımı ve bu turdaki bir kerelik tarif-migrasyonu rebuild'i makul; bu bulgu yeniden native build gerektirmiyor. |
| **G25-R4 · yüksek · G25-02/04** | `tools/ui-capture/common.py:60–89`. Önceki geçersiz filter byte reddediliyor; fakat CRC'si ve scanline'ı doğru, `IEND` verisi sıfır olmayan geçersiz PNG yine boyut döndürüyor. Driver ve resume ortak doğrulayıcıya dayanıyor; bu bozuk çıktı geçerli artifact sayılabilir. | Geçersiz chunk yapısı → nonzero; iki gerçek sürücü PNG'si ve yanlış filtre/boyut karşıtları korunur. Probe `(1,1)` döndüğünü gösterdi. Metro mutlak deadline ve screenshot sonrası yeni probe token'ı önceki karşıtları kapatıyor; iki farklı probe, screenshot öncesi gecikmiş raporu yeniden geçerli kılmıyor. |

G25-R1–R4, yeni ürün hedefleri değil: aynı dört invariant ailesinin kalan veya
FIX ile açılan yolları. İsteğe bağlı yeni temizlik bulgusu yok. Gözetici
tasarımını otomatik değiştirme veya üçüncü FIX yetkisi yok.

| Kabul | Durum |
| --- | --- |
| G25-01 | Önceki G25-R5 scoped kabulü geçerli; unchanged. |
| G25-02 | Açık R4; iki dar temsilci çıktı/heading/ölçüm, eşleşen PNG hash'leri ve iOS READY 8/8 readback reuse. |
| G25-03 | Açık R3 ve R1 offline finalizasyon; iki normal resume exit 0 reuse. |
| G25-04 | Açık R1/R4; 65 test kayıtlı GREEN; dar kusur probları RED. |
| G25-05 | Açık R1/R2; başarılı native public CLI SIGKILL exit 137 → CLEANED+FAIL ve Simulator listesi eşit reuse. |
| G25-06 | İnceleme ve kanıt kaydı tamam; goal bağımsız kabulü yok. |

**Taze:** kapsam/diff replay/hash, PNG ve kayıt karşılaştırması; cihazsız
`fix-r2/reviewer-probes-followup.log` çalıştı. İlk probe yolu macOS canonical
temp path bağında kesildi; aynı çıktıya başarı yazılmadı. **Reuse:** 65 unittest,
dar lint/typecheck/syntax, iki build/smoke/resume, SIGKILL ve 8/8 linked readback.
FIX-R1 karşıtı 32 testte 3 FAIL + 11 ERROR; API eksikliği ayrı, davranış RED'i
final path problarıyla gösterildi. Yeni build, tarayıcı, Simulator veya tam matris
koşulmadı. **Açık:** Faz3 görsel G1-07/G456-07/G24-07, F1 fix2, FO1 Faz4,
step19 ve gerçek OS/fiziksel/release/signing/storage kapıları.

INITIAL ret=1; G25-R1–R4 aileleri başarısız FIX=2, R5=0. **DECISION**: aynı GPT
sohbetinde durable finalizasyon ve süreç aidiyeti/cleanup state'ini yeniden
değerlendir, R3/R4'ü aynı goal içinde tut. Karar ve gerekiyorsa kapsam onayı
olmadan yeni implementasyon devri yok. Sonraki uygulama olursa AGENTS’in güncel
Sonnet 5.5 ana uygulayıcı yönlendirmesi geçerli; geçmiş Opus kanıtı değiştirilmez.

## FIX-R3 bağımsız devam review'u — 18.11.2026

**REJECTED → DECISION.** Aynı bağımsız GPT-6.2 Sol (`openai/gpt-6.2-sol`),
`ses_e114ec1f6ffeyd5nJqucKIgX4g`; uygulayıcı kaydı Claude Sonnet 5.5.
Başlangıç/review HEAD `508b3f0486a7ce04628ec0c3681d995573e5721d`, staged boş,
16 kaynak untracked, FIX-R3 delta 8/16. FIX-R2 baseline 16/16 ve
`fix-r3.diff` replay sonucu 16/16 hash final/working tree ile eşleşti.
Fixture/tarif, iOS capture entry ve G25-R5 envanter davranışı değişmedi.

### FIX-R3 engelleyici bulgular

| ID · önem · kabul | Kalan invariant ve etki | Dar karşıt / korunacak yol |
| --- | --- | --- |
| **G25-R1 · yüksek · G25-03/04/05** | `tools/capture-ui.py:111–138`: `bool(interrupted)` yalnız `wait()` dönüşünde alınır. Daha sonra, henüz lock alınmadan veya confirmation diske yazılmadan gelen SIGTERM/INT handler'ı listeyi günceller ama `_settle` eski `False` ile onay yazar. Probe gerçek `cmd_run`→`_settle` akışında handler'ı lock öncesi çağırdı: **exit 0, confirmed=true**. Bu, onaydan önce kesinti → CLEANED+FAIL sözleşmesini ihlal eder. | Gözetici 0 → CLI SIGTERM/INT settlement sırasında → 1, onay/reuse yok. Normal eşleşen exit ve lock/nesil karşıtları; offline cleanup/resume'un onay üretememesi korunmalı. |
| **G25-R2 · yüksek · G25-05** | `tools/ui-capture/desktop.py:179–213`, `supervision.py:120–144,147–161`. Normal ayrı driver/browser receipt ve kalıcı `escaped` listesinin retry kontrolü çalışıyor. Ama `start`/`launch` hata verip tek snapshot boş olduğunda `_identify` intent'i `gone` sayıyor; süreç hiç doğmadı ile çocuk/yardımcı gözlenmeden ayrıldı ayırt edilmiyor. Probe `start` hatası + boş gözlemde cleanup hatası **0** buldu. Metro cleanup da **gördüğü** kaçak PID'leri yalnız sinyal/`wait` sonrasında kaydediyor: gözetici o arada kaybolursa retry için kayıt yok. Probe ilk `killpg` çağrısında durable `escaped` alanının boş olduğunu gösterdi; gerçek sinyal gönderilmedi. | Fırlatan launch + kapanış kanıtı yok → pending; yalnız doğrulanmış no-launch/close terminal. Gözlenen kaçak → ilk teardown adımı öncesi diskte → gözetici kaybı → iki retry pending/nonzero ve sıfır sinyal. Pozitif ayrı receipt, bilinen kaçak retry ve Simulator'un bağımsız temizliği korunmalı. |
| **G25-R4 · yüksek · G25-02/04** | `tools/ui-capture/common.py:68–101`: Önceki nonempty IEND ve sıralama karşıtları kapanmış. Ama indexed PNG'de PLTE'nin mevcut olması yeterli sayılıyor ve `if plte` boş palette uzunluk kontrolünü atlıyor. Doğru CRC/scanline ve **sıfır girdili zorunlu palet** ile decoder'ın kullanamayacağı PNG `png_info` üzerinden `(1,1)` alıyor. Aynı ortak doğrulayıcı capture ve resume'u etkiliyor. | Formatın zorunlu içeriği yoksa artifact reddedilir; gerçek Desktop/iOS PNG'leri, önceki chunk/filter karşıtları ve geçerli desteklenen PNG'ler korunur. Deadline ve screenshot sonrası probe yeniden açılmaz. |

**G25-R3 scoped çözüldü.** `matrix.json` Settings satırında `ui.language` ve
`ui.languages` dahil; gerçek locale fingerprint karşıtında görünen etiket
değişikliği recapture, ilgisiz anahtar reuse. Fixture/tarif hash'i ve global
Desktop girdileri değişmedi. G25-R5 scoped kabulü korunur.

| Kabul | Karar ve kanıt |
| --- | --- |
| G25-01 | Önceki G25-R5 scoped kabulü korunur (50/600 kayıtlı liste). |
| G25-02 | Açık R4. İki dar temsilci PNG hash/ölçüm eşit; önceki iOS linked fixture readback reuse. |
| G25-03 | Settings fingerprint karşıtı kabul; R1 onaysız yeniden kullanım riski açık. İki normal confirmed resume reuse. |
| G25-04 | Açık R1/R4; önceki karşıtlar/72 GREEN reuse, yeni deterministik karşıtlar RED. |
| G25-05 | Açık R1/R2; native CLI SIGKILL 137→CLEANED+FAIL, confirmation yok, resume 1 ve Simulator listesi eşit reuse; kesinti pencereleri açık. |
| G25-06 | Bağımsız review kaydı tamam; goal kabulü yok. |

**Taze:** diff replay, hash/PNG/Simulator ve ürün iOS status karşılaştırması,
`fix-r3/reviewer-probes.log` (cihazsız; dört kusur karşıtı). **Reuse:** 72
unittest, check/list, satır sınırı, etkilenmeyen lint/typecheck/Ruby, iki
temsilci+resume, fixture ve native CLI SIGKILL. FIX-R2 RED 6 FAIL + 7 ERROR
(eksik API/kopya hataları ayrı); yeni build veya cihaz koşusu yok.
**Açık:** Faz3 G1-07/G456-07/G24-07, F1 fix2, FO1 Faz4, step19, gerçek
OS/fiziksel/release/signing/storage. Kod, plan ve ürün davranışı değiştirilmedi.

INITIAL ret=1; G25-R1/R2/R4 başarısız FIX=3, G25-R3 bu tur çözüldü
(tarihî başarısız FIX=2), G25-R5=0. Aynı GPT sohbetinde DECISION; dördüncü FIX
devri yok. Özellikle kesinti/commit sınırı ve kaynak kapanış kanıtının sırası
tasarım düzeyinde yeniden ele alınmalı.

## FIX-R4 bağımsız devam review'u — 19.11.2026

**REJECTED → DECISION; G25-R2 açık, G25-R1/R4 scoped çözüldü.** Aynı bağımsız
GPT-6.2 Sol (`openai/gpt-6.2-sol`), OpenCode `ses_e114ec1f6ffeyd5nJqucKIgX4g`.
Uygulama Sonnet 5.5. Başlangıç/review HEAD `508b3f0486a7ce04628ec0c3681d995573e5721d`,
staged boş, runner 16 untracked. FIX-R3 baseline kopyası ve güncel final
16/16 hash eşleşti; 7/16 değişti (`capture-ui.py`, `common.py`, `desktop.py`,
`ios.py`, `supervision.py`, iki test modülü). Son fixture düzeltmesi test
selection'ı; fixture tarifi ve ürün kaynakları bu turda değişmedi.

### FIX-R4 engelleyici bulgu

**G25-R2 — cleanup sahipliği / write-ahead, yüksek, G25-05.**
[`supervision.py:148–159`](../../../../tools/ui-capture/supervision.py#L148)
kaçak gözlemini kaydetme hatasında önceki değeri geri koyuyor;
[`supervision.py:173–178,201–218`](../../../../tools/ui-capture/supervision.py#L173)
ilk teardown'ı durduruyor ama kayıp gözlemi sonraki retry'a taşımıyor.
`ios.py:313–314` ve `capture-ui.py:216–239` üzerinden gerçek cleanup/recovery
çağrılarına cihazsız karşıt:

- Kayıt yazımı geçici hata → sinyal yok → sonraki finalization yazımı başarılı
  ve `RESTORE_PENDING/CLEANUP_FAILED`. Önceki `escaped` alanı yoksa diske
  `null` yazılıyor; retry listede gezinirken `TypeError` ile duruyor.
- Eski kaçak kaydı `[199]` varsa yeni gözlenen `200` kayboluyor. Kök grup ve
  `199` artık yok, `200` hâlâ canlı → `cleanup --run` yanlışlıkla `CLEANED + FAIL`
  (exit 1) yazıyor. Bu bir PASS ya da yabancı sürece sinyal değil; kanıtlanamayan
  canlı süreç varken **pending/exit 3** korunmuyor.

Dar karşıt: ilk veya ek kaçak gözlemi → write-ahead yazımı başarısız → ilk
denemede sıfır sinyal → depolama geri gelir ve kök kaybolur → iki retry
structured `RESTORE_PENDING`/3 ve sıfır sinyal. Yazım başarılıyken ilk sinyal
öncesi kayıt, kayıp gözeticide sinyal yasağı, Desktop belirsiz launch, ayrı
receipt ve Simulator'un bağımsız cleanup'ı korunmalı. Mevcut 68 test ilk
yazım hatasını ve *başarılı* yazım sonrası retry'ı ayrı kapsıyor; birleşik
geçişi kapsamıyor. Bu, önceki G25-R2 invariantının kalan yolu, yeni goal değil.

### Kabul ve kanıt — FIX-R4

| Kabul | Durum |
| --- | --- |
| G25-01 | G25-R5 scoped kabulü korunur; envanter byte-aynı. |
| G25-02 | G25-R4 scoped çözüldü: boş PLTE reddedildi, geçerli paletli PNG ve iki temsilci PNG/ölçüm kaydı doğrulandı; iOS fixture reuse. |
| G25-03 | G25-R3 önceki scoped kabulü korunur; normal confirmed Desktop/iOS resume kayıtları exit 0. Onaysız offline reuse yolu kapalı. |
| G25-04 | G25-R1 scoped çözüldü: gerçek sinyalli pre-lock/locked/post-decision, write-fail ve atomic-write/SIGKILL karşıtları reuse; ayrıca iki pending sinyal taze doğrulandı. G25-R4 boş/geçerli palet karşıtı taze. |
| G25-05 | Açık G25-R2; normal Desktop ayrı driver/Chromium receipt ve iOS Metro/SIM cleanup reuse; geçici write hatası → retry geçişi başarısız. |
| G25-06 | Bağımsız review kaydı tamam; goal kabul edilmedi. |

**Taze:** baseline/final hash, PNG hash, Simulator ve ürün iOS status
karşılaştırması; `fix-r4/reviewer-confirmation-and-png.log` iki bekleyen gerçek
sinyal ve palet karşıtları; `fix-r4/reviewer-retry.log` iki write-failure/retry
karşıtı (ilk probe traceback'i `reviewer-probes.log`). **Reuse:** 68/68
`unittest-final`, önceki etkilenmeyen lint/typecheck, iki 19.11 smoke/resume,
FIX-R2 fixture ve FIX-R3 native SIGKILL (tarihî; FIX-R4 cihazsız SIGKILL ayrı).
Build/suite/cihaz tekrarı yok. **Açık:** Faz3 görsel/F1, Faz4 FO1, step19,
gerçek OS/fiziksel/release; 2.5 kutusu açık.

INITIAL ret=1; G25-R2 başarısız FIX=4; R1/R4 scoped çözüldü (tarihî 3'er),
R3=2 tarihî, R5=0. Sonraki adım aynı GPT sohbetinde yalnız G25-R2 DECISION:
başarısız gözlem yazımından sonraki durable belirsizlik/iyileşme geçişini
netleştir. Otomatik FIX-R5 devri yok.

## FIX-R5 bağımsız devam review'u — 19.11.2026

**ACCEPTED — G25-R2/G25-05 kapandı; birikimli D25-M runner geliştirme goal'u
kabul edildi.** Bu, Faz3 görsel/ürün/fiziksel kabulü değildir.
Reviewer GPT-6.2 Sol (`openai/gpt-6.2-sol`), OpenCode `ses_e114ec1f6ffeyd5nJqucKIgX4g`;
uygulamadan ayrı, önceki turlarla aynı GPT sohbeti. Implementer devri Sonnet 5.5.

Başlangıç/review HEAD `508b3f0486a7ce04628ec0c3681d995573e5721d`, staged boş;
`fix-r5/source-final.sha256` 17/17. FIX-R4 final hash setine göre yalnız
`supervision.py`, `test_supervision.py` değişti; onaylı `test_recovery.py` eklendi.
Diğer 14 kaynak byte-aynı. FIX-R4 tam final kaynak kopyası yok: RED kayıtları
R4 davranışlı varyant, orijinal final üzerinde birebir sinyal değildir. Önceki
bağımsız R4 karşıt logu gerçek eski davranışı; hash setleri mevcut sınırı
kanıtlıyor. Etkilenen runtime ve test yolları doğrudan incelendi.

### G25-R2 kapanışı

- `supervision.py:148–157,160–178`: gözlenen birleşik liste yazım hatasında
  RAM'de kalır; eşit liste yeniden kaydedilir, başarılı yazım olmadan sinyal/
  wait/reap yok. Ownerless nonterminal kayıt `unverified`/pending; disk eski
  veya `escaped:null` olsa da PID/grup yokluğu terminal kanıt yapılmaz.
- `ios.py:297–328` → `capture-ui.py:216–239,260–265`: geçici yazım hatası ve
  final kayıt olmadan gözetici kaybı → iki cleanup ve resume exit `3`, sıfır
  sinyal. Taze `fix-r5/logs/reviewer-ios-retry.log` gerçek CLI komut
  fonksiyonlarıyla (OS uçları mock) absent/null/eski kaçak kaydı varyantlarında
  aynı sonucu gösterdi. Bağımsız aidiyetli Simulator için shutdown/delete
  devam etti, bütün run `RESTORE_PENDING` kaldı.
- `desktop.py:254–272` driver-managed receipt dalı değişmedi. Canlı unreaped
  Metro ve kalıcı terminal kayıt normal yolu korunur. Recovery test ayrımı ve
  satır sınırı uygun; yeni runtime/dependency yok. Yeni engelleyici bulgu yok.

| Kabul | Birikimli karar |
| --- | --- |
| G25-01 | G25-R5 scoped kabulü reuse; envanter değişmedi. |
| G25-02 | R4 iki dar temsilci PNG/ölçümü ve palette karşıtı reuse; iOS fixture readback reuse. |
| G25-03 | Çizilen locale fingerprint'i, confirmed Desktop/iOS resume reuse; yeni ownerless resume negatif karşıtı doğrulandı. |
| G25-04 | R4 karar noktası/sinyal, yanlış PNG/ölçüm ve deadline/probe kanıtı reuse; yeni yazım hatasında nonzero. |
| G25-05 | Onaylı FIX-R5 daraltması ve cihazsız 71/71; taze iOS production cleanup/retry karşıtı; önceki temsilci normal cleanup reuse. |
| G25-06 | Gerçek hash-delta, kabul→kanıt zinciri ve ayrı bağımsız review tamam; açık kapılar korunuyor. |

**Taze:** 17/17 hash ve gerçek kapsam, cihazsız iOS retry karşıtı (3 varyant).
**Reuse:** 71/71 Python exit 0; FIX-R4 Desktop/iOS smoke ve resume, fixture,
etkilenmeyen lint/typecheck/build/PNG ve önceki dar native SIGKILL kanıtı.
Yeni cihaz/native build/smoke/matris NOT_RUN. **Açık:** Faz3 tam regresyon ve
G1-07/G456-07/G24-07 görselleri, F1 fix2; FO1 Faz4; step19, OS/fiziksel/
signing/storage/release. INITIAL ret=1; R2 tarihî başarısız FIX=4 (FIX-R5
kabulü sayacı silmez), R1/R4=3, R3=2, R5=0.
