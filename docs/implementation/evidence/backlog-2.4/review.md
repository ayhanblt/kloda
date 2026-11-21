# 2.4 / D24 — INITIAL GPT review, 18.11.2026

**Güncel: FIX-R1b ACCEPTED — 2.4 geliştirme goal'u kapandı.**
G24-R1 RESOLVED; [son kabul kaydı](#fix-r1b-devam-reviewu-ve-kapanış--18112026).
Aşağıdaki INITIAL/FIX-R1 kayıtları tarihîdir; ilk review yeniden başlatılmadı.

## Karar / reviewer / gerçek kapsam

**REJECTED / FIX — goal kapanmadı; 2.4 checkbox açık.**
G24-05 karşılanmıyor (G24-R1); G24-07 görsel kanıtı ayrıca BLOCKED / NOT_RUN.
Scoped düzeltme üst ürünün veya F1'in kabulü değildir.

Reviewer: **GPT-6.1 Sol, `openai/gpt-6.1-sol`**, bu ayrı GPT review sohbeti.
Bu sohbet ürün uygulaması yapmadı; yalnız review kanıtı ve durum kayıtları yazdı.
Reviewer session ID araç bağlamında verilmedi (**UNKNOWN**); uygulayıcının ana
Opus session ID'si de manifestte yok, uydurulmadı. Devir ayrı Opus uygulama
sohbetinden INITIAL review olarak alındı; bu kayıt bir kabul kararı vermiyor.
Kabul kararı/subagent kod review'u devredilmedi. Dış API araştırması gerekmedi.

Start ve review HEAD: `508b3f0486a7ce04628ec0c3681d995573e5721d`.
Staged boş. Önceden dirty ağaç `baseline/status.txt` ile ayrıldı.
Gerçek 2.4 kapsamı: **15 mevcut code dosyası + 7 yeni code/spec + 6 locale**;
`code-2.4-delta.diff`, `locale-2.4-delta.diff`, `changed-code-files.txt`.
İlgisiz F1/2.2/2.3/süreç değişiklikleri ürün diff'ine katılmadı.
29/29 başlangıç hash'i, 22/22 final code, 6/6 locale eşit.
Strict hunk replay baseline→güncel 28/28 dosyayı birebir üretti:
`review-audit.txt`. İlk difflib metinsel karşılaştırmasındaki dört fark hunk
hizalaması farkıydı; gerçek kapsam belirsizliği değil.

Tek sözleşme: `docs/implementation/plans/next-plan.md` §2.4, D24/G24-01–07;
özellikle satır 802–830 invariant/tablosu. Yeni goal veya kabul şartı eklenmedi.

## Bulgular

### G24-R1 — P2 / ENGELLEYİCİ — Desktop geç sonuç, ayrılmış UI'ya ait sayılıyor

- **Kabul:** G24-05; invariant ailesi **stale ownership / presentation lifecycle**.
  INITIAL'da yeni tespit; önceki FIX'ten kalan bulgu değil.
  Yeni diagnostic bu açığı görünür bir regresyona dönüştürüyor; geç başarı
  fence'inin eksikliği başlangıç bileşeninde de vardı. İkisi aynı mevcut
  sözleşme/invariant altında, ayrı goal veya iki başarısız FIX sayılmaz.
- **Yer:** `apps/desktop/src/pages/backup/BackupSetup.tsx:92–106,158`.
  Sürüm kontrolü yalnız edit/yeni testte değişen `storageVersion`'a bakıyor.
  Back handler sadece mevcut diagnostic'i siliyor, sürümü geçersizleştirmiyor.
  `:22–27` görünürlük effect'i de test ownership/diagnostic'i kapatmıyor.
  Gerçek çağıran `apps/desktop/src/app/App.tsx:63,81` bileşeni unmount etmeyip
  `hidden` ve `visible=false` ile saklıyor.
- **Başlangıç → olay → beklenen:** A testi IPC cevabını bekliyor → storage'dan
  Back veya başka rotaya çıkış → A failure/success geç geliyor → geri açılış.
  A'nın ayrıntısı/başarısı ayrılmış sunuma uygulanmamalı. Şu an failure,
  Sources ekranında bile yeni diagnostic render ediyor; hide/reopen eski
  ayrıntıyı getiriyor. Geç success geri dönülen formda Start düğmesini açıyor.
  Ürün etkisi yanlış güncel-test bilgisi; yeni native yetki/secret sızıntısı
  kanıtlanmış değil.
- **Taze kanıt:** `review-probe.spec.tsx`, `review-probe.log`: **3/3 RED**,
  gerçek `BackupSetup` mounted; hatalar tam beklenen state assertion'ında,
  test altyapısı/compile hatası değil. Mevcut GREEN
  `BackupSetup.spec.tsx:45–61` yalnız edit/stale karşıtını kapsıyor;
  bırakma/gizleme yollarını kanıtlamıyor.
- **Mevcut Opus sohbetine scoped FIX:** kök nedeni bu olay sırasıyla doğrula;
  mevcut production component spec'ine Back→late failure/success ve
  retained visible=false→late reply→reopen regression'ını taşı.
  Sunum sahipliğini leave/visibility kaybı/unmount sınırlarında geçersizleştir,
  gösterilmiş diagnostic'i de ayrılınca temizle. Yalnız renderer state/version
  minimum çözümü; runtime testini/retained receiver'ı kapatma, IPC/native ABI,
  profil, retry/deadline/journal veya pairing foreground fence'i değiştirme.
  Edit/yeni test/fresh success ve malformed/secret fallback yollarını koru.
  Normal scoped FIX için yeni ürün planı/onayı gerekmiyor.

### G24-V1 — AÇIK KABUL KAPISI — G24-07 görsel karşılaştırma yok

- Invariant ailesi **visual evidence / truthful acceptance**; INITIAL devirde
  zaten açık, yeni ürün hatası veya başarısız FIX değil.
- Yer: `docs/implementation/plans/next-plan.md:856–862`;
  `MANIFEST.md` §Open gates. Yeni form/pairing metinlerinin üç dil,
  light/dark/büyük yazı scripted karşılaştırması **NOT_RUN**.
  Render/a11y GREEN gerçek yerleşim/taşma kanıtı yerine geçmez.
- Hazır izole yol yok; 2.5 altyapısı burada yazılmayacak. G1/G456 ertelemesi
  G24'e uygulanmadı. Bu kapının erteleme/kapsam kararı **aynı GPT sohbetinde
  kullanıcıya ait**; karar veya gerekli kanıt olmadan goal kapanmaz.
  G24-R1 scoped FIX'i bu kararı beklemeden mevcut yetki içinde yapılabilir.

**İsteğe bağlı temizlik:** ayrı öneri yok; blocker olmayan stil refactor'ı
veya süreç şartı eklenmedi.

## Kabul tablosu denetimi

| ID | Kontrol edilen kanıt / kaynak | Review sonucu |
|---|---|---|
| G24-01 | Mobil repair idle/in-flight TR/EN/DE, Desktop repair ve mevcut pending/complete/stale testleri; locale anlamı + PairingModal diff'i | REUSE; yeni engel yok. Phone→PC sırası, trust≠file grant; native eylem eklenmemiş. |
| G24-02 | App ve BackupSetup hints/a11y, unsafe input testleri; uygulama kanıtında eksik exact portlu ilk URL için `review-endpoint.spec.tsx` iki gerçek validator/probe→mock fetch assertion'ı | **Taze 2/2 GREEN**; ilk URL iki app'te `https://fixture.example:8083/webdav/Kloda/`, yalnız PROPFIND. Gerçek sunucu yok. |
| G24-03 | `g24-03-red.log` assertion RED→`g24-03-green.log` 28/28; final mobile API 37/37; settings/probe source | REUSE; eski tuple/testedAt, mutation yokluğu ve güvenli propfind HTTP/transport ayrımı uygun. |
| G24-04 | Final mobile API 37/37; Desktop probe/projection 77/77, final full 369/369; altı aşama/iki DELETE/readback/transport kaynak denetimi | REUSE; cleanup önceliği, eski classification ve belirsizlik korunmuş. |
| G24-05 | App edit/stale/background, settings reopen/warning, BackupSetup edit; gerçek retained caller ve reviewer leave/hide/success regression | **FAIL — G24-R1.** Mobil warning/profil korunumu uygun; Desktop leave/hidden kanıtı RED. |
| G24-06 | WeakMap/projection/parser unit + catch→render sentinel + malformed/void karşıtları; trusted sender→helper ve retry/storage caller taraması | REUSE; yeni engel yok. Allowlist alanları, ham Error/cause IPC'ye gitmiyor; normal upload policy değişmiyor. |
| G24-07 | Locale parity, activity error/OS state render, hints/a11y, scoped lint/typecheck/build kayıtları | **KISMİ — G24-V1.** Visual NOT_RUN. Renderer tsc baseline da exit2; genel tsc PASS değil. |

## Etkilenen yollar / standartlar

- Mobil `webdav.ts` request/readback sınırında metadata üretimi; settings'te
  beforeMutation intent, testedAt/tuple/warning ve disable/write/check sırası
  değişmemiş. App navigate `leaveStorage()` çağırıyor; hook background/unmount
  abort/version fence'i korunmuş. Kalıcı şemaya metadata eklenmemiş.
- Desktop verifyWriteAccess→cleanupProbe hata önceliği korunuyor; atStage yalnız
  presentation eki. testConnection failureCode→retry/persist ve runtime
  storageGeneration fence'i HEAD ile aynı. Normal upload request/finalize/
  inspect ve journal davranışına yeni politika eklenmemiş.
- `main.ts` helper mevcut trusted-sender `handle`'ın içinde; preload ve runtime
  `Promise<void>` ABI aynı. Renderer unknown parser başarıyı yalnız `ok===true`
  kabul ediyor, diagnostic alanlarını tekrar kuruyor.
- ADR0016 trust/file authority ayrımı ve ADR0018 retained native receipt sınırı
  korunmuş. Bu bulgu receiver close-on-blur gerekçesi değildir.
- FSD/sorumluluk ayrımı: UI model, probe, safe projection ve parser ayrı;
  yeni dependency/global stil/inline style yok. Metinler altı locale'de;
  Tailwind/NativeWind/Lucide yolu korunmuş. 22 dosya scoped ESLint reuse;
  300-line kuralı için yeni istisna yok.

## Taze / reuse / NOT_RUN

**Taze reviewer:**
- `node_modules/.bin/vitest run --config docs/implementation/evidence/backlog-2.4/review-probe.config.ts`
  (ilk config yalnız lifecycle spec içeriyordu): 3/3 **RED**, exit1,
  `review-probe.log`. FIX başarısız denemesi değil, INITIAL davranış kanıtı.
- Aynı config ile yalnız `docs/implementation/evidence/backlog-2.4/review-endpoint.spec.tsx`:
  2/2 GREEN, exit0, `review-endpoint.log`. Lifecycle sonuçları tekrar koşulmadı.
- Başlangıç/final hash + exact diff replay/caller audit: `review-audit.txt`.
- Çözülmemiş renderer tsc teşhisinin başlangıç karşıtı:
  approved temp dizinde current renderer kopyası, baseline mevcut dosyalarıyla
  overlay; üç yeni renderer dosyası snapshot'tan çıkarıldı. Aynı
  `tsc --noEmit -p <snapshot>/apps/desktop/tsconfig.json`: exit2,
  **yalnız aynı TS2882** (`entry.tsx:6`, `PairingPage.tsx:9`).
  `review-renderer-baseline.log` tam komut hedefini/snapshot'ı kaydeder.
  tsconfig/vite config HEAD-EQUAL. Bu artık salt “presumed” değil,
  başlangıçta da kanıtlı açık; kapsam dışı CSS düzeltmesi istenmiyor.

**Uygulama kanıtından REUSE (tekrar koşulmadı):**
mobile final 6 suite/84 test; API 37/37; desktop final 34 file/369 test,
probe 77/77 ve renderer 44/44; mobile/main tsc exit0, scoped lint exit0,
Vite + iOS/Android export exit0; list/null-aware locale parity.
Log yolları manifest §Acceptance/Static checks. Ara mobile App failure log'u
superseded; GREEN yerine kullanılmadı. Başarılı boş tsc/lint loglarının
exit durumu implementer manifestinden alınmıştır, reviewer tekrar PASS'i değil.

**Reviewer NOT_RUN:** tam suite, native/OS/fiziksel/gerçek WebDAV, görsel capture,
tam lint/build/export tekrarları. Renderer tsc mevcut ve baseline exit2:
tam renderer typecheck PASS iddiası yok.

## Durum / sayaç / devam

INITIAL ret=**1**; başarısız FIX=**0**.
Stale ownership: ilk INITIAL bulgu, failed FIX 0; visual gate: failed FIX yok.
Yeni oturum veya yeni finding ID sayaç sıfırlamaz.
F1 fix2/G1/G456 Faz3, FO1 Faz4, step19, production/provider/signing/storage
ve fiziksel kapılar korunur. 2.4 üst iş kabul edilmedi.

Tek sonraki uygulama: **mevcut Opus sohbetinde G24-R1 scoped FIX**.
Sonucu bu GPT review sohbetinde, yeni FIX diff/manifest üzerinden değerlendir;
ilk review'u/başarılı kontrolleri baştan başlatma. G24-07 kararını aynı GPT
sohbetinde kaydet; sıradaki 2.5 işini başlatma. Commit/push yok.

## FIX-R1 devam reviewu — 18.11.2026

### Karar / kapsam / kanıt

**REJECTED / FIX — G24-R1 kısmen düzeldi; G24-05 karşılanmıyor, checkbox açık.**
Aynı GPT-6.1 Sol (`openai/gpt-6.1-sol`) review sohbeti; session ID UNKNOWN.
Ürün kodu değiştirilmedi, kabul delegasyonu/dış API araştırması yok.
INITIAL'ın geçerli sonuçları korundu; yeni goal veya kabul şartı eklenmedi.

HEAD `508b3f0486a7ce04628ec0c3681d995573e5721d`; staged boş.
`fix-r1.diff` yalnız `BackupSetup.tsx` (tracked M) ve
`BackupSetup.spec.tsx` (INITIAL'dan beri untracked ??).
Exact reverse hunk replay iki pre-FIX dosyasını INITIAL final hash'ine
döndürdü; 2/2 FIX final, etkilenmeyen 20/20 code ve 6/6 locale hash eşit:
`review-fix-r1-audit.txt`. Birikmiş alakasız diff yeniden review edilmedi.

**REUSE:** `logs/g24-r1-red.log` 5 state assertion RED →
`logs/g24-r1-green.log` 12/12 GREEN; eski reviewer probe 3/3 GREEN
(`logs/g24-r1-reviewer-probe-green.log`); desktop 374/374,
scoped ESLint ve Vite build exit0. Renderer tsc aynı kanıtlı baseline
iki TS2882 ile exit2; genel tsc PASS değil. Mobil/main/IPC/parser/locale
INITIAL kanıtı etkilenmedi. Başarılı kontroller tekrar koşulmadı.

Back ve visible=false/unmount için sürüm invalidation kaynakta doğru;
edit/yeni test/fresh success ve güvenli fallback'ler aynı. Native receiver,
runtime test/retry/persistence/IPC/ACL değişmemiş. FSD/Tailwind/çeviri/
300-line sınırında yeni sapma yok.

### Bulgular

**G24-R1 — P2 / ENGELLEYİCİ / G24-05 — stale ownership; önceki
bulgudan kalan komşu yol, yeni bağımsız hata/goal değil.**

- Yer: `apps/desktop/src/pages/backup/BackupSetup.tsx:22–27,34–37,103–108`.
  Release yalnız Back/visible=false/unmount'ta çalışıyor. Gerçek çağıran
  `apps/desktop/src/app/App.tsx:63,81` hem backup hem jobs rotasında
  `visible=true` tutuyor; jobs'a geçiş yalnız `showActivity`'yi değiştiriyor.
  Activity effect'i formdan çıkarıyor ama test sahipliğini bitirmiyor.
- **Olay:** storage A testi bekliyor → jobs (`showActivity=true`, visible
  hâlâ true) → A failure/success → backup (`showActivity=false`) → Sources/
  formu yeniden aç. Failure Sources'a eski diagnostic'i getiriyor; success
  Start'ı etkinleştiriyor. Aynı “ayrılmış UI'ya late diagnostic/başarı
  taşınmaz” G24-05 beklentisi. Native yetki ihlali/sır sızıntısı iddiası yok.
- **Taze kanıt:** `review-fix-r1-neighbor.spec.tsx`,
  `review-fix-r1-neighbor.log`: **2/2 RED**, exit1; hatalar gerçek state
  assertion'ında. Yalnız önceki kanıtın kapsamadığı showActivity geçişi
  çalıştırıldı; başarılı Back/hide testleri yeniden koşulmadı.
- **Scoped FIX / mevcut Opus:** bu yolu production spec'te regression'a
  bağla; mevcut `releaseStorageTest` mekanizmasını showActivity ile
  storage'dan ayrılmayı da kapsayan minimum renderer çözümüyle tamamla.
  Gösterilmiş diagnostic de aynı geçişte temizlensin; fresh test yeniden
  çalışabilsin. Back/hide/edit/unmount fence'lerini, form değerlerini ve
  mevcut genel mesaj davranışını koru. Runtime testi/retained receiver,
  retry/deadline/profil/journal/IPC/native ABI ve pairing fence'i değişmesin.
  Yeni plan/onay gerekmiyor; tasarım belirsizliği tespit edilmedi.

İsteğe bağlı temizlik yok. Önceki GREEN örnekler korunur; bütün leave
yollarının/goal'un kabulü değildir.
**Sayaç:** INITIAL ret=1; stale ownership failed FIX=**1** (FIX-R1).
İki RED örnek iki deneme değildir. Aynı invariant ikinci FIX'te de
reddedilirse otomatik üçüncü FIX değil, aynı GPT sohbetinde tasarım
değerlendirmesi gerekir.

### G24-07 kullanıcı kararı / devam

Kullanıcı bu aynı sohbet içinde açıkça **“Faz3’e ertele”** seçti.
Yeni form/pairing metinlerinin TR/EN/DE, light/dark, büyük yazı dar
scripted görsel karşılaştırması 2.5 capture hazırlığı sonrası
**Faz3 DEFERRED / NOT_RUN**. Yalnız D24 görsel kapanış kapısı bu kararla
supersede edilir; **G24-V1 artık geliştirme kapanış engeli değildir**.
Görsel PASS veya ürün/fiziksel kabulü değildir; G24-R1/G24-05 engeli devam eder.
G24-01–04/06'nın önceki kabul eşlemesi, G24-07 render/a11y/lint/build reuse
ve renderer tsc baseline sınırlaması değişmedi.

**FIX / checkbox açık.** Tek sonraki uygulama mevcut Opus sohbetinde
G24-R1 kalan showActivity yolu; yeni diff/kanıt aynı GPT sohbetinde
değerlendirilir. Üst F1/Faz3–4/step19/release/fiziksel kapılar korunur.
Sıradaki bağımsız iş başlatılmadı; commit/push yok.

## FIX-R1b devam reviewu ve kapanış — 18.11.2026

### Karar / bağımsızlık / kapsam

**ACCEPTED — yalnız 2.4/D24 geliştirme goal'u. G24-R1 RESOLVED.**
G24-01–06 ve G24-07 render/a11y karşılandı; görsel parça kullanıcının
bu sohbetteki kararıyla Faz3 **DEFERRED / NOT_RUN**. Üst ürün/F1,
görsel, gerçek OS/native/fiziksel veya release PASS'i değildir.

Reviewer yine **GPT-6.1 Sol (`openai/gpt-6.1-sol`)**, aynı bağımsız GPT
review sohbeti; bu sohbet ürün uygulaması yapmadı. Reviewer ve ana Opus
session UUID'leri UNKNOWN; uydurulmadı. Kod review'u/kabul devredilmedi.
İlk review ve başarılı kontroller baştan başlatılmadı; dış API araştırması
ve yeni runtime/test/build koşusu gerekmedi.

HEAD `508b3f0486a7ce04628ec0c3681d995573e5721d`; staged boş.
`fix-r1b.diff`: yalnız tracked `BackupSetup.tsx` ve INITIAL'dan beri
untracked `BackupSetup.spec.tsx`. 2/2 final hash doğrulandı; exact reverse
hunk replay 2/2 dosyayı FIX-R1 hash'ine döndürdü. INITIAL→FIX-R1 zinciri
önceki audit'ten reuse; kalan code 20/20, locale 6/6 değişmemiş.
Kanıt: `review-fix-r1b-audit.txt`, gerçek ağaç durumu
`review-fix-r1b-status.txt`. İlgisiz dirty işler kapsama alınmadı.

### G24-R1 / stale ownership sonucu ve etkilenen yollar

`BackupSetup.tsx:36–42` tek `visible && step==='storage'` sınırını
izliyor. Storage sunumu sona erdiğinde layout effect sürümü artırıp
diagnostic'i temizliyor; unmount sürümü de geçersizleştiriyor.
Back (`:167`), showActivity→activity (`:22–27`), start→activity (`:119–122`)
ve hide aynı sınırdan geçiyor. Önceki enumerated-trigger açığı kalmamış.
Geç saveStorage/testStorage resolve veya reject mevcut sürüm kontrollerini
(`:107–115`) geçemiyor. Edit/yeni test, fresh başarı/teşhis, form değerleri,
genel hata fallback'leri ve activity progress sahipliği korunmuş.

`BackupSetup.spec.tsx:162–191` jobs→backup late failure/success, gösterilmiş
diagnostic'in temizlenmesi, portlu form değerlerinin korunması ve fresh test
kanıtını ekliyor. Önceki Back/hide ve secret/malformed kontrolleri aynı suite'te.
Runtime/ABI/retry dosyaları HEAD-EQUAL; receiver ömrü, native/ACL/pairing
fence'i, kalıcı profil/cleanup/retry algoritması değişmemiş.
FSD/Tailwind/çeviri/300-line standartlarında yeni sapma yok.
**Engelleyici veya isteğe bağlı yeni bulgu yok.**

### Kabul/evidence eşlemesi — önceki review'un devamı

| ID | Kapanış kanıtı |
|---|---|
| G24-01 | INITIAL pairing/locale/source denetimi REUSE; FIX bu yolu değiştirmedi. |
| G24-02 | INITIAL form hint/a11y + reviewer exact port/path 2/2 GREEN REUSE; form değerleri FIX-R1b regression'ında da korunuyor. |
| G24-03 | INITIAL PROPFIND RED→GREEN ve mobile API/tuple/mutation kanıtı REUSE. |
| G24-04 | INITIAL stage/HTTP/transport/readback/iki DELETE ve cleanup/classification kanıtı REUSE. |
| G24-05 | G24-R1 RESOLVED: FIX-R1b RED3→GREEN15, beş reviewer probe GREEN; mobile stale/warning/reopen kanıtı REUSE. |
| G24-06 | INITIAL allowlist/IPC/parser/catch sentinel ve FIX final malformed/fallback suite'i REUSE; politikalar değişmedi. |
| G24-07 | Önceki render/a11y/locale/lint/build kanıtı + FIX renderer kontrolü REUSE. Visual kullanıcı onayıyla Faz3 DEFERRED / NOT_RUN; PASS değil. |

**FIX uygulama kanıtından REUSE:** `logs/g24-r1-fix2-red.log` 3 assertion RED →
`g24-r1-fix2-green.log` 15/15 GREEN; `g24-r1-fix2-reviewer-probes.log`
iki dosya/5 GREEN; `g24-r1-fix2-desktop-full-vitest.log` 34 dosya/377 GREEN;
`g24-r1-fix2-eslint.log` exit0 ve `g24-r1-fix2-vite-build.log` exit0.
Bu koşular implementer tarafından yapılmıştır, taze reviewer runtime PASS'i değildir.
Mobile/main tsc/export ve locale kanıtları önceki kaynaklarında reuse.

Renderer tsc `g24-r1-fix2-tsc-desktop-renderer.log` exit2; teşhisler önceki
kanıtlı başlangıç karşıtıyla aynı iki CSS TS2882 (`entry.tsx:6`,
`PairingPage.tsx:9`). Yeni diff teşhisi yok; tam renderer tsc PASS
sayılmadı, kapsam dışı genel typecheck açığı korunuyor.
**Taze reviewer:** hash/reverse-diff/caller/source denetimi.
**Reviewer NOT_RUN:** test/build/lint/export tekrarı, görsel/OS/fiziksel.

### Sayaç / açık kapılar / tek sonraki iş

INITIAL ret=1; stale ownership failed FIX=1 (FIX-R1), FIX-R1b kabul edildi;
tarihî sayaç sıfırlanmadı, ikinci başarısız FIX oluşmadı.
G24-V1 visual Faz3 ve 2.5 capture hazırlığı açık; F1 fix2/G1/G456 Faz3,
FO1 Faz4, step19, signing/provider/storage/production/fiziksel kapıları
korunur. Bu kabul kalan genel renderer CSS typecheck hatalarını çözmez.

CURRENT ve bu manifest aynı reviewer sohbetinde kapatıldı; ek Opus kayıt
oturumu gerekmez. **Tek sonraki bağımsız iş: yeni GPT plan sohbetinde 2.5.**
Hazır prompt CURRENT'ta; bu review'da plan/uygulama başlatılmadı.
Ürün kodu değişikliği ve commit/push yok.
