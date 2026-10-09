# Kloda — 2B kaynakla sınırlı karar paketi

## Statü ve izin sınırı

**Güncel statü — [ADR0013](../decisions/0013-qr-based-local-lan-pairing.md): backend-independent QR LAN trust kabul, implementation not executed.** ADR0012 P-256 identity ve D03-A native DER persistence korunur. D01 Matrix/upstream/fork seçenekleri historical/non-actionable; current roadmap task veya gate değildir. D02 issuer/KMS ve D04 platform/time/authority kapsamı açık; backend issuer/login seçimi initial offline QR trust blocker'ı değildir. Tam2B/adoption/production proof veya feasibility execution onayı yok. [KLODA-QR-PAIR-V1](../security/qr-pairing-v1-protocol.md) protocol bytes/minimum native behavioral contract frozen; actual platform API/ABI/adoption/integration unverified; [QR roadmap](qr-pairing-implementation-roadmap.md) future implementation sırasını korur.

Dayanak: [1A/2A preparation](issuance-admission-preparation.md), [2A production araştırması](../security/production-readiness-research.md), [production gates](../security/production-gates.md), [capability profile](../security/capability-profile.md), [ADR0004](../decisions/0004-certificate-bound-capability-and-authority-responsibilities.md) ve [ADR0007](../decisions/0007-matrix-verification-and-device-continuity.md). Yeni paket mevcut2A source map/version/access-date/evidenceLimit kayıtlarını kullanır; yeni upstream release, provider veya runtime sonucu doğrulanmış sayılmaz. find-docs skill okundu; install/cache yazabilecek npx/Context7 çalıştırılmadı.

| Bağımlılık | Gözlenen durum | Bu pakete etkisi |
|---|---|---|
| Historical 1A exact native source/spec | Eski Matrix-key plan blocked; original archive/final corpus eksik | Eski ABI/frame/backend/driver uydurulamaz; full corpus recovery yeni Kloda P-256 prerequisite'i değildir |
| Historical 1B/1C ve ilgili1D runtime bulguları | not-executed;1D yalnız blocked-result documentary delivery | Eski plan P-256/hardware/SAS↔Kloda-key/session acceptance olarak yürütülemez; pass aktarılmaz |
| Tamamlanmış 2A | Dört hat tamam; overall source-limited | Historical source context yeniden araştırılmaz; yeni yön için yalnız dar source-backed prerequisite gerekir |
| Gerçek KMS/provider | Seçilmedi; actualKMS not-executed | API örneği sağlayıcı seçimi veya issuer entegrasyonu değildir |

## D01 — SDK signer ve native dağıtım yönü

**Historical source-confirmed:** crypto0.19.1 `OlmMachine::sign(&str)` room-key-backup intended-use/device+available-master signature API'sidir; arbitrary TLS byte/device-only public signer değildir (2A S01–S04/S10). İki-method byte patch yalnız eski scope'ta historical-runtime kanıtıdır. Apple cryptoFFI0.17, Node0.6.6/core0.18 ve WASM18.9/core0.19.1 aynı minimal native release değildir (S05–S08). Aşağıdaki seçenekler archival/non-actionable; Matrix SAS package/binding/target feasibility dahil hiçbir current QR prerequisite üretmez.

| Seçenek | Tradeoff | Onay neye izin verebilir / neye vermez |
|---|---|---|
| D01-A: upstream-first supported byte API yolu — historical kabul, retired/non-actionable | Historical upstream acceptance/matching auth bindings kanıtlanmış değil | Current roadmap, contribution/publication veya release adoption işi/izni değil |
| D01-B: maintained minimal fork + native bindings — historical, seçilmedi/non-actionable | Historical release/patch maintenance sorumlulukları değerlendirilmişti | Current fork/research/release task veya dependency değil; repo/fork oluşturma/install izni yok |

**Güncel yön: D01 product auth dependency retired.** Maintained fork seçilmedi; upstream ret otomatik fork, mandatory migration veya Kloda blocker yaratmaz. Historical patch ve matching arbitrary-byte distribution yeni P-256 identity proof'u değildir.

