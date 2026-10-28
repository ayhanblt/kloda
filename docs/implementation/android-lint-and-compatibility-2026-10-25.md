# Android liste3 lint kapanışı ve liste4 statik uyumluluk —25 Ekim2026

Liste2/3 kaynak ve host kapsamı tamam; gerçek Android OS/cihaz kabulü değildir.
Liste4'ün ilk statik uyumluluk dilimi uygulandı. Fiziksel/cihaz/probe duraklatması
kaldırılmadı. [Yeni kanıt ve kaynak hash'leri](evidence/android-schedule-2026-10-25/lint-followup.json).
Önceki [result.json](evidence/android-schedule-2026-10-25/result.json) tarihsel
kaynak snapshot'ıdır; oradaki lint BLOCKED sonucunu bu yeni koşu supersede eder.

## Hata, düzeltme ve gerçek sonuç

K2 analizinde Worklets'in Kotlin Gradle scripti `KaModule` araç hatası üretiyordu.
Yalnız analiz motorunu `-Pandroid.lint.useK2Uast=false` ile değiştiren Worklets
kontrolü exit0 verdi; ardından tam uygulama/modül analizi çalıştırıldı.
Lint task/issue kapatılmadı, baseline veya bağımlılık sürüm değişikliği yapılmadı.
Varsayılan K2 yolu hâlâ araç hatasına açıktır; aşağıdaki PASS explicit K1 komutudur.
[Android lint K2 yapılandırma kaynağı](https://android-developers.googleblog.com/2023/07/try-k2-compiler-in-your-android-projects.html).

İlk tam analiz, modülde8 ve app'te1 gerçek hata buldu; hata varken PASS verilmedi:

- Modülde ACCESS_NETWORK_STATE bildirimi eksikti; app config'inde zaten olan
  normal izin modül manifestine eklendi. Yeni kullanıcı izni/authority değildir.
- API30 `clearCapabilities` korundu; API24–29 yalnız eski varsayılan
  TRUSTED/NOT_RESTRICTED kaldırılır, NOT_VPN ve Wi-Fi/Ethernet seçimi korunur.
  İnternet/validated ağ şartı veya güvenlik fallback'i eklenmedi.
- API29 `isChildDocument` korunur. API24–28 aynı seçilmiş tree/authority ve kalıcı
  READ izninden, provider çocuklarının opaque ID'leriyle üyelik doğrular; isim/path
  prefix'i kanıt sayılmaz. Döngü/derinlik/null sorgu/izin kaybı güvenli reddedilir.
  Sinyal sorguya/özyinelemeye taşınır; snapshot sinyali üyelikten önce kurulur.
- Klasör seçici READ yoksa başarı dönmez; yalnız verilmiş READ kalıcılaştırılır.
- Kamera hardware özelliğinin optional bildirimi kaynak Expo config plugin'ine
  bağlandı. Generated manifest aynı plugin ile güncellendi; tüm prebuild koşulmadı.
- Modülün mevcut `abortOnError=false` ayarı true yapıldı; hatalar gizlenmez.

[DocumentsContract API sınırları](https://developer.android.com/reference/android/provider/DocumentsContract#isChildDocument(android.content.ContentResolver,%20android.net.Uri,%20android.net.Uri)) ve
[NetworkRequest API sınırları](https://developer.android.com/reference/android/net/NetworkRequest.Builder#clearCapabilities()) incelendi.

## Liste4 —16KB statik kütüphane uyumluluğu

Tam lint, Kloda arm64 kütüphanesinde16KB hizalama eksiğini de gösterdi. Mevcut
NDK27 ve Rust toolchain değiştirilmeden, build.rs yalnız Android cdylib için
max-page-size/common-page-size16384 linker seçeneklerini üretir.
[Resmî NDK27 talimatı](https://developer.android.com/guide/practices/page-sizes#ndk-r27).
Host build-script kontrolünde Android bu iki seçeneği üretirken macOS/Windows/
iOS/Linux üretmez. Dört ABI yeniden üretildi; gerçek ELF LOAD hizalaması ve
offset/adres congruence kontrolü PASS. Denetleyici32/64bit sentetik4KB ve tutarsız
LOAD örneklerini reddeder; Python -O ile çalışmayı da reddeder.

## Bu takipte çalıştırılan kontroller

```sh
# apps/mobile/android içinde; Windows'ta gradlew.bat kullanılır.
./gradlew :app:lintDebug :my-module:lintDebug :my-module:compileDebugAndroidTestKotlin --offline --console=plain -Pandroid.lint.useK2Uast=false
```

Son koşu exit0/Gradle26sn:857 task,71 çalıştı/786 güncel. Kotlin ana ve
instrumentation derlemesi, dört ABI native üretimi ve tam lint tamamlandı.
App0hata/30uyarı; modül0hata/34uyarı. Aligned16KB uyarısı kalmadı.
KTX/SDK/inlined API/statik alan ve app/resource uyarıları raporda saklanır.
StaticFieldLeak, applicationContext ile kurulan process kuyruğunu işaretler;
Activity sızıntısı kanıtı değildir; suppression eklenmedi.

- `python3 tools/test-android-saf.py`: gerçek scanner12 host grubu ve gerçek
  picker caller kontrolü PASS; opaque ID/scope, iptal/izin kaybı ve API29 yolu.
- `node tools/test-android-config.cjs`: manifest oluşturma/güncelleme/idempotence PASS.
- `python3 tools/check-android-elf-alignment.py`: sentetik kontroller+dört ABI PASS.
- build.rs hedef ayrımı ve scoped rustfmt, `git diff --check`: PASS.
- Ayrı Sol kaynak/güvenlik ve sonuç review tamam; iptal ve ELF denetleyici
  bulguları giderildi, son geçişte engelleyici bulgu yok. Reviewer test koşmadı.

Önceki64 mobil test ve diğer Rust/host PASS'leri bu takipte yeniden koşulmadı;
[önceki iş grubunun kanıtıdır](android-scheduling-2026-10-25.md).

## Açık liste4 kabulü

APK/AAB ZIP hizalaması, gerçek16KB OS, API24/güncel OS runtime, SAF/MediaStore,
bildirim/izin/FGS/JobScheduler, reboot/kill/Doze/kota, locked key, gerçek LAN/
revoke/suppression/rebackup kabulü NOT_RUN. Derleme bunları kapatmaz.
API24–28 üyelik kontrolü büyük ağaçta O(n²) maliyete ulaşabilir; provider iptale
uymayabilir. Live fallback IO/pil ve dosya×çalışma journal büyümesi ölçülmedi.
Retention/cleanup politikası icat edilmedi; performans değerlendirmesi gerekli.

Sıradaki iş: liste4'ün kalan statik paketleme/uyumluluk ve kaynak tüketimi
değerlendirmesi. Gerçek OS/cihaz kapısı duraklatılmış kalır; iOS locality kararı
ve diğer platform engelleri ayrıca açıktır. Kullanıcı verisi/Git mutation yok.
