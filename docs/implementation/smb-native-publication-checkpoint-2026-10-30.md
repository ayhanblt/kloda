# SMB16a — native publication foundation / 30 Ekim2026

D6A ve D7A onaylı. Exact SDK patch korunur; SMB ürün özelliği kapalıdır.
Bu kayıt aday seçiminden sonraki gerçek Files yayın temelidir, 16a kabulü değildir.
[Kanıt manifesti](evidence/smb-native-publication-step16-2026-10-30/manifest.json).

## Uygulanan ve doğrulanan

- Ortak Rust: güvenli, sessiz SDK isim dönüşümünü reddeden yollar; 64KiB sınırlı
  snapshot aktarımı ve tam final hash/byte doğrulaması; exclusive staging create,
  tüm WRITE+FLUSH, CLOSE ve no-replace rename onayları. Her alınmış toplu ACK,
  sonraki context kontrolünden önce native kayıt sahibine verilir. Belirsiz/eksik
  yanıt review gerektirir; hash eşitliğiyle sahiplenme veya uzakta silme yok.
- Ayrı Kotlin/Swift SMB journal: immutable tam hedef/credential generation,
  kaynak/snapshot/hash/size/context header; monoton ACK sırası; FULL/WAL; güncel
  context ve kaynak/admission kontrolüyle atomik yerel Completed. PC/DAV kayıtları
  completion yetkisi olarak kullanılmaz. C ABI/JNI aynı gerçek yayını çağırır.
- Ayrı sürümlü SMB Photos JSON codec: strict alanlar/duplicate-key reddi,
  int64 değerlerini string koruma, güvenli kaynak yolları, orijinal metadata,
  MIME/hash/rol/album/favori. Bu yalnız syntax doğrulamasıdır; yerel Completed
  kaynak sahipliği kontrolü ve Photos akış bağlantısı henüz uygulanmadı.
- Host Rust 7 unit+3 codec, gerçek Samba yedi yayın senaryosu, JNI dahil Clippy PASS.
  iOS kaynak Swift journal+C ABI+gerçek Samba host testi ve ayrı süreç reopen PASS.
  Owned Android API36 gerçek JNI+SQLite+Samba ve aynı süreç DB reopen PASS.
  Android arm64/JNI ve iOS Simulator arm64/C ABI link PASS. Son ek taşınabilir
  ad-alias sertleştirmesi host Rust ve Swift testlerinde doğrulandı; Android runtime
  ve cross-link sonuçları bu küçük doğrulamadan önceki checkpointtir.
- Ayrı ana-ajan review: Swift callback ömrü withExtendedLifetime ile korundu;
  Windows device alias ve Unicode private staging alias reddi güçlendirildi.
  Bağımsız review iddiası yok. Yeni 6 codec ve 20 JNI dependency sürümü OSV fark
  sorgusunda eşleşme vermedi; eski 71 sürümün kanıtı tekrar taranmış sayılmadı.

## 31 Ekim2026 — UI sonrası devam

UI ara paketi/web kanıtı tamamlandı; eski native/fiziksel kapılar açık.16a'ya dönülerek ayrı Android/iOS SMB profil+vault temeli eklendi: sürümlü sıkı alan kontrolü, ayrı credential/profile generation, parola açıklamalarında redaction; Android AES-GCM/no-backup ve iOS device-only Keychain deseni. Mevcut299 native kaynak değişmedi;4yeni native dosya+1Swift test eklendi.

Android dar Kotlin derleme PASS (19s); Swift host profil roundtrip+10 bozuk girdi+redaction PASS. Gerçek Keychain/Keystore runtime, owner serialization/context invalidation, OS route/source ve yayın bağlantısı HENÜZ YOK. [Bu dar kanıt](evidence/smb-native-publication-step16-2026-10-30/profile-vault-slice-2026-10-31.json).

