# Kloda — yeni sohbet için kısa devir / 29 Ekim 2026

Repo: `/Users/ayhanblt/Desktop/projects/kloda`; remote `ayhanblt/kloda`, branch `main`.
Ürün: **Kloda: Secure Photos & Sync**. Bu devir yeni geliştirme/test kabulü değildir.

## Başlangıç ve çalışma kuralları

- Yalnız **ana ajan** kullan. Subagent başlatma, mevcut ajanı devam ettirme veya
  otomatik Astra danışması yapma. Model/effort değiştirme. Kullanıcının bu son kararı
  eski helper/model-routing talimatlarını geçersiz kılar.
- Önce `AGENTS.md`, `.omp/AGENTS.md`, bu özet ve migration handoff'un güncel girişini
  oku. Sonra yalnız ilgili roadmap/ADR/kod/kanıt bölümünü aç; tüm konuşmayı veya
  bütün repo belgelerini listeleyip okumak yok. Eski checkpoint başlıkları tarihsel.
- Kod keşfinde Serena'nın Kloda aktivasyonunu ve sembol/caller/reference araçlarını
  doğrula; hedefli araçları kullan. Doküman kararlarının yerine sembol sonucu koyma.
- En küçük yeterli değişiklik; mevcut native API/journal/queue/fixture'ları kullan.
  Tamamlanmış işi yeniden yazma, gereksiz bağımlılık/soyutlama/genel scheduler ekleme.
- İlgili otomatik test/lint/typecheck/build ve gereken dar izole smoke; önce tek
  temsilci yol çalışsın, sonra gereken matrisi genişlet. Küçük her düzeltmede tam
  matrisi tekrarlama. Aynı ana ajan ayrı review geçişi yapsın; buna bağımsız ajan
  review'u deme. Gerçek bağımsız inceleme kapısı karşılanamıyorsa açık bildir.
- Onaylı sırada gereksiz adım onayı bekleme; yeni mimari/güvenlik/ürün kararı,
  çatışma, geri dönüşsüz işlem veya altyapı engelinde somut bulgu/seçenekle dur.
  Tamamlanan/açık/engelli/ertelenen/kapsam dışı gerekli işleri görünür tut.
- Geçmiş PASS yeni koşu değildir; fixture/Simulator/build fiziksel ürün kabulü değildir.
  Anlamlı grup sonunda handoff/roadmap/status güncelle; kısa sonuç ve sonraki işi ver.
- Git add/commit/push/reset/clean/stash yalnız açık izinle.29Ekim mevcut paketi
  commit/push izni sonraki işler için sürekli izin değildir. Force-push yok;
  AI contributor/Co-authored-by veya yeni kimlik kaydı ekleme.

## Bağlayıcı tasarım / mimari

Lovable **Project Migration Hub**, proje `222ef478-8826-4712-b3c4-9703a823f69d`,
revizyon `cb1143d16f7365f9913285b27d4067084b65a304`: tek onaylı UI kaynağı.
[Tasarım sözleşmesi](../ui/lovable-design-reference.md); frozen kaynak/asset/manifest
aynı dizindeki `lovable-reference/cb1143d16f73/` altında. Stitch tarihsel; eski
klasör kullanıcı izniyle arşivlenip kaldırıldı. Yerel `.local-evidence` ZIP'i bağımsız
backup değildir. Lovable demo QR/cihaz/ready/yüzde state'i gerçek API'ye çevrilemez.

TR/EN/DE anahtarları: tüm statik metin/etiket/placeholder. Tailwind/mevcut NativeWind,
ortak global CSS; yeni inline/page style/StyleSheet yok. Lucide; FSD/component
sınırları, backend Clean Architecture/bir use-case bir dosya; ESLint300satır
(yorum/boş satır hariç). Native OS/SwiftUI istisnası için açık kullanıcı kararı gerekir.

## Korunacak güvenlik / ürün kararları

- ADR0016: PC-first offline LAN, native PC-local ACL ve ayrı açık klasör/erişim onayı.
  QR trust tek başına dosya izni değildir; LAN'a merkezi login/JWT/KMS zorunluluğu
  ekleme. Native peer/pin/possession/current ACL ve revoke/publication fence korunur.
