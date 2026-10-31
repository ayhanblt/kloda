# CURRENT — 31.10.2026

Eski PASS taze kabul değildir.

## Steps

|#|Durum|Açık kapı|
|---|---|---|
|1|Android context uygulandı|runtime/21|
|2|Android background owner uygulandı|gerçek OS/21|
|3|Android schedule/retry uygulandı|eski OS/Doze/21|
|4|Android izole+dar fiziksel kanıt|gerçek PC/Photos/16KB/performans|
|5|iOS pairing izole|iPhone/Secure Enclave/PC LAN|
|6|iOS Files izole|provider/iCloud/restore|
|7|iOS Photos/izole PhotoKit|LivePhoto/RAW/edited/iCloud/alan|
|8|iOS background/izole retry|OS delivery/lock/gerçek PC|
|9|WebDAV ayarlar uygulandı|canlı ürün kabulü15/20/21|
|10|Mobil bütünleşik izole kanıt|reader/LAN/pil/alan/latency|
|11|Lovable alımı tamam|native görsel kabulü12|
|12|UI kodu+web kanıtı tamam|native ABI/görsel/a11y açık|
|13|Dar salt-okunur galeri uygulandı|Android/native/physical açık|
|14|16/16 teknik matris+D1–3 onaylı|SDK/fiyat/hesap/platform|
|15|WebDAV Files+Photos/own restore izole|picker/UI/BG/signing/20/21|
|16|AKTİF16a;16b SFTP/16c FTPS bekler|aşağıdaki kapılar; SMB KAPALI|
|17|S3 uyumlu/Amazon S3 başlamadı|multipart/belirsiz commit/integrity|
|18|Diğer bulutlar başlamadı|native auth/hesap; Box engelli|
|19|Live Activities başlamadı|extension/signing/mahremiyet/SwiftUI|
|20|Geniş kapanış başlamadı|platform/güvenlik/a11y/perf|
|21|En son toplu fiziksel kabul|yeni açık izin+hazır hesap/cihaz|

## Active16a

Tamam: SMB profil/vault temeli; D8 iki-wrapper SDK diff29/native diff157+Kotlin/JNI/Swift handoff. Rust13/Clippy, iki link, owned yayın, Swift host seed/reopen, Android JNI/SQLite makbuz testleri PASS.
[Kanıt](evidence/smb-native-publication-step16-2026-10-30/bound-socket-2026-10-31.json).
Açık: gerçek Keychain/Keystore, OS route/ağ sahibi, seçili Files yetki/generation, runtime/fault/catalog/restore/restart/Photos. SMB KAPALI.
Devam: profil/vault, OS LAN ve seçili Files kaynağının yetki/generation bağlarını tamamlamak.
Okuma: [ADR26][a26] D6–D8; [ADR22][a22] transport/custody; [checkpoint](smb-native-publication-checkpoint-2026-10-30.md) “Sıradaki dar iş”. Hedefli: [D8][d8], [usage](resume-and-usage-plan-2026-10-30.md).16 kabul ölçütlerini raporlamadan17'ye geçme.

## Decisions

- D6A 30.10: exact ENCRYPTION bit patch; hash/versiyon/upstream kaldırma koşulu [ADR26][a26].
- D7A 30.10: ayrı Files/SMB Photos makbuz/sidecar; kayıp ACK ile adoption yok [ADR26][a26].
- D8 31.10: ilk tek-satır geri alındı; iki wrapper+native köprü AYRI açık A onaylı [D8][d8].
- Mimari karar beklemiyor. SMB Photos yazma testi/21 fiziksel izni verilmedi; WebDAV istisnaları genişletilmez.

## Gates