Düzeltilmiş D8 kapsamı A ile açıkça onaylandı ve uygulandı: public Tokio ingress + crate-private runtime factory, tam peer kontrolü, C/JNI/Kotlin/Swift bağlı-socket handoff'u ve her dönüşte FD sahipliği/kapanması. D6 bit patch'i dışında yalnız iki SDK wrapper'ı; framing/crypto/auth/dependency değişmedi. İlk tek-satır önerisi tarihi başarısızlık kaydıdır; önceki otomatik onay engeli yeni açık kapsam onayıyla çözüldü.

Rust13 test, supplied-socket7 owned yayın/fault durumu, Swift host SQLite seed/ayrı süreç reopen ve disposable Android gerçek JNI/SQLite runtime PASS. Dar Kotlin + Androidarm64/iOSsimarm64 linkleri, üç dosyalık kasıtlı bozulma hash kapısı ve sabit1.99Clippy PASS. [Güncel D8 kanıtı](evidence/smb-native-publication-step16-2026-10-30/bound-socket-2026-10-31.json). Fixture yalnız loopback handoff kanıtıdır; gerçek OS route/vault/seçili kaynak yetkisi henüz bağlı değil. Ürün kapalı; yeni karar beklenmiyor. Owned strict container ve emulator5584 durduruldu, görüntüler retained. Diğer4ABI/proxy-fault/native-UI/physical kapıları tarihi kapsamlarında açık.

## 31 Ekim — profil sahibi dilimi tamamlandı

Profil değişimi eski işin bağlamını geçersiz kılar; her kayıtta yeni profil ve credential generation üretilir. Pending DB → vault yazma/okuma → exact ready sırası ve kilit sırası uygulanır. Vault okunamazsa kayıt/yayın yetkisi verilmez, eski custody üzerine yazılmaz. Tüm ACK'leri olan eski iş de bağlam değişince Completed olamaz.

Android gerçek Keystore/tamper/reopen ve Swift host ayrı süreç prepare/confirm/reopen testleri PASS. iOS pozitif Keychain/üretim custody doğrulaması açık; host vault-unavailable kanıtı bunları kapatmaz. [Taze dar kanıt](evidence/smb-native-publication-step16-2026-10-30/profile-owner-2026-10-31.json). SDK/ABI değişmediği için eski matris tekrarlanmadı. Owned AVD durduruldu; yeni dilim başlatılmadı.

## Sıradaki iş / güncel devam

01.11 kullanıcı sırası: önce16a kapanışı, sonra16b;16b bekletildi. Güncel [somut kapanış listesi](smb-acceptance-checklist-2026-11-01.md) ve [yeni dar fixture/review kanıtı](evidence/smb-closure-step16a-2026-11-01/manifest.json) esas alınır. Kullanıcı ayrı owned LAN sunucusu olmadığını bildirdi. Üretim LAN fence'i gevşetilmez; loopback testi admitted LAN PASS sayılmaz.

İlk route/Keychain diliminden sonra Files generation, own catalog/readonly staging, Android Files restore/keep-both ve ayrı Photos publication/import katmanı eklendi. Açıkça onaylanan exact Android Photos fixture metadata-only/no-reupload ve restore/no duplicate/recovery testinde PASS. Ayrı native queue/run/schedule sınıfları ve kalıcı retry/CAS kanıtı; altı release ABI export/Android16KB hizalama ve geçici iOS XCFramework paketi hazır. Ayrıntılı gerçek kapsam ve sınırlar [tek grup kanıtında](evidence/smb-native-publication-step16-2026-10-30/sources-catalog-read-2026-10-31.json).

**Ürün bağlantısı uygulandı;16a tam kabul/varsayılan aktivasyon açık.** 31.10 kullanıcı kararıyla SMB kendi `smb_enabled` opt-in tablosunda kalır; generation/job fence aynı SMB veritabanındadır. Claude'un dalındaki ortak `backup_destination` migration'ı beklenmez/kullanılmaz; bu dal tablo/CHECK/user_version değiştirmez. Ortak tabloya taşıma ayrı kullanıcı kararıdır.