**Current cutover:** Matrix/SAS/Olm/SDK dağıtımı ve SAS↔Kloda binding aktif path'ten çıkarıldı. İlk trust actual mutual TLS1.3 P-256 possession, QR PC SPKI equality, same-channel secret proof, PC approval ve durable local pins ister. Backend registry veya caller `trusted=true` pin yaratmaz; pairing-only channel için preexisting file capability gerekmez, file admission için capability/time/scope/deny/fence hep gerekir.

## D02 — Issuer/KMS: provider seçimi öncesi integration veto

**Source-confirmed:** jose6.2.12 `SignJWT.sign(key, options)`→CompactSign→FlattenedSign→WebCrypto key-based signing yapar; remoteKMS callback/external-signature input yok (2A K-S10). AWS Sign/GetPublicKey (K-S05/K-S06) yalnız P256/SHA256, RAW/DIGEST, DER signature/SPKI public metadata örneğidir. İki kaynak birleştirilince supported nonexport remote signing integration elde edilmiş olmaz.

**Karar hazırlığı sonucu:** bugün source-backed executable production issuer çözümü sunulamıyor. Provider isimleri arasında seçilecek kanıtlı entegrasyon adayları olmadığı için AWS/Azure/Google shortlist veya fiyat/SLA sıralaması uydurulmadı. AWS seçili değildir. “Nonextractable CryptoKey” ile “remoteKMS Sign'e supported delegation” aynı iddia değildir.

| Yön | Durum ve tradeoff |
|---|---|
| Mevcut pinned JOSE/verifier sınırında documented nonexport runtime key/handle yolu araştırmak | Desteklenen somut provider/runtime entegrasyonu source-confirmed olursa değerlendirilebilir; mevcut2A bunu bulmuş/kanıtlamış değildir. Uyumluluk çıkmazsa blocked kalır; geçici private export/local software fallback yok |
| Supported remote-signing API için upstream/library sınırı değişikliği önermek | Gerekirse Ayhan'a ayrı architecture/dependency seçenekleri sunulmalı; bu pakette üçüncü stack, fork/patch API veya manualJOSE seçilmedi. “Sağlayıcı Sign var” bu değişikliğin güvenlik/maintenance evidence'ı değildir |

**Öneri:** provider/custody/hosting seçimini supported integration prerequisite çözülene kadar ertele. Bu teknik seçim önerisi, yeni araştırmanın execution-ready olduğu veya mevcut library sınırının değiştirildiği anlamına gelmez. Native issuer ingress+actual cert possession ve gerçek account/PC approval provenance ayrıca G04/G05'tir; Sign başarısı authority değildir.

Gerekli integration dosyasında gelecekte key custody/handle sahibi, exact signer interface/supported version, compact signing input/DER-R+S conversion owner, public import/one Rust backend, token-outside issuer trust bootstrap, IAM/audit/rotation/revoke ve workload/proxy boundaries source-backed olmalı. KMS-ISSUER-PATH olmadan yalnız KMS-INTEROP sonucu issuer-ready değildir. Exact cloud/account/region/key veya proxy/token schema burada seçilmez; actualKMS/runtime olmadan ES256 provisional kalır. Signer hosting, G10/G11 remote file transport/provider kararını seçmez.

Backend login JWT yalnız user session'dır; signed capability ayrı device/PC/scope/expiry authorization taşır. Exact capability format bu cutover'da seçilmedi; önceki JOSE/JWS araştırması format adoption değildir. Server ES256 provisional + gerçek KMS gate'i device P-256 identity'den ayrı kalır; aynı curve key/role/custody equality değildir.

## D03 — Certificate DER persistence veya startup online bağımlılığı

**Korunan LAN sınırı:** signed capability actual exact full leaf DER'e bağlı; same-key/newDER eski capability'yi taşımaz ve authenticated online reissue ister. Engine cache persistence proof değildir. Initial QR LAN için PC Kloda P-256 key actual live TLS SPKI'dır; QR canonical SPKI hash'i capability full-DER hash'i değildir. [V1 minimum native behavior frozen](../security/qr-pairing-v1-protocol.md), actual native pin/channel API/ABI mapping ve integration açık; remote DTLS'ye cnf profili otomatik taşınmaz.

