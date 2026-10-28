# Mobil liste4 — fiziksel Android/Mac başlangıcı —26 Ekim2026

Sonraki aynı-gün checkpoint: [Mac ücretsiz Personal Team güvenli anahtar/native ve Electron-host NAPI doğrulaması](macos-personal-team-validation-2026-10-26.md) tamamlandı. Aşağıdaki signing-engelli gözlemi önceki fiziksel Android koşusunun tarihsel durumudur; Android-Mac aktarımı hâlâ yapılmadı.

Kullanıcı fiziksel teste geçmeyi onayladı; alıcı olarak bu Mac'i, telefonun günlük
profilini seçti. Bu onay4. adım içindir; güvenlik/platform kapılarını kaldırmaz.
Gerçek arşiv/anahtar/pin/authority reset veya migration izni değildir.
[Güncel kanıt ve kaynak/APK hash'i](evidence/android-physical-2026-10-26/result.json).

**Sonuç:** Kullanıcı telefonu elle açtıktan sonra5 yerel grup PASS; ayrı-PID
reopen PASS. Test paketi kaldırıldı. Ücretli Apple Developer üyeliği olmadığı
doğrulandı; bu Mac'in signing/readiness kapısı engelli. Android↔Mac aktarımı yapılmadı.

## Telefon: tamamlanan bağımsız kapsam

P1: SM-S921B/API36/arm64,4096byte sayfa. USB izni kullanıcı tarafından verildi.
Mevcut keystoreTLS PoC paketi yalnız varlık kontrolünde görüldü; çalıştırılmadı,
güncellenmedi, kaldırılmadı. Daha önceki hardware signer deneyi tekrar edilmedi.

Günlük profilde eski emülatör Photos paketinin tümü çalıştırılmadı. Yeni ve daha
önce kurulu olmayan `com.kloda.sync.test` kuruldu; mevcut uygulama verisi üzerine
yazılmadı. Runner artık scope verilmezse fixture/restart başlamadan durur;
`local-files` bütün Photos/restore gruplarından önce döner. Bu guard gerçek
telefonda eksik scope ile doğrulandı. Gelecekteki medya fixture koşuları ayrıca
açık `-e scope media-fixture` gerektirir; günlük kişisel profilde kullanılmaz.

Gerçek telefonda5 yerel grup PASS: native library load, Files iş/retry kayıtları,
scheduled journal/gerçek JobScheduler future kayıt-Pause-Resume, Files migration/
receipt/snapshot recovery ve gerçek FGS/bildirim yaşam döngüsü. Bunlar sentetik ve test UID'sine özel verilerdir;
native owner/anahtar/PC veya kişisel medya açılmaz.

Ayrı writer/read instrumentation farklı PID ile offset/hash/source/peer/context,
Completed+tombstone ve retry bütçesini korudu: PASS. Writer DB'yi temiz kapatır;
aktif aktarım kill, yarım SQLite write/crash veya power-loss kabulü değildir.

## İlk koşunun görünür pencere ön koşulu ve doğrulanmış tekrar

FGS grubu `resumed && focused` beklerken zaman aşımına uğradı; `acquire()`
satırına ulaşılmadı. Bu **servis arızası kanıtı değildir** ve FGS PASS yazılmadı.
Hemen sonraki salt okunur gözlem Dozing ve keyguard.showing=true gösterdi; bu,
ön koşulun eksikliğiyle tutarlıdır, tek neden olduğu kanıtlanmadı. Kullanıcı
kilidi elle açıp ekranı açık tuttuğunu onayladı. Tekrar öncesi Awake gözlendi;
beş grubun tamamı geçti. Resumed/focused test Activity'sinden sonra gerçek servis
başladı; Activity kapanınca servis/bildirim korundu, explicitstop ikisini kaldırdı.
Bu, gerçek aktarım veya Expo UI/grant kabulü değildir. Kilit/odak denetimi gevşetilmedi,
ADB ile ekran kilidi atlanmadı. Test UID'sinin geçici POST_NOTIFICATIONS izni
başlangıç durumuna döndürüldü; Photos izni verilmedi.

## Mac alıcısı: gerçek engel

Mevcut repo Electron uygulamasının salt okunur codesign metadata'sı: Team ID yok,
entitlement listesi boş, embedded provisioning profile yok; bundle identifier
Electron. Bu artifact Kloda development signing/readiness kanıtı değildir.
Native owner veya Secure Enclave/storage probe başlatılmadı. Kullanıcı ücretli Apple
Developer üyeliği olmadığını bildirdi. Mevcut onaylı signing kapısı engelli; satın alma/enrollment,
ad-hoc entitlement, legacy Keychain veya software-key fallback uygulanmadı.

Mac hazır olmadan QR/ayrı PC izni/TLS/ACL/aktarım/del-rebackup E2E başlatılmaz.
Fiziksel onay bu platform engelini çözmüş sayılmaz. Ayrı signing dilimi gerekiyorsa
somut plan ve mevcut ADR0015 güvenlik sınırlarıyla sunulacak.

## Kanıt ve sınır

Test APK build + explicitK1 full lint exit0/8sn; varsayılan K2 araç sınırı aynı.
Ayrı kaynak/sonuç review ilk4PASS ve FGS önkoşul ayrımını, local-files yolunun medya
sorgusu yapmadığını ve ayrı süreç kanıtının sınırını kontrol etti. ADB exit0 ile
FGS grubunun geçtiği iddia edilmedi; final tekrarda açık5PASS marker doğrulandı.
Bildirim izni geri alındıktan sonra yalnız bu görevde yeni kurulan test paketi
kaldırıldı; mevcut PoC paketi korundu. Git mutation yapılmadı.

Kalan: Mac signing/readiness; kişisel arşivden bağımsız gerçek test alanı ve hazır iki
endpoint ile LAN/TLS/ACL/aktarım. Eski OS/16KB/Doze/pil-disk ve diğer platform
kabulü ayrıca açıktır. Liste4 tamamlanmış değildir.
