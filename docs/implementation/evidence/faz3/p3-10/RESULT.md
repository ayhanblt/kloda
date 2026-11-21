# P3-10 görsel kabul — tek ready temsilci (20.11.2026)

Durum: **PARTIAL — görsel kabul AÇIK, PASS yok.** Variant metadata: `claude-agent/sonnet#medium` (Sonnet 5.5); reasoning_effort sayısından sonuç çıkarılmadı. M13-alt (`mobile.settings-bottom`) `state_unavailable` ve 5 FAIL geçmişi korundu; yeniden koşulmadı, matris/runner/kod değişmedi. Ana MANIFEST/CURRENT/plan değişmedi. Commit/push, ayrı review yok.

## 1. Runner `check`/`list` ↔ kaynak/fixture kimliği
| Komut | Exit | Sonuç |
| --- | --- | --- |
| `python3 -B tools/capture-ui.py check` | **1 (FAIL)** | tek hata: `ios ready rows ['provider-generic','settings','welcome'] != screens.tsx registry [...,'settings-bottom',...]`. Kök neden (kanıtlı): kullanıcı kararıyla `mobile.settings-bottom` matriste `state_unavailable`'a alındı ama `apps/mobile/capture/screens.tsx` registry'sinde duruyor. P3-00'daki `errors=[]` bu karardan ÖNCEYDİ. Araç sözdizimi/ortam (playwright, ruby, xcrun, xcodebuild, segedit, vtool, codesign, derq, npx) OK. |
| `capture-ui.py list` | 0 | toplamlar: 48 ready, 84 interaction_required, 378 state_unavailable, 72 blocked, 18 deferred_external (`list.log`). Not: `mx.cells` 5 ready satır × 12 = 60 hücre sayar, `listing` 48 verir; fark (override/ayrım) incelenmedi, kaynak `list.log`. |
`check` hatası düzeltilmedi (runner/matris/kod değişmez kuralı); `run` bu `check`'i çağırmaz, Desktop sürücüsünü etkilemez. iOS `run` yolu için registry↔matris uyumsuzluğu ayrı karar gerektirir (koordinatör: registry'den `settings-bottom` çıkarma capture-kodu değişikliği, M13-alt kararına bağlı).

Ready satırlar (her biri 12 varyant): `desktop.settings`, `desktop.tray`, `mobile.welcome`, `mobile.provider-generic`, `mobile.settings`. **G1-07 (M11) ve G24-07 (WebDAV/pairing) ready DEĞİL** (state_unavailable/interaction_required) → tercih edilenler uygun değil; temsilci olarak `desktop.settings/tr/light/normal` seçildi (cihaz/build/fixture gerektirmeyen, tek ready hücre-yolu).

## 2. Mevcut PNG reuse kararı
`matrix.fingerprint` + `reuse_decision` (salt okunur, `reuse-decision.log`): `desktop.settings/tr/light/normal` → **recapture** (değişen: `localeKeys`, `row`, `tools/ui-capture/{common,desktop}.py`); `mobile.settings/tr/light/normal` → **recapture** (`app.json`, capture `entry/protocol/screens/scroll`, `localeKeys`, `row`, `common.py`, `ios.py`). Yani eski G25 PNG'leri bu aday için reuse EDİLEMEZ.

## 3. Taze dar capture (Desktop renderer, sahipli, cihazsız)
`python3 -B tools/capture-ui.py run --driver desktop-renderer --screen settings --locale tr --theme light --size normal --width 1440 --out docs/implementation/evidence/faz3/p3-10/desktop-settings` → **exit 0**, `result: PASS`, `phase: CLEANED`, `cleanupErrors: []` (`desktop-run.{log,exit}`). Renderer stamp eşleşti (yeni build yok, `prepare-desktop` çalıştırılmadı). Ölçüm: PNG 1440×1000, `lang=tr`, `theme=light`, `hash=#/settings`, başlık "Ayarlar", innerWidth 1440, rootFont 16px, Inter yüklü, `pageOverflow=false`, bridge çağrısı 0, console hatası 0.
PNG sha256 `5a6f372e3404…3594` = eski G25 smoke PNG'siyle **byte-eş** (locale/araç hash değişse de render pikselleri aynı). Süreçler: kapsam/cleanup sonrası capture/Chromium süreci kalmadı (görünen `claude` süreçleri bana ait değil, dokunulmadı).
Görsel inceleme: iki kart (Görünüm: Koyu/Açık/Sistem, Dil: Türkçe/English/Deutsch), "Alıcı durumu ve arka plan ayarları" kartı + "Kloda'dan çık", oturum-açılışı onay kutusu, pencere-kapatma notu, Sürüm 0.0.0; sol menü "Ayarlar" aktif; taşma/kırpma yok.

