# P3-10 D12 Lovable-uyumlu Masaüstü Ayarlar — scoped ürün istisnası (20.11.2026)

Durum: **Uygulandı; dar doğrulama PASS; bağımsız review bekliyor.** Variant: `claude-agent/sonnet#medium` (Sonnet 5.5). Commit/push yok. Matris PASS, 1440, native OS, M13-alt veya tüm P3-10 PASS iddiası YOK.

## Başlangıç
`before/` (8 dosya kopyası) + `before.sha256`, `start-status.log`, `start-diffstat.log`. Çalışma ağacında çok sayıda önceden var olan kullanıcı/önceki-faz değişikliği vardı (ADR0018 background dosyaları dahil); yalnız aşağıdaki D12 sınırı değiştirildi, diğerleri korundu. Diff: `d12-scoped.diff` (before→after, yalnız bu dilimin delta'sı), sonraki hash'ler `after.sha256`.

## Değişiklik (dosya sınırı içinde)
- `DesktopBackground.tsx`: tek mounted sahip korundu; `general?: ReactNode` slotu eklendi. Settings'te sıra: Arka plan paneli (durum/autostart/gerçek `canHide` kapatma açıklaması) → slot (Genel) → Sürüm paneli (gerçek `appVersion`/bilinmiyor) → altta ayrı "Kloda'dan çık" (LogOut ikonu, aynı `quit()`/bridge yolu). Receiver/tray modunda başlıktaki Quit ve D13 değişmedi.
- `AppearanceSettings.tsx`: `Genel` başlığı → Görünüm (tema) → Dil, segmented gruplar; `.appearance-settings`, `name=kloda-language`/`kloda-appearance` radio sözleşmesi korundu.
- `App.tsx`: AppearanceSettings artık `general` olarak DesktopBackground içine verilir (yalnız settings rotası).
- `global.css`: `.segmented*`, `.settings-*` (Tailwind/var tokenları, inline stil yok).
- Locale: yeni üçlü `appearance.general` (Genel/General/Allgemein); mevcut anahtarlar kullanıldı. Parity 434/434/434.
- `App.spec.tsx`: settings sıra + 6 radio + tek Quit testi eklendi. Demo kapatma seçimi, sahte OS uyarısı/sürüm, kurulum reseti eklenmedi; login opt-in, hata/sürüm mantığı, ADR0018 dokunulmadı.

## Doğrulama (taze)
| Komut | Exit |
| --- | --- |
| `npx vitest run src/app/App.spec.tsx src/features/desktop-background src/pages/pairing` (ilk) | 0, 39/39; son tur (App.spec + desktop-background) 19/19 |
| `npx eslint` (App.tsx, App.spec.tsx, desktop-background/*.tsx) | 0 |
| `npx tsc --noEmit -p tsconfig.json` | 0 (CSS son ayarından önce; CSS-only sonrası değişmedi) |
| locale parity | 434=434=434 True |
| `capture-ui.py prepare-desktop` (mevcut komut, renderer build + stamp) | 0 |
| gözlemsel Playwright 521×849 TR/koyu (`/private/tmp/d12-scripts/shot.py`, repo dışı geçici; runner değişmedi, STUB/MEASURE mevcut modülden) | 0 |
Ölçüm (`after/measurement.json`): innerWidth 521, TR, koyu, Inter yüklü, pageOverflow false, bridge çağrısı 0, console hatası 0, belge yüksekliği 1385. `product.png` sha256 `f863172f1fec03de8037f575579a3e6f1a32e2717487c784db8d3eb04ae4c713`; önceki ürün PNG `b93ec228…`; metin `after/product-text.txt`. Not: `.desktop-content` altında 10 boş `style=""` INPUT öznitelikleri (kaynakta `style=` yok; React/tarayıcı artefaktı, yeni inline stil değil).
Reuse: c144 referansı `lovable-c144-preview/desktop-settings-narrow.jpg`, önceki `desktop-settings-matched` kaydı. Tam Vitest/tsc/lint yeniden koşulmadı (dar kapsam).

## Görsel fark (Lovable ↔ ürün, 521×849/TR/koyu)
Eşleşen: Arka plan önce → Genel → Tema → Dil → sürüm → ayrı Çık altta; panel/segmented (tam genişlik) dili. Kalan, bilinçli farklar: demo "kapatınca" seçici ve sahte OS uyarıları (ADR0018 gereği gerçek `canHide` metni); autostart switch yerine mevcut checkbox + durum metinleri; tema ikonu/açıklaması ve "Kurulumu yeniden başlat" satırı yok; "0.9.0 (prototype)" yerine gerçek sürüm; Lovable'da Tema/Dil aynı kart değil, ürün sırası Görünüm→Dil; navigasyon/üst şerit (shell) değişmedi (aktif öğe vurgusu ve "Kuluruma başla" şeridi shell farkı). Bunlar D12-2 sınırı gereği kabul edilmiş farklar veya scope dışı; piksel eşitliği iddiası yok.

## Cleanup
Playwright/Chromium/loopback sunucu kapandı (süreç yok). `apps/desktop/dist/renderer` yeni stamp'li build (gitignored çıktı). Geçici betik repo dışı.

## Sonraki adım
Bağımsız GPT review (gerçek diff + bu kanıt); sonra koordinatör MANIFEST/CURRENT'i işler.

## Devam kontrolü (kota sonrası, 20.11)
Önceki çağrının sonucu manifestte "alınmadı" idi; diskteki iş tamamdı: 8 izinli dosyanın güncel sha256'sı `after.sha256` ile **birebir eşit**, `before/`, `start-status.log`, `start-diffstat.log` ezilmedi, çevredeki kullanıcı/önceki-faz değişiklikleri (ADR0018 electron dosyaları, untracked `DesktopTray.tsx`, webdav-test-result vb.) korundu. Süreç aidiyeti: playwright/chromium/vite/capture/shot.py/dinleyen yerel sunucu yok (görünen `copilot-runtime` VS Code'a ait, dokunulmadı). Renderer stamp `fresh: true` (`logs/resume-provenance.log`; src `f98c220b…`, renderer `858d945c…`) → `product.png` (`f863172f…`) güncel kaynaktan. Tüm `logs/*.exit` = 0. Geçerli kanıt yeniden koşulmadı (hash eşit); yeni capture/test yok.

## Durum: REVIEW (yalnız D12 scoped)
D12-1 (sıra Arka plan→Genel→Tema→Dil→gerçek sürüm→ayrı Çık altta, segmented tam genişlik, radio/odak/TR-EN-DE parity 434) ve D12-2 (canHide metni, autostart, Quit/bridge, tek mounted owner, receiver/tray değişmedi; demo davranışı yok) için dar kanıt var; D12-3 dar vitest/ESLint/tsc + izole renderer + 521×849/TR/koyu tek görüntü tamam. Kalan farklar yukarıdaki "Görsel fark" listesinde. Faz3 tamamlandı DEĞİL; 1440, native OS, M13-alt, matris ve diğer P3-10 hücreleri açık. Commit/push yok.
Sonraki tek adım: bağımsız GPT reviewer'ın D12 diff'i (`d12-scoped.diff`) + bu kanıtı incelemesi.
