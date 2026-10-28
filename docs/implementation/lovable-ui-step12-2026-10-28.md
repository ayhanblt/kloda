# Liste12 — Lovable ortak kabuk ve ana akış uyarlaması

28 Ekim 2026. Bağlayıcı referans: Project Migration Hub,
`222ef478-8826-4712-b3c4-9703a823f69d`, frozen `cb1143d16f73`.
**Durum:** Kaynak/otomatik ve izole Desktop+iOS görsel kapsam uygulandı.
Android native görsel kontrolü ADB yetkilendirmesinde engelli;12’nin doğrulama
açığı olarak açık, PASS veya sessizce ertelenmiş sayılmaz.

Kapsam mevcut işlevleri bağlamaktır; yeni sağlayıcı aktarımı veya galeri motoru değildir.

## Uygulanan akış

- Mobil karşılama → kaynak → program → PC/QR; **Şimdilik atla** → ana sayfa.
  Alt gezinme: galeri/ana sayfa, Activity, bağlantılar ve ayarlar. Yedek/restore
  mevcut native API’den ayrı görünüme açılır. Skip yalnız oturum içi gezinmedir;
  eşleştirme, izin, config veya kalıcı kurulum-tamamlandı kaydı yazmaz. Yeni
  süreçte karşılama tekrar gösterilir; pencere içinde dönmek ayrı ayar bağlantısıdır.
- Desktop karşılama → gerçek alıcı ana ekranı, eşleştirme, cihaz/ACL, gelen
  geçmiş, yedek sürümleri/çöp, kaynak/program, giden WebDAV ve ayarlar aynı
  sidebar/kabukta. Dosya alanı seçimi cihaz başına mevcut açık native onaydır;
  prototipteki genel klasör düğmesi ayrı bir yetki kaynağına dönüştürülmedi.
- Her iki uygulamada5protokol+11bulut kataloğu ve sağlayıcıya göre parametre
  sayfaları var. Yalnız mevcut WebDAV akışına gerçek bağlantı yapılır; diğer
  seçeneklerin girişi/testi devre dışıdır ve entegrasyonun bulunmadığı açıklanır.
  Mobil WebDAV hâlâ config/probe’dur, byte sender15. adımdır.
- Mobil galeri ana sayfası gerçek mevcut kaynak sayısını ve kurulum/işlem
  bağlantılarını gösterir. Fotoğraf listesi/detay demo veriden üretilmez;
  uygulanmadığı görünürdür ve13. adımda gerçek kaynaklara bağlanacaktır.
- Sıcak yüzeyler, koyu aktif gezinme, yuvarlak kartlar, Lucide, aynı açık-halka
  SVG logo, azaltılmış hareketi gözeten giriş efekti ve yerel Inter fontları
  uygulandı. Dört statik ağırlık resmi Inter kaynağından, birbirinden farklı native
  PostScript adları ve OFL/provenance ile
  `assets/fonts/inter/` altında; font için ağ gerekmiyor. Mevcut expo-font57.0.4
  doğrudan beyan edildi, native paket sürümü değişmedi. Yükleme hatası uygulamayı
  kapatmaz; çevrilmiş uyarı ve sistem fontuyla kullanılabilirlik korunur.
- TR/EN/DE statik metin/etiketler locale dosyalarından gelir. Yeni sayfalarda
  inline style/StyleSheet yok; NativeWind/Tailwind ve ortak global CSS kullanılır.
  Native safe-area/camera/bottom-sheet için cssInterop yalnız mevcut native
  bileşenin className sözleşmesini bağlar. Max-lines300 lint kuralı korunur.

## Korunan davranışlar

ADR0016/17/18/19/20 yetki, publication, metadata, retention ve yaşam döngüsü
sınırları değişmedi. QR/camera/pending onay ekranında global sekmeler yok;
mevcut korumalı geri dönüş işlemleri çalışır. Desktop hash/history gezinmesi de
korumalı işlem kontrolünü kullanır. UI ayrılışı yetkili native receiver’ı durdurmaz.
Desktop WebDAV draft gizli halde mounted tutularak korunur; görünürlük
değişimi tek başına eski testi invalidate etmez. Mobil WebDAV formundan
ayrılınca eski test iptal/invalidate edilir. Eski
başarı, hata sonrası güncel alıcı/bağlantı başarısı olarak kalmaz. Tarihsel WebDAV
test metadata’sı canlı PC veya güncel yetki kanıtı değildir. Yeni credential,
provider adapter, trust/izin, kuyruk veya journal oluşturulmadı.

## Bu koşuda doğrulama

- Mobil123test/14suite, lint, TypeScript ve iOS+Android JS export exit0.
  Bunlar yeni native uygulama derlemesi veya fiziksel kabul değildir.
  Testler üç dilde skip’in yazma yapmamasını,16seçenek kataloğunu, kapalı sağlayıcı
  kontrollerini, yeniden mount davranışını ve mevcut stale probe/uyarı/kurulum
  regresyonlarını kapsar. Font yükleme ve hata dalları da test edildi.
