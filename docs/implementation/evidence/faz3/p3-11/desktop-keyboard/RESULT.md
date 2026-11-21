# P3-11 Desktop Ayarlar klavye/odak temsilcisi (21.11.2026)

Durum: **PASS (dar kapsam, 21/21 gerçek-klavye kontrolü) — mevcut STUB yerine betik-yerel eşdeğer STUB ile.** Variant: `claude-agent/sonnet#medium` (Sonnet 5.5). Faz3/screen reader/kontrast/native PASS değil. Commit/push yok. MANIFEST/CURRENT/plan koordinatörde.

## Kaynak/varyant
Aday: D12 FIX sonrası canlı kaynak; renderer stamp `fresh: true`, src `fb20cf35…1e78`, renderer `450e8e5b…bd8d` (`preflight.log`; D12 FIX provenance ile aynı, yeni build yok). Yerel Playwright/Chromium headless, loopback sunucu (`desktop._serve`), disposable browser context (viewport 1440×1000, koyu, TR). Ürün/araç kodu değişmedi. Script metni: `keyboard.py.txt` (repo dışı `/private/tmp/d12-scripts/keyboard.py`). Komut: `python3 -u -B -I keyboard.py . run` → **exit 0** (`run.exit`), çıktı `run.log`, kontroller `run/checks.json`, a11y ağacı `run/aria-before.txt`, Tab dizisi `run/tab-sequence-to-theme.json`, PNG'ler `run/focus-{theme,language,quit}.png` (sha: `ec41fb94…`, `6073f8bf…`, `29a989fd…`).

## Önemli bulgu — mevcut STUB ile koşu yapılamadı (harness, ürün kanıtı değil)
`tools/ui-capture/desktop.py::STUB` (Proxy tabanlı `window.kloda`) ile **gerçek klavye olayı** (`keyboard.press/down`, `locator.press`) D12 sayfasında renderer'ı donduruyor: keydown dinleyicisi çalışıyor ama sonrasında `evaluate` dahil her şey takılıyor (iki ayrı koşu 300 sn'de askıda kaldı, süreçler öldürüldü). Ayırt edici deneyler: STUB'sız uygulama + klavye çalışıyor; STUB + düz `set_content` sayfa + klavye çalışıyor; STUB + uygulama + **sentetik** `dispatchEvent` çalışıyor; STUB + uygulama + CSS kapalı hâlâ donuyor; fare tıklaması çalışıyor. Yani donma Proxy-STUB × uygulama × gerçek klavye birleşimine özgü; nedeni izole edilmedi (ürün keydown'u yok: tek global dinleyici sonner Toaster; ürün kusuru olup olmadığı **bilinmiyor**). Bu yüzden betik içinde **aynı allowlist sözleşmesiyle** düz-nesne STUB2 kullandım: `background.status`, `getDraft`, `getProgress` salt-okunur aynı veriyle; `background.setAutostart` ve `background.quit` çağrılırsa kaydedilip hata fırlatır (`window.__captureCalls`). Runner/STUB dosyası değişmedi. **Sapma:** kanıt "mevcut STUB" ile değil; STUB2'de `window.kloda.pairing` vb. yok (D12 rotası bunları kullanmıyor).

## Doğrulananlar (gerçek `page.keyboard`, DOM yazımı kanıt sayılmadı)
- Roller/adlar (aria snapshot): `radiogroup "Görünüm"` → Sistem/Açık/Koyu[checked]; `radiogroup "Dil"` → Türkçe[checked]/English/Deutsch.
- Tab, üstteki gezinme ve düğmelerden sonra tema grubuna ulaşır; odak **checked** radio'da (Koyu); focus ring görünür (seçeneğin outline'ı).
- Sol/Sağ ok: Koyu→Açık→Sistem→(2×Sağ)→Koyu; her adımda odak taşınır, tek checked; tema yalnız bu context'te uygulanır (`html.light` gözlendi).
- Tab → dil grubuna (Türkçe checked), ring görünür; Sağ ok English (checked, `lang=en`), Sol ok Türkçe (`lang=tr`).
- Tab → altta tek "Kloda’dan çık" düğmesi (role button, görünür odak); **etkinleştirilmedi**: `__captureCalls` boş, konsol hatası 0.
- Native köprü/gerçek ayar dokunulmadı; değişiklikler disposable context'te.

## Sınırlar / açık
1440×1000 tek koşu (dar 521×849 değil); Shift+Tab/Space/Enter, ters yön, odak kapanışı, `aria-describedby` okunması, ekran okuyucu, kontrast, yüksek zoom, diğer rotalar, tam Faz3 **kapsam dışı/açık**. Odak halkası görsel olarak doğrulandı, kontrast oranı ölçülmedi. Önceki D12 test/çekim kanıtları reuse. Proxy-STUB donması araç tarafında ayrı bulgu (öneri: koordinatör GPT'ye; runner değişikliği bu işte yetkisiz).

## Cleanup
Playwright/Chromium süreçleri sonlandı (kalan 0), loopback sunucu kapandı, geçici betikler repo dışı; repoda yalnız bu dizin eklendi.
