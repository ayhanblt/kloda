# M13 Ayarlar — tek dar yapısal karşılaştırma (21.11.2026, salt okunur)

Variant: `claude-agent/sonnet#medium` (Sonnet 5.5). Yeni capture/build/fixture/cihaz/araç/kod yok; eski ref koşusu yok. **Bu bir gözlemdir: native eşleşme, piksel eşitliği, görsel kabul veya matris PASS DEĞİLDİR.** `mobile.settings-bottom` `state_unavailable`, 5 tarihî FAIL ve D12 kaydı değişmedi.

## Girdiler
- Ürün: `settings-top.png` (sha `82a4a1ec…9777`) ve `settings-bottom.png` (sha `da45eae9…cf1a7`), 1206×2622 (402×874 pt), TR, **koyu** (ürün varsayılanı), content_size large(=normal), P3-02 Debug, `STATE.md`. İki görüntü arasında kalan (kaydırma ortası) bölge **hiç görüntülenmedi**; aşağıda tahmin edilmedi.
- Referans: `lovable-c144-preview/mobile-settings.jpg` (506×1142, web prototip, TR/koyu, tarayıcı; sha README'de `edd947bd…56e1bb`) + `source/src/views/mobile/activity-backups-settings.tsx.reference::MobileSettings` + `docs/ui/lovable-design-reference.md:74–84` (M13 uyarlama eşlemesi).

## Sıra (kaynak, referans görüntü ve ürün)
Referans/kaynak: Yedekleme → Gizlilik ve izinler → Genel (Tema, Dil) → "Kurulumu yeniden başlat" → Hakkında (Sürüm).
Ürün (kod `settings-page.tsx` + iki PNG): Yedekleme → Gizlilik → (arada görüntülenmeyen) → Dil/Tema seçenek kartı → Arka plan çalışma → "Kurulumu yeniden başlat" → Hakkında/Yapılandırma sürümü. Gözlenen sıra (Yedekleme, Gizlilik üstte; Dil listesi sonu, Arka plan, Kurulum, Hakkında altta) referansla **aynı ana sırayı** izler; Tema/Dil ve Gizlilik'in tam içeriği ürün PNG'lerinde görünmediği için bu bölgelerin karşılaştırması **yapılamadı** (kaynak kodu 'Görünüm' kartında system/dark/light radio satırları tanımlar, PNG'de doğrulanmadı).

## İzinli uyarlamalar (davranış; yerleşim farkı sayılmaz) — `lovable-design-reference.md:81–84`
| Referans öğesi | Üründe görülen | Sınıf |
| --- | --- | --- |
| "Mobil veri ile yedekle" anahtarı (etkin kontrol) | "Hücresel yedekleme" + "Bu sürümde hücresel yedekleme seçeneği yok." + **devre dışı** anahtar (üst PNG) | İzinli uyarlama (kapalı/disabled + açıklama) |
| Fotoğraf erişimi "Ayarlanmadı" pill'i | Yalnız "Fotoğraf erişimi — Fotoğraf kaynağı seçimini Kaynaklar'da yönet." başlığı (üst PNG, kart alt kenarı çubukta kesik); pill/izin durumu görünmüyor | İzinli uyarlama (demo izin durumu gösterilmez); alt kısmı PNG'de yok |
| Bildirimler anahtarı | Üst PNG'de görünmüyor (Gizlilik kartı çubukta kesik) | **Görülemedi** (viewport) |
| "Sürüm 0.9.0 (prototype)" | "Hakkında → Yapılandırma sürümü 0.0.0" (alt PNG) | İzinli uyarlama (`app.json::expo.version`, binary/release sürümü değil) |
| "Kurulumu yeniden başlat" (onay diyaloğu + reset) | Düz "Kurulumu yeniden başlat" düğmesi (alt PNG); onay/reset davranışı PNG'den gözlenemez | Davranış PNG ile doğrulanmadı |
| Satır başlıkları "Kaynaklar ve program / Ne zaman yedeklensin? / Yedekler" (chevron'lu satırlar tek kartta) | Ayrı tam genişlikli düğmeler "Ne yedeklensin? / Ne zaman yedeklensin? / Yedekler / Bulut yedekleri için kurtarma kodu" (üst PNG) | Yerleşim/biçim farkı (satır+chevron → düğme); "Kurtarma kodu" ürüne özgü ek öğedir (referansta yok) |

## Yerleşim/biçim farkları (gözlenen, bilinçli sınıflandırma yok)
- Referans: bölüm başlıkları kart dışında küçük (Yedekleme/Gizlilik ve izinler/Genel/Hakkında), kartlar ince satırlı; ürün: başlıklar kart içinde büyük (Yedekleme, Gizlilik, Hakkında), geniş padding, sayfa üstünde "Geri" düğmesi ve büyük "Ayarlar" başlığı. Referansta üst şeritte logo "Kloda" var, ürün PNG'sinde yok.
- Ürün alt sekme çubuğu 4 sekme (Durum/Fotoğraflar/Hedefler/Ayarlar); referansta aynı dört sekme (görüntüde Lovable rozeti ve Genel/Dil kartlarının üzerine biniyor).
- Ürün: "Arka plan çalışma" kartı + "Yedekleme Aktivitesi" düğmesi referansta yok (ürün/iOS gerçek arka plan açıklaması).
- Ürün 402 pt genişlik/3x, referans 506 px web (440 CSS px içerik) → ölçek/boyut doğrudan karşılaştırılamaz.

## Viewport / dev-client nedeniyle görülemeyenler
- Ürün üst PNG: Gizlilik kartı alt çubuk altında kalıyor (Bildirimler, Görünüm/Tema görünmedi); alt PNG: Dil kartının üst kısmı ve Tema kartı görünmüyor. İki PNG arası (Gizlilik→Dil) **görüntülenmedi**.
- Sağ üstte dev-client "Tools" yüzen düğmesi üst PNG'de "Geri"ye, alt PNG'de Dil listesine biniyor (ürün UI'sı değil).
- Referans: Lovable rozeti ve sekme çubuğu Genel/Dil kartlarını kısmen örtüyor.

## Sonuç
Ana bölüm sırası ve izinli uyarlamalar (hücresel kapalı+açıklama, sürüm=yapılandırma) gözlemle tutarlıdır; Bildirim/Tema/Dil/foto pill ve kaydırma ortası kanıtsızdır; yerleşim farkları (başlık düzeni, kart/satır biçimi, "Geri"/kurtarma kodu/Arka plan kartı) listelenmiş ve **kabul edilmemiş/etiketli gözlemdir**. Görsel kabul yöntemi tanımlanmadı.

## Tek somut sonraki adım (kanıt tekrarı yok)
Koordinatör, M13 için yalnız bu karşılaştırmayı P3-10 satırına "yapısal gözlem — kanıtsız bölgeler açık" olarak işlesin; kaydırma ortasını kanıtlamak ancak yeni bir kullanıcı kaydırma oturumu (aynı yöntem, ek PNG) gerektirir — bu kapsam kararıdır ve burada önerilmez/başlatılmaz.
