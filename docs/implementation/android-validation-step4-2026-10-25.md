# Mobil liste4 — Android doğrulama —25 Ekim2026

**26 Ekim takip:** Kullanıcı yalnız disposable API36 emülatörünü onayladı; [11 grup + ayrı-PID reopen doğrulandı](android-runtime-step4-2026-10-26.md). Aşağıdaki eski izin-bekleniyor/runtime-NOT_RUN kayıtları25Ekim tarihsel kapsamıdır. Gerçek PC/Doze/eskiOS/16KB/fiziksel kapıları bu sonuçla kapanmadı.

Durum: **cihazsız host/statik dilim tamam; Android runtime kabulü açık**.
Fiziksel/cihaz/probe duraklatması kendiliğinden kaldırılmadı. Kullanıcıdan yalnız
disposable API36 emülatörü için ayrı izin istendi; henüz yanıt/çalıştırma yok.
[Sonuç, kaynak ve APK hash'leri](evidence/android-validation-2026-10-25/result.json).

## Güncel paket ve otomatik kontroller

Güncel app debug APK ve module androidTest APK üretildi; release dağıtımı değildir.
Son offline derleme + explicit K1 tam lint exit0/15sn,927 task (97 executed).
App0hata/30uyarı, modül0hata/34uyarı. APK içinden minSdk24/targetSdk36 okundu;
bu değerler API24 cihaz çalışırlığı kanıtı değildir. K2 araç hatası önceki kayıtta
açık kalır; task/issue kapatma veya baseline yok.

- `zipalign -c -P 16 -v 4`: exit0/Verification successful; APK değiştirilmedi.
- `apksigner verify`: exit0; debug imzası kontrolü, release anahtarı kullanılmadı.
- Paket içindeki arm64-v8a/x86_64 kütüphanelerinin **52/52** ELF LOAD hizalaması,
  adres-offset congruence ve RELRO yerleşim kontrolü PASS.10 RELRO sonu hizalı;
  42 tam kendi LOAD'unda, izinli son-sayfa padding'iyle ve başka yazılabilir sayfa
  çakışmadan korunuyor. İlk yalnız modulo tanılaması eksikti; review bunu yakaladı.
  Hiçbir dependency/toolchain güncellemesi gerektiği sonucu çıkarılmadı.
  [Tam resmî RELRO istisnası](https://developer.android.com/guide/practices/page-sizes#check-the-relro-security-flag)
  ve [salt okunur ZIP kontrolü](https://developer.android.com/tools/zipalign) esas alındı.
  32bit bağımlılıklarda4KB bulunması bu64bit16KB kabulünün hatası diye sunulmadı.

Araç: `python3 tools/check-android-apk.py <app-debug.apk>`. Sentetik pozitif/negatif
RELRO örnekleri shared writable remainder, komşu yazılabilir sayfa ve eşlenen son
sayfayı aşan padding'i reddeder. Üç örnekte bağımsız llvm-readelf çapraz kontrolü
de saklandı. Bu static check,16KB OS'de çalıştırma değildir.

## Kalıcı silme/rebackup ve restart kanıtı

`python3 tools/test-android-files-retry.py`: **4 test PASS**. Yeni kontroller gerçek
AndroidSyncJournal şema/trigger/version/jobs/markDeleted SQL'lerini kullanır:
ayrı salt okunur child process reopen sonrası tombstone ve eski Completed receipt
kalır; changed hash/ilgisiz aynı içerik dışlanmaz; silinmiş pending kuyruğa dönmez.
Explicit intent eski receipt'i değiştirmeden rebackup_of/operation/offset'i korur.
Aynı intent primary key kopyası UNIQUE ile reddedilir. Bu, gerçek queue API'sinin
yeniden çağrılmasında idempotence veya native PC sonucu kabulü değildir.

İlk test editinde harness yerleşimi hatası oldu; yalnız test düzeltilerek final4PASS
alındı. Üretim journal/authority/Photos sözleşmesi değiştirilmedi. Önceki test
sayıları bu koşunun yerine sunulmadı.

Kaynak karşılıkları: FilesQueue otomatik suppression/explicit rebackup/current
status kontrolü; AndroidSyncJournal source/version/tombstone; PhotoManifestPublisher
seçili sürüm/resource recovery. Mevcut instrumentation kaynaklarında receipt/
offset/metadata/lost-reply assertion'ları var; bu görevde **çalıştırılmadı**.
Photos resource rebuild ve gerçek queue/JNI caller kabulü açık kalır.

## Kaynak tüketimi: ölçüm ve dar düzeltme

Actual Kotlin scanner, disposable provider doubles ile flat8.000 dosyada ölçüldü:

| API24 keşif ölçütü | Önce | Sonra |
|---|---:|---:|
| Provider sorgusu |8.001|1|
| Cursor ziyareti |32.012.001|8.001|

Pre29 keşif zaten seçili ağaçtan her provider kenarını geziyordu; her satırda aynı
ağacı kökten tekrar arama kaldırıldı. Satır başı kalıcı READ/iptal denetimi,
cycle/depth/null reddi ve gerçek snapshot/open öncesi bağımsız checkedDocument
doğrulaması korunur. API29+ authoritative kontrolü aynı; cache/izin benimseme yok.
`python3 tools/test-android-saf.py`: **15 scanner host grubu + picker PASS**;
satırlar arasında izin iptali, iptal sinyali, dış-kapsam opaque ID reddi de kapsanır.

`python3 tools/check-android-resource-costs.py`: üretim files_run_job SQL'i ve
sadeleştirilmiş temel tablolarla8.000 dosya ×12run=96.000 üyelik satırı ve
15.073.280byte SQLite artışı ölçüldü. Bu üretim DB toplamı/pil/OS süresi değildir.
Snapshot/digest öncesi eski API bağımsız üyelik kontrolü hâlâ dosya başına ağaç
gezebilir; Live fallback gerçek byte'ları yeniden okuyabilir. Metadata için
retention/özetleme/temizlik kararı eklenmedi; eski kayıtlar korunur.

## Kalan kabul kapıları

- API24/güncel Android gerçek SAF/MediaStore, permission, background/FGS/job,
  reboot/kill/Doze/kota/lock, native hardware key ve app lifecycle.
- Gerçek queue automatic suppression, explicit tekrar, changed source,
  yeniden eşleştirme/current ACL, kesinti/revoke ve Photos shared resource rebuild.
- Gerçek16KB runtime, büyük arşiv IO/pil/DB büyümesi; release APK/AAB/store kabulü.
- Fiziksel Android↔PC LAN/E2E ve gerçek platform engelleri; duraklatılmış.

Bağımsız Sol kaynak/güvenlik ve kaydedilmiş sonuç incelemesi tamamlandı; tarama
optimizasyonunda yeni blocker yok. Reviewer runtime/test/build koşmadı.
Sıradaki uygulanabilir doğrulama izole Android emülatörü; ayrı izin yanıtı beklenir.
Bu rapor liste4'ün tamamlandığını veya iOS'a otomatik geçildiğini söylemez.
