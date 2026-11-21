# P3-10 — Masaüstü Ayarlar, eşleşen tek temsilci

**Sonuç: Render doğrulandı; tasarım eşleşmesi sağlanmadı.** [Lovable c144e989
referansı](../lovable-c144-preview/desktop-settings-narrow.jpg) ve [Kloda
renderer çıktısı](product.png) aynı nominal **521×849 CSS px, DPR 1, Türkçe,
koyu tema** ile karşılaştırıldı. Bunlar tam sayfa görüntüleridir: referans
JPEG 506×1426 (15 px tarayıcı kaydırma alanı hariç), ürün PNG 521×1302.
Bu yüzden piksel farkı değil, yapı, sıralama, metin ve durum karşılaştırıldı.

| Alan | Gözlem |
|---|---|
| Gezinme ve temel kontroller | İkisinde de dar ekranda iki sütunlu gezinme, Ayarlar başlığı, tema ve dil kontrolleri var. Ürün aktif öğeyi turkuazla, prototip açık renkli dolgu ile vurguluyor. Üründeki kurulum şeridi prototip görüntüsünde yok; test verisi/durum farkı olarak ayrıca eşlenmeli. |
| Bölüm ve düğme sırası | Prototip önce Arka plan çalışma'yı, sonra Tema ve Dil'i gösteriyor; çıkış en altta. Ürün önce Görünüm/Dil'i gösteriyor, ardından alıcı kartını; çıkış bu kartın başlığında. |
| Pencere kapatma ve OS durumu | Prototip iki seçenek ve örnek OS uyarıları gösteriyor. Ürün davranışı açıklıyor ve ayrı tercih sunmuyor. ADR0018 davranış sınırı korunmalı; sahte OS uyarısı veya seçim eklemek eşleme çözümü değildir. Ürün görüntüsünde sentetik `canHide: true` durumu kullanıldı; gerçek OS kanıtı değil. |
| Kurulum ve sürüm | Prototipte alt bölümde “Kurulumu yeniden başlat” var, ürün Ayarlar kartlarında eşdeğer satır yok. Prototip `0.9.0 (prototype)`, ürün `0.0.0` gösteriyor; bunlar farklı veri kaynakları, görsel eşitlik veya release bilgisi değil. |

Mevcut ve güncel renderer stamp'i yeniden kullanıldı. Mevcut capture
modülünün salt-okunur bridge stub'ı ve loopback sunucusu ile, viewport'u
eşlemek için tek gözlemsel Playwright çekimi yapıldı (standart runner
1000 px sabit yükseklik kullanır). Kaynak/build değişikliği yok. Inter yüklü,
yatay sayfa taşması yok, konsol hatası ve allowlist dışı bridge çağrısı yok.
[Ölçüm ve kaynak kimliği](measurement.json). Tarayıcı ve yerel servis kapandı.

Bu sonuç standart matris PASS'i, geniş masaüstü karşılaştırması veya fiziksel
OS kabulü değildir. Sonraki dar adım: gerçek durum/ADR farkları ile yerleşim
farklarını ayırıp D12 tasarım eşlemesini netleştirmek; bu çekimi tekrar etmemek.
