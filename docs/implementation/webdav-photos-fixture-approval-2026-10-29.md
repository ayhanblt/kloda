# WebDAV15 — owned iOS Photos fixture istisnası önerisi

Durum: 30 Ekim2026 kullanıcı aşağıdaki dar Simulator test istisnasını onayladı. İlk reddedilen öneri uygulanmamıştı. Otomatik onay
incelemesi test kaynağının eklenmesini reddetti: önceki salt-okunur Photos
onayı favori değiştirme ve albüm oluşturma/silmeyi kapsamıyor.

Somut sınır:

- Yalnız `Kloda-WebDAV15-Disposable`, UUID
  `497AAA0F-967E-4781-9468-3F05CA2D3D5A`, ayrı test bundle
  `com.kloda.fixture.webdav15`. Fiziksel cihaz veya başka simulator yok.
- Yalnız test için yeni oluşturulacak sentetik PNG; kişisel/mevcut fotoğrafa
  mutasyon yok. PNG test sahipliği doğrulanmadan yazma yapılmayacak.
- Yeni ve yalnız bu testin oluşturduğu albüm; test PNG’sini ekleme, test PNG’sinin
  favorisini false→true değiştirerek metadata-only sidecar revizyonu ve medya
  yeniden upload edilmemesini doğrulama. Test cleanup’ı yalnız bu albümü kaldırır.
- Ayrı fixture uygulamasının native Keychain/SQLite/snapshot alanı ve loopback
  HTTPS sunucusu. Kloda cihaz anahtarı/pin/epoch veya kişisel arşiv reset yok.
- Ürün galerisinin salt-okunur API/UI kapsamı değişmez; arama, favori düzenleme,
  albüm düzenleme, paylaşma veya yerel silme ürün özelliği eklenmez.
- Sonuç yalnız Simulator PhotoKit/Keychain/native foreground pipeline kanıtı;
  iOS gerçek BG delivery, fiziksel cihaz/hardware ve normal OS cadence kanıtı değil.

Alternatif: yalnız mevcut OS erişimli test medyasını salt okunur export etme;
medya yoksa Photos runtime NOT_RUN. Metadata-only mutasyon kanıtı bu alternatifte
kapatılmaz. Her iki durumda Android gerçek OS-dispatch, iOS mevcut gerçek HTTPS,
JS/UI ve kalan review/restore kod çalışması sürdürülebilir.
