# P3-10 frozen görüntü uygunluğu — salt okunur eşleme (20.11.2026)

Variant: `claude-agent/sonnet#medium` (Sonnet 5.5). Yalnız yerel dosya okuma; ağ, Lovable rebuild/publish, arşiv açma, fixture/capture/build, ürün/araç değişikliği yok. MANIFEST/CURRENT/plan değişmedi.

## Sonuç (tek cümle)
`lovable-design-reference.md:88–93`'ün "6 web önizleme capture"ı **eski cb1143 revizyonuna** aittir ve diskte yoktur; bağlayıcı c144e98938da'da yalnız 7 Durum/Fotoğraflar/kilit-ekranı JPG'si vardır ve **welcome, provider, settings, Desktop Ayarlar veya tray için hiç uygun sabit görüntü yoktur** → bu beş hedef için görsel PASS verilemez; cb1143 veya ara-paket görüntüleri ikame edilmez.

## Kanıt zinciri
1. **Satır 88–93:** "151 kaynak, 7 doğrulanmış JPEG ve 6 web önizleme capture" + `c144e98938da/README.md` bağlantısı. Bağlayıcı `c144e98938da/manifest.json`: `sourceCount` **172**, `captures` **7** (hepsi `reference-*.jpg`). `c144e98938da/README.md` **mevcut değil** (kırık bağlantı). Yani cümle iki revizyonu karıştırıyor: 7 JPEG = c144; 151 kaynak ve 6 capture = cb1143.
2. **6 capture = cb1143:** step11 alım raporu 41–48: "6 screenshot [manifestte](../ui/lovable-reference/cb1143d16f73/manifest.json)". `c144e98938da/lovable-retirement.json` (`oldRevision cb1143d16f73…` → `replacement c144e989…`, kullanıcı ONAY'ı) tam altı PNG listeler: `desktop-receiver`, `lock-screen-reference`, `mobile-activity`, `mobile-connections`, `mobile-gallery-populated`, `mobile-gallery` (sha `91fa2e66…`, `08ce6842…`, `70aa6fe0…`, `95dc2549…`, `a6442ffa…`, `5b2bbe21…`). Dizin `docs/ui/lovable-reference/cb1143d16f73/` diskte **yok** (arşive alındı: `.local-evidence/ui-lovable-2026-10-30/lovable-cb1143d16f73-retired.zip`, sha `bb26a607…`; **açılmadı**). Ayrıca konuları (receiver, activity, connections, gallery, lock) hedef beş ekranı (welcome/provider/settings/Desktop Ayarlar/tray) içermez.
3. **c144e989 JPG'leri:** manifest kapsamı "Published Lovable prototype, simulated state only; not product/native/platform evidence"; provenance: "Public screenshot build SHA not independently attested; captures are published visual reference, not Git blob proof". İçerik: status-setup (Durum, koyu), safe-{light,dark}, syncing-{light,dark} (Durum), photos (Fotoğraflar), lock-screen. Welcome/provider/settings/D12/D13 yok. Genişlik 375/390 px web görüntüsü.
4. **`evidence/lovable-ui-interlude-2026-10-30/screenshots/` (mobil 30, desktop 22 JPG; ör. `settings-*`, `blocked-provider-*`, `receiver-*`):** Lovable referansı **değil**, o günün **ürün** çıktısı (RN Web / desktop renderer, `manifest.json` phase: "RN Web/desktop renderer visual evidence; native acceptance gates remain open"; native görsel kapı **BLOCKED, not PASS**). `reference.revision = c144e989` yalnız hangi tasarıma göre yapıldığını söyler. Güncel kaynak o tarihten sonra değişti (çalışma ağacında çok sayıda modifiye dosya) ve hash eşleşmesi kurulmadı → ne frozen referans ne geçerli güncel baseline; otomatik ikame edilmez.

## Hedef × uygun sabit görüntü
| Hedef | c144e989 JPG | cb1143 PNG | Ara-paket ürün JPG (30 Eki) | Karar |
| --- | --- | --- | --- | --- |
| mobile.welcome | yok | yok | — | referans görüntü YOK |
| mobile.provider-generic | yok | yok | `blocked-provider-*` yalnız ürün çıktısı | referans YOK |
| mobile.settings | yok | yok | `settings-*` ürün çıktısı | referans YOK |
| desktop.settings | yok | yok | `settings-*` ürün çıktısı | referans YOK |
| desktop.tray | yok | yok | tray görüntüsü yok | referans YOK |

## Sonuç ve kabul yöntemi
Görsel PASS kullanılamaz; kabul yöntemi değişmedi (frozen görüntü + aynı ekran/dil/tema/boyut). Kaynak farkı yalnız **etiketli bilgi** olarak okunabilir (örnek, önceki RESULT: Desktop ayarlar `d.settings.tsx.reference` → `DesktopSettings` demo-only kaynağı ile ürün yapısı farklı; onaylı uyarlama kaydı yok) — bu bir kabul değil.

## Koordinatör için düzeltilecek kayıt hataları (kod değil, kayıt)
- `docs/ui/lovable-design-reference.md:88–93`: "151 kaynak / 6 web önizleme capture" cb1143'e aittir; c144 için 172 kaynak + 7 JPEG; `c144e98938da/README.md` bağlantısı kırık.
- Kullanıcı kararı gerektiren seçenek: hedef beş ekran için yeni referans görüntü (kullanıcı onaylı) veya kabulün kaynak-düzeyi yönteme çevrilmesi.
