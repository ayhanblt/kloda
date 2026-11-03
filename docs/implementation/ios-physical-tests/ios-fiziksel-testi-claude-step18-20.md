# iOS fiziksel testi — Claude, adım 18–20

Bu klasör, iOS Simulator'da yapılamayan ve fiziksel iPhone'da yapılacak tüm testleri bir arada tutar.
Codex kendi testlerini aynı klasöre ayrı bir dosya olarak ekler. Testler en sonda, tüm kabullerden sonra,
gate 21 (toplu fiziksel kabul) kapsamında ve kullanıcının açık izniyle yapılır. Bu listedeki hiçbir madde
şu an PASS sayılmaz.

Önceki `step19-physical-test-checklist.md` bu dosyaya taşındı.

## 0. Test gününden önce

1. **Sunucu: kendi Nextcloud/WebDAV sunucun (karar 2026-11-01).** Fixture yalnız `127.0.0.1:18443`'e bağlı, telefondan
   kullanılamaz. Kontrol et:
   - telefonun ağından HTTPS ile erişiliyor, sertifikası iOS'un güvendiği bir sertifika (Safari'de uyarısız açılıyor);
   - test için ayrı, boş klasörler (`Kloda-test`, `Kloda-test-2`) ve ayrı bir uygulama parolası; test sonunda iptal;
   - ~150 fotoğraf için yeterli boş alan.
   Parolaları yalnız telefonda Kloda'ya / sistem tarayıcısına gir; sohbete veya dosyalara yazma.
2. **İmza.** Ücretsiz kişisel takımda `com.kloda.app` başka hesapta kayıtlıysa imza reddedilir; o durumda uygulama ve
   `KlodaLiveActivity` eklentisi için kendi önekinle bundle id (yerel değişiklik, commit edilmez). Profil 7 gün geçerli.
   Bundle id değişirse OAuth yönlendirme kayıtları (Dropbox, OneDrive, Yandex, Google) yeni id'yle eşleşmeyebilir;
   B4 o durumda atlanır ve not edilir.
3. **Uzun yedekleme.** Kloda'ya en az ~150 büyük fotoğraf seçtir; birkaç fotoğraflık iş Duraklat'a zaman bırakmıyor.
4. **iOS sürümü.** Live Activity düğmeleri iOS 17+; iOS 16.4 cihaz varsa A11 ayrıca denenir.

## A. Live Activity (adım 19)

Simulator provası 2026-11-01'de yapıldı
([kanıt](../evidence/step19-live-activity-2026-10-31/simulator-runtime-2026-11-01.json));
TR/EN/DE × koyu/açık/xxxL/AX2 kart çizimleri Simulator'da betikle alındı. Aşağıdakiler cihaz ister.

Bilmen gereken davranış (hata sanma):
- Ön planda başlayan iş, uygulama ön plandan çıkınca durdurulur (`os_interrupted`); kart "Bekleniyor" veya
  otomatik duraklatma varsa "Duraklatıldı" olur.
- Kilitliyken süren tek iş türü iOS'un başlattığı arka plan görevi (BGProcessingTask).
- Yeni kart yalnız uygulama ön plandayken ve yedekleme sürerken açılır; kart 2 sn'de bir güncellenir, push yok.

| # | Adım | Beklenen |
|---|------|----------|
| A1 | Uygulamayı aç, Şimdi yedekle; 3 sn bekle; kilitle | Kart "Yedekleniyor", yüzde, Duraklat + Kloda'yı aç; birkaç sn içinde "Bekleniyor" |
| A2 | Uygulamada senkronizasyonu duraklat; aç, Şimdi yedekle, kilitle | Kart "Duraklatıldı", Devam et + Kloda'yı aç (Simulator'da PASS) |
| A3 | Kilit ekranında Devam et | Face ID/kod ister, Kloda açılır, otomatik duraklatma kalkar, otomatik iş başlar (Simulator'da PASS) |
| A4 | Çalışan işi kilit ekranı kartından duraklat (aşağıdaki BG tetikleme ile) | Face ID/kod ister; iş durur; kart "Duraklatıldı"; sunucuya yeni istek gitmez |
| A5 | Elle başlatılmış işi uygulamada duraklat, kilitle | Kart "Bekleniyor", yalnız Kloda'yı aç (Simulator'da gösterilemedi) |
| A6 | Kart açıkken uygulamayı 2+ dk açmadan beklet | Kart "Bekleniyor"a döner, Duraklat yok (bayat kart) |
| A7 | Ayarlar > Erişilebilirlik > Daha Büyük Metin en büyük | Kart kesilmeden, düğmeler alt alta; 160 pt sınırında gerçek kırpma nasıl (Simulator AX2/AX5 PASS) |
| A8 | VoiceOver açık, kilit ekranı kartı | Başlık, ilerleme ("Onaylanan yedekleme ilerlemesi", yüzde), düğmeler okunur; ikonlar okunmaz |
| A9 | Dynamic Island (destekleyen cihaz) | Kompakt: logo + yüzde; uzun basınca durum + hedef türü |
| A10 | Gizlilik | Kartta dosya, fotoğraf, cihaz, sunucu adı yok; yalnız "WebDAV"/"Bilgisayar" |
| A11 | Cihaz dili TR/EN/DE; iOS 16.4 cihaz varsa | Metinler cihaz dilinde; iOS 16.4'te kart düğmesiz açılır |

