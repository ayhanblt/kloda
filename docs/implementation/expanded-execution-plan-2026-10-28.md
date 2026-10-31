# Kloda — genişletilmiş yürütme planı, 28 Ekim 2026

**Son güncelleme:** Lovable tasarımı onaylandı ve MCP erişimi doğrulandı; [bağlayıcı kaynak ve revizyon](../ui/lovable-design-reference.md). iOS Live Activities18’den sonra19’a eklendi; bütünleşik20, final kabul21.

Durum: Kullanıcı bugünkü tasarım/bağlantı genişletmesini plana eklemeyi ve toplu
fiziksel/uçtan uca kabulü en sona taşımayı onayladı. Bu kayıt sıra ve kapsamı tanımlar;11/12 yürütme sonuçları aşağıda bağlıdır.
Sağlayıcı hesabı, ücretli hizmet veya fiziksel kabul izni yerine geçmez.

## Numaralandırma ve korunan sonuçlar

Önceki [mobil yürütme listesi](mobile-execution-checklist-2026-10-24.md)1–10,
kendi kaynak/otomatik/izole kabul sınırlarıyla korunur. Tamamlanmış receiver,
journal/resume, cihaz/ACL, retention/suppression, lifecycle ve retry yeniden
uygulanmaz. Önceki11 Toplu kabul, yeni **21** numaralı son adımdır. Bundan sonra
“11. adıma geç” tasarım alımını; “kabul adımı”21’yi belirtir. Tarihsel belgelerdeki
eski11 atıfları yeni test veya kapanış iddiası değildir.

108 test/11suite, Android dar UI/reopen ve iOS Simulator sonuçları önceki
[10. adım](mobile-integrated-step10-2026-10-28.md) ve
[Android followup](mobile-android-step10-followup-2026-10-28.md) kanıtlarıdır;
bu plan hazırlanırken tekrar çalıştırılmadı. Gerçek native PC/LAN ve geniş fiziksel
kabul açık kalır.

## Güncel sıra

