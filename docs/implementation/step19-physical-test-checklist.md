# Step19 fiziksel cihaz testi (gate 21) — hazırlık ve adımlar

Simulator provası 2026-11-01'de yapıldı ([kanıt](evidence/step19-live-activity-2026-10-31/simulator-runtime-2026-11-01.json)).
Bu liste fiziksel testte hata payını azaltmak içindir; gate 21 kapatıcı olarak kalır ve burada PASS sayılmaz.

## Önce çözülmesi gerekenler (test gününden önce)

1. **Sunucu: kullanıcının kendi Nextcloud/WebDAV sunucusu (karar 2026-11-01).** Fixture yalnız `127.0.0.1:18443`'e
   bağlı olduğu için kullanılmaz. Test gününden önce kontrol et:
   - telefonun bağlı olacağı ağdan HTTPS ile erişilebiliyor ve sertifikası iOS'un güvendiği bir sertifika
     (Safari'de uyarısız açılıyor);
   - test için ayrı, boş bir klasör (örn. `Kloda-test`) ve ayrı bir uygulama parolası; test bitince parolayı
     sunucuda iptal et;
   - yaklaşık 150 fotoğraf için yeterli boş alan.
   Parolayı yalnız telefonda Kloda'ya gir; sohbete veya dosyalara yazma.
2. **İmza.** Ücretsiz kişisel takımda `com.kloda.app` başka bir hesapta kayıtlıysa imza reddedilir; o durumda
   uygulama ve `KlodaLiveActivity` eklentisi için kendi önekinle bir bundle id gerekir (yerel değişiklik, commit edilmez).
   Ücretsiz profil 7 gün geçerlidir.
3. **Yeterince uzun bir yedekleme.** Kloda'ya en az ~150 büyük fotoğraf seçtir (Fotoğraflar sekmesi); 6 fotoğraflık
   iş birkaç saniyede bitiyor ve Duraklat'ı denemeye zaman kalmıyor.
4. **iOS sürümü.** Düğmeler iOS 17+; iOS 16.4 cihaz varsa kartın düğmesiz açıldığı ayrıca denenir.

## Bilmen gereken davranış (hata sanma)

- Uygulama ön plandan çıkınca **ön planda başlayan** iş (elle ya da otomatik) uygulamanın kendisi tarafından durdurulur
  (`os_interrupted`); kart "Bekleniyor" veya otomatik duraklatma varsa "Duraklatıldı" olur. Bu tasarım gereğidir.
- Kilitliyken çalışmaya devam eden tek iş türü iOS'un başlattığı arka plan görevidir (BGProcessingTask).
- Yeni kart yalnız uygulama ön plandayken ve yedekleme sürerken açılır; arka plan görevi var olan kartı günceller.
- Kart, uygulama çalıştığı sürece 2 sn'de bir güncellenir; push yok.

## Adımlar

| # | Adım | Beklenen |
|---|------|----------|
| 1 | Uygulamayı aç, Şimdi yedekle; 3 sn bekle; kilitle | Kart "Yedekleniyor", yüzde, Duraklat + Kloda'yı aç; birkaç sn içinde "Bekleniyor" |
| 2 | Uygulamada Senkronizasyonu duraklat; yeniden aç, Şimdi yedekle, kilitle | Kart "Duraklatıldı", Devam et + Kloda'yı aç (Simulator'da PASS) |
| 3 | Kilit ekranında Devam et | Face ID/kod ister, Kloda açılır, otomatik duraklatma kalkar, otomatik iş başlar (Simulator'da PASS) |
| 4 | Çalışan işi kilit ekranı kartından duraklat (aşağıdaki BG tetikleme ile) | Face ID/kod ister; iş durur; kart "Duraklatıldı"; sunucuya yeni istek gitmez |
| 5 | Kart açıkken uygulamayı 2+ dk hiç açmadan beklet | Kart "Bekleniyor"a döner, Duraklat düğmesi yok (bayat kart) |
| 6 | Ayarlar > Erişilebilirlik > Daha Büyük Metin en büyük | Kart kesilmeden; düğmeler alt alta (Simulator AX2/AX5'te PASS) |
| 7 | VoiceOver açık, kilit ekranı kartı | Başlık, ilerleme ("Onaylanan yedekleme ilerlemesi", yüzde) ve düğmeler okunur; ikonlar okunmaz |
| 8 | Dynamic Island (destekleyen cihaz) | Kompakt: logo + yüzde; uzun basınca durum + hedef türü |
| 9 | Gizlilik | Kartta dosya, fotoğraf, cihaz, sunucu adı yok; yalnız "WebDAV"/"Bilgisayar" |
| 10 | Dil TR/EN/DE (cihaz dili) | Metinler cihaz dilinde |

### Adım 4 için arka plan görevini tetikleme

Simulator'da yapılamaz (BGTaskScheduler orada çalışmaz). Xcode'dan çalıştırırken:

1. Kloda'yı aç (otomatik yedekleme açık, duraklatılmamış), 1. adımdaki gibi kart açılsın; ana ekrana çık (kilitleme).
2. Xcode'da Pause, lldb'de:
   `e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateLaunchForTaskWithIdentifier:@"com.kloda.app.webdav.processing"]`
   (bundle id'yi değiştirdiysen öneki de değiştir), sonra Continue.
3. Kilitlemeden ekranın üstünden aşağı kaydırıp Bildirim Merkezi'ndeki kartı aç: "Yedekleniyor" + Duraklat görünmeli.
   Kilitliyken journal'lar korumalı olduğu için iş `credential_locked` ile bekleyebilir; bu yüzden ilk deneme kilit açıkken.
4. Duraklat → iş durur. Sunucu kaydında yeni istek kesilmeli.

## Kaydet

Her adım için ekran görüntüsü ve PASS/FAIL; FAIL'de saat ve sunucu kaydı. Sonuçlar
`evidence/step19-live-activity-2026-10-31/` altına yeni bir JSON olarak eklenir.
