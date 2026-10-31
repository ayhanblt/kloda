> 31 Ekim2026 D8 düzeltmesi ONAYLI/uygulandı: public Tokio ingress + dar C/JNI/Kotlin/Swift bound-socket handoff. Rust13, supplied-socket7 yayın durumu, Swift host seed/ayrı süreç reopen, disposable Android JNI/SQLite, iki temsilci link, hash gate ve1.99Clippy PASS. [Tek güncel checkpoint](smb-native-publication-checkpoint-2026-10-30.md), [taze dar kanıt](evidence/smb-native-publication-step16-2026-10-30/bound-socket-2026-10-31.json). Önceki D8 bekliyor/ret kayıtları tarihseldir ve yeni açık onayla çözülmüştür. Yeni karar yok: sıradaki iş gerçek native profil/vault + OS LAN ve seçili Files kaynak/context-generation sahiplerini runBound'a bağlamak; sonra tek Files proof. SMB kapalı,16a ve eski kabul kapıları açık. Owned container/AVD kapalı, veri retained.

> 31 Ekim2026 D8/A kontrolü: görünürlük onayı alındı, fakat private runtime parametresi/test-only Tokio dönüşümü nedeniyle dış tüketici başarısız; kendi tek satır hunk'ı geri alındı. Aktif SDK D6 bit patch'i; Rust10+check ve üç bozulma hash kapısı PASS. Yeni native köprü otomatik onay incelemesinde ek kapsam olarak reddedildi ve uygulanmadı. [Düzeltilmiş iki somut diff ve onay kapsamı](smb-route-bound-transport-decision-2026-10-31.md). Bu üst kayıt eski D8 bekliyor/tek satır yeterli ifadelerini geçersiz kılar. SMB kapalı.

> 31 Ekim2026 UI sonrası16a devamı: ayrı SMB profile/vault temeli eklendi; Android dar derleme ve Swift host codec10bozuk-girdi testleri PASS, gerçek vault/route/source runtime açık. [Tek güncel SMB checkpointi](smb-native-publication-checkpoint-2026-10-30.md). D8: hazır bağlı-socket constructor private; [yalnız public görünürlük patch'i / Kloda transport adapter'ı somut seçimi](smb-route-bound-transport-decision-2026-10-31.md) bekliyor. SDK henüz değiştirilmedi; SMB kapalı.

> 31 Ekim2026: Lovable UI kod paketi/web doğrulaması tamamlandı; native/fiziksel kabul kapıları açık. Mobile168, Desktop325 test PASS; son etkilenen kontroller PASS. [Tek güncel UI checkpointi](lovable-ui-interlude-checkpoint-2026-10-30.md). Onaylı iki kontrast uyarlaması uygulandı; ürün dependency ve299native kaynak değişmedi. Şimdi aşağıda korunan16a devam noktasına dön.

> 30 Ekim2026 D6A+D7A onaylı: ayrı Rust yayın motoru, C ABI/JNI ve Kotlin/Swift immutable SMB makbuz temeli uygulandı. Gerçek Samba host ve Android JNI/SQLite, Swift host/ayrı süreç reopen, 10 Rust test, temsilci Android+iOS link ve Clippy PASS. Ürün kapalı; native profil/vault/OS admission, catalog/restore/Photos sahipliği ve ürün akışı açık. [Tek güncel checkpoint ve sonraki iş](smb-native-publication-checkpoint-2026-10-30.md). Alt geçmiş kayıtları tarihseldir.

## UI ara paketi başlamadan önceki devam noktası

30 Ekim2026: roadmap16a SMB native yayın temeli. UI ara paketi roadmap sırasını
ve11/12/13/15/20/21 açık kabul kapılarını değiştirmez; paket bitince aşağıdaki
kesin noktadan devam edilir. Paket sürerken16. adım kaynakları korunur.

- Checkpoint: [SMB native yayın](smb-native-publication-checkpoint-2026-10-30.md).
- Kararlar: ADR0026 D6A exact ENCRYPTION patch ve D7A Files+ayrı Photos makbuz
  sözleşmesi onaylı; bekleyen yeni mimari karar yok. Yeni SMB Photos mutation
  testi henüz onaylanmadı; WebDAV istisnaları genişletilmez.
