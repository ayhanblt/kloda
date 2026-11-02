# 16b — ayrı onay bekleyen Android SFTP Photos fixture

Bu belge test çalıştırma onayı değildir. Önceki SMB Photos onayı SFTP'ye taşınmaz.
CURRENT'te korunan ayrı Photos test onayı uygulanır; kişisel kitaplık/cihaz/NAS yok.

Yalnız KlodaWebDavStep15 / emulator-5584, test paketi `com.kloda.sync.test` ve
`/tmp/kloda-sftp16b-preflight/bound-owned-runtime.json` ledger'ındaki mount içermeyen,
127.0.0.1:27448'e bağlı disposable OpenSSH sunucusu. Bağımsız management yolundan
Ed25519 SHA256 pin alınır. SFTP ürün native kodu, gerçek kaynak seçimi, bound yayın,
metadata revizyonu, download, restore, tekrar restore/idempotency ve stale/unknown
admission kontrolleri çalışır. Windows veya kişisel sunucu kullanılmaz.

Fixture: `AndroidSftpPhotosRestoreChecks.kt`; runner:
`python3 tools/test-android-sftp.py --photos-owned-fixture`.
Varsayılan Files veya kaynak-only koşuları bu scope'a giremez.

Bir yeni 1×1 PNG kaynak ve fixture'a özel albüm klasörü oluşturulur. Dört restore
çağrısında beklenen tek çıktı; son iki çağrı stale/unknown güvenli duruş kontrolüdür.
Beklenen toplam iki yeni medya öğesi; hata durumunda muhafazakâr üst sınır beş
(kaynak + en fazla dört çıktı). Silme yalnız ledger/native receipt-owned URI'lerle,
çıktıda receipt+marker+hash doğrulamasıyla yapılır. Bilinmeyen içerik silinmez.
Yeni verilen izinler geri alınır; fixture alias'ı temizlenir; sunucu önce kapalıysa
sonunda kapatılır ve yalnız runner'ın açtığı adb reverse kaldırılır.

Kaynaklar:
- `apps/mobile/modules/my-module/android/src/androidTest/java/com/kloda/sync/AndroidSftpPhotosRestoreChecks.kt`
- `tools/test-android-sftp.py`
- `apps/mobile/modules/my-module/android/src/main/java/com/kloda/sync/AndroidSftpPhotos*.kt`

Durum: fixture APK derlemesi PASS (01.11 kapanış grubu). Ayrı onay istendi; test çalışmadı.