## 4. Frozen Lovable referansı ile eşleme — **PASS verilemez**
- `c144e98938da/screenshots` yalnız 7 mobil JPG içerir; **Desktop ayarlar için referans GÖRÜNTÜSÜ yok**. Referans yalnız kaynak: `d.settings.tsx.reference` → `DesktopSettings` (`views/desktop/outgoing.tsx.reference`, "design reference; demo only").
- Kaynak ile ürün yapısı farklı: referansta D12 kod rozeti, "kapatınca tray/çık" Segmented, autostart Switch + üç Notice, ThemeSwitch, dil Segmented, "kurulumu yeniden çalıştır" ve "Sürüm 0.9.0 (prototype)" satırları, "Kloda'dan çık" butonu altta; üründe Görünüm+Dil kartı, "Alıcı durumu ve arka plan ayarları" kartı, onay kutusu, kapatma notu, Sürüm 0.0.0 ve "Kloda'dan çık" kartın sağ üstünde. `adaptation-findings.json`/`lovable-design-reference.md` D12/ayarlar için onaylı uyarlama kaydı **içermiyor**; hangi fark kabul edilmiş uyarlama (demo/kod rozeti çıkarma) hangisi eksik (kapatma davranışı seçimi, kurulum tekrarı) ayrılamadı.
- Sonuç: sayısal piksel/yapı görsel eşleşme kanıtı **NOT_RUN**; karar GPT/kullanıcı (fark sınıflandırması) gerektirir. Render kanıtı (§3) yalnız "üründe bu hücre bu aday kaynağıyla çiziliyor ve taşmıyor" der.

## 5. Kalan ready gruplar ve kanıt açığı (tek temsilci dışı, koşulmadı)
| Grup | Hücre | Durum / açık |
| --- | --- | --- |
| `desktop.settings` | 12 | 1/12 taze render (tr/light/normal); 11 varyant (tr/en/de × light/dark × normal/large + 1440 dışı) koşulmadı; referans görüntü yok |
| `desktop.tray` | 12 | recapture gerekli; Desktop sürücüsü hazır; referans görüntü yok (D13 yalnız kaynak) |
| `mobile.welcome`, `mobile.provider-generic`, `mobile.settings` | 36 | iOS native-entry: `check` kırmızı (§1), sahipli Simulator + sahipli fixture (`ba35dad4…` READY) + Metro gerekir; `mobile.settings` recapture gerekli; welcome/provider için frozen mobil JPG'ler var (`reference-mobile-*`) ama eşleşme yapılmadı |
| G1-07, G24-07, G456-07 | — | ready değil → görsel kabul açık (M13-alt state_unavailable) |
Matris körlemesine koşulmadı.

## Cleanup / sayaçlar
`desktop-run.exit` CLEANED; kalıcı süreç/cihaz/Metro yok; Simulator açılmadı. Repo: yalnız yeni `evidence/faz3/p3-10/*` (`check/list/reuse-decision/fingerprint-compare/desktop-run` logları + `desktop-settings/`). Test/FIX sayaçları değişmedi; M13-alt 5 FAIL korunur. `fingerprint-compare.log`'daki ham karşılaştırma yalnız bilgi (resmi karar `reuse-decision.log`).

## Sonraki adım (DECISION → koordinatör/GPT)
(1) `check` kırmızısı için tek karar: `screens.tsx` registry'sinden `settings-bottom` çıkarma (capture-only, M13-alt `state_unavailable` ile tutarlı) mı, yoksa iOS koşusu ertelenir mi; (2) Desktop ayarlar için referans-ürün fark sınıflandırması (kabul edilmiş uyarlama vs eksik) — frozen görüntü olmadığından görsel kabul kaynak-düzeyi karşılaştırmayla mı yapılacak. İkisi çözülmeden P3-10 görsel PASS verilmez.