| No | İş | Bitirme ölçütü / durum |
| --- | --- | --- |
|11|Lovable tasarım alımı ve eşleme — TAMAM|[151dosya/7JPEG/42kapsam/6capture ve native eşleme](lovable-design-intake-step11-2026-10-28.md) doğrulandı; revizyon cb1143d16f73. Eski Stitch arşivlenip kaldırıldı.12kaynak/otomatik kapsamı uygulandı; Android native görsel açığı ayrı.|
|12|Ortak uygulama kabuğu ve ana akışların uyarlanması — KAYNAK/İZOLE KAPSAM UYGULANDI, ANDROID GÖRSEL AÇIK|[123mobil test, Desktop/iOS görsel ve sınırlar](lovable-ui-step12-2026-10-28.md). Android ADB unauthorized; native görsel NOT_RUN. Mobil ana gezinme, ana sayfa, kurulum atla, kaynak/program, PC/QR, Activity/restore, bağlantılar ve ayarlar; Desktop alıcı/devices/incoming/backups/trash/settings ve giden hedefler. Mevcut native bileşenleri bağla; önce tasarım shell/prototype ile canlı özelliği ayır. Her rota geri dönüşlü ve erişilebilir olsun.|
|13|Galeri ve fotoğraf detayı — DAR KAYNAK/OTOMATİK/İZOLE iOS UYGULANDI; ANDROID RUNTIME AÇIK|[29Ekim uygulama/kanıt](photos-gallery-step13-2026-10-29.md). İzinli seçilmiş kaynaklarla liste/boş/limited-permission/detay/yedek durumunu eşle. Sahte medya veya başarıyı gerçek diye sunma. Mevcut metadata/Photos API’lerini kullan; geniş thumbnail cache/arama/EXIF/yeni yerel silme politikası gerektiriyorsa somut karar kapısı aç.|
|14|Protokol ve bulut teknik uygunluk/karar matrisi|Her P/C için resmî API/SDK, lisans, platform, auth/credential custody, upload/list/restore, kesinti/idempotency, limit/maliyet ve hesap gereksinimini kaynakla doğrula. Aşağıdaki güvenlik kararlarını ve gerekli ADR’leri yaz; yeni global kuyruk/SDK seçimini varsayma. [29Ekim16/16matris](provider-decision-matrix-step14-2026-10-29.md) hazır; D1–D3ADR0022ile onaylandı; fiyat/SDK/platform açıkları korunur. Çalışma onayı kararların yerine geçmez.|
|15|Mevcut WebDAV’ın eksik mobil gönderimini tamamlama — KAYNAK/OTOMATİK/İZOLE KAPSAM UYGULANDI|[Güncel native/restore kanıtı ve açık platform kabul kapıları](mobile-webdav-step15-native-checkpoint-2026-10-29.md). Android SAF/Photos ve iOS PhotoKit own restore PASS; gerçek ürün picker/UI/BG/signing kabulü20/21’de korunur. Mevcut tek profil/test-warning ve kalıcı iş/ayar/retry yapılarını kullan; mobil gerçek byte upload/status/sonuç/restore kapsamını belirleyip bağla. Desktop’ın tamamlanmış göndericisini yeniden yazma. İzole sunucuda kayıp yanıt, kesinti, context değişimi, çakışma ve güvenli yeniden deneme kanıtı.|
|16|SMB, SFTP ve FTP bağlantı/aktarımı —16a NATIVE TEMEL / ÜRÜN GATE AÇIK|[30Ekim D6A+D7A native yayın checkpointi](smb-native-publication-checkpoint-2026-10-30.md). Ürün kapalı;16b/16c atlanmadı. 16a SMB LAN-only;16b SFTP host identity doğrulamalı;16c FTP ancak onaylanmış güvenli profil varsa. Her biri ayrı dar dilim: form+gerçek adapter+job/context/error/restore sözleşmesi+izole otomatik kanıt. Karar verilmeyen seçenek görünür fakat çalışır gösterilmez.|
|17|S3 uyumlu ve Amazon S3|P5 ile C1 ayrı ekran/konfigürasyon; uygunsa aynı doğrulanmış adapter kullan. Endpoint/region/bucket/prefix ve credential bağlamı; multipart/abort/retry/belirsiz commit ve integrity kanıtını mevcut iş kimliğiyle ele al. Ortak içerik veya ETag tek başına tamamlanma/suppression kanıtı sayılmaz.|
|18|Diğer bulut sağlayıcıları|C2–C11 aşağıdaki ayrı checklist ile tek tek kapatılır. Ortak protokol/API gerçekten eşdeğerse adapter tekrar kullan; sağlayıcı auth/limit/davranışını eşdeğer varsayma. Her sağlayıcıda gerçek adapter ve güvenli credential/iş bağlamı, UI durumları, izole fixture/sandbox kanıtı gerekir. Hesap/maliyet/erişim engeli görünür kalır.|
|19|iOS Live Activities — kilit ekranı|Onaylı Lovable lock-screen tasarımını gerçek native iş/ACK durumuna bağlama; ActivityKit/WidgetKit extension, signing/OS uygunluğu, mahremiyet ve lifecycle/action sınırları önce doğrulanır. Stale/paused/wait/error/completed ayrılır; native SwiftUI/Tailwind uyumsuzluğu ve varsa yeni yetki/push kararı kullanıcıya sunulur. Background çalışma garantisi veya yeni upload yetkisi değildir.|
|20|Genişletilmiş bütünleşik kapanış ve platform hazırlığı|Yeni akışların otomatik/regresyon, Simulator/emülatör, görsel/a11y ve ayrı güvenlik review’u; gerçek normal macOS uygulamasının imza/alıcı kapısı, WindowsD3 ve Linux provider durumunu güncel kanıtla değerlendir. Koruma kopyasıyla eşzamanlı receiver latency, staging/alan ve retry maliyetini izole ölç. Açık SDK config olayını ve eski scope locator sınırını koru.|
|21|Toplu fiziksel/uçtan uca kabul — en son|Açık kullanıcı yürütme izni, hazır platform/sağlayıcı hesabı ve disposable verilerle gerçek Android/iPhone↔PC ve onaylanmış dış hedefler. Kaynak/izin/aktarım/restart/background/revoke/remove/trash/restore/suppression/performans/erişilebilirlik. Engelli platform veya sağlayıcıyı sessizce çıkarma; kapsam/karar ve NOT_RUN kaydıyla raporla.|

Bir alt dilim bittiğinde ilgili kanıt ve checklist güncellenir. Tasarım dosyasının
varlığı API/ürün implementasyonu; build PASS da gerçek platform desteği değildir.

## Sayfa kapsamı ve kaynakları

Kullanıcının Lovable’a gönderdiği prompt ve ekli sayfa envanteri42 tasarım kalemidir:
- Mobil13: M1 karşılama/atla, M2 kaynak, M3 program, M4 ana sayfa/galeri,
  M5 fotoğraf detayı, M6 bağlantılar, M7 ekle, M8 PC, M9 QR, M10 detay,
  M11 Activity, M12 yedek/restore, M13 ayarlar.
