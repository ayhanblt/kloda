# ADR 0007 — Matrix verification sınırı ve cihaz sürekliliği

- Kalıcı kayıt tarihi: 2026-10-04; session'da daha önce onaylanan kararın aktarımı
- Durum: MVP mimari yönü kabul edildi; production SDK/platform entegrasyonu doğrulanmadı
- Karar sahibi: Ayhan

## Bağlam ve karar sınırı

Matrix = **verification mechanism**, Kloda = **access authority** yönü kullanıcı tarafından seçildi. Bu bağımsız sınır [ADR 0003](0003-secure-pairing-and-offline-authorization.md) pairing/offline politikasını ve [ADR 0004](0004-certificate-bound-capability-and-authority-responsibilities.md) capability/mTLS kararını tamamlar; onları tekrar seçmez. Matrix native PoC sonucu veya bu kayıt ürün implementasyonu/production approval değildir.

## Kabul edilen sınırlar

1. Matrix standart SAS state machine'i commitment, iki local kullanıcı onayı ve reciprocal MAC/key-confirmation/Done için kullanılır; bare SAS primitive'leriyle Kloda'ya özgü yeni protokol oluşturulmaz. Tamamlanan aktif user/device/flow görüşmesinden immutable verified peer key alınır. Olm account/store/device bookkeeping motorun iç gereksinimidir, Kloda application-wide authority modeli değildir.
2. Matrix `is_verified()`, cross-signing, SSSS, SecretsBundle veya Matrix recovery Kloda file-access grant/recovery açmaz. PC scope, pair/grant, revoke/security-version, offline/session/file authority Kloda'ya aittir; [ADR 0004](0004-certificate-bound-capability-and-authority-responsibilities.md) merkez–PC ayrımı uygulanır. Olm/Megolm dosya taşıma kanalı değildir.
3. MVP'de ikinci bağımsız endpoint possession key yoktur. Her yeni file session aynı SAS-verified device key ile fresh possession ister; [ADR 0004](0004-certificate-bound-capability-and-authority-responsibilities.md) fresh full TLS1.3 yönünü seçmiştir. Diagnostic nonce imzası production session/channel/capability proof değildir. TLS ephemeral channel key'i veya ayrı server capability signer'ı ikinci endpoint identity key sayılmaz.
4. Sonraki discovery/server key query, token veya certificate'taki başka key önceki immutable SAS snapshot/grant'i devralamaz. Native trust boundary caller key/hostname/UI flag'inden oluşturulmaz; master/cross-signing signature device proof yerine kabul edilmez. Synthetic PoC Matrix user'ı gerçek Kloda account isolation veya registration kanıtı değildir.
5. **OS-protected software key modeli kabul edildi.** Normal sync'te per-run biometric/userPresence yoktur; donanım non-exportability, RAM'de private material bulunmaması veya secure erasure garantisi türetilmez. Plaintext storage fallback/central endpoint private-key recovery yoktur; PC normal dosyalarını korur.
6. Install epoch sandbox'ta tutulur; epoch ve local authorization state cloud backup/device transfer dışında kalmalıdır. Yalnız Keychain/Keystore key'i kalması installation continuity/grant sağlamaz. Sandbox'ta olmak kendiliğinden backup exclusion değildir.
7. Normal process/OS restart reinstall değildir ve epoch'u kendiliğinden değiştirmez. Certificate/token/authority/trusted-time koşulları yine gerekir; süre üst sınırı kanıtlanamıyorsa online beklenir, kesintisiz offline restart vaadi yoktur.
8. Reinstall/epoch kaybı/restore şüphesi veya retained epoch + missing/inconsistent SDK DB durumunda **eski key bulunsa bile offline ret; online PC onayı + SAS + yeni grant** gerekir. Yeni SDK account/key eski grant'e sessizce bağlanmaz. Login, possession veya merkez kontrolü tek başına eski grant'i diriltmez.
9. Locked/unavailable/UI-required gibi geçici OS provider hatası key loss/reinstall sayılmaz; erişim bekler, key/ciphertext/journal korunur. Sessiz key reset/new identity/plaintext fallback yoktur. Gerçek key loss re-pair ister; recovery mevcut key veya PC final dosyalarını otomatik silmez.
10. Software epoch tek başına tüm key+epoch+SDK DB+authorization rollback'ini güvenilir saptamaz. Restore şüphesinde fail closed zorunludur; her tam rollback'te şüphenin mutlaka oluştuğu kanıtlanmış değildir. Apple `ThisDeviceOnly` aynı cihaza backup restore sınırıdır; “asla backup'a girmez” veya “reinstall'da kesin silinir” değildir.

## Açık production gate'ler ve alternatif sınırı

`VerificationPort` mekanizma–authority ayrımının mantıksal adıdır; production interface/signature implementasyonu değildir. Exact SDK/crate/binding release, native API, supported byte signer, private store/backup exclusion, lock/background davranışı, gerçek kullanıcı UI ve account↔Matrix/device enrollment ayrı doğrulama kapılarıdır. Yerel iki-method SDK patch'i upstream destek, sürdürülebilir fork veya production adoption sayılmaz.

Matrix adayının native uygulanabilirliği kapanmazsa aynı sınır arkasında daha dar, spesifikasyonu ve security review'u bulunan **standart** SAS motoru ayrıca araştırılabilir; otomatik B'ye, custom SAS'a veya ikinci device key'e geçilmez. İkinci key yalnız farklı/hardware-backed koruma ve pairing transcript'ine kriptografik bağ ayrıca onaylanırsa değerlendirilebilir; şimdi onaylı değildir.

**physical-device validation required:** Android/iOS gerçek SAS + kullanıcı iki-onay UI; lock/reboot/first-unlock/background provider; key loss/retained-key reinstall/restore/backup-device-transfer exclusion; iOS16.4 ve güncel iOS, Android API24 ve güncel cihaz hedefleri; secure backend olmayan Electron/Linux'ta fail closed. Emulator/simulator testleri bunları kapatmaz.

## Kanıt ve kalıcı dayanaklar

[Native verification/TLS kanıt kaydı](../security/poc-native-verification-evidence.md) Rust17, native52 ve later same-key TLS alt-gate'lerini ayrı evrelerde tutar. [Capability profile](../security/capability-profile.md) ve [36 acceptance hedefi](../security/capability-acceptance.md) production grant/session/time/fence eksiklerini açık tutar. Aynı key/native wrapper deneyi gerçek authority/admission veya fiziksel background kanıtı değildir.

- [Apple key accessibility/restore sınırı](https://developer.apple.com/documentation/security/restricting-keychain-item-accessibility).
- Tarihsel köken: `kloda-verification-authority-decision.md`, `kloda-protocol-native-storage-research.md`, `kloda-authority-session-contract.md` session araştırmaları. Kritik politika yukarıda self-contained kayıtlıdır; ephemeral dosyalara erişim kararın önkoşulu değildir.