Native Expo/JS hedef formu ve kayıtlı hedef yönetimi, run/pause/sayaç/retry, own katalog/restore/review, Android JobService2706/2707+boot/settings/global pause ve iOS BG kaydı bağlıdır. Varsayılan build desteği kapalı; yalnız açık native build opt-in etkinleştirir. Kullanıcı ayrıca hedefi kaydedip etkinleştirmeden yedek işi oluşmaz. Profil/opt-in açma kontrolü ve generation/opt-in kapatma tek SMB transaction içindedir.

Mobil27 paket/175test+tsc+lint PASS. Paketlenmiş release Rust üzerinden disposable Android gerçek OS JobService/lease+SAF+SMB Files/sayaç/sonraki dispatch/disable PASS. Kapatma UPDATE'ine SQLite hata enjeksiyonu generation+enabled atomik rollback'i doğruladı. Gerçek Expo/Pods ile SMB etkin arm64 Simulator uygulama derleme+link PASS. iOS host source/restore/Photos/run/CAS/foreground concurrency PASS; ortak pause politikası ilk iki işlem hata verse de tüm durdurma işlemlerini çağırır ve yeni otomatik işleri geçici fence ile engeller. Son ayrı aynı-agent inceleme bağımsız review değildir. Native Rust davranışı değişmediği için altı release ABI matrisi tekrarlanmadı.

Gerçek iOS admitted LAN/bookmark/PhotoKit runtime, üretim signing/device custody, bağımsız review ve12/20/21 görsel/a11y/perf/fiziksel kapıları açık. Android exact Photos onayı iOS'a/fiziksele genişlemez. Sonraki kabul fixture'ı bu sınırlar içinde hazırlanmalıdır; geçmiş host/derleme kanıtı gerçek iOS aktarım kabulü sayılmaz.16b/16c başlatılmadı. Owned AVD+Samba durduruldu; veriler/katmanlar retained.

## Opt-in paketleme ve dar tekrar komutları

Varsayılan Android `BuildConfig.KLODA_SMB_NATIVE=false`; iOS flag yokken yalnız desteklenmiyor durumu döner. Android Gradle için `-PklodaSmbNative=true`, `buildStorageNative` ile dört doğrulanmış release ABI'yi paketler. iOS önce repo kökünde `node tools/build-storage-native.mjs ios`, ardından `apps/mobile/ios` altında `KLODA_SMB_NATIVE=1 pod install --no-repo-update`: doğrulanmış device+arm64 Simulator XCFramework ve compilation flag bağlanır. `KLODA_STORAGE_CHECK_OUTPUT=/tmp/kloda-smb16-release` mevcut doğrulanmış build cache'ini kullanır. Generated paketler Git'e eklenmez. Bu opt-in üretim kabulü veya signing izni değildir.

Owned Samba ledger/container doğrulanmış ve çalışıyor olmalı; Android runner yalnız zaten açık KlodaWebDavStep15/emulator-5584 kabul eder, AVD oluşturmaz/sıfırlamaz. `JAVA_HOME=/Library/Java/JavaVirtualMachines/openjdk-17.jdk/Contents/Home KLODA_STORAGE_CHECK_OUTPUT=/tmp/kloda-smb16-release python3 tools/test-android-smb-publication.py --product-native --release-candidate` gerçek paketlenmiş kütüphane/factory/OS Files yolunu kullanır; Photos mutate etmez. Photos yalnız ayrı açık onaylı `--photos-owned-fixture` kapsamındadır.

`python3 tools/test-ios-smb-sources.py --contracts-only` host kaynak/restore/Photos/run/CAS/pause testleri; `--expo-modules` ayrıca gerçek kurulu Expo/Pods üzerinden tam Swift typecheck'tir. Bunlar gerçek iOS bookmark/PhotoKit runtime kabulü değildir. SMB etkin Pods kurulumundan sonra `apps/mobile/ios` altında `xcodebuild -workspace KlodaSecurePhotosSync.xcworkspace -scheme KlodaSecurePhotosSync -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/kloda-smb-product-ios-build ARCHS=arm64 ONLY_ACTIVE_ARCH=YES CODE_SIGNING_ALLOWED=NO` gerçek ürün derleme/link komutudur; uygulama başlatmaz veya cihazı imzalamaz. Kalıcı toplu native UI capture script'i hâlâ bekler.
