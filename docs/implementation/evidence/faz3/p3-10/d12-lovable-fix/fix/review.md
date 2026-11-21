# P3-10 D12 FIX — bağımsız yeniden inceleme

**ACCEPTED — yalnız Faz3 P3-10 D12 scoped istisnası, D12-1/2/3.**
Sözleşme: `next-plan.md` §3, D12 satırları; Faz3 `MANIFEST.md:68`;
önceki bulgu: `../review.md` §Tek engelleyici bulgu. Reviewer: GPT-6.2 Sol
(`openai/gpt-6.2-sol`), aynı bağımsız oturum
`ses_e05b3160cffetF78VQHyjKxkcP` (ortam ve manifest eşleşti).
Uygulayıcı varyantı devirde `claude-agent/sonnet#medium`.

## Başlangıç ve delta

- HEAD `508b3f0486a7ce04628ec0c3681d995573e5721d`; staged boş.
  FIX `before/` içerikleri → `before.sha256` → INITIAL `../after.sha256`
  8/8 eşit. FIX `after.sha256` → canlı kaynak 10/10 eşit. Normalize edilmiş
  `diff -u` hunk'ları `fix.diff` ile birebir; INITIAL/FIX son hash'lerinin
  fark kümesiyle aynı yedi dosya: `global.css`, `App.spec.tsx`,
  `DesktopBackground.tsx`, `AppearanceSettings.tsx`, üç locale. Allowlist içinde.
- `App.tsx`, `DesktopBackground.spec.tsx` ve önceki untracked `DesktopTray.tsx`
  INITIAL sonuyla byte-eş. Desktop tracked/untracked durum listesi FIX
  `start-status.log` ile eşit; orada zaten dirty/untracked Electron/WebDAV
  komşuları FIX değişikliği sayılmadı. Durum listesi scope dışındaki her dosyanın
  byte hash'i değildir. Yeni bağımlılık, inline stil, ortak shell veya araç deltası
  yok; Desktop kaynak `git diff --check` temiz.

## Kabul eşlemesi

- **D12-1 — önceki görsel bulgu kapandı.** c144 `/d/settings` kaynak yolu
  (`d.settings.tsx.reference:2–15` → `outgoing.tsx.reference:178–194`,
  `theme-switch/ui.tsx.reference:11–26`) ve
  `../../lovable-c144-preview/desktop-settings-narrow.jpg` ile `after/product.png`
  doğrudan karşılaştırıldı. Arka plan başlığı kart dışında, Ayarlar başlığı
  ile ayrık ve panelin hemen üstünde; Genel başlığı altında ayrı dolgulu
  ve ikonlu Tema kartı, Sistem → Açık → Koyu, kart içinde sistem ipucu ve
  kart dışında Dil görünüyor. Sürüm kartı ve ayrı alt Çık korunmuş.
  `DesktopBackground.tsx:64–70,103–111`, `AppearanceSettings.tsx:9–30`,
  `global.css:141–157` ve `App.spec.tsx:132–149` ile eşleşiyor.
  Native, adlandırılmış iki radio grubu, `checked` ve değişmeyen seçim
  callback'leri korunuyor; `global.css:117,152–154` odak/seçim, `aria-describedby`
  ve üç çevrilmiş `systemHint` (`locales/{tr,en,de}.json:486`) mevcut.
  Anahtar kümeleri yeniden karşılaştırıldı, 435/435/435 eşit.
  `.appearance-settings` / `input[name=kloda-language]` capture sözleşmesi
  korunuyor (`tools/ui-capture/desktop.py:29,234`). Klavye/odak kaynak
  incelemesidir; yeni etkileşim koşusu yapılmadı.
- **D12-2 — korundu.** `App.tsx:63–86` byte-eş, tray→receiver→settings
  tek mounted owner; `DesktopBackground.tsx:24–60,71–111` status poller ve
  autostart fence, `canHide` salt-okunur açıklaması, gözlemlenen OS uyarıları
  ve bridge sürümü/unknown değişmedi. Receiver başlığı ve Quit aynı kartta;
  D13 branch ve `DesktopTray.tsx` değişmedi. `DesktopShell.tsx:42–44`
  ayarlar-dışı Welcome rotası, `preload.cts:23` ve
  `electron/runtime/background.ts:55–87,150–175,191–202` mevcut native
  Linux görünür kontrol ve default-Cancel Quit yolu için önceki bağımsız
  kaynak kanıtı reuse. Yeni demo kapatma tercihi, sahte OS verisi, sahte
  sürüm veya kurulum reseti yok. Fixture `0.0.0` / `canHide: true` native
  OS ölçümü değil; shell, demo notice/switch ve setup/sürüm farkları ayrı.
- **D12-3 — taze FIX kanıtı doğrulandı, yeniden koşulmadı.**
  `logs/vitest.log` iki dosya/19 test; `App.spec.tsx:109–151` gerçek
  route/poller, kart ve radio yapısı, ipucu accessible description,
  tek Quit; önceki background spec'inin komşu/autostart/canHide/version
  kapsamı aynı. Beş `*.exit` 0; ESLint/tsc temiz log, komut kapsamı
  `RESULT.md` kaydında. Test/lint/tsc exit kayıtları build'den önce.
  Test dosyaları `after.sha256` ile doğrulandı, renderer stamp'in parçası
  değiller. `prepare-desktop.log`, `provenance.log` ve canlı
  `.kloda-capture-build.json` için source/renderer digest bağımsız tekrar
  hesaplandı: `fb20cf353d7b83a48908d7770865894f4aad3e805d6c0b702863136ab7ca1e78` /
  `450e8e5b7b5fed34b09c032b3705d7c4b0c42cdd6a5dcb3d9bc05a3cbc91bd8d`, fresh.
  Bu renderer-only Vite build; tek yazıcı altında gitignored standart
  `apps/desktop/dist/renderer` (ayrı checkout değil). Mevcut repo dışı
  `shot.py:7–30` aynı renderer'ı ephemeral loopback/Chromium ve read-only
  STUB ile nominal 521×849/TR/koyu sunuyor; native OS/profile yok.
  `shot.log` = `after/measurement.json` ve PNG SHA-256
  `6c6f925c6ffb05c656cd36eaa836d7e3e40a9b15332f646a6e7ed71cc262b4c3`;
  Inter yüklü, yatay taşma/konsol hatası/allowlist dışı çağrı yok.
  Tam sayfa PNG 521×1442; c144 JPEG 506×1426, hash README ile eşit
  (`43a1a9be…`). Scrollbar ve state farkları nedeniyle piksel eşitliği
  iddiası yok.

Engelleyici olmayan temizlik notu: `global.css:145` komşu seçicisi
`App.tsx:71–77` wrapper'ı nedeniyle eşleşmez; başlıkların görüntüdeki gerçek
ayrımı gözlendi. 24 px kuralının uygulandığı iddia edilmiyor; scoped panel
hiyerarşisini bozmadığından bu satır için yeni FIX açılmadı.

Tarihî ilk ret 1, başarısız FIX 0; kota sayaç değildir. M13-alt 5 tarihî FAIL
ve `state_unavailable` aynen açık. D12 kabulü 1440 px, native OS, kalan
P3-10/matris, Faz3 veya Faz4 kabulü değildir. Yeni build/runtime/cihaz koşusu
yok; önceki review ve CURRENT/MANIFEST/plan değiştirilmedi.