11/12/13/15/20/21 kabulü açık. WindowsD3/provider/startup/SQLite/opened-object, macOS normal uygulama signing, Linux provider+görünür kontrol; gerçek OS/storage/restore/revoke/recovery, bağımsız review, reader/large text/klavye, pil/alan/latency/retry/perf, SDK config olayı ve eski scope-locator kapanmadı.
Roadmap dışı açık kapsam: hesap/MFA/recovery, public roots/deep-link, Internet/remote/E2EE, iki yönlü sync/versions ve FolderSync migration; otomatik işe ekleme. Her tarihî açık/karar maddesi [kayıpsız eşleştirmede](archive/migration-check.md); kapanış kaynağı yoksa açık kalır.

## ADRs

[ADR dizini](../decisions/). Yalnız yazılı kapsam değişir.
- 01 framework/schedule; SAS ilk trust13 ile değişti.
- 02 ilk slice; Files/Photos kapsamını05 genişletir.
- 03 pairing/offline; LAN merkezî önkoşullarını16 kaldırır.
- 04 cert/authority; Matrix-key12, SAS13, LAN önkoşulları16.
- 05 PC-first Files/Photos; LAN account/step-up önkoşulları16.
- 06 hesap/MFA/recovery; yalnız LAN bağımlılığı16 ile kalkar.
- 07 Matrix sınırı/continuity; LAN central/token/online şartı16.
- 08 upstream/cert; LAN DER/reissue/KMS şartı16; SDK istisnası26.
- 09 kanıtlı dilimler; fiziksel eski11 artık21.
- 10 operation-bound durable proof; değişmedi.
- 11 in-process native peer session; değişmedi.
- 12 Kloda P256; Matrix-key identity yerine.
- 13 QR LAN; SAS/account-first trust yerine.
- 14 ortak Rust QR core; ayrı engine yerine.
- 15 Desktop platform/signing isolation.
- 16 PC-local ACL; LAN JWT/KMS/24h/central-grant/DER-reissue yerine; pin/cert/revoke kalır.
- 17 Photos sidecar/import recovery; iOS ertelemesi step7 kapsamında kalktı.
- 18 receiver UI ayrılığında sürer; close-on-blur yerine, grant fence kalır.
- 19 device remove/trash/recover; bulut silme politikası değildir.
- 20 iOS LAN/native pairing; stub yerine, physical açık.
- 21 seçili Photos salt-okunur; geniş medya düzenleme yok.
- 22 LAN SMB3/FTPS, SFTP pin, native custody; plain FTP/broker yok.
- 23 açık etkin her hedefe bağımsız yedek; tek-PC dağıtım varsayımı yerine.
- 24 ayrı WebDAV Photos sidecar; PC Completed-ID sözleşmesini değiştirmez.
- 25 açık tek-isteklik review yetkisi; sessiz rebind/adoption yerine.
- 26 ortak Rust SMB/native sahip, D6/7/düzeltilmiş8; genel fork izni değildir.

## Rules

JWT/KMS LAN önkoşulu yok; close-on-blur/Wake-on-LAN yok; %100 yedekli/yansıtıldı iddiası yok. Foreground grant fence bypass yok. Legacy sahipsiz receipt/pending: hedef tahmin/silme yok; ağdan önce dur. Socket+route/generation kanıtı yoksa SMB parolası gönderilmez; şifresiz/DNS fallback yok.

## References

[Lovable](https://kloda-secure-photo-sync.lovable.app), rev `c144e98938da96f698f378972290ff3d1dd311eb`; [proje/snapshot](../ui/lovable-design-reference.md).
Yakalama: toplu script varsayılan; **kalıcı script/komut yok, bekleyen**. Kanıt [UI checkpoint](lovable-ui-interlude-checkpoint-2026-10-30.md); yeni UI işi araya alınmaz.
[Arşiv](archive/README.md), [sıra](expanded-execution-plan-2026-10-28.md) yalnız ilgili bölüm okunur.

[a26]: ../decisions/0026-shared-rust-smb-engine.md
[a22]: ../decisions/0022-advanced-destination-transport-and-credential-custody.md
[d8]: smb-route-bound-transport-decision-2026-10-31.md
