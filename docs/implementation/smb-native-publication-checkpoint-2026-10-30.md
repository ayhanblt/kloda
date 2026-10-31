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

## Sıradaki dar iş

Yeni oturum: önce iOS pozitif Keychain/üretim custody kanıtı; ardından kaynak ve gerçek OS LAN admission sahiplerine SMB binding/generation bağla, tek seçili Files kaynağıyla ürün sahibini kanıtla. Profil sahibinin dar Android/host testleri tamam; platform kabulü değildir.
Sonra kendi Completed catalog/Files restore ve restart/unknown-ACK review yolu;
Photos için aynı hedefte yalnız kendi Completed kaynaklarını bağlayan sidecar
publication/metadata-only/restore. Ürün UI/queue/schedule ancak bu sahiplik ve
recovery kapıları geçince açılır. Yeni Photos mutation testi önce kendi somut
fixture sınırlarını hazırlamalı; eski WebDAV istisnası SMB’ye genişletilmez.

Tam altı ABI matrisi stabil native checkpointte bir kez; sıradaki küçük değişimde
yalnız etkilenen kontrol. Düzeltilmiş D8 onaylıdır; yeni karar yoksa tekrar onay isteme. 16b SFTP ve16c FTPS,
12/13/15/20/21 platform/görsel/a11y/signing/fiziksel kapıları açık kalır.

## Dar tekrar komutları

Owned Samba ledger/container doğrulanmış ve çalışıyor olmalı. Android runner
yalnız zaten açık KlodaWebDavStep15/emulator-5584 kabul eder; AVD oluşturmaz veya
sıfırlamaz. `tools/check-storage-native.mjs aarch64-linux-android` çıktısı
`KLODA_STORAGE_CHECK_OUTPUT=/tmp/kloda-smb16-adopt-cross` altında hazırlanır.
`tools/test-android-smb-publication.py` bu kütüphaneyi yalnız test APK asset'ine
kopyalar; ürün kütüphane yüklemesi değildir. iOS runner host Swift'tir, Simulator
veya üretim signing kanıtı değildir. Araçlar: `tools/test-storage-native.mjs`,
`tools/test-ios-smb-publication.py`, `tools/test-android-smb-publication.py`.
