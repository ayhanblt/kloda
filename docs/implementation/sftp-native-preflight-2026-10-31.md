# SFTP16b — ilk aday ve tek host kanıtı /31 Ekim2026

Durum: bu belge31.10 tarihî ön eleme kaydıdır.16b uygulama ve izole kapanış02.11 tamamlandı; [güncel devam noktası](sftp-native-checkpoint-2026-11-02.md). Genel12/20/21 ve son Claude review açıktır.

## Onaylı sınır

[ADR0022 D2](../decisions/0022-advanced-destination-transport-and-credential-custody.md): kullanıcı exact host+port için SHA256 host parmak izini bağımsız kanaldan sağlar. Parola ancak eşleşmeden sonra; bilinmeyen/değişen anahtar hard-stop, yeni bağımsız doğrulama+açık güncelleme gerekir. TOFU, SSH private-key import/export/agent ve Kloda cihaz anahtarını SSH için kullanma yok. İlk auth native secure store'da kullanıcı adı/parola. Bu çalışma Internet/remote, kişisel hesap/veri veya21 fiziksel iznini genişletmez.

## Ucuz eleme ve yön

`ssh2=0.9.6`/`libssh2-sys=0.3.3` exact crate'leri incelendi; sys arşiv hash'i resmi sparse registry checksumuyla eşleşti. Gömülü libssh2 `1.11.1_DEV`, eski düzeltmeleri içeriyor, fakat ETM yolunda tekrar atanan packet_length için upstream'in işaret ettiği sonraki kontrol yok. [Açık follow-up PR2677](https://github.com/libssh2/libssh2/pull/2677) nedeniyle bu aday **güvenlik kabulü almadı**. [Önceki backport PR359](https://github.com/rust-lang/ssh2-rs/pull/359) tek başına bu bulguyu kapatmıyor. Exploit çalıştırılmadı; SDK patch'i/fork'u uygulanmadı. Pin denetimi, pin denetiminden önce çalışan parser riskinin çözümü sayılmadı.

Alternatif exact `russh=0.65.0`, default-features=false, yalnız `ring`; `russh-sftp=3.0.1`. Yerel SDK değişikliği yok. Çözümlenen188 exact sürümün OSV batch sorgusunda0 eşleşme; RSA/OpenSSL/aws-lc/libssh2 graph'ta yok. Bunlar bütün güvenlik/platform kabulü veya sıfır zafiyet taahhüdü değildir. Recent [EXT_INFO](https://github.com/Eugeny/russh/security/advisories/GHSA-4p9f-7p9m-5vfg), [zero-write](https://github.com/Eugeny/russh/security/advisories/GHSA-fw5c-8223-6h42) ve [nested-cert](https://github.com/Eugeny/russh/security/advisories/GHSA-3hm4-p7h4-rvwp) kayıtları0.65'i düzeltmeli sürüm olarak gösterir; exact kaynakta nested-certificate koruması görüldü. Bağımlılık lisans metadatası mevcut; permissive alternatifler seçilebilir (`r-efi` MIT alternatifi). Nihai dağıtım notices/crypto/platform kabulü açık.

Değerlendirilen feature profili RSA host key desteklemez. Tek host kanıtı plain Ed25519 içindir; diğer key/cert/server kombinasyonları test edilmedi. Desteklenmeyen sunucu görünür hata vermeli, otomatik başka trust/auth yoluna geçmemelidir. Bu henüz ürün SDK/mimari aktivasyonu değildir.

## Gerçek tek host kanıtı

[Tek manifest ve ham kanıt](evidence/sftp-preflight-step16b-2026-10-31/manifest.json). Sabit Rust1.99; yalnız `/tmp/kloda-sftp16b-preflight` aday paketi, üretim Cargo/lock/native kaynakları değiştirilmedi. Owned yeni OpenSSH kullanıcısı ve yeni host anahtarı, host mount yok, ayrı Docker bridge, yalnız127.0.0.1:27448 yayını. İlk internal-network denemesi bağlantı hatası verdi; başarısız log retained. Başarılı kanıtın ağı internal değildir, endpoint loopback'tir; bu gerçek OS LAN-route kanıtı sayılmaz.

PASS: eksik pin yerelde ret; yanlış pin gerçek SSH host-key callback'ine ulaşıp parola çağrısından önce ret; doğru bağımsız pin sonrası parola. Sunucu logunda toplam tam bir başarılı parola auth. Yönetim kanalından `docker exec ssh-keygen -l -E sha256` ile alınan fingerprint kullanıldı, SSH bağlantısından öğrenilip güvenilmedi.

PASS:131073byte,32KiB sınırında sıralı WRITE ACK, zorunlu gerçek fsync ACK, CLOSE ACK, exclusive create tekrarında ret; standard SFTPv3 rename, mevcut hedefe rename çakışmasında ret; final taze bounded read+tam byte/size/SHA256. Üretim journal/Completed makbuzu üretilmedi. Sunucu fsync desteklemediğinde başarı dönebilen yüksek-seviye `sync_all` yolu kullanılmadı; raw istek+explicit status kullanıldı. Aynı-agent ayrı review bunu ve gerçek callback olmadan bağlantı hatasını pin reddi sayma test açığını yakaladı; bağımsız inceleme değildir.

Host build+all-target Clippy -D warnings PASS, rustfmt uygulandı. İki owned fixture container durduruldu; yeni dosyalar/image/network/kanıt retained. Kişisel dosya/Photos/NAS/gerçek hesap kullanılmadı.

## Güncel devam noktası

[02.11 checkpoint](sftp-native-checkpoint-2026-11-02.md) ve [tek kapanış manifesti](evidence/sftp-closure-step16b-2026-11-01/manifest.json). Yukarıdaki aday/host denemeleri tarihîdir; ürünün güncel durumu için tekrarlanmaz.
