# Liste11 — Lovable tasarım alımı ve eşleme,28 Ekim2026

**11. adım tamamlandı:** onaylı revizyonun kaynak/asset snapshot’ı alındı, kapsam
ve mevcut native karşılıkları çıkarıldı.12. adım UI uygulaması başlamadı.

## Alınan referans

- [Bağlayıcı proje](../ui/lovable-design-reference.md): Project Migration Hub,
  `222ef478-8826-4712-b3c4-9703a823f69d`.
- Frozen SHA `cb1143d16f7365f9913285b27d4067084b65a304`; başlangıç ve kapanış
  MCP gözlemi aynı. Kaynaklar her read_file çağrısında bu ref ile okundu.
- [Yerel snapshot](../ui/lovable-reference/cb1143d16f73/README.md):151/151 kaynak
  dosyası;143 metin,1favicon SVG ve7JPEG. Metinler UTF-8 olarak aynen yazıldı;
  hash’ler yerel decoded-text byte kanıtıdır, sağlayıcının raw Git blob hash’i
  verilmedi. Asset byte’ları authenticated live preview’dan alındı; git blob
  eşitliği iddia edilmez. Preview da aynı revizyonda gözlendi.
- 7JPEG Pillow decode/verify başarılı: demo1–6 816×816; wallpaper1024×1536.
- Logo TSX’te light/dark/mono/tray varyantları, SVG favicon ve global token/motion
  CSS alındı. Ayrı standalone tüm-logo export’u yapılmadı;12’de mevcut geometri/
  renk korunarak platform asset paketine eşlenir, yeni logo icat edilmez.

## Kapsam ve sonraki bağlama

[42 kalem ve mevcut uygulama karşılığı](../ui/lovable-reference/cb1143d16f73/page-map.json):
13mobil+13Desktop ekranı ve16provider görünümü. Provider’lar aynı parametreli
formu kullanıyor;42 ayrı route dosyası zorunluluğu yok. Mobil/Desktop provider
route’ları var. `/lock-screen` ek iOS/Android web demo görünümü; iOS native19’a
ayrı bağlıdır, Android API entegrasyonu tamamlandı sayılmaz.

| Aile | Yerel uygulama durumu | Yapılacak bağlama |
| --- | --- | --- |
|Karşılama/Atla/ana gezinme|Yeni welcome/skip/gallery shell eksik|12’de ana sayfaya geçiş, eksik kaynak/bağlantı uyarıları; izin yaratmadan gezinme|
|Kaynak/program|Mevcut native pickers ve program var|Yeni görünüme böl; mevcut kalıcı bağlam/Pause/Live/retry korunur|
|PC/QR/ayrı izin|Mevcut mobile/desktop native yol var|Dekoratif QR/dummy approval değil gerçek APIs; hazır/trust/grant ayrı|
|Galeri/detay|Native uygulamada bağımsız sayfalar yok|12 shell,13 izinli gerçek kaynak/detay; gereksiz geniş cache/arama kararı yok|
|Activity/yedek/restore|Mobil Activity içinde mevcut|Görünümleri ayır; gerçek ACK/journal ve Photos import recovery korunur|
|Desktop alıcı/devices/incoming/backups/trash/settings/tray|Mevcut işlevler var|Stil/navigasyon uyarlaması; native authority yeniden yazılmaz|
|Bağlantılar/provider form/detay|WebDAV dışında yeni katalog|12 tasarım shell;15–18 gerçek entegrasyon. Desteklenmeyene sahte başarı yok|
|Kilit ekranı|Web demo var; gerçek Live Activity yok|19 extension/platform/privacy/admission sınırlarıyla|

## Bu adımda gözlenen web tasarım akışı

Kullanıcı özel Lovable hesabında giriş yaptı; public publish yapılmadı. Karşılama
→Şimdilik atla→M4 kaynak/bağlantı/izin eksikleri gözlendi. Ardından demo-normal
kitaplık, Activity, bağlantı seçimi, Desktop receiver ve iki lock-screen paneli
incelendi.6 screenshot [manifestte](../ui/lovable-reference/cb1143d16f73/manifest.json).
Ana sayfa boş ve dolu demo görüntüleri ayrı adlarla korundu. Statik kapsam42;
tüm42 ekranın görsel/klavye/üç dil/ekran okuyucu matrisi bu adımda yapılmadı.