- Desktop13: D1 karşılama/atla, D2 alıcı ana sayfa, D3 QR, D4 cihaz/ACL,
  D5 incoming, D6 sürümler, D7 çöp, D8 bağlantılar, D9 ekle/detay,
  D10 kaynak/program, D11 giden işler, D12 ayarlar, D13 tray/menu.
- Protokol5: P1 WebDAV,P2 SMB,P3 FTP,P4 SFTP,P5 S3 uyumlu.
- Bulut11: C1 Amazon S3,C2 Box,C3 CloudMe,C4 Dropbox,C5 Google Drive,
  C6 Google Cloud Storage,C7 Kolab Now,C8 MEGA,C9 OneDrive,
  C10 Nextcloud,C11 Yandex Disk.

42 kalem ayrı42 native route zorunluluğu değildir; ortak form, alt görünüm ve
OS yüzeyi olarak tekrar kullanılabilir. Prototip demo durumları release’e
mocked ready/transfer/account olarak taşınmaz. LogoSVG, azaltılmış hareket,
Lucide, Tailwind ve FSD korunur; Lovable web kodu doğrudan native uyumlu sayılmaz.
28Ekim kullanıcı teyidi: yeni sayfa/bileşenlerde inline style veya sayfa içi
StyleSheet yok; Tailwind/mevcut NativeWind ve ortak global CSS kullanılır. Legacy
kod yalnız ilgili ekran uyarlanırken ele alınır; native SwiftUI/OS uzantısı
uyumsuzluğu dar istisna kararı gerektirir. [Bağlayıcı tasarım/kod kuralları](../ui/lovable-design-reference.md).

## Sağlayıcıların ayrı takip listesi

| Kalem | Şu anki gerçek durum | Sıradaki işlem |
| --- | --- | --- |
|P1 WebDAV|Mobil native byte sender/bağımsız queue/review/Files+Photos restore bağlı; scoped SDK kanıtları PASS,15 kabulü açık. [Güncel checkpoint](mobile-webdav-step15-native-checkpoint-2026-10-29.md). Desktop sender yeniden yazılmadı.|15|
|P2 SMB|Ekran/entegrasyon yeni kapsam; LAN-only sınırı mevcut.|14→16a|
|P3 FTP|Ekran yeni kapsam; şifresiz credential/payload aktarımı mevcut güvenlik onayı değildir.|14 güvenli profil/FTPS desteği kararı→16c|
|P4 SFTP|Ekran/adapter yeni; host-key kabul/değişim politikası seçilmedi.|14→16b|
|P5 S3 uyumlu / C1 Amazon S3|Endpoint, credential ve commit sözleşmesi incelenmedi.|14→17|
|C2 Box|Tasarım kapsamı onaylı; API/auth/adapter henüz doğrulanmadı.|14→18a|
|C3 CloudMe|Aynı; protokol desteği varsayılmadı.|14→18b|
|C4 Dropbox|API/auth/adapter incelenmedi.|14→18c|
|C5 Google Drive|API/auth/adapter incelenmedi.|14→18d|
|C6 Google Cloud Storage|API/auth/adapter incelenmedi; S3 eşdeğeri varsayılmadı.|14→18e|
|C7 Kolab Now|Dosya API/protokol ve kullanım uygunluğu incelenmedi.|14→18f|
|C8 MEGA|API/SDK/lisans/credential ve transfer uygunluğu incelenmedi.|14→18g|
|C9 OneDrive|API/auth/adapter incelenmedi.|14→18h|
|C10 Nextcloud|Sağlayıcı ayrıntıları ve auth incelenmedi; WebDAV yeniden kullanımı kanıtlanacak.|14→18i|
|C11 Yandex Disk|API/auth/adapter incelenmedi.|14→18j|

18a–j numaraları izlenebilirlik içindir;14 bulgularıyla uygulama sırası en küçük
tekrar kullanım dilimine göre önerilebilir. Sağlayıcı atlamak veya kapsamdan
çıkarmak kullanıcı kararı olmadan yapılmaz. Şu anda hiçbiri “çalışıyor” sayılmadı.

## Karar kapıları — şimdi varsayılmayacaklar