- Tutulan kanıtlar: [native yayın manifesti](evidence/smb-native-publication-step16-2026-10-30/manifest.json),
  önceki aday/adoption manifestleri aynı yerde korunur. Containers/proxy ve owned
  emulator kapalı, test katmanları/veri imajları retained; orijinal Pixel'e dokunma.
- Bekleyen sonraki dar dilim: native profil/vault ve gerçek OS LAN/current-source
  admission sahiplerine SMB binding/generation bağla; tek seçili Files kaynağıyla
  ürün sahibini kanıtla. Ardından own catalog/Files restore/restart review,
  Photos own-Completed-resource binding/publication/restore. SMB ürün kapalıdır.
- Başlangıç git status: `.local-evidence/ui-lovable-2026-10-30/pre-ui-git-status.txt`.
  Native kaynak koruma hashleri aynı dizindeki `protected-native-source-sha256.json`.
  UI'daki eski kirli değişiklikler otomatik olarak16a kabul edilmez; gereken UI
  dosyasında16. adıma ait hunk bulunursa dur ve sor. Stash/reset/clean/commit yok.

> Kullanıcı isteğiyle30Ekim2026 çalışma durduruldu. Devam noktası16a/D6; SDK patch/adoption onayı yok. Önce [kısa kaldığımız yer ve kullanım azaltma planını](resume-and-usage-plan-2026-10-30.md) oku. Model/effort aynı, yalnız ana ajan; eski kanıtları veya matrisleri baştan yükleyip tekrarlama.

> 30 Ekim2026 SMB16a/D5A: alternatif smb2=0.36.2 değerlendirildi;71dependency OSV eşleşmesi0 ve6mobiletarget cross-link PASS. Yayımlanmış SDK, aynı strict Samba’da cipher negotiation kapısını auth öncesi geçemedi. Gerçek wire ve Samba kaynağı eksik ENCRYPTION capability bitini doğruladı. Yalnız /tmp tek-bit tanı varyantı strict aktarım/no-clobber/wire-fault ve6target PASS; ürüne patch/SDK değişimi yapılmadı, SMB kapalı. [Somut D6 patch bakım kararı](smb2-step16-alternative-checkpoint-2026-10-30.md), [yerel upstream rapor taslağı — gönderilmedi](smb2-upstream-interop-report-draft-2026-10-30.md). Önceki aday kanıtları tarihsel olarak korunur;16a ve12/13/15/20/21 kapıları açık.

> 30 Ekim2026 SMB16a: D4/A [ADR0026](../decisions/0026-shared-rust-smb-engine.md) onaylandı: Android/iOS ortak Rust SMB, native işler Kotlin/Swift, ilk kapsam yalnız SMB. Ayrı storage crate/sabit0.12.1, gerçek owned Samba no-clobber/1MiB/strict ve iki wire-fault testi, dört AndroidABI+iOS cihaz/Simulator cross-link ve Clippy PASS. Ürün köprüsü/özellik etkinleşmedi. OSV RSA advisory dependency kapısı açık; NTLM-only akışta exploit gösterilmedi, temiz sayılmadı/suppress edilmedi. [D5 somut aday/fork seçimi ve kanıt](smb-step16-candidate-checkpoint-2026-10-30.md). 16a tamamlanmadı;12/13/15/20/21 kabul sınırları korunur.

> 16a salt-okunur ön değerlendirme: mevcut SMB adapter yok; LGPL libsmb2 ve MIT Rust smb adayları incelendi, dependency kurulmadı. Ayrı ortak Rust storage sınırı ile platform-native/libsmb2 dağıtım planı arasında yeni D4 engine/mimari kararı gerekiyor; kullanıcı yerine seçilmedi. [Somut seçenek ve doğrulama planı](smb-step16-engine-decision-2026-10-30.md). 15’in izole kanıtları ve12/13/20/21 açık kabul kapıları korunur.

> 30 Ekim2026 son doğrulama: onaylanan ayrı iOS restore-kopyası testi PASS; gerçek PhotoKit/native Vault/HTTPS/yerel Completed receipt ile yeni asset/album, byte/ad/MIME/favori/album, otomatik hedef kapalıyken açık restore ve aynı süreçte DB reopen/tekrar kopya oluşmaması doğrulandı. Yalnız güncel kaydedilmiş restore asset/album cleanup doğrulandı; sentetik kaynak PNG ve ilk başarısız fixture kopyası review için retained. Android SAF/Photos SDK kanıtları, mobil163test/TS/ESLint9 ve gerçek iOS app build PASS. 15 kaynak/otomatik/izole kapsamı uygulandı; ürün picker/Expo UI, iOS gerçek BG delivery, signing ve12/13/20/21 kabul kapıları açık. [Kanıt](evidence/webdav-native-step15-2026-10-29/manifest.json). Aşağıdaki girişler tarihsel checkpointtir.

