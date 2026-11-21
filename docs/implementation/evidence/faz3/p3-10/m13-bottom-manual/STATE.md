# M13-alt manuel kontrol — sahipli durum (20.11.2026, aşama 1)

Variant: `claude-agent/sonnet#medium` (Sonnet 5.5). Credential/env kaydı yok. M13-alt `state_unavailable` + 5 FAIL korunur; tam görsel/matris PASS yok.

- Simulator: `Kloda-M13Manual-1795207741`, UDID `2480FEB1-006B-41C8-860A-2D5D8CC1BFD7` (iPhone 17 Pro, iOS 26.5; bu iş için yeni oluşturuldu; UDID `/private/tmp/p3-03-scripts/m13-sim.udid`).
- Uygulama: P3-02 Debug `.app`, `debug.dylib` sha256 `bc7b6bfd1492…60a9` (`app-hash.log`), `com.kloda.app` pid 34619 (launch.log).
- Metro: `expo start --dev-client --localhost --port 18082` (klon `/private/tmp/kloda-p3-02/apps/mobile`, `CI=1`); kabuk pid `/private/tmp/p3-03-scripts/m13-metro.pid`, dinleyen pid 33898 (`metro-listen.pid`); URL `http://localhost:18082/node_modules/expo/AppEntry.bundle?platform=ios&dev=true&minify=false` (normal Expo AppEntry; HTTP 200). `metro.log`.
- Koşul: dil TR, `simctl ui` content_size `large` (= runner "normal"), appearance `light` (sistem). **Sapma:** ürün tema tercihi varsayılanı `dark` (`theme-provider.tsx:13`, kayıtlı tercih yok) → uygulama **koyu** açıldı; tema değiştirilmedi (alt bölümde, ek kullanıcı eylemi olurdu). Bu yüzden varyant **TR/koyu/normal** (frozen M13 JPG'si de koyu). 402×874 pt.
- Önce PNG: `precheck-welcome.png` sha256 `6ad3d9ee…932a`: normal Karşılama ekranı (üst konum DEĞİL, Ayarlar değil); sağ üstte dev-client "Tools" düğmesi.
- Yazma/izin/ürün değişikliği yok; hesap/gerçek cihaz yok.

## Cleanup planı (kullanıcı yanıtı sonrası veya kesintide)
`xcrun simctl terminate/shutdown/delete 2480FEB1-…`; Metro: `kill` kabuk ve dinleyen pid (komut satırı `expo start … 18082` doğrulanarak); 18082 dinleyen 0, `simctl list` içinde `M13Manual` 0; klondaki P3-02 artefaktları ve ürün dosyaları dokunulmaz.

## Aşama 2 — Ayarlar üst PNG (21.11.2026, kullanıcı "hazır" sonrası)
Aidiyet yeniden doğrulandı: Simulator `Kloda-M13Manual-1795207741` / UDID `2480FEB1-006B-41C8-860A-2D5D8CC1BFD7` Booted (listede tek `M13Manual`); `com.kloda.app` çalışıyor; Metro kabuk/dinleyen pid 33898 (`expo start … --port 18082`), 18082 dinleyen aynı pid. Başka cihaz/süreç kullanılmadı.
`settings-top.png`: 1206×2622 px (402×874 pt, 3x), sha256 `82a4a1ecf2b46b44500882931ace18331c75418d3baef4d205a9931649cf9777`.
Gözlem: başlık "Ayarlar", üstte "Geri" düğmesi; Yedekleme (4 düğme + hücresel anahtar) ve Gizlilik başlangıcı; alt sekme çubuğu "Ayarlar" aktif; TR; **koyu** tema (varsayılan, bkz. aşama 1 sapma); `content_size large` (= normal). **Hakkında / Yapılandırma sürümü görünmüyor** (yalnız Gizlilik'in başı) → üst konum doğrulandı. Sağ üstte dev-client "Tools" overlay'i "Geri" düğmesine biniyor (ölçümde not). Alt PNG alınmadı; kaynaklar korunuyor.

## Aşama 3 — alt PNG ve cleanup (21.11.2026, kullanıcı "hazır" sonrası)
Aidiyet doğrulandı: UDID `2480FEB1-006B-41C8-860A-2D5D8CC1BFD7` Booted (tek `M13Manual`), `com.kloda.app` çalışıyor, Metro kabuk/dinleyen pid 33898 (`expo start … --port 18082`), `content_size large`.
`settings-bottom.png`: 1206×2622 px (402×874 pt, 3x), sha256 `da45eae9b712f1192ee4ff9081cf7ab9f0342e59f64ba48db98d8786332cf1a7`; üst PNG `settings-top.png` sha `82a4a1ec…9777` (farklı).
Bizzat gözlem: TR, koyu; üstte Dil seçenekleri (Türkçe/English/Deutsch) kartının sonu, ardından "Arka plan çalışma" kartı (+ "Yedekleme Aktivitesi"), "Kurulumu yeniden başlat" düğmesi ve **"Hakkında" kartında "Yapılandırma sürümü 0.0.0" satırı tam görünür, alt sekme çubuğunun (Durum/Fotoğraflar/Hedefler/Ayarlar) hemen üstünde**; kart alt kenarı ile çubuk arasında boşluk var, kırpma yok. Üst PNG'de bu satır görünmüyordu (yalnız Yedekleme/Gizlilik başı) → kaydırmayla alt duruma erişim kanıtlandı. Dev-client "Tools" overlay'i sağ üstte (üst PNG'de "Geri" düğmesine, alt PNG'de Dil listesine biniyor). Saat 00:36 → 00:41 (aynı oturum).
Kapsam: yalnız alt duruma erişim kanıtı (gerçek kullanıcı kaydırması, TR/koyu/normal). **P3-10 görsel kabul veya matris PASS değil**; frozen M13 native eşi yok, `mobile.settings-bottom` `state_unavailable` ve 5 FAIL değişmedi.

### Cleanup (doğrulandı)
`simctl terminate` → Metro 33898 komut satırı doğrulanarak `kill` (metro-gone) → `simctl shutdown`+`delete` UDID 2480FEB1… (exit 0). `simctl list` içinde `M13Manual` 0, 18082 dinleyen 0, `expo start…18082` süreci 0. Klon `/private/tmp/kloda-p3-02` ve P3-02 artefaktları ile ürün dosyaları dokunulmadı; başka cihaz/süreç kullanılmadı.