1. **FTP ve kanal güvenliği:** Mevcut TLS/DTLS/SSH veya uygun güvenli kanal sınırını
   şifresiz FTP’ye çevirmiyoruz. Plain FTP/FTPS, sertifika doğrulama ve LAN/remote
   kapsamı14’te somut seçeneklerle kullanıcıya getirilecek.
2. **SFTP sunucu kimliği:** İlk host-key kabulü/değişim ve credential/anahtar türü
   seçilmeli; otomatik trust veya SSH private-key export varsayılmayacak.
3. **Bulut auth/custody:** Her serviste desteklenen login/token refresh/revoke,
   minimum scope ve native secure store gerekir. Ortak OAuth var sayılmaz;
   mobile’a provider client-secret gömülmez. Backend OAuth broker, token saklama
   veya yeni hesap hizmeti zorunlu olursa yeni mimari/mahremiyet kararı gerekir.
4. **Provider maliyeti/koşulları:** Kayıt/app verification/inceleme, test hesabı,
   storage/egress/request ücreti veya SDK lisansı incelenmeden ücretsiz/tam destek
   taahhüdü yok. Ücretli kaynak ve gerçek kullanıcı hesabına yazma ayrı izin ister.
5. **İş ve veri tutarlılığı:** Kaynak sürümü, destination/account/bucket bağlamı,
   resumability, commit kanıtı ve suppression provider desteğiyle eşlenmeli.
   PC-local ACL/ADR0019 çöp protokolü üçüncü tarafa otomatik taşınmaz. Bulutta
   silme/retention veya restore overwrite politikası yeni onay olmadan eklenmez.
6. **Galeri:** Kaynak izinleri, limited-library, thumbnail/private cache ve
   yerel silme/alan açma sınırları tasarım aksiyonu var diye onaylanmış sayılmaz.
7. **Platform:** macOS normal imzalı .app/receiver, WindowsD3 ve Linux identity/
   storage ayrı kapılar. iPhone Secure Enclave/OS delivery, Android eskiOS/16KB,
   tam reader/performans kabulü eski fixture’larla kapanmaz. Ubuntu LTS/GNOME ve
   Kubuntu LTS/KDE hedefleri değişmedi. Yeni bilgi olmadan Windows araştırması yok.

## Dilim başına doğrulama

- Değişen mantığa ilgili otomatik test, lint/typecheck/build; gerekiyorsa native
  compile/clippy ve dar izole smoke. İlgisiz bütün matris tekrar edilmez.
- Credential/token redaction; redirect/endpoint/host identity; gerçek hatada stale
  başarıyı kaldırma; foreground trust/grant fence; callback/context yarış review’u.
- Kesinti/kayıp yanıt/restart/aynı işin tekrarı; no-overwrite ve belirsizlikte ret.
- TR/EN/DE; küçük/geniş pencere; büyük font/klavye/focus ve ekran okuyucu hazırlığı.
-29Ekim kullanıcı kararıyla yalnız ana ajan; güvenlik/sonuç review'u ayrı geçişte yapılır, bağımsız ajan review'u diye sunulmaz. Gerçek bağımsız inceleme kapısı varsa açık raporlanır. NOT_RUN/BLOCKED geçmiş PASS ile gizlenmez.
- Native kullanıcı arşivi ve mevcut authority değil, disposable/synthetic/sandbox
  veriler. Sağlayıcı sandbox imkânı yoksa otomatik test gerçek hesap kabulü sayılmaz.

## Gerekli fakat bu genişletmeye otomatik eklenmeyen işler

E2EE/key lifecycle, hesap/MFA/recovery, uzaktan PC/P2P/relay, Files two-way/conflict/
versions ve migration ayrı ürün backlog’u. Galeri’nin yalnız yeni onaylı sayfa/
kaynak eşlemesi13’e alındı; gelişmiş arama/katalog/medya düzenleme ayrıca seçilir.
PC bağlantısı için merkezi login/JWT/KMS zorunlu olmaz. Kullanıcı hesabına ait
provider oturumu PC-local yetkilendirme yerine geçmez. ADR0016/17/18/19/20 ve
mevcut kaynak/job/retry güvenlik sınırları korunur.

Önceki Android SDK devices.xml/.old olayı açık kayıttır; restore/cleanup yapılmadı.
Git add/commit/push/reset/clean/stash yok; model/effort değiştirilmez. Genel fiziksel
kabul duraklatması21 için açık izin gelene kadar sürer. 11tasarım/asset alımı tamamlandı; **sıradaki12: ortak uygulama kabuğu ve ana akışların onaylı Lovable tasarımına uyarlanması**.12 henüz başlamadı.