- ADR0017: Photos manifest/sidecar/resource ve import/recovery tutarlılığı.
- ADR0018: yetkili receiver UI focus/minimize/hide/route ayrılışında çalışır. Yeni
  QR/trust/grant görünür aktif pencerede açık eylem ister. Tray/quit warning/login
  opt-in gerçek OS durumuna bağlı; Linux görünür geri açma/çıkış yolu olmadan gizlenmez.
  Uyku/kapalı PC'ye aktarım garantisi yok.
- ADR0019: revoke eşleşme/yedekleri korur; cihaz kaldırma trust+ACL'yi iptal eder,
  yeniden QR+ayrı grant gerekir. Seçili Files/Photos **yedek sürümü**30gün çöp,
  eski hedefe no-overwrite restore;30gün sonunda, kapalıysa sonraki açılışta cleanup.
  Başka sürümlerin ve çöp süresindeki sürümlerin paylaştığı Photos medya korunur.
  Manuel eklenmiş/ilgisiz dosya silinmez. Aynı değişmemiş kaynağın otomatik yeniden
  gelişi tombstone/suppression ile engellenir; explicit rebackup ayrı, değişmiş kaynak
  yeni sürüm. Ortak içerik tek başına ilgisiz kaynağı engellemez. Telefona remote delete yok.
- ADR0020: onaylı iOS LAN farkı korunur; native interface/QR IP/socket/same-network,
  tam TLS/device identity ve PC izni var; doğrudan route/VPN yokluğu veya anlık ağ
  değişimi tespiti garanti edilmiş sayılmaz. Android sözleşmesini buna gevşetme.
- Çalışan işte kaynak/hedef ayarı değişirse güvenli duruş ve açık sonuç; tamamlanmış
  byte/toparlanma kaydı korunur, eski iş yeni hedefin yürütme fırsatını tüketmez.
  Erişim retry toplam5deneme/60sn; mobil OS erteleme bütçesini Desktop alıcısına taşıma.
  Mevcut timeout korunur, ek toplam timeout yok. Conflict/unknown ayrı inceleme;
  bağımsız dosyalar devam eder, recheck/iki kopyayı koru/skip tamamlandı değildir.
  Korunan kopya isimlendirmesi UTC zaman+revision. Pause otomatik yedeklemeyi de
  kullanıcı Resume diyene kadar durdurur.
- Kişisel arşiv, mevcut key/pin/cert/epoch/authority/scope verisine dokunma;
  reset/migration/cleanup veya provider/software-key fallback yok. Disposable veri kullan.

## Mevcut gerçek durum / ilk değerlendirme

Desktop receiver/journal/resume, cihaz/ACL/removal, ADR0019 retention/suppression,
background/tray/autostart, kalıcı Activity ve WebDAV context/retry işlerindeki
kaynak/otomatik sonuçlar korunur. Mobil1–10 Android context/background/schedule/
retry ve dar runtime; iOS pairing/Files/Photos/background; mobil WebDAV config/probe
ve entegre izole kontroller kendi rapor sınırlarıyla uygulanmış durumda.
Bunlar bütün platformların çalıştığı veya fiziksel kabulün kapandığı anlamına gelmez.

11tasarım alımı tamam;12Lovable kabuk/skip/ana akış uyarlaması uygulanmış:
[12 raporu ve kanıt](lovable-ui-step12-2026-10-28.md). Mobil123test/14suite,
Desktop322tam test+sonra13örtüşen hedefli test; lint/TS/build ve42Desktop capture.
iOS24ilk ekran+son benzersiz4Inter yüzü/4alias native kaydı ve aynı süreçte
font1→3.571→1 düzeltme kanıtı var. Native metin ölçümü yalnız Text/chrome düğümlerini
yeniler; job/pairing hook'ları remount edilmez. Bunlar28Ekim kayıtları, yeni koşu değil.

