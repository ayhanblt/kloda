# P3-10 — Masaüstü Tray (D13), eşleşen tek temsilci

**Sonuç: Render doğrulandı; tasarım eşleşmesi sağlanmadı (yapı/içerik farkları var).**
[c144e989 `desktop-tray-narrow.jpg`](../lovable-c144-preview/desktop-tray-narrow.jpg)
(506×955, sha256 `660c7b4d…7814`, README ile eşit) ve [ürün renderer çıktısı](product.png)
(521×1053, sha256 `8e46bb69000cc0300248f206d90d616dec1106dfc0956c96e206138e4a4dac02`)
aynı nominal **521×849 CSS px, DPR 1, TR, koyu** ile karşılaştırıldı; ikisi de tam
sayfa, bu yüzden piksel farkı değil yapı/metin/durum karşılaştırması. Ölçüm: [measurement.json](measurement.json), [metin](product-text.txt), [log](shot.log), exit 0 ([shot.exit](shot.exit)).

## Yöntem (pasif)
Mevcut renderer stamp'i yeniden kullanıldı (`fresh: true`, src `fb20cf35…`, renderer
`450e8e5b…`; D12 FIX ile aynı, derleme yok). `desktop.STUB` read-only bridge + sahipli
loopback; rota `#/tray`; tek gözlemsel Playwright çekimi (standart runner 1000 px
sabit yükseklik kullanır, kullanılmadı). Klavye yok, hiçbir düğme/radyo etkinleştirilmedi.
Betik repo dışı (`/private/tmp/d13-scripts/shot.py`). Kaynak/build/fixture değişikliği yok.

## Gözlem
`h1` "Tray menüsü", `role=group` menü + `role=status` "Dinliyor"; Aç etkin, iki duraklatma
düğmesi `disabled`, Çık etkin. Inter yüklü, yatay taşma yok, console hatası 0, bridge
çağrısı 0, `lang=tr`, tema koyu. Tarayıcı, bağlam ve loopback kapandı.

## c144 ↔ ürün farkları
| Alan | Prototip | Ürün |
|---|---|---|
| Başlık/açıklama | "Tray / menü çubuğu"; kısa platform listesi | "Tray menüsü"; uzun açıklama (destek yoksa pencere korunur) |
| Menü kartı | Durum "Alıcı açık" yeşil nokta; "2 telefon · 14 dosya geliyor" | Pill "Dinliyor"; "Etkin yedekleme yok." |
| Duraklat | İki satır etkin görünümlü | İki satır `disabled` + açıklama (D-G23 onaylı gerçek desteklenmeme) |
| Ek öğe | Sağda "Tray / menü çubuğu" ikon örnekleri kartı | Yok |
| Kabuk | Üstte yalnız marka; vurgu açık dolgu | Ek "Bu bilgisayar / Kuruluma başla" şeridi; vurgu turkuaz |
| Menü kartı ölçü/yerleşim | ~287 px, sol; sağda ikon kartı | w-72, sol; sağ boş |

## Sınırlar
Prototip "2 telefon · 14 dosya" ve etkin duraklatma simüle veridir; ürün durumu STUB'ın
read-only `receiver.available=true`, boş aktivite durumu — gerçek akış/OS değil. Duraklat
etkin olmaması ve açıklama ürün kararıdır (D-G23), sahte etkinleştirme eklenmez. İkon-örnek
kartı ve açıklama uzunluğu tasarım farkı olarak GPT/koordinatörde değerlendirilmeli.
Bu bir D13 tek temsilci gözlemidir: native OS tray, piksel eşitliği, 1440, matris veya
Faz3 PASS değil; D12 kabulü, tarihî FAIL ve sayaçlar değişmedi.

## Sonraki adım
Koordinatör farkları (ikon-örnek kartı, açıklama/durum metni) tasarım kararı olarak sınıflandırır; bu çekim tekrarlanmaz.