### A4 için arka plan görevini tetikleme

Simulator'da yapılamaz (BGTaskScheduler orada çalışmaz). Xcode'dan çalıştırırken:

1. Kloda'yı aç (otomatik yedekleme açık, duraklatılmamış), A1'deki gibi kart açılsın; ana ekrana çık (kilitleme).
2. Xcode'da Pause, lldb'de:
   `e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateLaunchForTaskWithIdentifier:@"com.kloda.app.webdav.processing"]`
   (bundle id değiştiyse öneki de değiştir), sonra Continue.
3. Kilitlemeden Bildirim Merkezi'ndeki kartı aç: "Yedekleniyor" + Duraklat görünmeli. Kilitliyken journal'lar korumalı
   olduğu için iş `credential_locked` ile bekleyebilir; ilk deneme kilit açıkken.
4. Duraklat → iş durur, sunucu kaydında yeni istek kesilir.

## B. Bulut hedefleri (adım 18)

Simulator'da yapılamadı: Simulator'daki uygulamaya metin yapıştırılamadığı için sunucu adresi ve Nextcloud girişi
girilemedi (2026-11-03). Hedef başına "Şimdi yedekle"/Duraklat köprüsü (18A/4c) iOS'ta derlendi ve Jest ile
kapsandı; çalışırken iOS'ta görülmedi. iOS çok hedefli kuyruk koşusu da 18A/3'ten beri NOT_RUN.

| # | Adım | Beklenen |
|---|------|----------|
| B1 | Bağlantılar > Bağlantı ekle > Nextcloud; kendi sunucun, klasör `Kloda-test-2`; sistem tarayıcısında giriş | Kart eklenir, "Devre dışı"; parola uygulamada hiç sorulmaz; sağlayıcı listesinde Kolab Now yok |
| B2 | Kartta Etkinleştir, sonra Şimdi yedekle | Kart "Yedekleniyor…", düğme Duraklat olur; dosyalar yalnız `Kloda-test-2`'ye gider |
| B3 | Çalışırken kartta Duraklat | İş durur, kart "Duraklatıldı"; özgün WebDAV kartı ve planı değişmez |
| B4 | Özgün WebDAV de etkinken iki hedefi sırayla çalıştır (biri sürerken diğerinde Şimdi yedekle) | İkinci istek `backup_busy`; aynı anda iki yükleme yok; her hedef kendi durumunu gösterir |
| B5 | Uygulamadan çık / kilitle (elle iş sürerken) | İş `os_interrupted` ile durur, kart "Duraklatıldı"; geri dönünce Şimdi yedekle yeniden başlatır |
| B6 | Hedefi kaldır (onay penceresi) | Kart kaybolur; sunucuda Kloda uygulama parolası iptal edilir (Nextcloud > Güvenlik); diğer hedefler etkilenmez |
| B7 | Dropbox, OneDrive, Yandex, Google Drive girişleri imzalı cihaz derlemesinde | Sistem tarayıcısı açılır, dönüşte kart eklenir, "desteklenmiyor" (yükleme 18B/5'e kadar yok); iptal çalışır |
| B8 | VoiceOver açık, Bağlantılar kartları | Sağlayıcı, durum, kullanıcı/klasör ve düğmeler sırayla okunur; durum değişimi duyurulur |
| B9 | Daha Büyük Metin en büyük, Bağlantılar ve ekleme sayfası | Metin ve düğmeler kesilmeden |

## Kaydet

Her adım için ekran görüntüsü ve PASS/FAIL; FAIL'de saat ve sunucu kaydı. Sonuçlar yeni bir JSON olarak
`evidence/step19-live-activity-2026-10-31/` (A) ve `evidence/cloud18-nextcloud-2026-10-31/` (B) altına eklenir.