## Adaptasyon bulguları — tasarımı değiştirmeden kodu düzelt

- `demo-store.tsx:57–66` loadFull sahte grant/pairing/folder readiness üretir.
  Tasarımın görünümü korunur, state’i gerçek native gözleme bağlanır.
- `shared/ui/demo-qr.tsx`, `views/desktop/receiver.tsx:101–118` QR/onayları demo.
  Mevcut ADR0016/native foreground/PC consent yolunun yerine geçmez.
- Header bağlantı adedinden Bağlı üretiyor; kayıt varlığı online/receiver/ACL
  kanıtı değildir. Uygun unknown/unavailable durumuna gerçek data bağlanacak.
- Görsel onayı hardcoded marka/saat/yüzde/aria/placeholder metinleri onayı değildir.
  TR/EN/DE key’leri gerekir.26-screen hub içindeki Türkçe etiketler de taşınmaz.
- Shared progress/chart/sidebar inline style içeriyor; global/Tailwind eşlemesi
  gerekir. `views/mobile/connections.tsx` ve bazı kit/UI dosyaları300-line
  hedefini aşan ham uzunlukta; sıkıştırma değil component ayrımı gerekir.
  Bunlar static gözlem; yeni ESLint koşusu veya kesin AST tam denetimi değildir.
- Shared kit status truncate, uzun kimlik/çeviri ve büyük fontta önemlidir.
- Prototip QR/traysiz Linux/keep-both isimlendirmesini açık karar sayıyor;
  mevcut ADR’ler ve UTC+revision dahil eski kullanıcı kararları yeniden açılmaz.

## Transfer sorunları ve dürüst sınırlar

MCP binary JPEG’yi replacement-character içeren metin döndürdü; kullanılmadı.
Python TLS CA hatasında doğrulama kapatılmadı; curl ve anonim preview401 döndü.
Kullanıcı login sonrası iframe üzerinden indirme aracı timeout/kernel reset verdi;
private design ayrı authorized preview tab’ında pageAssets ile7görsel alındı.
Bir6asset bundle çağrısı yaklaşık120s sürdü; lock-wallpaper27ms. Tekrar yolu
kayıtlı, credential/cookie/token kopyalanmadı veya repoya yazılmadı.

Eski Stitch kaldırma ilk ön kontrolde15 yerine20 dosya bulunduğu için durdu;
5ek dosyanın yalnız `.DS_Store` olduğu doğrulandı.15tasarım+5metadata önce özel
`.local-evidence/design-transition-2026-10-28/stitch-legacy-before-removal.zip`
içine byte-hash ile yedeklendi, ZIP/readback doğrulandı; sonra yalnız izinli
`stitch_private_photo_cloud/` klasörü kaldırıldı. Yedek Git-dışı/yerel ve bağımsız
backup değildir. Tarihsel raporlar tarihsel kalır; canlı referanslar Lovable’a döndü.

## Doğrulama / kalanlar

- Kaynak inventory151/151, SHA256 manifest,7 image decode,42 coverage ve6 capture
  dosyası yerel assert’lerle doğrulandı. Ayrı bounded kaynak review yapıldı;
  sonuç/manifest review ayrıca kaydedilir. Bu sayılar native test PASS değildir.
- Test/build/SDK/cihaz/probe/kurulum çalıştırılmadı; Lovable’a yazma/generate/
  publish komutu gönderilmedi. Kullanıcının login’i ve demo gezinmesi dışında
  dış proje kaynağı değişmedi. Git mutation ve kişisel arşiv/authority dokunuşu yok.
- Native/static ekran adaptasyonu12; gerçek gallery13; protocol/auth kararları14;
  WebDAV15,protokoller16,S3/Amazon17,diğercloud18,LiveActivities19; bütünleşik20;
  fiziksel kabul21. OS/SwiftUI istisnası ve lock-screen privacy gibi yeni kararlar
  gerektiği adımda somut örnekle sorulur; varsayılmaz.
