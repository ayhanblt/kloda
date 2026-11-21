# P3-11 — Desktop renderer açılış ölçümü, tek soğuk örnek (20.11.2026)

**Sonuç: taze gözlem (1 örnek). PASS, perf-regression veya native-startup iddiası yok.**
Variant: `claude-agent/sonnet#medium` (Sonnet 5.5).

## Koşul
- Renderer: mevcut stamp'li `apps/desktop/dist/renderer`, `fresh:true`, src `fb20cf35…`, renderer `450e8e5b…` (D12/D13 ile aynı; build/artefakt değişmedi).
- Mevcut `tools/ui-capture/desktop.py` read-only `STUB` + sahipli loopback; rota `#/tray`; Playwright Chromium, tek disposable soğuk context (cache/localStorage boş).
- Sabit: 521×849, DPR 1, `tr-TR`, koyu, reduced-motion. Klavye/GUI/düğme yok, PNG yok.
- Betik repo dışı: `/private/tmp/d13-scripts/startup.py`; komut `python3 -I -B … startup.py . <bu dizin>` → **exit 0** ([startup.exit](startup.exit), [startup.log](startup.log), [measurement.json](measurement.json)).

## Ölçüt ve saat kaynağı
Tarayıcı Navigation/Paint Timing ve `performance.now()` (aynı sayfa zaman kökü, navigasyon başlangıcına göre ms). "Hazır" = `[role=group] [role=status]` görünür ("Dinliyor") ve `document.fonts.status==="loaded"` sonrası okunan `performance.now()`.

| Ölçüt | ms |
|---|---|
| responseEnd | 11 |
| first-paint | 40 |
| first-contentful-paint | 128 |
| domContentLoadedEventEnd | 61.1 |
| loadEventEnd | 61.3 |
| hazır ekran gözlemi (üst sınır; Playwright bekleme gecikmesini içerir) | 144.3 |

Doğrulama: console hatası 0, bridge dışı çağrı 0, h1 "Tray menüsü". Not: bu betik `h1`'leri `hidden` süzmeden okudu; ikinci `h1` ("Yedeklenecek klasörleri seçin") muhtemelen gizli bir yüzeydendir (D13'te `MEASURE` süzülmüş listede yalnız "Tray menüsü" vardı), ancak bu koşuda doğrulanmadı; ölçümü etkilemez.

## Sınır
- Tek örnek; varyans/medyan yok. Eşleşen önceki baseline yok (resource-costs host-sentetik baseline'ı farklı ölçümdür) → karşılaştırma yapılmadı, eşik tanımsız.
- Chromium headless renderer yükleme süresidir; Electron native pencere/süreç başlatma, OS tray, gerçek bridge/IPC, disk/journal değil.
- CPU/bellek/I/O: bu araçta hazır güvenilir metrik yok, yeni ölçer kurulmadı → NOT_RUN.

## Cleanup
Tarayıcı/context kapandı, loopback kapandı (`srv.shutdown/server_close`); kalan chrome/crashpad süreçleri Brave/VS Code'a ait, dokunulmadı. Ürün/test/runner kodu, build, fixture, dış ağ yok.

## Sonraki adım
Koordinatör P3-11 satırına "Desktop renderer açılış tek soğuk gözlem (taze, eşiksiz)" ekler; a11y/CPU/bellek NOT_RUN kalır. Sıradaki bağımsız kontrol: tek yeni araçsız uygulanabilir yol yok — a11y okuyucu veya Faz4 fiziksel ölçüm kullanıcı kararı.