> 30 Ekim2026 son durum: Files ve Photos WebDAV restore/catalog/API/UI iki platformda bağlı. Android owned gerçek SAF provider restore ve sentetik MediaStore Photos restore/metadata/retry/unknown-create/context/target-library kontrolleri PASS. iOS actual native-core HTTPS→typed restore/local publication ve ortak medya kontrolü PASS; onaylı tek Simulator Keychain grubu ile gerçek PhotoKit kaynak/metadata-only/açık review daha önce PASS. iOS gerçek Photos import için ayrı restore-kopyası onayı bekliyor; çalıştırılmadı. Mobil22 suite/163test, TS/ESLint9 ve iOS host journal PASS; son ortak helper dahil gerçek Expo iOS arm64 Simulator app build PASS. 15 tamamlanmadı;12/13/21 kapıları korunur. [Güncel kanıt](evidence/webdav-native-step15-2026-10-29/manifest.json). Aşağıdaki eski checkpoint girişleri tarihseldir.

> 30 Ekim2026 güncel: ADR0025 A ve dar owned Photos/Keychain test deneyleri onaylandı. Açık tek-isteklik review yetkisi/native API/UI uygulandı; eski header/ACK değişmez. Files restore/catalog/UI iki platformda kaynak olarak bağlı; iOS host typed restore/fresh-process ve gerçek HTTPS download→local publication component PASS. Mobil tam158 + son lifecycle4, TS/ESLint9 PASS. iOS app build PASS (son cancel-before-admission patch sonrası tekrar gerekecek). Android yeni Files domain build/runtime son grubu sürüyor. Photos restore henüz uygulanmadı. Owned PhotoKit+vault runtime: -34018; onaylı tek keychain grubu Simulator launch reddi, BLOCKED; daha geniş entitlement/fallback yok. 15 tamamlanmadı;12/13/21 kapıları korunur. [Kanıt manifesti](evidence/webdav-native-step15-2026-10-29/manifest.json). Eski “onay bekliyor” girişleri tarihsel.

> WebDAV15 güncel review: native current-source validator/API/Activity UI bağlı; tam154 mobil + son listing-fence3 test, TS/ESLint9 PASS. Güncel iOS actual-core HTTPS ve Android journal runtime PASS; UTC/revision keep-both adı düzeltildi. Cross-context açık review yetkisi kararı ve owned Photos test istisnası bekliyor; restore açık. 15 tamamlanmadı,12/13/21 kapıları korunur. [Checkpoint](mobile-webdav-step15-native-checkpoint-2026-10-29.md).

> Güncel WebDAV15: hedef opt-in/fan-out UI ve native OS dispatch bağlı; mobile150/TS/lint PASS, Android zorlamasız gerçek JobService/HTTPS+global Pause PASS, iOS actual-native-core HTTPS keep-both PASS. Review yalnız çekirdek; source validator/UI ve restore açık. Owned iOS Photos mutation test istisnası async onay bekliyor; auto-review reddedilen test uygulanmadı. [Güncel checkpoint](mobile-webdav-step15-native-checkpoint-2026-10-29.md).

> WebDAV15 güncel native kanıt: gerçek owned iOS/Android HTTPS, Android MediaStore/Photos+native queue ve vault/policy PASS; ayrı Expo backup modülü build PASS. Ürün UI/OS dispatch/review/restore açık; 15 bitmedi. [Güncel dar checkpoint](mobile-webdav-step15-native-checkpoint-2026-10-29.md).

# Kloda — yeni sohbet için kısa devir / 29 Ekim 2026

