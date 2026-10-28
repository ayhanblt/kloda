# iOS Files — mobil liste6 (27 Ekim 2026)

## Sonuç

Files kaynak entegrasyonu ve izole doğrulama tamamlandı. Bu, gerçek iPhone-PC
aktarımı veya tüm mobil ürün kabulü değildir. [Seçilmiş kanıtlar](evidence/ios-files-2026-10-27/README.md).
Liste7 Photos ve liste8 background/zamanlama/otomatik retry bu görevde uygulanmadı.
[Korunan sıra](mobile-execution-checklist-2026-10-24.md), [ADR0020](../decisions/0020-ios-local-network-admission-and-native-pairing.md).

## Uygulanan akış

- Mevcut iOS bookmark/scanner, aynı Rust upload/status/chunk/finalize/list/restore
  protokolüne bağlandı. Yeni transport, bağımlılık veya ikinci DB yok. Yeni aktarım
  API'si raw path/descriptor/owner veya yetki bağlamı kabul etmez; mevcut kaynak
  seçiminin opaque reference sözleşmesi korunur.
- Native seçilmiş kaynağı scoped/coordinated okur; her bileşen no-follow descriptor
  üzerinden açılır. Eksik boyut/tarih ve enumerator hatası sessizce atlanmaz.
  iCloud dosyası current/downloaded değilse kullanılabilir byte varsayılmaz.
- Gerçek SHA256, root dev/inode/birth-time ve göreli kaynak kimliği kullanılır.
  Aynı içerik farklı kaynakları birleştirmez. Kayıtlı kaynakta kök kimliği değişirse
  yeni wire-source varsayılmaz; source_identity_unknown ile bütün kaynak durur.
  Kaynak ve kök değişimi yeniden
  doğrulanır; provider pipe/URL doğrudan Rust'a verilmez.
- Yeni aktarım için private0600 snapshot; mevcut pending snapshot yeniden kullanılır.
  Completed/owner_deleted sorgusu için ikinci tam kopya ayrılmaz. Hash/kimlik aynı
  kalmadan yeni snapshot eski işe bağlanmaz.
- Aynı kloda-sync.sqlite içinde dar files_job, files_restore ve files_run kayıtları
  eklenir; eski discovery kayıtları korunur. Bunlar yeni genel scheduler değildir.
  Kaynak/hedef/request/hash/size/snapshot değişmez, operation bir kez atanır,
  ACK monoton ve boyutla sınırlıdır. Completed yalnız exact native sonuçla yazılır.
- Kayıp create aynı request'i; kesilmiş işlem aynı operation/status'u kullanır.
  Kayıp finalize yeni upload üretmez. Restart transient durumları paused/interrupted
  gösterir; geçmiş current trust/ACL değildir. Kaynak kaybolduğunda/değiştiğinde eski
  pending iş kalır; toplu finished arkasında gizlenmez. Bağımsız kaynak/dosya hatası
  diğer dosyaları engellemez; cancel/settings/journal arızası güvenli durdurur.
- Native current complete record ve repair durumu tekrar kontrol edilir. iOS özel
  transfer epoch'u actor/I/O kontrollerine taşınır; Android background yolu optional
  epoch olmadan korunur. Yetkilendirme Rust PC-local ACL ve fresh native kanaldadır;
  pairing tek başına dosya izni vermez. LAN için backend login/JWT/KMS eklenmedi.
- owner_deleted kalıcıdır; otomatik yeni upload'a dönüşmez. Açık rebackup, kaydedilmiş
  operation referansı için current native owner_deleted sonucu ister. Eski record'un
  tombstone'u yeni yetki sayılmaz; güncel PC/izin üzerinden doğrulanır. Yeni hash ayrı
  sürümdür. Eksik operation bilgisi uydurulmaz, bu durumda işlem reddedilir.

## Own restore

Kullanıcı native klasör seçer; orijinal dosya adı korunur. Current native Completed
metadata UI'daki id/name/hash/size ile tam eşleşir. Private staging'e bounded64KiB
indirme, kalıcı offset ve tam hash doğrulaması kullanılır. Kayıp indirme yanıtının
yalnız private, henüz ACK kaydı olmayan en fazla bir chunk kuyruğu yeniden indirilir;
byte sayısı tek başına başarı değildir.

Yayınlama intent'i ve yeni O_EXCL dosyanın inode'u byte yazımından önce kalıcıdır.
Var olan başka dosya üzerine yazılmaz. Kesilen kendi inode'u yalnız mevcut tüm
byte'lar beklenen prefix ile eşleşirse devam eder; belirsizlik review_required'dır.
Kayıp yanıtta current yetki + kayıtlı inode/hash yeniden doğrulanır. Farklı açık hedef
seçimi ayrı retained attempt oluşturur; eski kayıt retarget edilmez. Completed hedef
silinmişse yeni açık restore yeni attempt kullanabilir. Başarı sonrası staging
kaldırılır; receipt korunur ve sonraki kontrol hedef üzerinden yapılır. Kaynak
orijinalleri ve ilgisiz hedefler silinmez.

