# Protokol/sağlayıcı uygunluk ve karar matrisi —14 /29 Ekim2026

Durum: **16/16 katalog seçeneği değerlendirildi; D1–D3onaylandı. Onboarding/SDK/fiyat/runtime
kapıları açık; sağlayıcılar çalışıyor denmez.15hedefli kaynak değerlendirmesi başladı.**
Bu kayıt geliştirme/account/deployment/ücretli kaynak oluşturma onayı değildir.

[13 galeri uygulaması ve kanıt](photos-gallery-step13-2026-10-29.md) tamamlanan
kaynak/izole kapsamıyla devralındı;12/13Android native ve fiziksel kapıları korunur.
Katalog kimlikleri `packages/sync-core/src/destination-catalog.ts` ile karşılaştırıldı.
Mevcut mobil WebDAV yalnız config/probe; `webdav.ts` bir byte sender değildir.
Mevcut kalıcı iş/context/retry/receipt yapıları kullanılacak; yeni global queue,
scheduler, PC record-ID taklidi veya ortak OAuth varsayımı yok.

## Değişmeyen uygulama sınırı

Her adapter'ın bağlamı provider+account/tenant+endpoint+root/bucket/prefix+credential
revision+source revision içermeli. Ayar değişimi eski işi güvenle durdurur; eski
ACK ve recovery kaydı korunur. Token refresh aynı hesap/context içinde kalmalı;
farklı hesabın eski işi devralması engellenmeli. Upload-session URL'leri de sırdır:
log/renderer/history'ye dökülmez, güvenli native saklama ve host/TLS sınırı ister.

Kayıp yanıt, var olan hedef, unknown commit, çakışma ve gerçekten doğrulanmış
completion ayrıdır. Liste/name/size/date/ETag tek başına SHA256 içerik kanıtı veya
aynı hedef sürümünün sahiplik kanıtı değildir. Restore, explicit kullanıcı eylemi,
sabit uzak sürüm/ID ve yerelde no-overwrite ile ayrı doğrulanır. PC-local ACL ve
ADR0019çöp/suppression politikası üçüncü taraf cloud'a taşınmaz. Cloud delete,
retention, remote authority ve Kloda medya E2EE/key lifecycle açık kalır.

Yeni servis client-secret'ı mobile/Electron renderer'a gömülmez. Account credential,
refresh token, SSH parola/key ve session URL için native güvenli store sınırı
korunur; mevcut mobile WHEN_UNLOCKED_THIS_DEVICE_ONLY WebDAV kaydı bütün provider
platformları/backgound modları için otomatik uygunluk kanıtı değildir.

## 16 seçenek: API, auth, I/O ve uyarlama kapısı

Aşağıdaki I/O davranışları **resmî API olanağı veya uygulanacak doğrulama adayı**dır;
Kloda implementasyonu/runtime PASS'i değildir. Başka klasör/hesap için yetki türemez.

