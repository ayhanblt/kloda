# P3-10 — bağlayıcı Lovable önizleme görüntüleri

Proje `222ef478-8826-4712-b3c4-9703a823f69d`. Kaynak HEAD
`c144e98938da96f698f378972290ff3d1dd311eb`; beş rota için HTTP 200 önizleme
yanıtında `x-lovable-project-revision: c144e989` doğrulandı. Kullanıcı tarayıcıda
kendi hesabıyla giriş yaptı; kimlik bilgisi kaydedilmedi. Yalnız mevcut
önizleme rotaları açıldı; tasarım, backend, build ve yayın değiştirilmedi.

Tam sayfa ham JPEG'ler; kırpma ya da yeniden boyutlandırma yapılmadı. İçerik
Türkçe/koyu, nominal tarayıcı viewport'u 521×849 CSS px, DPR 1; görsellerde
Lovable rozeti kalabilir. Mobil prototip içerik genişliği 440 CSS px.

| Ekran | Prototip rotası | JPEG piksel boyutu | SHA-256 |
|---|---|---|---|
| [Karşılama](mobile-welcome.jpg) | `/m/welcome` | 506×978 | `da2c1f3f2c80f957956852a52edcf9e35e4ee1623c6d8c89e47bc1f3a3aa012f` |
| [Box sağlayıcı](mobile-provider-box.jpg) | `/m/connections/new/box` | 521×849 | `54ed12fe2f660d6395ee7bc743f408ccfa39d173072f8c12576280af455e44eb` |
| [Mobil Ayarlar](mobile-settings.jpg) | `/m/settings` | 506×1142 | `edd947bd30367cf5c1c4c3b8a624a85468aef39084dadb6dac1a130b4556e1bb` |
| [Masaüstü Ayarlar, dar](desktop-settings-narrow.jpg) | `/d/settings` | 506×1426 | `43a1a9be6d798106b29df5e8b4faba3b861907ee20214f9d6b85cad0ce93e0be` |
| [Masaüstü tray prototipi, dar](desktop-tray-narrow.jpg) | `/d/tray` | 506×955 | `660c7b4d7ed4d43156454203788e703a66ec2979891f4b5437b061e304597814` |

Bu kayıt, doğru revizyondaki tasarımın referansıdır; Kloda ürününden alınan
görsel veya karşılaştırma sonucu değildir. Masaüstü çekimleri dar responsive
yerleşimi gösterir; önceki 1440 px ürün koşusuyla eşdeğer değildir. Mobil web
çekimleri native viewport/DPR ve sistem chrome'u ile birebir eş değildir.
M13 tam sayfa görüntüsü native M13-alt davranışını doğrulamaz. Görsel kabul,
eşleşen varyant ve ürün kanıtı gelene kadar açık; bu turda fixture hazırlanmadı.
