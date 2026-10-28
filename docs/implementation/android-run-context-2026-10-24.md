# Android çalışma–ayar bağlamı — 24 Ekim 2026

Kullanıcı onaylı11-adım listesinin1. adımının uygulanmasını istedi. Scope yalnız
Android native PC-first foreground queue çalışma/ayar bağlamıdır; background/OS
scheduler veya iOS/Windows araştırması bu dilimde başlatılmadı.
[Liste ve sonraki iş](mobile-execution-checklist-2026-10-24.md).

## Tamamlanan davranış

Mevcut SharedPreferences kaynak/program ayarı değişirken aynı commit'e UUID
revision eklenir. Aynı değerli schedule save ve aynı source seçimi revision'ı
boş yere değiştirmez. Kaynak ekleme/kaldırma/ref, interval/local-time ve pairing
bağlamı captured fingerprint'e bağlanır; değiştirip eski değerlere dönmek eski
çalışmayı canlandırmaz. WebDAV endpoint/credential native PC hedefi değildir;
WebDAV ayarı PC çalışmasını durduracak bağlama katılmadı.

Queue kaynak listesini çalışmanın başında bir kez yakalar; yeni kaynak eski run'a
katılmaz. Her güvenli kontrol/JNI sınırında güncel native ayarla eşleşme aranır.
Ayar değişince devam/retry/final run-success durur; `settings_changed` sonucu
üç dilde görünür. In-flight synchronous istek geri alınmış varsayılmaz; doğrulanmış
ACK korunur ve sonraki istekten önce durulur. Finalize/Completed yayın ve run-result
kontrolleri sourceLock ile ayar yazımıyla sıralanır; tamamlanmış dosyalar korunur.

Pairing scan/approve/deny/cancel/resume/remove değişimi görünür RESUMED/foreground
yolundadır; revision kaydından sonra sourceLock bırakılır, queue join edilir ve
sonra native mutation çağrılır. sourceLock tutarken join yok. Aynı native record'a
resume yalnız pause eder;5/60 bütçesini yeni context bahanesiyle sıfırlamaz. Yeni
record eski dosya işinin record/source/operation kimliğini değiştiremez. Mevcut
native pin/ACL/revoke/scope kontrolleri her transferde geçerlidir; context geçmişi
izin değildir. Açık rebackup kullanıcı eylemi/suppression sınırları korunur.

Mevcut SQLite schema5 yalnız files_run context_binding sütunu ve immutable run
trigger ekler. Context/record/rebackup değiştirilemez; v4 eski bağlamı bilinmeyen
resumable run otomatik current sayılmaz, güvenli stopped/failed olur. Dosya
journal/Completed/ACK/snapshot ve owner_deleted kayıtları sıfırlanmaz veya taşınmaz.
Yeni context ayrı run/id ve kendi bütçesiyle başlar. Stale terminal row'a geç gelen
pause/finish/attempt yazımı eski işi canlandıramaz; startAttempt etkilenen satırı
kontrol eder. Eski finished context güncel ayarların sonucu gibi gösterilmez;
dosya geçmişi ve durdurulma sonucu korunur.

Files status sorgusu hatası eski canlı/güncel sonucu temizler. Ayrı Photos status
hatası ise geçerli Files kuyruğunu gizleyip Duraklat kontrolünü kapatmaz. Bu review
bulgusu düzeltildi ve regresyon testi eklendi. UI tasarım dili değiştirilmedi.

## Doğrulama

[Seçilmiş kanıt](evidence/android-run-context-2026-10-24/README.md).
Mobil53 test/8 suite, ESLint/TypeScript, iOS+Android JS export, Kotlin main+
instrumentation compile exit0. Gerçek Kotlin context/worker host smoke ve8 worker
vakası PASS; journal double kullanılır. Production SQL disposable host2 test PASS:
v4→v5/reopen, byte receipt/tombstone, immutable context, stale sonuç ve farklı peer.
İlk test fixture yerleşimi/beklenen hata metni hataları düzeltildi; final sonuçlar
önceki başarısız denemelerden ayrıdır. Bağımsız Sol kaynak review'ında bir UI
regresyonu giderildi; son geçişte engelleyici bulgu yok. Reviewer test çalıştırmadı.

Ayarlar/revision aynı native preferences commit'indedir; ayrı config deposu yok.
[Android Editor sözleşmesi](https://developer.android.com/reference/android/content/SharedPreferences.Editor)
atomik değişiklik ve senkron kalıcı commit sonucu sağlar; false ise başarı
sunulmaz. SQLite/preferences iki ayrı store tek transaction gibi sunulmaz: çalışma
bağlamı yeniden okunup doğrulanır; mismatch'te eski run benimsenmez.

## Kabul sınırı

Gerçek Android SharedPreferences/process/SQLiteOpenHelper ve JNI aktarım sırasında
ayar yarışları instrumentation kaynaklarında/kabul planında açıktır; instrumentation
yalnız derlendi. Cihaz/emulator/probe başlatılmadı; host smoke fiziksel kabul değil.
Program occurrence tüketimi/Live/background/OS yürütücüsü henüz yok. Bu dilim
run'ı mevcut program revision'ına bağlar; gerçek schedule yürütücüsü3. adımda aynı
bağı kullanmalıdır. Schedule preference otomatik yedekleme yapılmış sayılmaz.
Native PC scope/revoke yetkisi telefondaki settings hash'inden türetilmez.

Onaylı liste2. adımı (Android arka plan owner/queue ömrü) sıradadır; bu görevde
başlatılmadı. iOS LAN sözleşme kararı, Desktop platform engelleri ve geniş ürün
backlog'u listede korunur. Kullanıcı arşivi/key/pin/certificate/epoch/authority'ye
ve Git add/commit/push/reset/clean/stash işlemlerine dokunulmadı; fiziksel duraklatma
ve ana model/effort ayarı korunur.