2026-10-29 **15 native ara checkpoint /AVD olayı:** [ADR0023](../decisions/0023-explicit-independent-backup-destinations.md) ile her açıkça etkin hedefe bağımsız backup/sonuç/retry onaylandı. [Native ara uygulama, kanıt sınırları ve emulator olayı](mobile-webdav-step15-native-checkpoint-2026-10-29.md): HTTPS/journal/publication/snapshot transport kaynakları var; iOS hostSQLite kontrolleri ve native buildler geçti; ürün/source/schedule/UI/restore henüz bağlı değil. Photos DAVsidecar sözleşmesi ADR0024ile onaylandı. Android runtime kurulumu başarısız; yanlış emulator veri yolu + wipe-data mevcut Pixel_9_Pro AVD verisini yeniden oluşturdu, emulator durduruldu; kullanıcı verilerin disposable olduğunu ve kurtarma gerekmediğini bildirdi.15tamamlanmadı;12/13ve fiziksel kapılar korunur.


2026-10-29 **D1–D3onaylandı /15kaynak değerlendirmesi:** [ADR0022](../decisions/0022-advanced-destination-transport-and-credential-custody.md) SMB3şifreleme+imza, explicitFTPS/LAN, bağımsız SFTPhost fingerprint+parola ve cihaz-native cloudsecret/no-broker kararlarını kaydeder. Box engelli kapsamda korunur. [15ön değerlendirme](mobile-webdav-step15-preflight-2026-10-29.md): mevcut mobile run/schedule PCrecord'a bağlı; PC+WebDAV birlikteyken otomatik hedef dağıtımı değerlendirmesi bu tarihsel kayıtta karara bağlıydı; sonradan A/ADR0023onaylandı. O sırada byte sender uygulanmamıştı; yeni test/build yoktu;12/13ve fiziksel kapılar korunur.

2026-10-29 **14 karar kapısı:** [16/16 protokol/provider matrisi ve D1–D3 somut önerileri](provider-decision-matrix-step14-2026-10-29.md) hazır. LAN SMB/FTPS, SFTP host identity ve cloudcustody D1–D3yanıtları sonradan ADR0022ile onaylandı; aşağıdaki ilk matris kaydı tarihsel. Okunamayan fiyat/SDK lisans kapıları açık işaretli.15başlatılmadı, sağlayıcı atlanmadı; mevcut12/13ve fiziksel kapılar korunur.

2026-10-29 **13 galeri/detay güncellemesi:** [Dar uygulama, test ve kanıt](photos-gallery-step13-2026-10-29.md), [ADR0021](../decisions/0021-read-only-selected-photos-gallery.md). Seçili kaynak/page/preview/limited/denied/detay/yerel geçmiş bağlandı. Mobil142tam+39etkilenen+son13boundary test; lint/TS/iki export, Android compile/K1lint ve iOS arm64build + gerçek PhotoKit/Expo/limited native smoke geçti; kapsam ayrıntıları raporda. Android runtime/native görsel,12horizontal swipe/VoiceOver/landscape ve fiziksel/platform kapıları açık. Yalnız ana ajan ve ayrı same-agent review. Sıradaki14;13tam platform kabulü iddiası yok.

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
13dar gerçek galeri/detay kaynak+otomatik+izole iOS kapsamı [uygulandı](photos-gallery-step13-2026-10-29.md); Android runtime/native görsel ve fiziksel kabul açık.16sağlayıcı katalog/formu var;
WebDAV dışındaki adapterler kapalı, mobil WebDAV byte sender da henüz yok.

## Sabit kalan sıra — eksik adım atlama

Ayrıntılı kabul ölçütleri: [genişletilmiş plan](expanded-execution-plan-2026-10-28.md).
12açıkları koru.13dar uygulama/kanıt raporunu esas al; 14D1–D3onaylı (ADR0022); 15A/ADR0023onaylı; native ara kaynak/host kontrolleri var, entegrasyon tamamlanmadı. Photos DAVsidecar ADR0024onaylı; kullanıcı AVD disposable/kurtarma gereksiz dedi; en üst checkpoint esas.

| No | Kalan kapsam |
|---|---|
|13|[Dar kaynak/otomatik/izole iOS galeri uygulandı](photos-gallery-step13-2026-10-29.md); Android runtime ve platform/fiziksel kabul açık. ADR0021onaylı; cache/arama/EXIF/yerel silme yok.|
|14|[16/16karar matrisi hazır](provider-decision-matrix-step14-2026-10-29.md); D1LANtransport, D2SFTPhost identity ve D3cloudcustody ADR0022ile onaylandı; açık SDK/fiyat/platform kapıları korunur.|
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
