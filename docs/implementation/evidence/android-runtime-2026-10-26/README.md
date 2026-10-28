# Android API36 runtime —26 Ekim2026

Sonraki fiziksel güvenlik güncellemesi: aşağıdaki eski komut bu kapsülün tarihsel
APK'sına aittir. Güncel runner açık scope ister; günlük kişisel profilde yalnız
`-e scope local-files` kullanılır. Tam medya koşusu ayrı boş test ortamı ve açık
`-e scope media-fixture` içindir. Eski medya APK'sı günlük telefonda çalıştırılmaz.

[Sonuç/kaynak/APK hash'leri](result.json), [final11 grup](final-groups.txt),
[farklı PID reopen](restart-final.json), [APK ELF64](apk-elf64.json).
[Eski schema beklentisi FAIL](baseline-fail.txt), [düzeltilmiş migration](migration-fixed.txt),
[Photos kayıp finalize FAIL](photos-lost-reply-fail.txt) ayrı tutuldu.

Ana koşu: `adb -P 5059 -s emulator-5588 shell am instrument -w com.kloda.sync.test/com.kloda.sync.AndroidFilesQueueRecoveryInstrumentation`.
Restart: aynı komuta `-e restartPhase write|read -e restartToken <fresh32hex>`;
writer DB'yi temiz kapatır, arada yalnız test paketi force-stop edilir.
Lifecycle grubu için yalnız test UID POST_NOTIFICATIONS izni geçici verilip
başlangıç grant durumuna geri alınır. Permission restore instrumentation dışında
yapılır; self UID revoke koşuyu öldürebilir.

Bu komutlar yeni cihaz/AVD başlatma veya fiziksel çalışma talimatı değildir.
Kapsül self-test Android/MediaStore/SQLite/FGS/JobScheduler kaydıdır; native PC
yanıtları fixture, resource-recovery callback'i simulated sender. Gerçek PC/TLS/
ACL, aktif-upload kill, power-loss, eski OS ve fiziksel kabul kanıtı değildir.
