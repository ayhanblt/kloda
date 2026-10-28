# Android liste10 dar açılış/görsel kapanışı —28 Ekim2026

**Önceki unauthorized engeli normal Android USB debugging onayıyla aşıldı;
izole UI dilimi PASS.** [Seçilmiş yeni kanıt](evidence/mobile-integrated-2026-10-28/android-followup/README.md).
Önceki BLOCKED kaydı tarihsel olarak korunur; gerçek PC/LAN/fiziksel kabul olmaz.

## Yapılanlar

- Aynı disposable API36 AVD, açık `/tmp` user/AVD/emulator yolları ve özel5038
  ADB sunucusuyla açıldı; kişisel cihaz seçilmedi. İlk sandbox denemesi socket/
  Qt engelinde durdu; izinli sandbox-dışı çalıştırma normal ADB ekranına ulaştı.
- Hostun tanımladığı vendor key ile guest boot property key aynı olsa da görünen
  USB onayındaki fingerprint farklıydı. Salt public-key karşılaştırması bunu
  **mevcut yerel ADB host key** olarak doğruladı; generated test vendor key diye
  sunulmadı. Yalnız görünür Allow seçildi, Always allow seçilmedi. Auth kapatılmadı,
  host key değişmedi ve Kloda peer/ACL güveni verilmedi.
- Önceden derlenen APK kuruldu. Sentetik fixture mevcut üretim App/Computer/
  Activity ekranlarını açtı; kaynak/peer/iş cevapları sahtedir. Görülen ACK65536/
  131072 ve outcome_unknown gerçek aktarım kanıtı değildir.
- Gerçek Android gözleminde durum çubuğu açık yüzeyde beyaz metin gösteriyordu.
  Üretim root'unda mevcut RN StatusBar `dark-content` sabitiyle düzeltildi;
  fixture aynı sabiti kullanır. Yeni bağımlılık veya native/policy değişimi yok.
- TR kaynak, DE PC, TR ilerleme ve EN belirsiz sonuç ekranları görüntülendi;
  scroll ile iki dosya görüldü. Belirsiz iş tamamlandı gösterilmiyor, ayrı PC
  izni rehberi görünür, metin/çerçeveler bu480×800/fontScale1 örneğinde okunur.
- Farklı PID3691→3830 reopen; fixture artık başlangıçtaki profil varlığını ve
  probeWarning değerini **yazmadan önce** raporlar. İkisi true; yeniden okunmuş
  metadata uyarısı true. Null profil seed başarısı reopen kanıtıyla karıştırılmaz.

## Doğrulama

Bu followup'ta108 test/11suite, root lint, mobile TS ve iki JS export exit0.
Önceki native derlemeler bu koşuda yeniden yapılmış sayılmadı; production native
kaynak değişmedi. Ayrı kaynak review engelleyici bulgusuz; sonuç review ayrı kayıt.
İlk erken pidof/görüntü/hazır-kayıt assertion'ı yükleme tamamlanmadan exit1 verdi;
yeni sahne ve preexisting alanlarını bekleyen bounded kontrol geçti. Başlangıçta
DevLauncher SplashScreenManager ClassNotFoundException loglandı, ardından JS ve
UI çalıştı; SafeAreaView deprecation uyarısı da kayıtlı, uyarısız runtime denmedi.

## Korunan açıklar

Gerçek QR/grant/PC aktarımı, kapsamlı Android font/keyboard/reader/oldOS/16KB,
iPhone/OS background/fiziksel grup11, WebDAV byte sender ve eşzamanlı receiver
koruma-kopyası latency kabulü açık. Önceki SDK devices.xml/.old yan etkisi aynen
açık kayıt: geri yazma/restore/cleanup yok. Yeni SDK sürümü/image indirilmedi;
mevcutuserdata veya arşiv silinmedi. Sıradaki liste11 için gerçek platform kapılarını
ve izinli fiziksel kapsamı netleştirmek; bu followup fiziksel grubu başlatmaz.

Resmî referanslar: [Emülatör ekran kaydı/screenshot](https://developer.android.com/studio/run/emulator-take-screenshots),
[SDK ortam değişkenleri](https://developer.android.com/tools/variables).
Console screenshot ve normal dokunma, sonra exact emulator serial ile ADB kullanıldı.

Ayrı sonuç review ilk unknown görüntüsünün reopen çekimiyle aynı dosya adında
üzerine yazıldığını buldu. İlk görüntü byte kanıtı yok; tarihsel hash doğrulanamaz.
Reopen görüntüsü ayrı adla korundu ve kendi hash kaydıyla eşleşir; eski PASS
görüntü kanıtı uydurulmadı. Diğer üç ilk ekran kaydı korunur.
