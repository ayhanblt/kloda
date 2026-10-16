# PC backup, Files ve Photos — kabul edilen ürün sözleşmesi

Belgeleme tarihi: 2026-10-04. [ADR 0005](../decisions/0005-computer-first-files-and-photos-backup.md) kararının ayrıntılarıdır; yeni mimari/implementasyon onayı değildir. Aşağıdaki kabul hedefleri **çalıştırılmış test sonucu değildir**. Session kaynakları değişmeden bırakılmıştır; bu belge içeriği yerel scratch dosyalarına ihtiyaç duymadan anlaşılır.

**V1 LAN file authority:** [ADR0016](../decisions/0016-v1-pc-local-file-authority.md) selects PC-native local SQLite ACL and explicit peer/scope consent independently of login/central capability. Selected Files/Photos upload/status/finalize/OWN list/user restore are implemented; no delete, other-peer, outside-root, two-way or arbitrary browsing grant. [ADR0017](../decisions/0017-photos-sidecar-manifest-and-import-recovery.md) resolves the metadata/import contract with a versioned sidecar over the unchanged native transfer and local source/target import journals. [Current Android evidence](../implementation/implementation-session-handoff.md#photos-sidecar-manifest-and-import-recovery--2026-10-14) includes real MediaStore original import/retry/crash reconciliation. Unsupported resource/organization semantics are review, not success; iOS/native physical/platform/background acceptance and account recovery/final remote authorization remain OPEN.

## 1. Ana akış ve program

- İlk local trust: PC aktif invitation QR'ı → telefon QR-only scan → actual mutual TLS/P-256 SPKI + same-channel secret proof → exact candidate PC approval → iki durable local pin + ACK. [ADR0013](../decisions/0013-qr-based-local-lan-pairing.md) bu akışı backend/internet/login olmadan kabul eder; native/bridge/UI implemented, actual Android↔PC physical kabul açık. V1 LAN dosya akışı ayrıca explicit PC-local scope/peer ACL onayı ve her operasyonda native enforcement ister. Offline local pins ≠ file grant; tarihsel account/central-capability zorunluluğu bu dar LAN ACL için ADR0016 ile superseded, remote/account recovery açık.
- Ana hedef PC, kaynak genel dosyalardır. WebDAV/SMB gelişmiş seçenekleri korunur; yeni PC kanalını SMB'yi internete açarak gerçekleştirme. Uzaktan listeleme bilgisayardaki izinli alandan yapılır; web dosya tarayıcısı veya merkezî dosya indeksi bu seçimden türetilmez.
- Mobilde kaynak ve program; PC'de izinli alıcı klasör seçilir. Android/iOS ortak ürün davranışı hedeflenir, aynı native API veya kesintisiz background garanti edilmez. iOS Files security-scoped izinleri ve Android SAF grant'leri gerçek erişim sınırıdır; tüm cihaz dosya sistemi taranmaz. Kaynak izin iptali boş kaynak/başarı değildir.
- Sessionda seçilmiş uyumluluk/destek **hedefi iOS 16.4+ / Android 7.0(API24)+** ve ortak native crypto yönüdür. Bu hedef tüm release/toolchain minima uyumluluğu/onayını veya tüm sürümlerde proved support'u kapatmaz. Fiziksel PoC'nin experimental minSdk24 APK'sı tek başına ürün minimum-OS kararı değildir; ADR0001 bu tarihsel seçim ve açık gate ayrımını korur.
- Live varsayılan: değişiklikler OS izin verdiğinde ilk fırsatta işlenir; Live periyodik JS timer veya kesintisiz real-time diye taklit edilmez. 12/24 saat + yerel saat seçildiğinde değişiklik kaydedilir ama otomatik upload yalnız program yürütülünce başlar. Sync Now ayrı; düzenli programın saatini değiştirmez.
- [ADR 0001](../decisions/0001-mobile-sync-behavior-and-framework-constraints.md) toplam beş erişim denemesi/başarısız sonuç sonrası 60 saniye ve ayrı OS takibi/beş girişim/5 dakika hedefini korur. Aktif uzun iş ikinci kopya başlatma gerekçesi değildir; OS uyanma garantisi yoktur.
- Temel mod tek yönlü backup + remote list/download. PC backup alanına elle eklenen dosyalar da görünür/indirilebilir. Files çift yönlü mod ancak kullanıcı seçimiyle açılır; tek yönlü backup ve Photos kaynak silmeleri bu seçimle otomatik çift yönlü olmaz.

## 2. Files silme ve sürüm koruması

| Durum | Kabul edilmiş davranış |
|---|---|
| Seçili çift yönlü Files alanında silme | Karşı tarafa yayılır; PC'de geri alınabilir içerik ve ilişkili kayıt **silmeden önce** kalıcılaştırılır. |
| PC offline, disk dolu veya korunacak içerik yok | Geri alınabilirlik varmış gibi silme yok; işlem bekler veya gerçek hata gösterilir. |
| Trash süresi | PC'de geri alınabilir silmenin commit'inden itibaren **30 gün**. İstemci saat değişimi erken kalıcı silmeye neden olmaz. |
| Normal A→B güncellemesi | A, doğrulanmış B tarafından değiştirildiği commit'ten itibaren **30 gün** geri alınabilir; güncel B korunur. |
| Delete/edit | Ortak revision'dan bağımsız yeni içerik sessizce silinmez; delete/edit conflict, değişmiş içerik korunur. |
| Delete/delete | Aynı silme iki kez uygulanmaz. |
| Offline peer 30 gün sonra gelir | Trash temizliği tombstone/journal ömrü değildir; eski dosya kendiliğinden dirilmez. |
| Koruma deposu dolu | Retention sessizce kısaltılmaz, sağlam eski sürüm erkenden silinmez, özgün dosya silinmez; yeni değişiklik bekleyen/hatalı gösterilir. |
| PC'de haricen overwrite/delete | İlk başarılı ingest'ten önce kaybolan içerik için restore sözü yok; ingest sonrası son doğrulanmış koruma kopyası haricî değişiklikten etkilenmez. |

Güncel normal dosyalar ve immutable koruma deposu ayrıdır. Değiştirilebilir live dosyaya hard-link vermek koruma kopyası değildir; yazmayı ayıran reflink/COW gerçekten destekleniyorsa kullanılabilir, değilse bağımsız doğrulanmış kopya gerekir. Kaynak plan hash-adresli doğrulanmış içerik ile mantıksal current/version/trash referanslarını seçmiştir; bu kayıt yeni filesystem primitive veya wire/DB schema tasarlamaz.

Yeni içerik önce koruma deposunda doğrulanıp commit edilir, sonra live görünüm güvenle güncellenir. Aktif dosya, korunan sürüm, trash veya çözülmemiş conflict'in referans verdiği blob temizlenmez. Çözülmemiş conflict yalnız 30 gün geçti diye silinmez. Aynı blob'u kullanan mantıksal dosyalardan birini silmek diğerlerinin içeriğini silemez.

## 3. Files conflict ve kullanıcı çözümü

- Varsayılan **iki kopyayı da koru**: bağımsız değişiklikler sessiz overwrite/son-yazan-kazan ile çözülmez. İki sürüm normal dosya olarak kalıcı korunur; kullanıcı çözene kadar conflict kaydı açık kalır.
- Diğer dosyalar sync'e devam eder. Sürümler gerçekten korunduysa conflict tek başına run'ı failed/partial yapmaz: completed + ayrı unresolved conflict sayısı. Disk/izin/ağ yüzünden koruma başarısızsa hata gizlenmez.
- Conflict kimliği orijinal dosya kimliği + değişmez kaynak revision kümesinden türetilir. Aynı küme rescan/retry/restart'ta yeni conflict üretmez; daha sonra yeni bağımsız içerik değişikliği yeni conflict oluşturabilir.
- İsim kaynak cihaz + **o revision'a kaydedilmiş** tarih-saat + kararlı revision ayırt edicisi taşır; uzantı korunur. Tarihsel öneri `ad (conflict cihaz UTC-tarih-saat revision).uzanti`; exact wire/naming profile onayı değildir. Cihaz adı değişikliği veya her taramada “şimdi” kullanımı adı değiştirmez. Aynı cihaz adı/zaman damgası, mevcut hedef ismi ve OS karakter/uzunluk sınırları deterministik, no-overwrite biçimde ele alınır.
- Conflict kopyalarının dosya/revision kimlikleri journal'da izlenir; kopyanın karşı peer'a yayılması yeni bağımsız edit/conflict değildir. mtime tek başına nedensellik kanıtı değil; ortak revision tabanı izlenir.
- Run'da **bu çalışmada bulunan** conflict sayısı ve **tüm açık** conflict'lerin kalıcı toplamı ayrı tutulur. Reopen açık kayıtları kaybetmez; çözülmüş kayıt yeniden açık sayılmaz.

| Kullanıcı seçimi | Sonuç |
|---|---|
| İki sürümü de tut | İki dosya kalır; conflict resolved olur. |
| Bu sürümü tut | Seçilen kalır; diğerinin kaldırılması kullanıcı kararı ve Files geri alınabilir silme kuralına tabidir. |
| Diğer sürümü tut | Karşı sürüm kalır; aynı silme güvenliği uygulanır. |

Çözüm kalıcı sync olayı olarak yayılır, restart/retry idempotenttir. Ekran açıkken revision değiştiyse eski seçim yeni içeriği ezmez, güncel karşılaştırma gösterilir. Farklı cihazlardaki eşzamanlı çözümlerde içerik kaybettiren kör son-yazan-kazan yoktur.

### İstenen Activity/Summary anlatımı

- Başarı: **“Senkronizasyon tamamlandı”**.
- Tek conflict: **“1 dosyada çakışma bulundu. Her iki sürüm de korundu.”** + **“Çakışmaları incele”**.
- Çoklu: **“3 dosyada çakışma bulundu. Tüm sürümler korundu.”**.
- Kalıcı durum: **“3 çakışma çözümlenmeyi bekliyor”**.

Sayılar örnektir; i18next tr/en/de ve çoğul kuralları kullanılır. Davranış kabulü completed+unresolved durumunu sınar; exact kopya cümleye bağlı test yazılmaz.

## 4. İçerik kimliği ve FolderSync sınırı

1. Seçilen yöntem **SHA-256 içerik hash'i + kalıcı kayıt**. Kararlı byte snapshot akış halinde hash'lenir; büyük dosya RAM'e alınmaz. Okurken değişen içerik eski hash'le başarılı backup sayılmaz.
2. Yaklaşık **8.000 FolderSync dosyası** ilk doğrulanmış taramada gerçekten okunur, hash/konum kaydedilir; aynı içerik doğrulanınca yeniden upload olmadan mevcut backup kaydına bağlanır. İsim/tarih/boyut yalnız aday filtresidir. WebDAV/SMB'nin SHA-256 sunduğu varsayılmaz; zayıf/standart olmayan ETag SHA-256 yerine geçmez.
3. İçerik kimliği konumdan, mantıksal dosyadan ve Photos asset'inden ayrıdır. Aynı içerik birden fazla klasör/asset/album ilişkisine ait olabilir. Receipt **hedef depo/alan kimliğiyle scope edilir**; başka hedefe geçince önceki hedefteki kopya yeni hedefte var sayılamaz.
4. Hash kanıtı yalnız doğrulanmış snapshot/revision için yeniden kullanılabilir. Kaynak/hedef değişimi veya invalidation eski kanıtı geçersiz kılar; kalıcı kayıt fiziksel kopyanın hâlâ mevcut/doğru olduğunun tek başına kanıtı değildir.
5. Live Photo/çok-resource asset gereken tüm resource rolleri ve her hash ile doğrulanır. Tek still image eşleşmesi tüm Live Photo duplicate değildir. Albüm/favori değişimi medya blob'unu yeniden upload ettirmez.
6. Yeniden kodlanmış/sıkıştırılmış/düzenlenmiş, byte'ları farklı medya yalnız benzer görünmesi nedeniyle atlanmaz; perceptual similarity özelliği seçilmedi.

Bu davranış ürün gereksinimidir; mevcut FolderSync arşivi bu oturumda test hedefi yapılmadı ve migration çalıştırılmadı. Tarihsel ilk WebDAV diliminin “yalnız kendi receipt'i / yabancı dosya benimsenmez” sınırı o dilimin kanıtını korur; yeni SHA-256 migration kararını uygulanmış göstermez.

## 5. Photos backup-first ve restore

- iPhone Photos → PC otomatik backup kaynağı olabilir. PC edit/delete Photos kütüphanesine otomatik yansımaz; Files çift yönlü ayarı sınırı aşmaz.
- Kullanıcı tekil/toplu seçimle **“Fotoğraflara Kaydet/Geri Yükle”** başlatabilir. Yeni cihaz/tam Photos kurtarma için **tüm erişilebilir Photos yedeği** toplu restore edilebilir; tek tek seçim zorunlu değildir. Tüm iPhone OS/app verisi, erişilemeyen veya hiç yedeklenmemiş medya restore vaadi yoktur.
- Restore kalıcı asset-bazlı iş: hazırlama/indirme → doğrulama → PhotoKit import → commit/receipt. Ağ kesintisi, PC offline, permission loss, alan yetersizliği veya app kapanışı completed değildir.
- Duplicate önleme zorunlu: retry/reopen/ikinci “tümünü restore” mükerrer import yaratmaz. Kullanıcının sonradan Photos'tan sildiği asset eski receipt nedeniyle sonsuza dek atlanmaz.
- PhotoKit commit başarılı, Kloda receipt yazımı kesilmişse reconciliation gerekir; native işlem+journal tek transaction değildir. Receipt backup asset/resource → hedef Photos library → yerel asset kimliğini bağlar. Yerel identifier cihazlar arasında aynı varsayılmaz; önce erişilebilir mevcut asset kontrolü, gerektiğinde resource hash'leriyle erişilebilir kütüphane reconciliation yapılır.
- Tek toplu UI işi bütün arşivi RAM'e veya sınırsız tek PhotoKit transaction'ına çevirmez. OS izinleri/yürütme sınırları görünürdür; kesintisiz background tamamlama sözü yoktur.
- Add-only mevcut library'yi okumaz; limited erişimde görünmeyen asset yok sayılmaz. İzin yokken “duplicate yok/tam duplicate koruması” denmez; kapsam kullanıcıya bildirilir. SHA-256 doğrulanmış erişilebilir byte'lar içindir, görünmeyen library için garanti değildir.

### Medya ve organizasyon ayrı

| Katman | Kabul edilen kapsam | Vaat sınırı |
|---|---|---|
| Medya | Orijinal resource'lar, Live Photo still/video, erişilebilir temel metadata; PhotoKit'ten alınabilen mevcut edited görünüm orijinalden ayrı korunur. | Bir asset tek JPEG varsayılmaz; Apple private edit geçmişini yeniden çalıştırma sözü yoktur. |
| Organizasyon | PhotoKit'in izin verdiği kullanıcı albümleri, üyelikler, favori durumu backup metadata'sında saklanır/restore edilir. | Sistem/smart albums, People/yüzler, Memories, özel edit history ve iCloud internal state birebir restore edilmez. |
| Koruma | Metadata/manifest de backup verisidir; PC'de kalır, uzak aktarımda E2EE'dir. | Supabase'e merkezi dosya/album kataloğu veya plaintext medya hash listesi yüklenmez. |
| Restore sırası | Önce medya mevcut/import edilmiş doğrulanır; source→target asset eşlemesiyle organizasyon uygulanır. | Aynı asset iki albümde diye iki kez import edilmez; aynı adlı farklı albümler yalnız başlıkla birleştirilmez. |
| Sonuç | Medya ve organizasyon completion ayrı izlenir. | Medya tamam, metadata hatalıysa “her şey geri yüklendi” yok; metadata retry medyayı çoğaltmaz. |

API/izin dışındaki organizasyon unsurları görünür limit olarak raporlanır. Mevcut library kullanıcı onayı olmadan silinip backup'la birebir aynalanmaz. Albüm/metadata restore gereksinimi galeri navigasyonu, arama veya thumbnail ürün kapsamını karara bağlamaz.

## 6. Gizlilik, remote tercih ve production gate'leri

PC normal dosyaları Finder/Explorer ile açma/düzenleme/ekleme deneyimi korunur; kapalı Kloda vault yoktur. Private device key'ler uç OS storage'ında kalır. Hesap recovery bunları sunucudan yeniden üretmez; PC normal dosyaları koruduğundan kayıp telefon key'i yeni onaylı pairing ile değiştirilebilir.

[ADR0012](../decisions/0012-kloda-owned-p256-device-identity.md) ayrı long-lived Kloda P-256 identity ve mümkün olduğunda Secure Enclave/Keystore-StrongBox-TEE/TPM non-exportable provider yönünü korur. [ADR0013](../decisions/0013-qr-based-local-lan-pairing.md) Matrix/SAS'ı current pairing path'ten çıkarır; QR/native channel binding, durable pins/ACK ve kalan hardware API/support/fallback/background/physical gate'leri açıktır. Local peer pin trust, backend registry yalnız control metadata'dır. Backend JWT user session, ayrı signed capability PC/device/scope/expiry file authorization'dır; QR trust veya session identity proof grant değildir.

Relay'in yalnız depolamaması gizlilik kanıtı değildir: edge TLS + origin TLS iki farklı sınırdır. HTTPS veya tunnel token E2EE key'i değildir. Dosya/medya/album metadata'sı relay'e plaintext açılmaz; IP/zaman/boyut gibi trafik metadata'sının anonimliği vaat edilmez.

Cloudflare Tunnel tarihsel tercih ve TURN'den farklı üründür. ADR0012 remote için **WebRTC/DTLS + signed signaling/fingerprint + Kloda device mutual proof**, mümkünse direct P2P ve **Cloudflare TURN yalnız relay fallback** yönünü seçti; LAN pinned TLS/SPKI + mutual proof. Exact source/native/provider deployment ve iOS background/physical proof açık; adopted production iddiası yok. TLS/DTLS kanal güvenliği zorunlu, varsa payload encryption ek defense-in-depth'tir, yerine geçmez. Kullanıcı sağlayıcı hesabı/port/DNS kurmaz. PC asleep/offline ise cloud file store olmadan telefonda beklenir; relay disk/object-store ürünü olmaz.

Aşağıdaki eski provider araştırması tarihsel maliyet/limit bağlamıdır; Tunnel/DNS connector provisioning yeni remote yönünün prerequisite'i değildir. Güncel Cloudflare TURN deployment/credentials/cost/limits/redundancy ayrıca doğrulanır; historical fiyat güncel teklif değildir.

| Gate | Saklanan araştırma bulgusu / sınır |
|---|---|
| Cloudflare public Tunnel | Büyük dosya/video hizmet koşulları, HTTP upload sınırları ve o tarihte belgelenen hesap başına 1.000 tunnel limiti var; chunking/encryption/cache bypass koşulları kaldırmaz. Ücretsiz/sınırsız production backup varsayılmaz. |
| Merkezi provisioning | Backend hesabından tunnel/DNS ve connector token dağıtımı kullanıcı hesabı gerektirmeyebilir; dağıtım/lisans/tenant isolation/ölçek sözleşmesi kanıtlanmadı. Hesap-level API key uygulamalara gömülmez. |
| TURN | Ayrı servis, eşleştirme/authorization değildir; kısa ömürlü credential backend'den. Kaynakta $0.05/outbound GB bulgusu vardı; fiyat/limit/kota yeniden doğrulanır, throughput/SLA garantisi değildir. |
| Alternatif maliyet | ngrok yalnız aday araştırması: okunan PAYG $20 aylık taban/credit, 5 GB sonrası $0.10/GB outbound, $0.02/aktif endpoint-saat; farklı kullanım kalemleri, güncel teklif veya adoption değildir. |
| Stream | Encode/store eden Cloudflare Stream yalnız byte taşıyan içerik saklamayan yolun sessiz alternatifi değildir. |
| iOS | background URLSession HTTP(S)/file-backed'tir; remote DataChannel ona devredilmiş sayılmaz. iOS simulator inconclusive; gerçek iPhone trust/lifecycle/storage ve desteklenen eski OS kanıtı gerekir. |
| Network/PC | CGNAT her zaman fail değildir; çift NAT/firewall/client isolation başarısız olabilir. TURN PC offline/sleep, suspend veya internet kesintisini çözmez. |
| Değişiklik kapısı | Seçilen WebRTC/DTLS/direct-P2P/Cloudflare TURN fallback yönü provider deployment/native/background gate'lerini kapatmaz. Uygunsuz provider koşullarında self-hosted relay, managed tunnel, başka provider veya foreground-only garantiye sessiz cutover yok; ayrı kullanıcı kararı gerekir. |

## 7. Kanıt sınıfları ve baseline boşlukları

**Kabul edilmiş politika:** bu belgedeki ürün davranışları. **Tarihsel kod incelemesi:** aşağıdaki boşluklar kaynak oturumda görülmüştür; bu belgelemede güncel kod yeniden çalıştırılmadı. **Gözlenmiş izole PoC:** Android 14 pass / 1 direct-connectivity inconclusive; `complete:false`, production-ready false. **Fiziksel cihaz gerekli:** iOS. **Production gate:** hesap/pairing/enrollment, transport dağıtımı, platform/native storage, filesystem/time/fence ve gerçek ürün akışı.

- Mobil baseline native journal kaynak metadata kuyruğudur; gerçek run/receipt/restore migration olmadan tamamlanmış sync değildir. Rescan delete/reinsert pending durumları kaybedebilir; kesik scan'de eksik öğe delete sayılmaz.
- Kaynak scanner'lar metadata enumerate eder; Photos original resource byte okuması/hash yok, resource size sıfır kaydı gerçek backup değildir. Native bridge'de program kaydı gerçek scheduler/worker/upload/restore değildir.
- Android read-only SAF grant çift yönlü write/rename yetkisi değildir; provider yetenekleri açık kontrol edilir. iOS bookmark enumeration upload boyunca scope'u otomatik açık tutmaz.
- Desktop outgoing WebDAV adapter incoming PC receiver/crypto engine diye yeniden adlandırılmaz. Tarihsel baseline inbound server, list/download, content store, SHA256 inventory, conflict veya Tunnel dağıtımı içermiyordu.
- Desktop size+mtime revision hash değildir; receipt/pending hedef/account scope'u eksikti; uncertain final commit, temp silip pending kaldırarak başarı sayılamaz. Source yeniden seçimi kimlik/backup kökünü rastgele değiştirmemeli.
- Desktop schedule due/running RAM'de; kalıcı reconciliation ve window-close kabulü tamamlandı değildi. Dev server dağıtılabilir signed installer/connector kanıtı değildir.
- Yeni account/MFA/recovery/peer/conflict/restore ekranları için onaylı Stitch referansı bulunmamıştı; mevcut dil korunur, yeni keyfî design system kurulmaz. Eksik ekranlar çalışan özellik diye gösterilmez.
- Tarihsel task checkpoint **7 tamamlanmış temel kayıt / 10 açık iş** olarak korunur; foundation, probe veya isolated PoC bütün vertical slice'ı kapatmaz. PoC EngineConfig/RequestMeta/receipt sözleşmesi izolasyon içindir; fixture pair secret veya app-private signaling üretim account/protocol API'si değildir.

## 8. Çalıştırılmamış kabul hedefleri

- 30 gün içinde delete ve A→B update rollback; offline peer'ın diriltmemesi; delete/edit yeni byte'larının korunması; disk full'da erken cleanup olmaması; aktif/ref-counted blob ve unresolved conflict temizlenmemesi.
- İki bağımsız edit → iki dosya + bir durable açık conflict + completed run; diğer dosyalar devam. Retry/restart/karşı tarafa taşıma conflict veya ismi çoğaltmaz. Aynı ad/zaman/OS limit/target collision overwrite yaratmaz.
- Üç conflict çözümü kalıcı yayılır; sayılar doğru azalır; stale veya eşzamanlı çözüm yeni içerik kaybettirmez.
- FolderSync doğrulanmış aynı byte'lar upload edilmez; değişmiş byte/target/receipt yanlış skip üretmez; mutable snapshot reddedilir.
- PC edit/delete Photos'u otomatik değiştirmez. Tekil/toplu/tüm restore ve native commit sonrası crash reconciliation duplicate üretmez; sonradan library'den silinen medya stale receipt ile sonsuza dek atlanmaz.
- Tek medya iki kullanıcı albümü + favorite → tek asset, doğru iki üyelik/favorite; tekrar restore asset/albüm çoğaltmaz. Limited permission/metadata error eksik kapsamı açık gösterir, tamamlandı yalanı yoktur.
- Router ayarı olmadan ayrı ağlarda eşleşme/aktarım, kötü signaling kimlik değiştirmesine karşı peer doğrulaması, relay plaintext yokluğu, PC offline queue, fiziksel iOS background ve advanced WebDAV/SMB korunması ayrıca ispatlanır.

## 9. Kaynak eşlemesi ve resmî dayanaklar

Bu satırlar özgün session kayıtlarını gösterir; durable politika yukarıda tam olarak yazılıdır. Kaynaklar bu çalışmada değiştirilmedi; burada yeni deney/kurulum yapılmadı.

| Kaynak | Satırlar / major claim |
|---|---|
| `local://kloda-computer-backup-plan.md` | 5–45 PC/general files, advanced options, Tunnel preference ve gates; 47–51 Live/scheduled/manual, PC-added files; 150–193 deletion/conflict/UI/resolve; 195–240 restore/duplicate/FolderSync/versioning; 242–268 medya/organizasyon/gizlilik; 271–295 tarihsel baseline/minOS önerisi/managed maliyet. |
| `local://kloda-security-discussion-plan.md` | 9–16 relay gizliliği ile HTTPS ayrımı, eksik mobile upload; 18–37 açık işler ve deneysiz danışma. |
| `local://kloda-first-vertical-slice-plan.md` | 5–22 tarihsel WebDAV/no-Live/no-migration sınırı; 42–63 schedule/durable completion/source güvenliği; 175–189 platform yaşam döngüsü; 210–221 tamamlanma kriteri. |
| `local://kloda-todo-coverage-plan.md` | 19–37 tarihsel 7 tamamlanmış/10 açık ayrımı; 43–48 Foundation ≠ bütün kabul. |
| `local://kloda-transport-analysis-plan.md` | 7 seçilmiş common native crypto yönü ve iOS16.4+/Android7/API24 uyumluluk/destek hedefi; 9–25 LAN locality/cellular opt-in/native durable yön; 201–228 retained aday ve iOS sınırı. Eski bilgisayar planındaki minOS önerisi ile daha sonraki seçim tarihsel sıradır; scope-freeze17 experimental APK minSdk24'ün ürün minimum kararı olmadığını sınırlar. Release/toolchain compatibility/approval gate'leri açık; ADR0001 güncel kayıt kaynağıdır. |
| `local://kloda-android-poc-scope-freeze.md` | 3–13 izolasyon/no-product-integration; 19–36 scoped fiziksel Android kanıtı, son 14/1 ve false statüleri. |
| `local://kloda-poc-engine-contract.md` | 2–10 izolasyon workspace, fixture/config ve ortak receiver/transport/journal sözleşmesi; ürün API adoption değildir. |

Sessionda okunmuş resmî belgeler (bu belgelemede canlı yeniden doğrulama yapılmadı): [Apple directory access](https://developer.apple.com/documentation/uikit/providing-access-to-directories), [PHAssetResource](https://developer.apple.com/documentation/photos/phassetresource), [PhotoKit değişiklik commit'i](https://developer.apple.com/documentation/photokit/requesting-changes-to-the-photo-library), [add-only](https://developer.apple.com/documentation/photos/phaccesslevel/addonly), [limited Photos](https://developer.apple.com/videos/play/wwdc2020/10641), [background URLSession](https://developer.apple.com/documentation/foundation/downloading-files-in-the-background), [Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/), [routing/large-file koşulları](https://developers.cloudflare.com/tunnel/concepts/routing/), [SSL sınırları](https://developers.cloudflare.com/ssl/concepts/), [central tunnel provisioning](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel-api/), [account limits](https://developers.cloudflare.com/cloudflare-one/account-limits/), [TURN](https://developers.cloudflare.com/realtime/turn/), [credentials](https://developers.cloudflare.com/realtime/turn/generate-credentials/), [28 Eylül 2026 koşullarına referans verilen CDN terms](https://www.cloudflare.com/service-specific-terms-application-services/#content-delivery-network-free-pro-or-business), [video politikası](https://developers.cloudflare.com/fundamentals/reference/policies-compliances/delivering-videos-with-cloudflare/), [ngrok fiyat araştırması](https://ngrok.com/pricing.md). Bunlar platform/provider sınırlarını temellendirir; çalışan Kloda implementasyonunu kanıtlamaz.