- Desktop30dosya/322test tam koşu; ardından yeni çöp-route testi dahil13hedefli
  test geçti. Lint/TypeScript/tam build geçti.322sonrası yeni bir323tam koşu
  yapılmış sayılmaz. Production main/native yalnız derlendi, owner başlatılmadı.
- Desktop izole Electron renderer: TR/EN/DE ×1440/640genişlik ×7yüzey =42capture.
  Gerçek yüklenmiş yerel Inter FontFace, taşma/inline-style ve stale-success
  kontrolleri geçti. Synthetic IPC kullanıldı; production main/owner/ağ yok.
- iOS26.5 owned Simulator’da mevcut debug app ile production App karşılama ve
  production page+shell bileşenleri çizildi:24normalfont capture (3dil×8yüzey)
  ve hedefli responsive/progress/font-change takipleri. Gezinme callback’leri ve
  native veri JS fixture’dır; gerçek dokunma/QR/transfer kabulü değildir.
  Alt sekme/üst durum kırpılması1.786ve3.571fontScale’da bulundu ve düzeltildi:
  büyük yazıda üst satırlar ayrılır, alt gezinme tam metinli yatay kaydırılır;
  font sınırı konulmaz. OS font değişiminde stale native ölçüm ayrıca bulundu;
  yalnız header/footer ve ortak Text bileşenindeki native metin düğümleri
  fontScale ile yeniden ölçülür. Alıcı/Activity sayfası, iş ve pairing hook’ları
  remount edilmez. Aynı süreçte normal→3.571→normal gövde+chrome görüntüsü düzeldi.
  OS font değişiminde native metin seçimi/erişilebilirlik odağı sıfırlanabilir;
  iş/izin state’i değişmez.
 0/50/99/100byte-progress fixture genişlikleri beklenen oranlarla doğrulandı;
  bu gerçek dosya aktarım kanıtı değildir.
- Android owned API36 emülatör girişimi `adb ... unauthorized`/exit1 ile engellendi.
  Native screenshot NOT_RUN; key/trust reset veya auth bypass yok, yalnız owned
  emülatör/server durduruldu. Android JS export’u bu native kontrolün yerine geçmez.
- CUA’da Simulator kontrolü kullanılamadı: native tap/swipe/VoiceOver, yatay
  strip’in gerçek jestle son sekmeye kaydırılması ve landscape bu koşuda NOT_RUN.
  Jest dört sekmenin eylem/etiketlerini ve font değişiminde iş modelinin yeniden
  yüklenmemesini doğrular; bunu native jest kabulü saymayız. Debug dev-menu simgesi
  bazı Simulator görüntülerinde overlay’dir; ürün tasarımı değildir.
- İlk sandbox Electron SIGABRT ve Expo Metro source-watch `addedFiles` hatası
  korunur. İzole izinli renderer koşusu ve Metro yeniden başlatma sonrası capture
  tamamlandı; güvenlik/dependency/OS kontrolü bu hatalar için gevşetilmedi.
- Ayrı kaynak/güvenlik review’larında engelleyici bulgu yok: skip, protected pairing,
  stale probe, trash route, font/error ve adaptive chrome incelendi. Son kaydedilmiş
  sonuç/kapsam review’u ayrıca kanıt dosyasındadır.

Kanıt klasörü: [seçilmiş kayıtlar](evidence/lovable-step12-2026-10-28/).
Ham/geçici kayıtlar `.local-evidence/lovable-step12-desktop/`,
`.local-evidence/mobile-step12-native/` ve `/tmp/kloda-step12/` altında.

## Açık sınırlar / sonraki iş

13gerçek galeri/detay;14protokol/auth/credential/lisans/maliyet kararları;
15mobil WebDAV sender;16SMB/SFTP/FTP;17S3;18diğer bulutlar;19LiveActivities;
20bütünleşik;21izinli fiziksel kabul. Bunlar bu kaynak/görsel uyarlamayla kapanmaz.
Native launcher/splash/tray/menu görsel paketi ve native OS izin metinlerinin
TR/EN/DE kabulü bu JS/renderer koşusunda doğrulanmadı;20/21’de görünür takip
edilir.
WindowsD3, macOS normal uygulama imzası ve Linux identity/storage provider kapıları,
UbuntuLTS/GNOME ve KubuntuLTS/KDE gerçek kabulü, Android suppression/rebackup
runtime sınırları, eski scope locator, receiver büyük dosya latency ve staging/alan
sınırları önceki kanıtlarıyla açık kalır. Medya E2EE/key lifecycle, hesap/recovery,
remote, Files two-way/conflict/versions ve migration ayrı ürün kapsamıdır.

Son font metadata kontrolünde ilk statik dosyaların ortak `Inter-Regular`
iç adı taşıdığı bulundu. `updateFontNames=True` ile400/500/600/700yüzleri ayrı
adlara düzeltildi; dört ad/ağırlık/hash assert’i kaydedildi. Önceki capture’lar
yükleme kanıtıdır, farklı yüzlerin native seçimi kanıtı diye sunulmaz. Son
font-only export/build ve hedefli native takip kanıtı bu düzeltme sonrasındadır.

Kişisel arşiv/authority/key/pin/epoch/config veya fiziksel cihaza dokunulmadı;
Git mutation ve Lovable kaynağına yazma/publish yapılmadı.
