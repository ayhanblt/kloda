# Android çalışma–ayar bağlamı kanıtı — 24 Ekim 2026

[Sonuç/kapsam/kaynak SHA](result.json), [gerçek host Kotlin çıktı](worker-checks-output.txt),
[worker fixture](worker-checks.kt), [context testleri](context-checks.kt),
[tekrar sürücüsü](run-worker-checks.py). Driver mevcut Kotlin compiler/stdlib,
Android36 signatures ve org.json host jar kullanır; dependency indirmez. Çıktıları
replay sırasında ignored local-evidence içine yazar; kaydedilmiş kanıtı değiştirmez.

`python3 tools/test-android-files-retry.py`: gerçek kaynak SQL'i disposable host
SQLite'ta çalıştırır. Fresh schema, v4→v5 ALTER, immutable context/record/rebackup,
reopen, retry zamanı/bütçesi, stale finish/pause/start reddi, farklı peer ve
Completed receipt/deletion tombstone koruması kontrol edilir. İki test PASS.

Worker/context testleri gerçek production Kotlin dosyalarını derler. Journal test
double'dır; context fingerprint'te gerçek org.json kullanılır. Eski ayarlara geri
dönme, source/ref/schedule/revision, WebDAV ayrımı, malformed ayar ret, eski finished
sonucun current gibi görünmemesi,5/60 retry ve wait/finish sırasında settings stop
kontrolleri PASS. Bunlar Android SharedPreferences veya JNI runtime kabulü değildir.

Mobil53 test/8 suite, ESLint/TypeScript, iki JS export ve Kotlin ana+instrumentation
compile gerçek bu dilimde çalıştı; tüm raw konsol bu kapsülde tutulmuş sayılmaz.
Device/emulator/instrumentation çalıştırılmadı; fiziksel duraklatma sürer.
[Yapılan değişiklikler](../../android-run-context-2026-10-24.md).
