# Kloda — İzole issuance/admission feasibility planı

## Statü ve amaç

**Historical / superseded scope — executable plan veya yeni QR/P-256 acceptance değil.** ADR0012 eski Matrix-key issuance/mTLS yönünü değiştirdi; güncel [ADR0013](../decisions/0013-qr-based-local-lan-pairing.md) ve [future-only QR roadmap](qr-pairing-implementation-roadmap.md) QR local trust'ı seçer. Aşağıdaki source/driver/spec/lab claim/matris ve başarı tanımı eski1A/1B/1C/1D tarihsel kaydıdır; execution başlamadı ve bu cutover execution izni vermez. Eski native spec blocked; historical corpus recovery current QR prerequisite değildir.

Eski deneyin hedefi: **aynı native Matrix telefon key'i ile authority endpoint'inde certificate possession → gerçek ES256 issuance → PC'de fresh full native mTLS üzerinde actual peer-DER ve SAS-key-bound admission → bir gerçek scope-gated list işlemi**. Backend'e dosya bytes/catalog/hash/private endpoint keys aktarılmayacaktı. Gerçek hesap-provider enrollment ve production scope approval provenance bu lab fixture'larıyla kanıtlanmış sayılmayacaktı.

**Güncel dependent-code prerequisite'i ayrı ve dar:** [KLODA-QR-PAIR-V1](../security/qr-pairing-v1-protocol.md) exact QR payload/lifecycle/channel-material bytes ve minimum native behavioral contract frozen / implementation not executed. Hardware-preferred Kloda P-256 actual mutual TLS1.3 possession, QR PC canonical SPKI equality, same-channel secret proof, exact reserved candidate PC approval, durable local pins/consume ve same-key ACK recovery için actual native API/ABI/adoption/integration unverified. Matrix/SAS package/binding/upstream/fork current requirement değildir. Remote WebRTC/DTLS/signaling ayrı kalır.

[2A production source araştırması](../security/production-readiness-research.md) dört hattı source-only ayırır. Ek açık G02/G06 prerequisite: pinned jose6.2.12 key-based signing API arbitrary remoteKMS callback almaz; actualKMS Sign desteği supported production issuer integration yolu kanıtı değildir. Bu hazırlık manual/custom JOSE, üçüncü stack/provider veya key-export fallback seçmedi. Local software1B alt-gate tasarımı ile gerçekKMS/production issuer kanıtı ayrı kalır.

Local peer pins trust anchor'dır; registry/caller boole'u trust kurmaz. Initial QR LAN'da PC Kloda P-256 key actual TLS SPKI ile eşleşir; exact-DER file capability hash'i ayrı, DER persistence/reissue politikası korunur. İlk local trust internet/backend/login olmadan tamamlanabilir; account enrollment, step-up, scope veya file capability/grant yaratmaz. D02 issuer/KMS ve D04 platform/time/authority gate'leri ayrı açık, backend initial QR trust blocker'ı değildir.

Required identity/pin/pairing/epoch continuity kaybında fresh QR re-trust + gerekli online authorization/new grant; hardware retention tek başına continuity değildir. Android device-local hardware P-256→TLS1.3 CertificateVerify **CLOSED/PASS (SM-S921B/API36)** dar [gate kaydıdır](../security/production-gates.md), actual Android↔PC LAN/final app/native bridge/iOS physical/desktop/background veya36 authority hedefini kapatmaz; bu tur rerun yok.

**Aşağıdaki bölümler historical plan'dır.** İçlerindeki conditional execution komutları/fixture'lar ve SDK-patch-required alanları aktif P-256 talimatı değildir; yeni source-backed prerequisites yerine geçirilemez. Eski sayılar/hash'ler değiştirilmez, old corpus rebuild veya tamamlanmış2A araştırmasını rerun etme gereği çıkarılmaz. Bu docs-only cutover code/dependency/provider/experiment çalıştırmaz; yeni mock factory/fake ABI/scaffold oluşturulmaz.

## Başlangıç ve kaynaklar