|Kod / katalog kimliği|API / platform yolu ve credential|Upload, list, restore, kesinti/idempotency|Karar / doğrulanacak sınır|
|---|---|---|---|
|P1 `webdav`|Mevcut native HTTP(S) yolu; kullanıcı seçtiği sunucu ve mevcut profil. [RFC4918](https://www.rfc-editor.org/rfc/rfc4918).|PUT/PROPFIND/GET; conditional create ve COPY/MOVE `Overwrite:F` sunucu özelinde test edilmeli. Kayıp cevapta mevcut durable journal+exact-byte reconciliation; range/resume evrensel garanti değil.|15önce mevcut sender mekanizmasıyla dar adapter. Mevcut timeout,5/60retry ve no-overwrite korunur; probe=true byte-transfer kanıtı değil.|
|P2 `smb`|LAN-only sabit. [MS-SMB2/3](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-smb2/), native C adayı [libsmb2](https://github.com/sahlberg/libsmb2); user/domain/share bilgisi ayrı hedef kimliği.|CREATE/READ/WRITE/query-directory; create disposition/exclusive hedef, kalıcı file identity ve kayıp-write/rename sonrası readback fixture gerektirir. SMB durable handles bütün NAS'larda varsayılmaz.|Öneri: SMB3+, şifreleme+imza zorunlu; eski/şifresiz sunucuya fallback yok. Bu advanced SMBprofili ADR0022ile onaylandı. iOS/Android/desktop paketleme+lisans incelemesi açık.|
|P3 `ftp`|Yalnız onaylanacak güvenli profil. [RFC4217 FTPS](https://www.rfc-editor.org/rfc/rfc4217); native aday libcurl; user/password secure store.|STOR/LIST/MLSD/RETR/REST/RNFR-RNTO sunucu özelliği. STOR/rename atomik create-only garantisi vermez; bağımsız staging, owned-job recovery ve final no-clobber kanıtı olmadan çalışma yok.|Öneri: explicit FTPS `AUTH TLS`, veri `PROT P`, tam sertifika/hostname kontrolü, LAN-only; plain FTP/`PROT C`/CCC/fallback kapalı. Sunucu bunu desteklemiyorsa seçenek engelli kalır.|
|P4 `sftp`|SSH2/SFTP; [OpenSSH spesifikasyonları](https://www.openssh.org/specs.html), [libssh2 known-host check](https://libssh2.org/libssh2_knownhost_checkp.html). Credential Kloda P256 identity değildir.|[Exclusive create](https://libssh2.org/libssh2_sftp_open_ex.html), READ/WRITE/READDIR; rename/fsync uzantısı sunucuda doğrulanır. Başka süreçle yarışı ve lost-reply retry'ı yalnız path/size ile çözmek yok.|Öneri: sunucu SHA256host fingerprint'i bağlantıdan önce bağımsız kanaldan girilip eşleşmeli; değişim hard-stop. İlk dar auth parola; key import/export/agent ve otomatik TOFU yok. Bu dar profil ADR0022ile onaylandı.|
|P5 `s3-compatible`|S3API+SigV4 aday; endpoint/region/path-style/bucket/prefix ve access credential ayrı konfigürasyon. C1'in alias'ı değil.|Multipart/HEAD/LIST/GET/abort/conditional commit ancak **seçilecek sunucu** bunları gerçekten destekliyorsa. ETag=SHA256 veya AWS ile eşdeğer conditional write varsayılmaz.|Sunucu/vendor seçilmedi; şartlı create, checksum ve list consistency matrisi/fixture açık. Tek adapter paylaşımı ancak davranış eşitliği kanıtlanınca.|
|C1 `amazon-s3`|[AWS conditional writes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html); IAM scope ve credential seçimi açık. Kotlin/API24+, Swift veya mevcut native HTTP aday; hiçbir SDK eklenmedi.|Put/CompleteMultipartUpload için precondition; upload-ID/part/checksum durable; completion kaybında exact key/version+bytes uzlaştırması. LIST/GET(version) restore adayı. Multipart ETag içerik SHA256'ı değildir.|Mevcut kullanıcıya ait scoped access-key mi yoksa STS/federation mı kararlaştırılmadı. Yeni Cognito/broker/role/account/region/bucket oluşturulmaz; maliyet onayı yok.|
|C2 `box`|[OAuth token endpoint](https://developer.box.com/reference/post-oauth2-token) örneği client_secret kullanıyor. Public-client secretsiz yol bu incelemede doğrulanamadı; rclone'da blank config alanı bunun kanıtı değil.|[Chunked upload](https://developer.box.com/guides/uploads/chunked), part/session/commit, list(file ID)/download API'leri. Account file-size cap, conflict/preflight ve commit-sonrası sonucu gerçek readback ile kanıtlamak gerekir.|Mobile'a secret gömmek yok. Provider-supported public flow doğrulaması veya **ayrı onaylı broker mimarisi** gerekir. Token refresh rotate/revoke ve eşzamanlı refresh yarışı ayrıca native test ister; Box listede korunur.|
|C3 `cloudme`|[Resmî HTTPS WebDAV](https://www.cloudme.com/en/webdav); mevcut WebDAV mekanizmasını yeniden kullanma adayı. [REST/SOAP](https://www.cloudme.com/en/api/webservices) ayrıca SSL+Digest belgeliyor; auth türleri karıştırılmaz.|DAV PUT/PROPFIND/GET; generic DAV adapter testlerinin CloudMe sunucu davranışını kanıtladığı varsayılmaz. Conditional/finalize/retry ve digest/basic seçimi hesapla doğrulanır.|Özel CloudMe SDK seçilmedi. TLS credential akışı, remote no-overwrite ve güncel plan sınırı geçmeden çalışır etiketi yok.|
|C4 `dropbox`|[OAuth rehberi](https://www.dropbox.com/developers/reference/oauth-guide), native public-client PKCE + offline refresh adayı; app-folder/full-access scope kararı ayrı.|[Upload sessions](https://docs.dropboxapi.com/dropbox-api/api-reference/user-endpoints/files/upload-session-finish), offset+commit; list/get by stable ID/rev, restore download. Add/autorename/revision davranışı açık seçilmeli; Dropbox content_hash normal dosya SHA256'ı sayılmaz.|App registration ve [production review](https://www.dropbox.com/developers/reference/developer-guide) var; hesap oluşturulmadı. Native redirect/scopes ve rotation/context testleri açık.|
|C5 `google-drive`|[Drive upload](https://developers.google.com/workspace/drive/api/guides/manage-uploads); platform-specific Google auth, `drive.file` gibi en dar uygun scope adayı. [Desktop OAuth](https://developers.google.com/identity/protocols/oauth2/native-app) mobile SDK doğrulamasının yerine geçmez.|Resumable session+status; [önceden ayrılmış file-ID](https://developers.google.com/workspace/drive/api/guides/create-file) yeniden create'te duplicate'i önler. Aynı adla çok dosya olabilir; list adı→kimlik değildir. Binary download ve sabit revision/hash doğrulaması gerekir.|Google project/platform client-ID, redirect ve scope/verification seçimi açık. Workspace export/Docs conversion bu binary backup diliminden türetilmez.|
|C6 `google-cloud-storage`|[GCS resumable API](https://docs.cloud.google.com/storage/docs/resumable-uploads), OAuth+IAM; Drive değildir. Service-account JSON'u mobile'a gömmek veya otomatik broker seçmek yok.|[Generation preconditions](https://docs.cloud.google.com/storage/docs/request-preconditions): create-only `ifGenerationMatch=0`; session offset/status; list/get generation ve checksum. Session URI bearer yetkisidir; güvenli saklanmalı, loglanmaz.|Project/billing/bucket/region ve kullanıcı/federation auth kararı açık. CRC/MD5 metadata tek başına Kloda E2EE manifest/authority kanıtı değildir.|
|C7 `kolab-now`|[Resmî KB DAV endpoint](https://kb.kolabnow.com/faq/can-i-access-my-files-via-webdav), HTTPS `/files/Files`; kaynak2019tarihli, bugünkü hesabın davranışını kanıtlamaz.|DAV list/PUT/GET ve conditional create/no-overwrite test edilecek; Files entitlement, token/app-password/2FA akışı güncel hesapta doğrulanmadı.|Ayrı adapter/account markası korunur; generic WebDAV aday. Files özelliğini veya ücretsiz hesabı varsayma; onaylı disposable hesap gerekir.|
|C8 `mega`|[Resmî C++SDK](https://github.com/meganz/sdk) Android Java/iOS ObjC ve desktop örnekleri sunuyor; account session+client-controlled encryption kendine özgü.|SDK upload/list/download, transfer-resume ve duplicate/node-identity sonucu exact SDK sürümüyle test edilmeli. REST'e basit PUT veya genel OAuth adapter'ı diye çevrilmez.|SDK top-level [BSD2koşullu LICENSE](https://raw.githubusercontent.com/meganz/sdk/master/LICENSE) doğrulandı; GPL varsayımı yok. Dependencies/version/size/account-session+key custody ve Kloda E2EE ilişkisi açık; SDK kurulmadı.|
|C9 `onedrive`|[MSAL/public-client code+PKCE](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow), delegated user scopes+tenant/account ayrımı; app-only yetki varsayılmaz.|[Graph upload session](https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession?view=graph-rest-1.0): fail conflict, expected ranges, expiry ve finalitemID; list/get stableitem/version. Upload URL yetkili session'dır, Graph bearer başka hosta kör taşınmaz.|App registration/redirect+personal vs work-account/scopes kararı açık. ETag/quickXorHash currentSHA256 veya PC receipt yerine geçmez.|
|C10 `nextcloud`|[Resmî DAV](https://docs.nextcloud.com/server/latest/developer_manual/client_apis/WebDAV/basic.html); user instance+app-password. [LoginFlow](https://docs.nextcloud.com/server/latest/developer_manual/client_apis/LoginFlow/index.html) credential/revoke modelini belgeler; V2/browser akışı sürümle ayrıca seçilecek.|Mevcut DAV adapter adayı; PROPFIND/GET/PUT/conditionalMOVE ve varsa chunk API sürümü/capability ölçülmeli. App-password başka instance/account için kullanılamaz.|Yeni merkezi account/broker yok varsayımı henüz uygulanmadı; kullanıcı instance'ı/sertifikası/2FA politikası doğrulanacak. Hosted plan ile self-host maliyeti farklı.|
|C11 `yandex-disk`|[YandexID mobile SDK](https://yandex.com/dev/id/doc/en/mobileauthsdk/about) iOS/Android OAuth sağlar; native registration/scopes/license-version seçimi açık.|[Upload URL API](https://yandex.com/dev/disk-api/doc/en/reference/upload) `overwrite=false`; verilen HTTPS URL'ye PUT; list/resource metadata/download ile reconciliation. Uploader URL'ye OAuth token eklenmez; yetkili URL gizli tutulur.|30dk URL süresi native retry bağlamıyla eşlenecek. API quota/file cap, account region/availability ve native SDK lisansı doğrulanmadan etkin adapter yok.|

## Limit / hesap / maliyet kontrolü

Değerler araştırma tarihindeki dokümantasyon gözlemidir, Kloda'nın yeni dosya boyu
politikası değildir. Bütün sağlayıcılarda quota/full-disk/rate-limit görünür hata;
kesintisiz background ve ücret sıfır garantisi yok. Aşağıdaki plan linkleri satın
alma önerisi veya kullanıcıya ait hesap/kapasite tespiti değildir.

|Kod|Belgelendi / hâlâ açık|
|---|---|
|P1|Server quota, request/range/size/MOVE sınırı deployment'a bağlı; kullanıcı sunucusu ve ağ/alan maliyeti. Yeni hesap/ücret yok varsayılmaz.|
|P2|NAS/server dialect+share ACL+alan/handle limitleri; yeni NAS/Windows lisansı alınmadı; user server bilgisi açık.|
|P3|Passive port/NAT/TLS-session-reuse, quota ve REST/rename kabiliyeti server'a bağlı; sadece LAN profili önerildi.|
|P4|Server extensions/chroot/symlink/quota; host+port+key doğrulaması, SSH hesabı gerekli. Sunucu maliyeti kullanıcı deployment'ına bağlı.|
|P5|Vendor seçilmediğinden SDK compatibility, max multipart/object, request/egress/storage fiyatı **bilinmiyor**; AWS tablosu uygulanmaz.|
|C1|[Güncel AWS multipart tablosu](https://docs.aws.amazon.com/AmazonS3/latest/userguide/qfacts.html):48.8TiBobject,10.000part,5MiB–5GiBpart (sonpart istisna). [Storage/request/retrieval/network/unfinished-part maliyeti](https://aws.amazon.com/s3/pricing/) region/class'a bağlı; eski5TB varsayımı kullanılmadı.|
|C2|Chunk API minimum20MB ve session7gün; küçük dosya direct upload gerekir. [Box planı](https://www.box.com/pricing) upload-size/storage ve platform API entitlement'ını etkiler; Kloda hesabı/planı bilinmiyor.|
|C3|[CloudMe pricing](https://www.cloudme.com/en/pricing) sayfası tüm planlarda2GBmax file diyor. Fiyatların bölge/vergi/billing/account'a göre teyidi ve gerçek DAV sunucu sınırı açık.|
|C4|Upload-session request≤150MiB; API'nin sessionfile cap'i ayrı. [Dropbox plan](https://www.dropbox.com/plans) storage/retention ve Business API transfer limitini etkiler; development/production app review ayrıca var.|
|C5|Resumable session1hafta; source-bound URI saklanmalı. [GoogleOne storage planı](https://one.google.com/about/plans), Workspace admin/scopes ve API quota ayrı. Drive depolama hakkı GCSbucket hakkı değildir.|
|C6|Session URI1hafta ve yetki token'ı gibi korunur. [GCS fiyatı](https://cloud.google.com/storage/pricing): storage class/region, operations/retrieval ve network bileşenleri; project/billing gerekir. Ücretsiz test veya service-account dağıtımı varsayılmadı.|
|C7|Kolab Files hesabı/planı gerekir; [signup](https://kolabnow.com/signup) içerik metni bu araçta okunamadı. Güncel Files quota/fiyat/upload cap **doğrulanmadı**,2019KB'den fiyat çıkarılmadı.|
|C8|MEGA account storage+transfer quota ve SDK application-key kaydı incelenecek. [Pricing](https://mega.io/pricing) bu araçta açılamadı; güncel limit/fiyat **doğrulanmadı**, hesap veya satın alma yapılmadı.|
|C9|Graphfragment<60MiB, bölünmüş fragment320KiBkatı; session expiry response-bound. [OneDrive planı](https://www.microsoft.com/en-us/microsoft-365/onedrive/compare-onedrive-plans) storage ve personal/work farkı; tenant consent/rate-limit ayrıca.|
|C10|[Enterprise plan](https://nextcloud.com/pricing/) ile self-host sunucu/alan/backup işletimi aynı maliyet değildir. Instance/PHP/proxyquota+chunk cap sürüme bağlı.|
|C11|Upload URL30dk; quota/upload restrictions hesap planına bağlı. [Plan sayfası](https://360.yandex.com/disk/) araçta outdated-browser yanıtı verdi; bugünkü fiyat/filecap **doğrulanmadı**. Gerçek hesap/region izni yok.|

## SDK / lisans / platform seçimi — hiçbiri kurulmadı

- WebDAV/CloudMe/Kolab/Nextcloud: mevcut native HTTP tekrar kullanım adayı; protokol
  kullanımı yeni SDK lisansı seçmek değildir. Server/client kaynak kodu kopyalanmadı.
- SMB adayı libsmb2: LGPL2.1metni mevcut; [kendi COPYING ve build/platform
  belgeleri](https://github.com/sahlberg/libsmb2) de version-pinned kontrol ister.
  Statik mobile dağıtım/notice/relink ve transitif dependency değerlendirmesi açık.
- SFTP adayı libssh2 [3koşullu BSD metni](https://raw.githubusercontent.com/libssh2/libssh2/master/COPYING);
  FTPS adayı libcurl [curl lisansı](https://curl.se/docs/copyright.html). Crypto/TLS
  backend, CVE/paket-boyutu/ABI ve4AndroidABI+iOS16.4/desktop compile kapıları açık.
- S3 adayları [AWSKotlin](https://docs.aws.amazon.com/sdk-for-kotlin/latest/developer-guide/home.html)
  (JVM/Android24+; universal Native/JS SDK varsayımı yok) ve [AWSSwift](https://github.com/awslabs/aws-sdk-swift)
  Apache2.0kaynak adayı. C1/P5tek config olmaz; hiçbir SDK ortak global adapter diye seçilmedi.
- DropboxJS [MITkoşulları](https://raw.githubusercontent.com/dropbox/dropbox-sdk-js/main/LICENSE),
  GoogleSignIn-iOS [Apache2.0](https://raw.githubusercontent.com/google/GoogleSignIn-iOS/main/LICENSE),
  MSALAndroid [MIT](https://raw.githubusercontent.com/AzureAD/microsoft-authentication-library-for-android/dev/LICENSE)
  aday lisans gözlemleri. Bunlar native background-byte stream veya tüm platformların
  feature parity kanıtı değildir. REST/native auth yaklaşımı sürümle seçilecek.
- Box güncel SDK lisans/paket seçimi ve Yandex native SDK lisansı bu dilimde
  **kapanmadı**; GETAPI örneği veya başka vendorSDK lisansından türetilmez.
  MEGA'da top-level BSD2gözlemi transitif build/application terms onayı değildir.
- Context7 `library rclone`→`/rclone/rclone` ve Box auth doc sorgusu çalıştırıldı.
  Yalnız davranış karşılaştırması; rclone binary/queue/default app credentials
  alınmadı. Esas provider iddiaları yukarıdaki birincil vendor/RFC kaynaklarına dayanır.

## Kullanıcı onaylı kararlar —29 Ekim2026

D1/D2/D3 kullanıcı tarafından ayrı ayrı onaylandı; bağlayıcı kayıt [ADR0022](../decisions/0022-advanced-destination-transport-and-credential-custody.md). Bu onay SDK/fiyat/platform açıklarını kapatmaz.

**D1 — LAN transport profili (onaylandı).** SMB3şifreleme+imza zorunlu,
LAN-only; şifresiz/downgrade yok. FTP seçeneği explicit FTPS/TLS+`PROT P`, tam
sertifika/hostname kontrolü, LAN-only; plainFTP/CCC/clear-data fallback yok.
ImplicitFTPS veya user-supplied CA/pinning gerekiyorsa ayrı profil kararı.
Bu seçenek eski NAS/FTPserver'ları kapsam dışına otomatik çıkarmaz: uyumsuz
server görünür engelli kalır; onayla güvenlik gevşetilmez.

**D2 — SFTP host identity/auth (onaylandı).** Kullanıcı host+port için
SHA256fingerprint'i yönetici/bağımsız kanaldan alır ve bağlanmadan önce doğrular.
Farklı/unknown key'de dur; değişimi bağımsız kontrol+explicit update olmadan kabul
etme. İlk dar auth username/password; key export/import/agent, Kloda identity'nin
SSHkey olarak kullanılması ve otomatik TOFU yok. Alternatif explicit ilk bağlantı
fingerprint kabulü, bağımsız kanal doğrulaması olmadan ilk-bağlantı MITM riskini
kullanıcıya taşır; bu alternatif seçilmiş sayılmaz.

**D3 — Cloud credential custody (onaylandı).** Doğrulanmış public-client
native akışlar ve cihaz-native secret store; yeni merkezi OAuthbroker/token
saklama yok. Box secretsiz native yolu doğrulanana kadar açıkça engelli listede
kalsın; sağlayıcı silinmez/atlanmış sayılmaz. Alternatif yalnız gerekli provider
code-exchange broker'ı için threat-model/design hazırlamak; deploy veya account
oluşturmak bu seçimin bile kapsamı değildir. Refresh token'ın server'da tutulması
ayrıca onay gerektirir. User-supplied AWS/GCScredentials ya da federation/account
kaydı da kurulum diliminde ayrı açık izin olmadan oluşturulmaz.

Kararlar ADR0022ile kaydedildi; diğer ADR'lerin kendi kapsamları korunur. Bulut plaintext/E2EE envelope, retention/delete, gerçek hesap/
maliyet ve platformSDKadoption kapıları ayrıca açık; burada kararlaştırılmadı.

## Review / sonraki sıra

Aynı ana ajan ayrı kaynak/kanıt review'u yaptı; bağımsız ajan incelemesi değil.
16kimlik kataloğa eşlendi; WebDAVdışı mobil adapter çalışır sayılmadı. Yeni
cloud login/hesap/app registration, kaynak harcaması, secret gönderimi, deployment,
Git işlemi veya platform/Windowsprobe yok. Birincil kaynakların okunamayan fiyat/
lisans kapsamı açık işaretlendi; rcloneconfig veya doc örneği auth-custody kanıtı
sayılmadı. Kararlar onaylı; [15hedef seçimi değerlendirmesi](mobile-webdav-step15-preflight-2026-10-29.md) sonrası15mobilWebDAVsender;16SMB/SFTP/FTPS,17S3,18tüm
10cloud,19LiveActivities,20hazırlık,21son fiziksel kabul sırası korunur.
