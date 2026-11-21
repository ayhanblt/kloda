# D12-1 FIX — Tema kartı / Arka plan bölüm başlığı (20.11.2026)

Durum: **REVIEW (D12-1 FIX uygulandı, dar kanıt tamam; bağımsız kabul YOK).** Variant: `claude-agent/sonnet#medium` (Sonnet 5.5). Başarısız FIX sayacı 0, tarihî ret 1, M13-alt 5/5 korunur. Commit/push yok. INITIAL kanıtı (`../before`, `../after*`, `../d12-scoped.diff`, `../RESULT.md`, `../review.md`) ezilmedi.

## Baseline
`before/` + `before.sha256` = INITIAL `after` içeriği (`../after.sha256` ile birebir eşit doğrulandı); `start-status.log` tracked+untracked. Çevre değişiklikleri (Electron/WebDAV, `DesktopTray.tsx` vb.) dokunulmadı. Gerçek FIX deltası: `fix.diff`, sonrası `after.sha256`.

## Değişiklik (izinli dosyalar)
- `AppearanceSettings.tsx`: Genel başlığı altında ayrı dolgulu `pairing-card` Tema kartı (SunMoon ikonlu "Görünüm" legend, segment sırası **Sistem → Açık → Koyu** native radio, `aria-describedby` ile çevrilmiş sistem ipucu); Dil kart dışında. `name=kloda-appearance/kloda-language`, `.appearance-settings`, checked/onChange aynı.
- `DesktopBackground.tsx`: settings modunda Arka plan başlığı kartın **dışında** bölüm başlığı (`h2.settings-section-title`); receiver modunda başlık/Quit aynen kartın içinde. Tek mounted owner, poller, quit/autostart/canHide/sürüm mantığı değişmedi.
- `global.css`: `.settings-section-title` boşlukları, `.appearance-theme-card`, `.appearance-hint` (var tokenları, inline stil yok).
- Locale: yeni üçlü `appearance.systemHint` (TR/EN/DE), parity 435/435/435.
- `App.spec.tsx`: mevcut sıralama testine radio sırası `[system,light,dark,tr,en,de]`, Tema kartının `.pairing-card` içinde / Dil'in dışında olması, ipucu accessible description, Arka plan başlığının kart dışında olması eklendi.

## Komutlar (hepsi taze, `logs/*.{log,exit}`)
| Komut | Exit |
| --- | --- |
| `npx vitest run src/app/App.spec.tsx src/features/desktop-background` | 0, 19/19 |
| `npx eslint` App.tsx, App.spec.tsx, desktop-background/*.tsx | 0 |
| `npx tsc --noEmit -p tsconfig.json` | 0 |
| locale parity | 435=435=435 True |
| `capture-ui.py prepare-desktop` | 0; stamp `fresh: true`, src `fb20cf35…`, renderer `450e8e5b…` (`logs/provenance.log`) |
| tek 521×849/TR/koyu gözlemsel çekim (`/private/tmp/d12-scripts/shot.py`, repo dışı, aynı koşul) | 0 |
`after/product.png` sha256 `6c6f925c6ffb05c656cd36eaa836d7e3e40a9b15332f646a6e7ed71cc262b4c3`; ölçüm: 521 genişlik, TR/koyu, Inter yüklü, pageOverflow false, console hatası 0, bridge çağrısı 0, belge yüksekliği 1442.

## Görsel sonuç (c144 `desktop-settings-narrow.jpg` ile)
Eşleşti: Arka plan kart dışı bölüm başlığı + Ayarlar ile boşluk; Genel → ayrı dolgulu Tema kartı (ikon, Sistem/Açık/Koyu, ipucu) → Dil kart dışı → sürüm kartı → altta Çık. Kalan bilinçli farklar (D12-2 sınırı) INITIAL RESULT'taki listeyle aynı: demo kapatma seçici/sahte OS uyarısı/"Kurulumu yeniden başlat"/prototype sürümü yok, autostart checkbox, shell. Piksel eşitliği iddiası yok.

## Reuse / açık
D12-2 ve komşu (D13/receiver) kanıtı reuse (ilgili testler 19/19 içinde yeniden geçti; ayrıca tam suite koşulmadı). Açık: bağımsız re-review, 1440/native OS, M13-alt, matris, diğer P3-10 hücreleri; Faz3 tamamlandı değil.

## Cleanup
Playwright/Chromium/loopback kapandı, süreç yok; `apps/desktop/dist/renderer` yeni stamp'li (gitignored). Geçici betik repo dışı.

## Sonraki adım
Bağımsız GPT reviewer `fix.diff` + bu kanıtı incelesin.
