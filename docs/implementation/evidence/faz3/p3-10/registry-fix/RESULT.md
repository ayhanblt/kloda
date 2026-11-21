# P3-10 capture-only registry uyumu — 20.11.2026

Durum: **DÜZELTİLDİ (capture-only), dar kontroller PASS.** Variant: `claude-agent/sonnet#medium` (Sonnet 5.5). Ürün, matris, runner (`tools/ui-capture/*`, `tools/capture-ui.py`) kodu değişmedi; yeni capture/build/fixture/cihaz yok. M13-alt `mobile.settings-bottom` **12 `state_unavailable`**, 5 FAIL kaydı ve M13-alt görsel kabul açığı değişmedi. Desktop PNG render notu Lovable görsel kabulü değildir. MANIFEST/CURRENT/plan işlenmedi; commit/push yok.

## Başlangıç (reuse)
`check` exit 1 kanıtı reuse: `check-before.log` (= `../check.log`) — tek hata `ios ready rows [...] != screens.tsx registry [..., settings-bottom, ...]`. Başlangıç: `apps/mobile/capture/` ve `tools/ui-capture/` izlenmeyen (untracked) dizinler (`start-status.log`), bu yüzden git diff yok; önce/sonra kopya + diff kaydedildi. Runner hash'leri değişmedi (`runner-hashes-before.log`: matrix.json `0a957b42…`, ios.py `c1075139…`, capture-ui.py `87afcef5…`).

## Diff (`screens.diff`, tek dosya `apps/mobile/capture/screens.tsx`)
- `'settings-bottom'` adapter girdisi ve ona özel yorum satırı kaldırıldı.
- `scrollToEndScreens`: `['settings-bottom']` → `[]` (export adı/tipi `readonly string[]` korundu; `entry.tsx` tüketimi etkilenmez).
- `welcome`, `settings`, `provider-generic` adapter'ları ve `captureScreenNames`/`CaptureScreen` export kontratı aynı.
sha256: önce `0ad222ad…ae25` → sonra `a6df2b5d…0f` (`before.sha256`, `after.sha256`, `screens.tsx.before`).
`tools/ui-capture/ios.py` `SCROLL_END_SCREENS`'ta ad hâlâ var (runner koduna dokunulmadı; test_capture bunu kullanır) — zararsız, registry artık o ekranı üretmez.

## Dar doğrulama (taze)
| Komut | Exit | Sonuç |
| --- | --- | --- |
| `python3 -B tools/capture-ui.py check` | **0** | `errors: []`, ortam araçları hazır (`check-after.{log,exit}`) |
| `python3 -B tools/capture-ui.py list` | 0 | satırlar `../list.log` ile **aynı** (`list-after.log`) |
| `python3 -B -m unittest discover -s tools/ui-capture -p test_matrix.py` | 0 | 35/35 OK (`test_matrix.{log,exit}`) |
| `apps/mobile`: `../../node_modules/.bin/tsc --noEmit -p capture/tsconfig.json` | 0 | çıktı boş (`capture-tsc.*`) |
| `apps/mobile`: `eslint capture/screens.tsx capture/entry.tsx` | 0 | çıktı boş (`capture-eslint.*`) |
`test_capture.py` ve native/iOS koşusu bu dilimde çalıştırılmadı (değişiklik runner'a dokunmadı; yeni capture yok).

## 48 / 60 uzlaştırması (salt okunur, `count-reconcile.log`)
- `mx.cells()` toplam **600** efektif hücre: ready 48, interaction_required 84, state_unavailable 378, blocked 72, deferred_external 18 = `list` totals ile **eşit**.
- "60" yalnız **satır-durumu** sayımıydı (5 ready satır × 12). Efektif durum: `cellOverrides` ile Desktop iki satırın `size=large` hücreleri `state_unavailable` ("renderer has no root font-size control; browser zoom is not native large text").
  - `desktop.settings`: 6 ready (tr/en/de × light/dark × **normal**) + 6 state_unavailable; `desktop.tray`: 6 + 6;
  - `mobile.welcome` 12, `mobile.provider-generic` 12, `mobile.settings` 12 ready (override yok).
  - Toplam ready = 6+6+12+12+12 = **48**. Fark, 12 Desktop large-hücresi (2×6) — uydurma yok.
- Önceki RESULT'taki "60 / her satır 12 varyant" ifadesi bu yüzden düzeltilir: Desktop için 12 değil 6 ready hücre; önceki "11 varyant koşulmadı" Desktop için **5** efektif ready varyant (tr/light/normal hariç) olarak okunmalı. `mobile.settings-bottom`: 12 `state_unavailable` doğrulandı.

## Açık
iOS native-entry ready hücreleri (welcome/provider/settings, 36) için `check` artık yeşil; koşu için sahipli Simulator+fixture+Metro gerekir (koşulmadı). Desktop ayarlar/tray için frozen referans görüntüsü yok; Lovable görsel kabul, G1-07/G24-07/G456-07 ve M13-alt açık.

## Sonraki adım
Koordinatör MANIFEST'e registry uyumunu ve 48=ready/600 efektif sayımı işlesin; sonra bir sonraki P3-10 temsilcisi için karar: iOS `mobile.welcome` veya `provider-generic` (ilk Simulator+fixture koşusu, frozen mobil JPG referanslı) ya da Desktop referans-fark sınıflandırması.