Picker beklerken cancel/destroy olmuş eski istek yeni ticket alamaz. Ticket ilk
çağrıda yakalanır; picker sonrası ve worker girişinde doğrulanır. Çift picker açılmaz.

## Gerçek kontroller

| Kontrol | Bu çalışma grubunun sonucu |
| --- | --- |
| Mobil |65 test/8 suite, typecheck, root lint, iOS/Android JS export PASS |
| Rust |Foreground filtre8 ve ABI8 PASS (bir test örtüşür); sender7 PASS, gerçek sentetik TCP/mTLS sender fixture dahil |
| Native kalite |Host+iOS Simulator lib/tests strict Clippy, scoped fmt, max-lines, dependency policy PASS |
| Android |Ortak Rust değişikliği dört ABI derlendi; yeni Android runtime/physical koşusu değil |
| iOS derleme |Device+Simulator Rust library ve gerçek arm64 Debug Simulator app PASS; minimum16.4 compile,26.5 runtime |
| Simulator Files |28 fixture grubu PASS: journal14, upload3, publication4, snapshot6, cancellation1 |
| Simulator ABI |Güncel private C signature/real Rust ABI7 grup PASS; hardware custody yerine geçmez |
| Swift session |C-stub5 grup PASS; inactive/destroy/stale epoch/current record/close failure |
| Gerçek Expo |Files metotları, Simulator custody reddi, dosya uydurmadan kalıcı erken hata ve farklı süreçte aynı run sonucu PASS |
| Veri sınırı |Yalnız kendi disposable Simulator; app authority klasörü yok, fake file job yok; test sunucusu ve Simulator kapalı |
| Ayrı inceleme |Partial restore, pending membership, picker cancellation ve per-file snapshot hata sınırı bulguları giderildi; son dar review engelleyici bulgusuz |

Upload fixture gerçek Swift state machine'i sentetik native yanıtlarla çalıştırır;
publication fixture gerçek native descriptor/SQLite dosyalarını disposable klasörde
kullanır. Bunlar gerçek provider/iCloud/picker, iPhone veya PC LAN kabulü değildir.
Eski PASS sayıları yeni koşu sayılmadı. İlk platform test varsayımı, Pods dosya listesi,
Swift inout ve fixture path hataları kanıtta ayrı korunur; final sonuçla örtülmez.

## Açık / ertelenen / kapsam dışı

- **Platform/runtime kabulü açık:** gerçek security-scoped provider/iCloud okuması,
  user picker, iPhone Secure Enclave ve iPhone-PC Files/restore, revoke/kesinti/lock
  matrisi. Simulator custody'yi reddeder; production software-key fallback yok.
- **Liste8:** otomatik5/60 erişim retry ve ayrı OS bütçesi/zamanlama/background henüz
  bağlanmadı. Şu an explicit foreground denemesi ve kalıcı toparlanma var; attempts
  alanı otomatik retry uygulandı demek değildir. Schedule preference yürütme değildir.
- **Liste10:** oldest/current OS, büyük kaynak/staging/disk-full ve provider fault
  matrisi, tam akış görsel/VoiceOver/Dynamic Type kabulü. Crash'in snapshot oluşturma
  ile journal insert arasına düştüğü sahipsiz staging'lerin güvenli alan yönetimi
  ayrıca değerlendirilecek; bu görevde genel tarama/cleanup yapılmadı. Veri uydurmak
  veya kullanıcı arşivini taramak çözüm değildir.
- **Bilgi sınırı:** explicit rebackup güvenilir operation referansı gerektirir;
  referans yoksa native bilgi genişletilmeden tahminle gönderilmez. Unknown publication
  veya erişilemeyen eski locator otomatik benimsenmez; görünür hata/inceleme kalır.
- **Kapsam dışında:** Photos7/import, background8, WebDAV9 ve toplu fiziksel11; geniş
  E2EE/key lifecycle, account/recovery, remote, two-way/versions/migration açık backlog.
  Windows/Linux ve Desktop fiziksel engelleri bu sonuçla kapanmadı.

TR/EN/DE ve mevcut Stitch/erişilebilirlik bileşenleri korunur. Henüz bağlı olmayan
iOS Photos kontrolleri Files başarısı gibi sunulmaz; yerel telefon dosya hataları PC
disk hatası diye gösterilmez. Kullanıcı arşivi, mevcut key/pin/cert/epoch/authority
kullanılmadı veya reset edilmedi. Git mutation yok. Tek sonraki sıra liste7 Photos.