| Seçenek | Tradeoff | Sınır |
|---|---|---|
| D03-A: exact certificate DER'i native lifecycle altında persist et; renewal online authenticated reissue ile — yön kabul edildi | Normal restart'ta sırf yeniDER üretimi nedeniyle capability kaybından kaçınmayı hedefler. Persistent record/key/epoch/store consistency, expiry, atomic publication ve OS backup/restore davranışı ayrıca tasarım+runtime kanıt ister | AynıDER tek başına offline authority değildir: valid capability, Kloda key/pin/pairing/epoch/authority continuity, trusted absolute+elapsed bound, deny/version/scope ve actual fresh authenticated TLS hep gerekir; Matrix SDK DB-only loss bu continuity'yi otomatik bozmaz |
| D03-B: her process start'ta farklıDER cert üret; tekrar authenticated online issuance bekle — seçilmedi | Persistent cert record sorumluluğunu azaltır, fakat farklıDER eski capability'yi reddettirir; restart sonrası center unreachable olduğunda bu capability ile admission mümkün değildir (policy-derived sonuç, runtime gözlemi değil) | Restart/offline usability maliyetinin Ayhan tarafından açık kabulü gerekir. Scope/epoch/time window reset, silent replacement identity veya cert binding bypass yok |

**Kabul edilen yön: D03-A; exact storage/API kararı henüz değil.** Native DER persistence center unreachable fakat PC erişilebilirken gereksiz yeniDER bağımlılığını azaltmayı hedefler; PC offline ise admission sağlayamaz. Reboot/reinstall sonrası kesintisiz offline çalışma garantisi değildir. Selected current P-256/native lifecycle source contract'ı olmadan dosya formatı/OS key class/transaction ABI seçilemez; eski Matrix final corpus recovery beklenmez. Yön kararı persist/renewal implementation'ı veya fiziksel proof değildir.

Seçimden sonra LIFE-CERT: sameDER restart→tüm diğer gate'lerle admission; samekey/newDER+oldtoken→ret; eligible authenticated reissue→same-scope admission. LIFE-EPOCH/LIFE-BACKUP/LIFE-PROVIDER/LIFE-TIME failure varyantları geçmeden production adoption yok; cert expiry veya ret durumunda eski token uzatılmaz.

## D04 — Platform ve continuity kararlarının kanıt sınırı

Safety policy korunur: iOS16.4+/AndroidAPI24 hedefi, per-run userPresence zorlamama ve transient provider→wait/no reset. Eski software-only Matrix identity modeli superseded; Kloda P-256 hardware-preferred yönü Secure Enclave/StrongBox/TEE/TPM exact API, non-exportability, encoding, coverage ve noninteractive/background proof ister. Hardware availability/fallback/Linux policy seçilmedi; minimum/current physical cihaz, Windows/macOS/Linux support ve signed release artifact'leri açık. Eski URLSession/same-SDK-key araştırması yeni P-256 background compatibility proof'u değildir.

Android physical hardware-backed P-256→TLS1.3 CertificateVerify alt-gate'i **CLOSED/PASS (SM-S921B/API36)**; yalnız cihaz-local native TLS server/client kanıtıdır. [Production gates](../security/production-gates.md) kaydı korunur; actual Android↔PC LAN/final app/Rust bridge, iOS physical, desktop hardware/background ve aggregate G01 kapanmaz. Bu tur rerun yok.

| İleride Ayhan'ın seçeceği implementation/deployment alanı | Şimdiki karar engeli / gerekli kanıt |
|---|---|
| Exact platform binding/toolchain/desktop supported release matrix | Matching locked native artifact ve minimum/current OS proof; source floor destek iddiasına dönüştürülmez, mobile minimum daraltılmaz |
| Noninteractive hardware provider/key custody ve Linux/fallback policy | Source-backed exact API/encoding/target coverage + physical locked/missing/provider/background proof; plaintext/export veya silent second identity fallback yok |
| Epoch/authorization + Kloda key/local peer pin/pairing/certificate consistency owner, OS paths/backup exclusion | Required identity/pin/pairing/epoch continuity kaybında fresh local QR trust + gerekli ayrı online authorization/new grant; offline QR trust file grant yaratmaz. Hardware key retention tek başına continuity değildir |
| Trusted absolute-time ve elapsed upper continuity design | elapsedRealtime/ContinuousClock local support; cross-reboot trust kanıtı yok. Unprovable continuity→online wait, timer/t0 reset yok; full software rollback detection garanti edilmez |
| Certificate renewal/transaction implementation ve recovery/restore operator flow | D03 yönü + selected current source/ABI + real lifecycle proof; eski corpus recovery zorunlu değil. Renewal scope/time grant genişletmez; restore suspicion fresh QR re-trust ve gerekli online authorization ister |