- Ürün kökü repository root'tur; private kullanıcı path/credential hedefi değildir.
- Kabul edilen kayıt: [ADR0004](../decisions/0004-certificate-bound-capability-and-authority-responsibilities.md), [ADR0007](../decisions/0007-matrix-verification-and-device-continuity.md); ADR0003 offline/revoke/fence politikası korunur.
- Historical immutable native kaynak: `/tmp/kloda-same-key-tls.hjUS9L/`; şu an kontrol edilen bu path erişilebilir değil. Public archive geri alınır ve historical digest doğrulanırsa source manifestleri, `core/`, patched `vendor/matrix-sdk-crypto`, `sdk-byte-signer.patch`, native wrappers/build scripts allowlist ile incelenebilir; **state/private DB/key/epoch/binary kopyalanmaz**. Kullanıcının bildirdiği `docs/security/proof.tar.gz` recovery adayı araçlardan henüz görünmedi; erişim/hash doğrulanmadan geri kazanılmış kaynak sayılmaz.
- Historical `core/src/tls_commands.rs`: Engine-lifetime certificate cache ve PC/SAS trust gate gözlemi; exact bugünkü source/symbol/ABI tekrar erişilemediği için execution edit anchor'ı olarak doğrulanmış değil. Authority-server enrollment modu kanıtlı değil.
- Historical `core/src/tls_session.rs`: actual leaf key pin/full handshake gözlemi; native actual peer-DER export/admitted-context association yeni kapı. Kaynak geri gelmeden signature/caller/driver komutu tahmin edilmez.
- Kalıcı dayanak: [capability profile](../security/capability-profile.md), [36 acceptance hedefi](../security/capability-acceptance.md), [native/TLS kanıt](../security/poc-native-verification-evidence.md), [public inspection summary](../security/evidence/capability-research-summary.json). /tmp ve session-local dosyalar yalnız historical provenance'tır; mevcut raw kaynakların yeniden erişilebilirliği execution prerequisite'idir.
- Adaylar yalnız **jose6.2.12 / jsonwebtoken10.1.0**; source destek bulgusu runtime pass değildir. [jose alg dispatch](https://raw.githubusercontent.com/panva/jose/v6.2.12/src/lib/jws_algorithms.ts), [Rust algorithms](https://raw.githubusercontent.com/Keats/jsonwebtoken/v10.1.0/src/algorithms.rs), [Rust validation](https://raw.githubusercontent.com/Keats/jsonwebtoken/v10.1.0/src/validation.rs), [Rust import](https://raw.githubusercontent.com/Keats/jsonwebtoken/v10.1.0/src/decoding.rs).

## Execution yetkisi ve izolasyon

Execution ayrıca onaylanırsa `mktemp -d /tmp/kloda-issuance-admission.XXXXXX` ile yeni scratch açılacak. Ürün code/manifests/lockfiles/ADR ve önceki PoC'ler execution'da read-only olacak. Sadece allowlisted public kaynaklar kopyalanacak; bütün eski workspace veya arşivin private state üyeleri açılmayacak. Fresh lab key/epoch/SDK DB native provider'da üretilecek; endpoint private key'i export edilmeyecek.

Execution için scope-local Node/Nest/jose bağımlılıkları ve Rust JWT crate indirme/compile, yeni lab endpoint ve mevcut Android emulator/iOS simulator/Electron harness çalıştırma gerekir. Bunlar **şimdi yapılmadı**. Execution onayı bunları yalnız yeni scratch/lab için yetkilendirmeli; npm/Cargo cache ve build outputs scratch'a yönlendirilecek, global/toolchain install veya ürün dependency adoption yapılmayacak. Toolchain/target/lab erişimi yoksa kurulum yerine somut blocker raporlanacak.

Authority yalnız ephemeral lab endpoint'tir, public/live service değildir. Lab port/address/hostname/trust material runtime config'tir; kullanıcı hostname/port/credential koda/repoya girmez. Server TLS key ve server ES256 signer fixture'ları endpoint device possession key'i değildir; production custody değildir. Backend role NestJS kalır; domain/application/infrastructure/interface ayrımı ve use-case başına dosya uygulanır. Deney code'undan önce max-lines/layer sınır lint'i kurulur; native/adaptor code küçük ayrık sorumluluklarda tutulur.

## Deneyin trust modeli

| Veri | Deneyde trusted kaynak | Kanıtlayacağı / kanıtlamayacağı |
|---|---|---|
| Telefon/PC key ve bilateral SAS | Fresh native provider+SDK, iki uç completed verified snapshot | Gerçek native identity/possession; production SDK/platform desteği değil |
| Account/role/pair/PC scope/version/epoch mapping | Harness'ın server ve PC tarafına ayrı verdiği immutable açıkça synthetic fixture | Mechanical equality/admission rejection; gerçek Supabase account, fresh step-up veya authenticated PC approval enrollment değil |
| Issuance certificate DER | Authority TLS endpoint'inin gerçek presented peer leaf'i | Gerçek TLS possession/binding; request JSON/header cert'i değil |
| PC-admission certificate DER | Aynı native TLS session'ın actual peer leaf'i | Session-bound comparison; identity DTO veya caller expected-cert string'i değil |
| Issuer/key/algorithm/type | Token dışı independently configured lab trust record | Fixed-key allowlist/type/rotation rejection; production bootstrap/KMS trust değil |
| Validity time | Lab-only controlled conservative time provider; claims bizzat validator'da değerlendirilir | Strict exp/nbf gate behavior; secure OS time/suspend/restart continuity değil |
| Scope root/operation | PC fixture içindeki gerçek yeni temp directory + izinli list operation | Admit sonrası gerçek operation gate; symlink/mount/open/commit atomikliği değil |

Synthetic kayıtlar production registration olarak adlandırılmaz; JS/caller input immutable trust fixture'ı değiştiremez. Bilateral SAS gerçek çalışacak; fixture “verified=true” boole'u onun yerini almayacak. Normal sync için yeni per-run TOTP/userPresence eklenmeyecek; gerçek step-up/enrollment entegrasyonu ayrı production prerequisite kalır.

## Uygulama sırası

### 1. Kaynak/toolchain pin ve deney profili

Execution başında source commit/patch SHA, manifests/locks, Node/Rust/target/OS sürümleri ve mevcut lab kullanılabilirliği kaydedilir. Eski kaynak hash'leri yalnız inventory için okunur; eski suites yeniden çalıştırılarak önceki sonuçlar tekrar doğrulanmaz. Yeni deneyin regresyonları yeni scratch build'inde çalışır.

Scratch'ta exact **deney profili** dondurulur: compact signed JWS, ES256 single allowlist, protected token type ve trusted issuer/kid; required iss/sub/aud/iat/nbf/exp/jti/cnf.x5t#S256; pair/phone/PC/roles/scope/operations/epoch/version'in producer ve validation eşlemesi. Private claim adları/type/frame grammar yalnız lab contract'ıdır; production wire/API/DB şeması kararı değildir. Unknown/missing/malformed alanların fail-closed davranışı kaydedilir. Token-supplied jku/jwk/x5u veya key lookup trust kuramaz.

Trusted public import EC/P-256 JWK x/y→SEC1 point ve versioned verifier backend ile kanıtlanır; raw `from_ec_der` SPKI-DER parser gibi kullanılmaz. Tek Rust crypto backend feature'ı dondurulur; legacy EdDSA fallback/manual JOSE/üçüncü verifier yok. ES256 private signer fixture yalnız authority process'inde kalır.

### 2. ES256 cross-runtime alt-gate

Gerçek `jose` ile üretilen compact JWT Rust `jsonwebtoken` verifier'ında doğrulanır. Protected header/payload/signature tam wire üzerinden geçer; mock signer, source-text veya kendi çıktısını echo eden test yok. Signature bit-flip, protected claim tamper, wrong alg/curve/kid/iss/sub/aud/type ve eksik zorunlu alanlar ret olmalıdır.

JWS raw r||s import/verify ölçülür; EC PEM/JWK import seçimi kayıtlıdır. Strict exp equality ve nbf sınırı bağımsız conservative validity gate'inde test edilir; crate default leeway60/nbf=false veya exp<now davranışına dayanılmaz. Lab time provider network caller'dan alınmaz ve OS trusted clock diye raporlanmaz.

Bu alt-gate geçse bile ES256 **provisional** kalır: gerçek KMS gate'i kapanmamıştır.

### 3. Aynı native key ile authority endpoint enrollment/issuance

Fresh Android/iOS native engine, daha önce bilateral SAS ile verified PC peer'i ve aynı native identity certificate'ı korurken lab Nest HTTPS authority endpoint'ine fresh full mTLS yapar. Mevcut PC-only TLS hedef/role/trust adapter'ı yeni scratch'ta ayrıştırılır; PC SAS pin ve authority-server trust policy birbirine karıştırılmaz. Authority server authentication configured lab trust üzerinden yapılır; production bootstrap olarak sunulmaz.

Nest TLS ingress **gerçek peer cert**, tamamlanmış standard client CertificateVerify/Finished ve independently provisioned lab registration/eligibility fixture'ından issuance girdisini çıkarır. Native local identity cert'i ile ingress actual cert DER/public key karşılaştırılır. Native signer counter/correlation endpoint scope'unda ölçülür. JS/header/signaling cert'i, key string veya “step-up passed” request flag'i trusted input olmaz; proxy varsa trusted metadata zinciri kanıtlanmadan issuance yok. Tercih lab TLS termination'ın issuer ingress'te doğrudan olmasıdır.

Fresh phone cert'in standart Node/Nest TLS stack'iyle compatibility'si **gate**'tir; CA/leaf-chain veya signer desteği çalışmazsa gerçek hata raporlanır. Client authentication'ı kapatma, ikinci device key, endpoint private export, custom CSR/challenge/handshake veya başka backend stack'e sessiz geçiş yok. Token-binding OAuth client-authentication veya tam OAuth server implementasyonu olarak etiketlenmez.

Başarılı durumda yalnız lab fixture'ın account/pair/PC/scope/version'ına ve ingress actual leaf DER thumbprint'ine bağlı token authority tarafından imzalanıp **o authenticated TLS kanalıyla** telefona döner. Rejected identity/eligibility/token request'inde signed capability üretimi yoktur. PC approval gerçek enrollment'ı lab registration fixture'ıyla kapatılmış sayılmaz.

### 4. Fresh PC-session admission ve gerçek scope-gated operation

Mevcut Engine tek aktif `tls_session` tutar. Authority response native TLS'te alındıktan sonra authority session kapatılıp yeni PC session açılır; aynı native key/epoch/SAS snapshot **ve aynı certificate DER** korunur. Yeni Engine/new cert ile token'ı sessiz taşımak yok; cert değişimi yalnız lifecycle reissue senaryosunda ayrı ele alınır.

Telefon authority'den aldığı capability'yi PC'ye **yeni full same-key mTLS** application data üzerinden sunar. PC native TLS connection actual peer leaf DER'i handshake tamamlandıktan sonra immutable session context'ine bağlar; leaf SPKI ayrıca fresh SAS snapshot ile eşittir. Telefon PC native leaf key pin'ini doğrular. Caller cert/header/host/session handle token bağının kaynağı olamaz; capability TLS transcript'inde signed sayılmaz.

PC verifier signature/header/registered+domain claims/issuer trust/local grant/version/deny/time gates'i aynı session context'inde değerlendirir. Admitted state key/session/capability bağını taşır; değiştirilmiş grant/capability yeni admission ister. Aynı valid token başka **fresh** legitimate TLS reconnect'te kullanılabilir; captured handshake ve başka peer/context'e token relay ret olur. Admission'ın trusted sonucu caller tarafından manufactured bool/handle ile oluşturulamaz.

Bir gerçek `list` operation yeni geçici PC root'unda known fixture files'ın exact set'ini döndürür; farklı root/op veya admission öncesi request hiçbir filename/data döndürmez. PC local gate kullanılır, UI flag yeterli değildir. Deney full upload/download/commit veya filesystem atomicity implementasyonu değildir; sentinel root dışı veri sızıntısı yokluğu bu sınırlı path için gözlenir, bütün path races çözülmüş denmez.

### 5. Lifecycle, local deny ve tekrar admission

Aynı native SDK key ile **yeni gerçek DER** üretilir; key equality ve DER inequality ölçülür, donor başka-key cert bunun yerine kullanılmaz. Eski token new-cert session'da ret; existing key-bound lab grant/scope değişmeden authenticated authority mTLS reissue new certificate'a bağlanır, yeni token admitted olur.

Local deny veya trusted fixture version advance current session'ın yeni list operation'ını keser; stale token/late allow yeni admission açamaz. Revoked/unknown issuer kid ret; lab authenticated trust update farklı testtir ve exp/window uzatmaz. Bu runtime local gate davranışıdır; durable revoke/commit crash-race veya gerçek merkezi revoke dağıtımı kanıtı değildir.

Restart/cert persistence ve native elapsed continuity uygulanmış gibi gösterilmez. Continuity/time source kanıtı yoksa session/operation online bekler; eski fixture final/journal/key'ler silinmez. Offline `<24h` ve publication policy değişmez ama platform timer/FS proof bu gate'in kapsamına alınmaz.

### 6. KMS prerequisite ve production compatibility kaydı

Bu plan **KMS/hosting/custody provider seçmez veya cloud key oluşturmaz**. Provider/hosting ve gerekli erişim ayrı Ayhan kararıdır. Provider seçilip ayrıca KMS smoke izni verilirse gerçek ES256 Sign→jose/Rust verify, digest-vs-message contract, DER-vs-raw r||s, key export/public trust ve rotation/revoke contract ölçülür; mevcut iki adayla yapılır. Endpoint device key'leri KMS'e verilmez.

Bu bilgi/izin yoksa `kmsFeasibility=not-executed` ve açık prerequisite yazılır; local software key sonucu KMS yerine geçirilmez. Runtime başarısı tek başına ES256'yı final yapmaz. KMS ve runtime sonuçları geldikten sonra provisional statünün kapanması ayrı karar kaydı gerektirir, otomatik production approval değildir.

#1 için Android/iOS/Electron ABI/build/runtime ayrı kaydedilir; [ADR0001](../decisions/0001-mobile-sync-behavior-and-framework-constraints.md) iOS16.4+/Android7+ destek hedefi release compatibility kanıtı değildir. Emulator/simulator fiziksel lock/background/provider, gerçek ağ ve Expo entegrasyonu yerine geçmez; exact API/release minimum compatibility gate'i açıktır.

## Gelecekte yürütülecek doğrulama matrisi

| Senaryo | Gerçek gözlem / beklenen sonuç | Önceki hedef |
|---|---|---|
| Positive native issuance→fresh PC mTLS→authorized list | Token actual enrollment DER'e bağlı; native verified admitted context; exact approved file set | 02/31/32 |
| Possession yok veya ingress cert JS/header'da spoof | Issuance/admission yok; signed token/new authority state yok | 01/02/03 |
| Başka account/phone/PC/role; scope veya op genişletme | Ayrı varyantlarda ret; trusted fixture değişmez; filename leakage yok | 04/05 |
| Signature/claim tamper, wrong issuer/kid/type/alg/curve | Rust gerçek wire verifier ret; token'dan trust config kurulmaz | 27/27a/28 |
| Actual DER hash yerine SPKI/raw-key/root hash | Capability binding ret; ayrı SAS key equality korunur | 31 |
| Trusted root keyA, actual leaf/CV keyB | Native peer leaf pin ret, token signature valid olsa da erişim yok | 03/31b |
| Captured handshake/consumed proof replay; PSK/0RTT | Fresh possession/admission yok; early filenames/data yok | 06/07/08/30 |
| Aynı unchanged valid token ile iki fresh legitimate reconnect | Her biri fresh proof/current authority gerekir; jti global one-shot değil, time window reset yok | 06/07/09 |
| Missing required domain field veya mismatched epoch/version | Ret; fixture migration/reset/permission expansion yok | 04/09/21 |
| exp−epsilon / exp equality / exp+epsilon; nbf before/at | Test-only time bound ile gerçek admission/operation allow/ret sınırı; elapsed production clock kanıtı değil | 09/14 |
| Aynı key/new DER: old token; sonra authenticated reissue | İlki ret, new bound token current same-scope admit; grant key/scope değişmez | 31a |
| Local deny/version ilerlemesi; stale/late allow | Mevcut ve fresh session operation ret; deny eski allow ile kalkmaz | 16/18/18a |
| Unknown/revoked kid; independent trusted rotation | Unknown/revoked ret; sadece configured trusted key update çalışır | 27/28 |
| Unavailable/unknown continuity veya time provider | Online bekle; key/state reset/fallback yok | 14/15/22 |

Bunlar **gelecek execution hedefleri**, şu anda not-executed. Her varyant her uygulanabilir pair'de ayrı kaydedilir; bir Android pass'i iOS pass diye sayılmaz. Önceki36 hedefin tamamı scope coverage ledger'da listelenir; yalnız gerçekten exercised native/runtime alt-gate'ler işaretlenir, unexercised/partially covered hedefler açık kalır. Full36 acceptance pass veya production authorization claim'i yok.

## Çıktılar ve başarı tanımı

Execution sonunda yeni scratch: public source/toolchain hashes, deney profile contract, per-platform issuance/admission rejection kayıtları, actual leaf/key/thumbprint/counter correlation, process command/stdout/exit, supported/adversarial case results ve report. Public evidence'de raw device/issuer public material tutulabilir; token/private signer key, endpoint private key, account credential ve media catalog/bytes log/archive'e girmez. Fresh lab secret state kanıta paketlenmez.

Report ayrımı: `runtimeEs256Interoperability`, `nativeAuthorityEnrollment`, `nativePeerDerSessionBinding`, `issuanceAdmissionFeasibility`, per-platform `supported|fail|blocked|not-executed`, `kmsFeasibility`, `es256Provisional:true`, `platformTlsDeviceKeyProductionGate:open`, `authorityImplemented:false` (**ürün authority'si**), `productionReady:false`, `physicalDevicesValidated:false`, `realPeerNetworkValidated:false`, `sdkPatchRequired:true`, excludedAcceptanceIDs ve unresolvedProductionGates. Yeni scratch lab implementasyonu varsa ayrıca açıkça `labAuthorityImplemented` alanıyla ayırt edilir.

Lab issuance/admission complete ancak real native authority mTLS, actual DER bound real signature, fresh PC-session native validation, positive authorized operation ve listed adversarial/lifecycle gate'leri **Android–PC ve iOS–PC'de gerçekten** gözlendiyse true olabilir. Eksik platform/NodeTLS/KMS sonucu overall production için pass değildir. KMS ayrı statüdür; issuance/admission lab complete olsa da ES256 provisional kalabilir. Sadece standalone token verifier geçerse lab issuance/admission tamamlandı denmez.

Implementation pass sonrasında ayrı review ADR0003/0004, native actual leaf/key trust, Nest katman/FSD ve scope/no-private-export sınırlarına karşı yapılır. Yeni scratch için lint/test/build her artifact stabil olduktan sonra bir birleşik verification geçişinde yürütülür; lab'ın gerçek programlarıyla yukarıdaki path'ler exercise edilir, tests alone kanıt değildir. Review fix çıkarsa sadece affected correction smoke'u yapılır. Proof driver/case runner tekrar üretilebilir deney kaynağıdır; throwaway inspection scaffolds kaldırılır, public evidence/report kalır. Sonraki ürün implementasyonu, KMS veya platform gate closure otomatik başlatılmaz.

## Mevcut plan hazırlığı kanıtı

Planın tarihsel hazırlığı ADR0004, current security design referansları ve ayrı belge review'udur; bu kalıcı aktarım ADR/docs/public evidence'i günceller, ürün/deney code veya mevcut PoC'yi değiştirmez. Runtime/JWT/TLS/KMS/build/test/install/service/device başlatılmadı, production gate kapanmadı. Kaynak/private-state güvenlik sınırı ve execution için ayrı onay gereksinimi değişmedi.

## Ayrı belge review — tamamlandı

Yazımdan sonra `ApprovalRecordReview` kullanıcı onayının dört koşulunu ve current/historical ADR ayrımını, `IssuancePlanReview` native kaynaklara karşı uygulanabilir deney sırasını ve trust/başarı sınırlarını değerlendirdi. Living design gate tablosunda kalan “NestJS rolü öneri” çelişkisi düzeltildi; dar follow-up review finding'in kapandığını doğruladı. Plan review'da actionable finding yok.

ADR relative link hedefleri ve living design/plan→ADR0004 referansları belge smoke'unda çözüldü. Bu review ve belge smoke'u **runtime, platform/TLS/device-key veya KMS feasibility kanıtı değildir**. Execution ayrıca onay bekler.