**12 açık:** Android native görsel `adb unauthorized`; gerçek swipe/VoiceOver/
landscape kabulü NOT_RUN. Key/auth reset veya güvenlik bypass'ı yok. Geçici owned
emülatör/Simulator ve test servisleri kapatıldı. Bu açığı yeni sohbette koru;
yalnız izinli izole ortamda çözülebilir,13'e geçerken sessizce kapatma.
Galeri henüz gerçek fotoğraf listesi/detay değil.16sağlayıcı katalog/formu var;
WebDAV dışındaki adapterler kapalı, mobil WebDAV byte sender da henüz yok.

## Sabit kalan sıra — eksik adım atlama

Ayrıntılı kabul ölçütleri: [genişletilmiş plan](expanded-execution-plan-2026-10-28.md).
İlk iş12açık doğrulama/altyapı durumunu hedefli kontrol et; sıradaki geliştirme13.

| No | Kalan kapsam |
|---|---|
|13|Gerçek galeri/fotoğraf detayı: izinli kaynak/limited/boş/detay/yedek durumu. Yeni cache/arama/EXIF/yerel silme kararı varsayma.|
|14|Her protokol/cloud için resmi API/SDK/lisans/auth-custody/restore/idempotency/limit/maliyet karar matrisi; FTP güvenli kanal ve SFTP host-key politikası ayrı karar.|
|15|Mevcut mobil WebDAV config/probe'a gerçek sender bağlama; mevcut kalıcı iş/context/retry, kesinti/kayıp yanıt/no-overwrite kanıtı.|
|16|SMB LAN-only, SFTP, yalnız onaylı güvenli profille FTP; ayrı dar adapter+UI/job/restore dilimleri.|
|17|S3 uyumlu ve Amazon S3 ayrı konfigürasyon; uygunsa ortak adapter, multipart/commit/integrity/context.|
|18|Box, CloudMe, Dropbox, Google Drive, Google Cloud Storage, Kolab Now, MEGA, OneDrive, Nextcloud, Yandex Disk; hiçbirini sessizce atlama.|
|19|iOS Live Activities: gerçek job/ACK, ActivityKit/WidgetKit/signing/privacy; SwiftUI istisnası ve yeni push/yetki gerekiyorsa karar.|
|20|Bütünleşik otomatik/izole/görsel/a11y/platform hazırlığı; launcher/splash/tray/native izin çevirileri, performans/alan/receiver latency ve aşağıdaki kapılar.|
|21|En son toplu fiziksel/uçtan uca kabul; yeni açık yürütme izni, hazır platform/hesap ve disposable veri gerekir.|

Provider ücretli kaynak/hesap/app registration veya broker/backend OAuth/credential
saklama gibi yeni kararları kullanıcı izni olmadan oluşturma. Bulut delete/retention
ve remote yetki, PC-local ACL/çöp kararından otomatik türetilmez.

## Kapanmamış kapılar / geniş ürün işleri

WindowsD3 pozitif startup/SQLite opened-object/admission/continuity'nin son kanıt
sınırları; macOS normal imzalı uygulama/receiver (Personal Team dar native/Electron-host
PASS'i normal uygulama kabulü değil; eski profil2Kasım2026'da sona erer); Linux
identity/storage provider. Yeni bilgi/karar olmadan Windows araştırmasını/probe'u
tekrarlama, güvenliği gevşetme. Linux kabul hedefleri UbuntuLTS/GNOME ve KubuntuLTS/KDE.

Android gerçek PC/LAN/suppression-rebackup ve eskiOS/16KB/Doze; iPhone SecureEnclave/
LAN/OS background delivery ve Photos varyantları; eski scope locator kaybolunca
geçmişi yönetememe; büyük koruma kopyasının receiver timeout/retry/latency etkisi,
staging/alan ve açık SDK config olayı takipte. Fiziksel duraklatma21için yeni açık
izin gelene kadar sürer; eski sınırlı telefon testi genel izin değildir.

Medya E2EE/key lifecycle, hesap/recovery, remote erişim, Files two-way/conflict/
versions ve FolderSync migration ayrıca açık. Bunları silme veya bu sıraya onaysız ekleme.