**Öneri:** bu exact API/storage/deployment seçimlerini platform kanıtı olmadan selected gösterme. Accepted fail-closed politika korunur; özellik kapsamı sessiz azaltılmaz. PC final normal dosyalarına epoch/private-store backup exclusions uygulanması önerilmez.

## Onay sırası ve değişmeyen gate'ler

1. [ADR0012](../decisions/0012-kloda-owned-p256-device-identity.md) D01 auth gate'ini retired, D03-A native DER persistence'i retained yaptı; ADR0008 historical D01 yönünü kaydeder. Byte signer contribution/fork/release beklemek Kloda prerequisite'i değildir.
2. D02 issuer integration/provider/custody/hosting ve D04 platform/storage/time/background/fallback kapsamı açık; backend issuer/login initial offline QR trust blocker'ı değil. Device identity/trust file authority değildir.
3. Dependent native pairing için [frozen V1](../security/qr-pairing-v1-protocol.md) ve [QR roadmap](qr-pairing-implementation-roadmap.md) esas alınır; actual mutual TLS/PC SPKI equality, same-channel secret proof, atomic reservation/approval/consume+pins/ACK recovery implementation ve selected provider ownership/source/API/ABI proof gerekir. Remote binding ayrı; Matrix/SAS/upstream/fork gate yok.
4. Eski1A/1B/1C/1D driver/spec yeniden yazılmaz veya P-256 acceptance olarak yürütülmez; full historical corpus rebuild gerekmez. Yeni prerequisite ve D02/D04 kararları source-backed olmadan dependent code/2C hazır değildir; ayrı gerçek cloud/device/execution izinleri korunur. Fake ABI/opaque trust factory veya local/simulator ikame yok.

`experimentExecuted:false`; `runtimeEs256Interoperability:not-executed`; `nativeAuthorityEnrollment:not-executed`; `nativePeerDerSessionBinding:not-executed`; `kmsFeasibility:not-executed`; `es256Provisional:true`; `productionReady:false`.36 acceptance hedefinin tamamı not-executed; G01/G02/G03/G05/G06/G09 ve physical/diğer gate'ler açık. Bu paketi hazırlamak1D, tam2B veya2C done demek değildir. Ürün code/manifests/locks, private state veya historical archive değişmedi; build/test/install/service/device/cloud işlemi yok.

## Yazım sonrası doğrulama

**Historical ADR0008-era kayıt:** aşağıdaki smoke/review ADR0012 cutover'ını doğrulamaz; bu değişiklikte yeni check çalıştırılmadı.

Kullanıcı seçimi ve canonical handoff sonrası read-only JS documentation smoke: altı changed belge içinde **82 relative-link occurrence** mevcut dosya hedefine, **1 heading anchor** gerçek Markdown başlığına çözüldü; **22 source-map ID** 2A provenance tablosunda bulundu. D01-A/D03-A accepted yönleri ile D01-B/D03-B nonselected sınırı, altı ilgili gate'in open/provisional/not-executed kalması ve36 exact unique authority ID'nin not-executed/unexercised durumu doğrulandı. External URL availability, source/archive hash veya runtime revalidation yapılmadı.

Ayrı yazım-sonrası manual review ADR0004/0007 ve profile continuity sınırına karşı yapıldı: D01 release/adoption değil bakım yönü; D02 integration eksikliğini KMS primitive desteğiyle kapatmıyor; D03 aynıDER ile diğer authority/time/continuity gate'lerini bypass etmiyor. Review sırasında PC offline ile center unreachable ayrımı netleştirildi: persist cert offline PC'yi erişilebilir yapmaz. D01/D03 kullanıcı seçimi ADR0008'e kaydedildi; exact storage/API, destek hedefi, provider veya execution izinleri kendiliğinden seçilmedi.
