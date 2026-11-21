# 2.2/G2–G3 — Desktop tray/sürüm/kapanış — uygulama manifesti

Sözleşme (tek kaynak, kopyalanmadı): `plans/next-plan.md` §2.2/G2–G3 (D-G23, G23-01–08).
Durum: **REVIEW / ACCEPTED — INITIAL + FIX-R1 bağımsız GPT kabulü (18.11.2026).**
G23-R1 RESOLVED; G23-01–08 karşılandı, 2.2 geliştirme goal'u kapandı.
[Son review](review.md#fix-r1-bağımsız-devam-reviewu--18112026). Gerçek OS/release/Faz3–4 kapıları açık. Commit/push yok.
Rol: Opus uygulama (18.11.2026). Self-review bağımsız kabul değildir.

## Başlangıç / diff kapsamı

- Start HEAD `508b3f0486a7ce04628ec0c3681d995573e5721d`; staged başlangıç ve final boş
  (`baseline/staged.txt`, `staged-final.txt`).
- Başlangıç dirty/untracked: `baseline/status.txt` (12 satır; 1.5/F1/Windows devir belgeleri,
  next-plan, 2.2 araştırma eki). Ürün yollarında başlangıç diff'i yoktu.
  CURRENT başlangıç kopyası `baseline/CURRENT.start.md` + `baseline/CURRENT.start-vs-HEAD.diff`.
  Başlangıç kaynak hash'leri `baseline/source-start.sha256` (hedef + korunan komşular).
- Oturum sırasında kullanıcı tarafından değişen, **bu işe ait olmayan** yollar: `AGENTS.md`,
  `.opencode/commands/{implement,plan,review}.md`, `docs/implementation/research-pilot.md`,
  `evidence/research-routing-2026-11-18.md`. Dokunulmadı.
- Bu işin ürün diff'i (10 tracked + 1 untracked; hepsi §Hedef tablosunda):
  tracked `product-tracked.diff`; untracked `DesktopTray.tsx` → `product-untracked-DesktopTray.diff`.
  Final hash'ler `source-final.sha256`. Satırlar `lines-final.txt` (en büyük background.spec 207 kod satırı; hepsi ≤300).
- Korunan komşular HEAD'e eşit: `electron/main.ts`, `preload.cts`, `runtime/pairing.ts`,
  `src/app/global.css`, `shared/ui/Brand.tsx` (`neighbors-final.sha256`). Native/journal/autostart değişmedi.
- Bu işin kanıt dizini: bu dizinin tamamı (untracked).

## Uygulanan çözüm (D-G23 sınırında)

- `DesktopTray.tsx` (yeni, saf sunum): `trayState` öncelik hata > bilinmeyen > faaliyet > dinliyor > kullanılamıyor;
  logo (`Brand`), durum pill'i, gözlenen etkin/boşta satırı, hata alert'leri, Aç, iki açıklamalı **disabled** pause
  (`aria-describedby`), Çık. Bridge/poll/state/persistence yok; sayaç/ilerleme gösterilmez.
- `DesktopBackground`: `tray`/`onOpen` prop'ları; aynı mounted poller tray sunumunu besler (ikinci poller yok);
  settings'te salt-okunur kapanış (`canHide` kaynaklı) + `appVersion` satırı; failure/eksikte "bilinmiyor".
  Mevcut single-flight/alive/settingsVersion, autostart ve Quit yolu aynen.
- `App.tsx`: placeholder kaldırıldı; tray rotasında h1/açıklama başlığı; `onOpen` → mevcut `navigate('receiver')`
  (protectedDecision fence'i korunur).
- `background.ts::snapshot`: `appVersion: app.getVersion()` (yeni IPC/preload yok). `BackgroundStatus.appVersion`
  **opsiyonel**: plan dışı `ReceiverFlow.spec.tsx` fixture'ına dokunmamak için; main her zaman sağlar, renderer eksik/boşu
  "bilinmiyor" gösterir. Kapsam genişlemesi değil, dar tip seçimi — review'da görünür olsun diye kayıtlı.
- i18n TR/EN/DE: `tray.*`, `background.{closeBehavior,closeHides,closeStaysVisible,closeAutomatic,version,versionUnknown}`;
  `ui.trayDescription` "kontroller yukarıda" yerine gerçek tray'in aynı Aç/Çık kontrollerini sunduğunu söyler.
- Görsel düzeltme (capture'da bulundu): katmansız `.pairing-state` rengi utility'yi eziyordu → pill yalnız Tailwind token
  sınıflarıyla; global `button { font: inherit }` nedeniyle `text-sm` grup kapsayıcısına taşındı. global.css değişmedi.

## Kabul eşlemesi (ID → kanıt → sonuç)

| ID | Kanıt | Sonuç |
|---|---|---|
| G23-01 | `DesktopBackground.spec` G23-01: önce RED (`g23-01-red.log`: tray group yok, 1 fail/3 pass), sonra GREEN (`g23-01-green.log` 4/4); final suite | **fresh PASS** — errorCode+available=true → hata pill+alert; idle→active(transfer/backup)→backup hata→shutdown hata→unavailable→recovery; progressbar/sayı yok |
| G23-02 | G23-02 testi (tray↔settings rerender tek `status` çağrısı; unmount sonrası geç reply/poll yok) + mevcut stale-autostart testi (reuse, aynı koşuda yeşil) | **fresh PASS** |
| G23-03 | Renderer: Open→onOpen, Quit→tek `background.quit`, reject→unknown + Quit kullanılabilir; App: tray Open→`#/receiver`; main coalesce/Cancel/awaited-close/failure testleri değişmeden suite'te yeşil | **fresh PASS** (yeni Quit controller yok) |
| G23-04 | İki pause disabled + accessible description; tıklamada quit/setAutostart/onOpen çağrısı yok; capture `calls: []` | **fresh PASS** |
| G23-05 | main: getVersion mock → snapshot `appVersion` (tam eşitlik); renderer: `0.0.0`, canHide→closeHides/closeStaysVisible, failure→versionUnknown, prototype yok, radio/ek tercih yok, setAutostart çağrısı yok | **fresh PASS** |
| G23-06 | main G23-05/06/08 testi: Linux doğrulanmamış → görünür + `canHide:false`; tray click → gizlenebilir, receiver/schedule kapanmaz; mevcut Linux/fallback lifecycle testleri suite'te yeşil. Foreground invitation/approval: `pairing.ts` HEAD'e eşit, önceki 16.10 native kanıtı reuse (tarihî, taze HEAD native PASS değil) | **fresh PASS (JS) + reuse (native)** |
| G23-07 | Renderer TR/EN/DE erişilebilir ad testleri; izole scripted capture `capture/` (26 görüntü: D12/D13 × TR/EN/DE × light/dark × 1440/640 + TR hata durumu); `measurements.json`: tema/dil doğru, sayfa taşması 0, kart dışı/kırpılmış öğe 0, boş olmayan inline stil 0, bridge yan etkisi 0, konsol hatası 0; klavye: Aç odaklanabilir, Tab disabled pause'ları atlayıp Çık'a gider. Görsel karşılaştırma: Lovable `outgoing.tsx.reference` D12:171–197 / D13:209–239 ile ana model inceledi | **fresh PASS (izole renderer)** — sapmalar aşağıda |
| G23-08 | App: rezervasyon altında `#/tray` → `#/pairing`'e geri, tray görünmez, dialog korunur; settings/receiver geçişinde tek poller; mevcut backup draft/pairing testleri yeşil; main: yalnız üç IPC kanalı, trusted/foreign frame reddi, autostart/journal/close yan etkisi yok; scoped ESLint, iki tsc, renderer build | **fresh PASS** |

Komutlar (cwd `apps/desktop`, loglar bu dizinde):
- `npx vitest run --config vitest.config.ts` → `desktop-suite.log`: 31 dosya / **334 test PASS** (final kaynakla).
  Ara dar koşular: `renderer-expand.log` 10/10, `main-expand.log` 11/11, `app-expand.log` 8/8.
- `npx eslint <8 değişen ts/tsx>` → `eslint-scoped.log` exit 0 (JSON locale'ler lint kapsamı dışında).
- `npx tsc --noEmit -p tsconfig.json` / `-p tsconfig.main.json` → exit 0.
- `npx vite build` → `renderer-build.log` exit 0 (renderer production build; `dist/` gitignored).
- `python3 -I capture/capture_d12_d13.py apps/desktop/dist/renderer capture/out 47913` (repo kökünden) →
  `capture/capture.log`, `capture/out/`. Tek kullanımlık; kalıcı proje komutu değildir, 2.5 açık kalır.

## Bilinçli sapmalar / sınırlar

- Lovable D13 sahte "receiving" pill'i, pause toast'ları ve `0.9.0 (prototype)` yok (D-G23). D12 close Segmented yerine
  salt-okunur satır (D-G23). Lovable D13 sağdaki tray ikon varyant paneli eklenmedi: renderer gerçek tray ikon varlığını
  göstermez; marka paneli işlev/kanıt değildir. Pill, paylaşılan `Brand` bileşeni bölünmediği için adın altında değil sağdadır.
- Native tray/uygulama menü metinleri Türkçe sabit kalır (native menü yerelleştirmesi kapsam dışı).
- Mevcut settings bölümünde receiver hata metni (role=alert) renksiz — önceden var, bu işte değiştirilmedi.

## Açık / ertelenmiş kapılar (değişmedi)

- `npm run build` tam zinciri (sync-core + main emit + SQLite/native rebuild) NOT_RUN: native/ABI etkisi yok; main için tsc noEmit koşuldu.
- Tam `npm run lint` NOT_RUN (scoped lint koşuldu). Native/Rust testleri NOT_RUN (kaynak değişmedi).
- Gerçek OS tray erişilebilirliği/tema/login/sleep, Windows/macOS/Linux fiziksel kabul → Faz4 açık. Pixel-diff yok.
- F1 fix2 compile/RED-GREEN/dar lint Faz3 DEFERRED/NOT_RUN; FO1 delta Faz4; S3/G1/1.5 scoped kabulleri,
  G1-07 Faz3 ertelemesi, B2/release/P5/provider/signing/storage ve 20–21 fiziksel kapılar aynen açık.

## FIX-R1 (G23-R1) — 18.11 aynı Opus sohbeti

Kaynak: [review.md](review.md) §G23-R1 ve §dar FIX devri. Başlangıç: `fix-r1/baseline/`
(HEAD, status, staged boş, değişecek 4 dosyanın tam başlangıç kopyası + sha256;
DesktopTray/spec hash'i INITIAL `source-final.sha256` ile eşit).

| Bulgu | Invariant | Olay sırası | Sembol | Regression | Önce → sonra |
|---|---|---|---|---|---|
| G23-R1 | Hata önceliği yalnız pill/alert'i belirler; faaliyet satırı bağımsız gerçek gözlemden (`backup.active \|\| activeTransfers>0`) gelir; query failure'da stale faaliyet sunulmaz | FILE aktif + backup failure poll → error pill/alert + "etkin" satırı; failure temizlenir → active; iş biter → listening/idle; komşular backup active + receiver error, FILE + shutdown error | `DesktopTray.tsx::DesktopTray` faaliyet satırı (kök: `state === 'active'` türetmesi) | `DesktopBackground.spec.tsx` "G23-R1 …" (mounted Background→Tray) | RED (`fix-r1/r1-red.log`: error pill + "Etkin yedekleme yok.") → GREEN |

- Kök neden doğrulandı: faaliyet satırı pill önceliğinden (`state === 'active'`) türetiliyordu.
  Minimum fix: aynı satır `status.backup.active || status.receiver.activeTransfers > 0` gözleminden;
  unknown dalı ve hata alert'leri değişmedi. Yeni state/protokol/çeviri yok. `fix-r1/fix-DesktopTray.diff`.
- Regression dizisi: FILE+backup failure → error/active; failure temizlenir → active/active; biter → listening/idle;
  backup active+receiver error → error/active; FILE+shutdown error → error/active; bridge failure → unknown,
  ne active ne idle, alert yok (stale faaliyet sunulmaz). `fix-r1/fix-spec.diff`.
- Kontroller (cwd `apps/desktop`, loglar `fix-r1/`): Vitest DesktopBackground+App spec **19/19** (`r1-green.log`);
  ESLint iki dosya exit0; renderer tsc exit0; `vite build` exit0; tek temsilci capture hata+aktif TR/light/1440
  (`capture_r1.py` = INITIAL betiğinin tek varyant türevi; `capture/`, ölçüm 0 bayrak/0 konsol hatası).
- Reuse (değişmedi, hash eşit — `fix-r1/source-final.sha256` diğer 9 dosya INITIAL ile aynı): main/background.spec,
  main tsc, App/i18n/api; tam suite 334 INITIAL kaydı + bu turun etkilenen 19 testi. Tam suite, main tsc, native,
  26 capture matrisi bu turda NOT_RUN (etkilenmedi). Final diff: `fix-r1/product-tracked-final.diff`,
  `fix-r1/product-untracked-DesktopTray-final.diff`; staged boş. Satırlar ≤300 (`fix-r1/lines-final.txt`).
- Durum: **REVIEW / ACCEPTED — aynı bağımsız GPT sohbetinde FIX-R1 kabul edildi.**
  Sayaç: INITIAL ret 1, başarısız FIX 0; FIX deneme 1 kabul. Aşağıdaki son kapanış geçerlidir.

## Sayaçlar

- Başarısız düzeltme sayacı: 0 (G23-01 ilk düzeltmede GREEN). Görsel düzeltme ilk yeniden capture'da temiz.
- Capture betiği iki kez düzeltildi (tema localStorage varsayılanı, boş `style=""` ölçüm hatası) — ürün değil, ölçüm aracı.
- Usage/token: UNKNOWN (harness ölçüm vermiyor). 

## Bağımsız GPT INITIAL review / dar FIX

- Reviewer: GPT-6.1 Sol (`openai/gpt-6.1-sol`), Opus uygulamasından ayrı GPT sohbeti;
  session ID UNKNOWN. Review HEAD başlangıçla aynı `508b3f0486a7ce04628ec0c3681d995573e5721d`.
- [review.md](review.md): tüm INITIAL goal/diff birlikte incelendi; **REQUEST CHANGES**.
  11/11 final, 13/13 başlangıç ve 5/5 komşu hash doğrulandı; tracked/untracked
  gerçek diff kayıtlara byte-eşit, staged boş (`review-audit.txt`).
- **G23-01 sonucu supersede:** yukarıdaki uygulama fresh PASS'i yalnız eski
  assertion kapsamındadır. G23-R1 / P2 / observed-status projection ailesi:
  `DesktopTray.tsx:48–50` hata pill'inden idle türetiyor; gerçek aktif iş gizleniyor.
  `review-probe.log`: üç bağımsız hata+faaliyet bileşimi **3/3 RED / exit1**.
- G23-02–08 incelemesi uygun; 26 capture ölçümü/klavye ayrıca statik doğrulandı
  (`review-capture-audit.txt`). Bu satır uygunluğu goal veya üst iş kabulü değildir.
  Uygulama suite/lint/tsc/build reuse; reviewer yeniden koşmadı. Açık kapılar aynen korunur.
- Sıradaki: **mevcut Opus uygulama sohbetinde `/implement`**, yalnız review.md
  §Mevcut Opus sohbetine dar FIX devri. Kök neden→mounted regression→minimum fix→
  etkilenen yollar. Yeni plan/onay gerektiren kapsam kararı yok; ürün kodu reviewer tarafından değiştirilmedi.
- Invariant sayacı: observed-status projection **INITIAL ret=1, başarısız FIX=0**;
  implementer'ın ilk regression GREEN kaydı başarısız FIX sayacı değildir.
  Sonraki tur REVIEW/unchecked; kabul bu mevcut GPT review sohbetinde değerlendirilecek.

## Bağımsız GPT FIX-R1 kapanışı / 18.11.2026

- Reviewer aynı GPT-6.1 Sol (`openai/gpt-6.1-sol`), session ID UNKNOWN;
  Opus uygulamasından ayrı mevcut review sohbeti. HEAD `508b3f0486a7ce04628ec0c3681d995573e5721d`.
- **2.2 goal ACCEPTED:** INITIAL incelemesi + FIX-R1 birlikte G23-01–08'in tamamını
  karşılıyor; yalnız scoped fix kabulü diye üst iş kapanışı varsayılmadı.
  Satır bazlı son eşleme [review.md §FIX-R1](review.md#fix-r1-bağımsız-devam-reviewu--18112026).
- G23-01/G23-R1 **RESOLVED**: hata pill'i ve gerçek faaliyet bağımsız; unknown stale
  faaliyeti sunmaz. G23-02–08 önceki kabul incelemesi etkilenmedi, kanıtı reuse.
- `fix-r1/review-audit.txt`: final 11/11 hash, INITIAL→FIX başlangıç zinciri,
  canlı tracked+untracked diff eşitliği, diğer 9 ürün/5 komşu değişmezliği, staged boş.
- Taze reviewer `fix-r1/review-probe-green.log` **3/3 GREEN, exit0**;
  uygulayıcı mounted regression RED→GREEN/19 test, scoped lint/renderer tsc/build ve
  tek hata+aktif capture kanıtı reuse. INITIAL full-suite/main tsc/26 capture sonuçları
  kendi kaynaklarında korunur; final full-suite veya native/OS yeniden koşuldu denmez.
- Başarısız FIX sayacı **0**, INITIAL ret **1**, FIX-R1 deneme 1 kabul.
  Yeni bulgu/temizlik önerisi yok; önceki ret/devir bölümü tarihîdir, aktif FIX talimatı değildir.
- CURRENT'te 2.2 [x]; F1/Faz3–4 ve bütün açık/ertelenmiş kapılar aynen korunur.
  Sonraki ayrı iş 2.3/G4–G6 GPT planı; hazır prompt review.md sonunda. Bu sohbetten başlatılmadı.
