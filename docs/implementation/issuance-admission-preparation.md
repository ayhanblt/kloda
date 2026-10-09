# Issuance/admission — 1A/2A hazırlık kaydı

## Kapsam ve baseline

Bu preparation kaydının ilk onayı yalnız1A/2A hazırlığı, kaynak araştırması ve belge yazımı içindi. **Güncel yön [ADR0013](../decisions/0013-qr-based-local-lan-pairing.md) + [future-only QR roadmap](qr-pairing-implementation-roadmap.md); implementation not executed.** ADR0012 P-256 identity korunur; eski Matrix-key issuance/mTLS1A/1B/1C/1D spec/driver/coverage historical/superseded ve execution'a açılmaz. ADR0009 bağımsız prerequisite-ready implementation yönünü korur; eski corpus recovery veya bu docs cutover'ı ürün/native/feasibility execution izni değildir.

Sınıflar: **source-confirmed** okunan exact source/statement; **historical-runtime** geçmiş scoped deney kaydı, rerun değil; **unverified** mevcut native/runtime/production kanıtı yok; **blocked** somut eksik prerequisite. Kaynak erişimi/URL/sürüm/hash bilgisi iddiaya scope edilir; source desteği runtime kanıtı değildir.

**Güncel dar prerequisite:** [KLODA-QR-PAIR-V1](../security/qr-pairing-v1-protocol.md) QR payload/lifecycle, exact HMAC/exporter/encoding ve minimum native behavioral contract frozen / implementation not executed. Native P-256 mutual TLS1.3 possession ve QR PC canonical SPKI hash = actual TLS key, same-channel secret proof, PC approval, atomic reservation/durable consume+pin ve ACK recovery için actual platform API/ABI/adoption/integration unverified. Matrix/SAS SDK, SAS-key binding, upstream/fork current task/gate yok. Backend registry pin yaratmaz; local pins anchor'dır. Remote signaling/WebRTC/DTLS proof ayrı kalır.

LAN exact-DER certificate-bound capability/reissue + D03 persistence korunur; capability DER hash'i QR SPKI hash'i değildir. Backend login JWT user session, signed capability ayrı file authorization'dır. Initial QR trust internet/backend/login/KMS olmadan tamamlanabilir; account eligibility/step-up/scope/capability/time/deny/fence koşullarını kaldırmaz. D02 issuer/KMS ve D04 platform/time/background/release açık, initial trust'a backend blocker olarak taşınmaz.

Required Kloda identity/pin/pairing/epoch continuity kaybı veya restore suspicion fresh QR re-trust + gerekli online authorization/new grant ister; hardware retention tek başına continuity değildir. Android device-local hardware P-256→TLS1.3 CertificateVerify **CLOSED/PASS (SM-S921B/API36)** [gate kaydı](../security/production-gates.md) dar alt-gate'idir; actual Android↔PC LAN/final app/native bridge/iOS physical/desktop/authority gate'leri kapanmaz; bu tur rerun yok.

**Aşağıdaki kaynak/env/hash ve1A lab tabloları historical scope'tadır.** Eski source/ABI/driver boşlukları eski spec'i blocked tutar; yeni identity protocol'ünü seçmez. Counts/hash'ler korunur, historical SAS/TLS pass authority/P-256/hardware/session proof'una aktarılmaz.

## Onay sırasında doğrulanmış kaynak engeli

**1A blocked:** `/tmp/kloda-same-key-tls.hjUS9L` için read-only kontrol `Path not found` verdi. Historical recovery pointer archive'ı aynı root altındaki `proof.tar.gz` olarak kaydeder. `/tmp/kloda-same-key-tls*`, `/tmp/*proof*.tar.gz`, repository `**/proof.tar.gz;**/sdk-byte-signer.patch` filename araması başka kopya bulmadı. Bu kontrollü lokasyonlarda yokluk, global irrecoverability değil.

Gereken public archive SHA256: `db9e72a619acb9b619f0912978d4c8fdd45de0ffab9d5e4d35d3f3c873adc241`; historical patch SHA256: `5b56cfe81e41fd7f31e32d20ffa829f7315b8b3699e979379f0255b46b45cc87`. Kaynak: [native evidence provenance](../security/poc-native-verification-evidence.md), §Kaynak haritası/hash. Bunlar expected historical digest, bugün erişilemeyen byte'ların rehash'i değil. Public source tekrar erişilebilir olmadıkça exact native ABI/driver/callsite/frame/backend/limit planı ready sayılamaz; eski source tahminle yeniden yazılmaz.

Public kaynak geri gelirse önce archive digest doğrulanır, yalnız source/manifests/lock/patch/scripts/public sanitized report üyeleri isim allowlist'iyle okunur. Private DB/WAL/SHM/key/epoch/wrapper/runtime state/binary/credential açılmaz; tüm archive extraction veya eski suite replay yok. Digest mismatch blocker'dır; historical evidence yeni byte'lara aktarılmaz.

Sonraki onaylı [local retention/recovery sonucu](../security/evidence-retention-and-recovery.md): SDK byte-signer patch'in tam34 satırı historical SHA256 ile **byte-verified** kurtarıldı; `.local-evidence/` altında Git dışı1-member recovery paketi ve84-row inventory tutuluyor.57 complete-unverified/23 incomplete/3 missing row final source/caller/lock manifest proof'u değil; native-base ve TLS revision adayları ayrılıyor. Eski archive SHA'sı geri gelmedi, `historicalArchiveRecovered:false`, `nativeExecutionSpecReady:false`; **1A blocked** sürüyor. Bu update historical toolchain/suite rerun değildir.

## 1A — erişilebilir kaynak ve araç envanteri

Araştırma erişim aralığı: **2026-10-05T07:03:26Z–07:06:42Z**, `/bin/date -u` / `date -u` çıktıları. `find-docs` skill okundu; bu onay `npx`/install/cache yazımını yasakladığı için Context7 CLI çalıştırılmadı, **resmî tagged-source / versioned Node docs / RFC reader** kullanıldı. Aşağıdaki source-confirmed bulgular bir sign/verify/TLS API runtime deneyi değildir.

Kullanıcı recovery konumu olarak `docs/security/proof.tar.gz` bildirdi. Parent'ın bu konumdaki direct read/filename glob/hash denemesi henüz dosya erişimi sağlamadı; bu, bildirilen konumun yanlışlığı veya global irrecoverability iddiası değildir. Bu envanter historical `/tmp` eksikliğini yeniden test etmedi. Public archive erişilebilir olursa yukarıdaki expected digest ile doğrulama ve source allowlist incelemesi önce gelir. Hash/yer yeniden doğrulanmadan source-ready statüsü verilmez.

Recovery gözlemi: kullanıcı `/Users/ayhanblt/Desktop/projects/kloda/docs/security` konumunu bildirdi; parent `shasum -a 256 docs/security/proof.tar.gz` ile hash okumayı denedi, **No such file or directory**, exit1. Direct directory read ve security/docs subtree filename glob'ları arşiv bulmadı; daha sonraki absolute-path `stat` da **No such file or directory**, exit1 verdi. Bu yüzden SHA256 karşılaştırması/member inspection yapılmadı. Kullanıcının dosyayı bildirmesi korunur; araçların dosyaya erişememesi yalnız bu preparation ortamının erişim blocker'ıdır.

### Safe path/version çıktıları — ortam erişimi, deney değil

Önce `command -v` ile entrypoint'ler bulundu; `/usr/bin/stat -f '%N: %HT %Y'` Rust symlink'lerini Homebrew binary'lerine çözdü. Rustup shim çalıştırılmadı, exact mevcut compiler binary'leri kullanıldı. `xcode-select -p` mevcut Xcode seçimini gösterdikten sonra yalnız `xcodebuild -version` çalıştırıldı. Shell zincirlerinin çıkış kodu **0**; Node/npm/Rust/Cargo/Java/Xcode version dışında derleme/target query CLI/device discovery yok.

| Araç | Bulunan path / exact salt-okunur komut | Gerçek stdout | evidenceLimit |
|---|---|---|---|
| Node | `.nvm/versions/node/v22.23.1/bin/node --version` | `v22.23.1` | Jose/WebCrypto/OpenSSL interoperability çalıştırılmadı |
| npm | `.nvm/versions/node/v22.23.1/bin/npm --version` | `10.9.8` | npm script/install/npx çalıştırılmadı |
| PATH Rust | `/opt/homebrew/bin/rustc` → `/opt/homebrew/Cellar/rust/1.98.1/bin/rustc --version` | `rustc 1.98.1 (48a229cea 2026-09-01) (Homebrew)` | Historical native1.99.0 ile aynı compiler değil |
| PATH Cargo | `/opt/homebrew/bin/cargo` → `/opt/homebrew/Cellar/rust/1.98.1/bin/cargo --version` | `cargo 1.98.1 (797e8a9bc 2026-08-05) (Homebrew)` | Resolve/fetch/build yok |
| PATH Rust sysroot | `/opt/homebrew/Cellar/rust/1.98.1/bin/rustc --print sysroot` | `/opt/homebrew/Cellar/rust/1.98.1` | Directory read yalnız `aarch64-apple-darwin` target lib gösterdi |
| Existing exact Rust | `.rustup/toolchains/1.99.0-aarch64-apple-darwin/bin/rustc --version` | `rustc 1.99.0 (b940084d7 2026-09-28)` | Rustup auto-install shim kullanılmadı; source/build uyumluluğu unverified |
| Existing exact Cargo | aynı toolchain `bin/cargo --version` | `cargo 1.99.0 (5f94df478 2026-08-27)` | Native build yürütülmedi |
| Xcode seçimi | `/usr/bin/xcode-select -p` | `/Applications/Xcode.app/Contents/Developer` | First-launch/install/xcrun/simctl yok |
| Xcode | `/usr/bin/xcodebuild -version` | `Xcode 27.0`; `Build version 27A266a` | SDK mevcut olması simulator/device erişimi veya eski OS desteği değildir |
| Java | `/opt/homebrew/Cellar/openjdk@17/17.0.19/libexec/openjdk.jdk/Contents/Home/bin/java --version` | `openjdk 17.0.19 2026-04-21`; `OpenJDK Runtime Environment Homebrew (build 17.0.19+0)`; `OpenJDK 64-Bit Server VM Homebrew (build 17.0.19+0, mixed mode, sharing)` | Gradle/daemon yok |
| javac | aynı JDK `bin/javac --version` | `javac 17.0.19` | Compile yok |

Path tablosunda home prefix yalnız kısaltıldı; komutlar mevcut kullanıcı home altındaki exact absolute binary'lerle çalıştı. `command -v rustup` `/opt/homebrew/bin/rustup` döndürdü; stat symlink hedefi `/opt/homebrew/Cellar/rustup/1.29.1/bin/rustup`, ancak rustup çalıştırılmadı.

Filename/directory-only inventory şunları gösterdi:

- Existing Rust1.99.0 target lib directories: `aarch64-apple-darwin`, `aarch64-apple-ios-sim`, `aarch64-linux-android`. Existing stable toolchain yalnız host target lib directory gösterdi. Bu std/lib dosyalarının mevcut olması ABI compile/link/runtime pass değildir; physical iOS target kanıtı verilmez.
- Android SDK metadata paths: platforms `android-33`, `android-33-ext4`, `android-35`, `android-36`; NDK `23.1.7779620`, `25.0.8775105`, `26.1.10909125`, `27.1.12297006`. Okunan `android-35/source.properties` = Android15/API35/revision2; okunan NDK27 metadata = `Pkg.Revision=27.1.12297006`, `Pkg.ReleaseName=r27b`. Diğer directory adları içerik/version doğrulaması değil filename bulgusudur. API24 platform bulunmuş gibi sunulmaz.
- Xcode iPhoneOS/iPhoneSimulator/MacOSX `SDKSettings.json` DisplayName'leri sırasıyla **iOS27.0 / Simulator–iOS27.0 / macOS27.0**. Simulator runtime availability, provisioning, physical attached target, API floor ve minimum/current OS runtime kontrol edilmedi.
- Repo filename inventory `package.json` ve mobile module `build.gradle` buldu; erişilebilir native PoC `Cargo.toml`, ABI driver veya patch yerine bunlar kullanılmadı.
- `adb`, emulator, `simctl`, device list, serial, fullenv, private store/key/epoch/state, cloud/account API denemesi yapılmadı. Ortam eski historical ortamla eşit varsayılmadı.

### Local public provenance — snapshot hash

Erişim: yukarıdaki araştırma aralığı; `/usr/bin/shasum -a 256` çıkış0. Hash erişilebilir **belge/metadata byte'larını** sabitler; historical archive byte'larını veya runtime sonucu tekrar kanıtlamaz. Feasibility hash parent'ın sonraki integration edit'inden **önceki** snapshot'tır.

| Public local kaynak / section | SHA256 | evidenceLimit |
|---|---|---|
| `docs/security/capability-acceptance.md`, exact01–32+18a/27a/31a/31b rows | `db30d3a84000e866b3aec2e561f4e578cd1e1a14c4e0efa4b35f423c1cedf29e` | Policy/future targets,36 runtime pass değil |
| `docs/security/capability-profile.md`, §§Trusted provenance/Capability/Session admission | `b93ad1aa1a7e5760bfa0a069bb45f195a16c518b9f326f79c1bcab34b731f39c` | Production grammar/API implementasyonu değil |
| `docs/security/poc-native-verification-evidence.md`, §§3/Kaynak haritası | `8ad8ae4996ce53542462d194aceae277999589374e9551627d9aa42eebaa04db` | Historical-runtime summary; actual source/ABI yerine geçmez |
| `docs/implementation/issuance-admission-feasibility-plan.md`, §§Uygulama sırası/Gelecekte yürütülecek doğrulama matrisi | `3a34f15a2caf8ff6aa0071e1f409e3479cf27a3034f2dd7f2d8ff0029409f181` | Historical plan snapshot, approved execution değil |
| ADR0003, §§24 saat/İptal/recovery | `565c2787d3287eadb11283f3ba0b9ba38fbce78bcbd341231c835907af951d08` | Accepted policy only |
| ADR0004, §§1–4 | `ff35d0291b39ff7c6c360b61d0d32de3102430ddad928ba76f881b75e2a47065` | ES256 provisional/native authority unverified |
| ADR0007, §§Kabul edilen sınırlar/Açık production gate'ler | `c674fe05fe97ec14f9b83aec8ca319c82da724f6225d8ea9d5dfbff463ed7e55` | Continuity policy, physical proof değil |
| Android SDK `platforms/android-35/source.properties`, ApiLevel/Revision | `2c3764446f335ad2cc44383a0360fe247620b7c774ec100d5087771ac8ed3b28` | Installed SDK metadata only |
| Android NDK `ndk/27.1.12297006/source.properties`, Revision/ReleaseName | `e9b907b9c90bc2f0aaa87049580cc0c3ee0bb6aff50b58e4d1a8876ba3aeb026` | Installed NDK metadata only |
| Xcode `Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS.sdk/SDKSettings.json`, DisplayName | `2227b37c40c85b24d2b9ade62cdf8f6a889f1ff36e79019a2d5136264768f112` | SDK metadata, device support değil |
| Xcode `Platforms/iPhoneSimulator.platform/Developer/SDKs/iPhoneSimulator.sdk/SDKSettings.json`, DisplayName | `b8c86f02919d336244af1509b95b3bdaf9fd1151ee97ba188f5f77b301ed4a1e` | SDK metadata, launched simulator değil |
| Xcode `Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk/SDKSettings.json`, DisplayName | `7b93ad7e534cc4b31c6a4e39d19b5e0288acf2168c2649479a796d1cb51939fb` | SDK metadata, Electron native build değil |

## 1A — exact candidate source incelemesi

Bu bölümün her URL'si **2026-10-05T07:03:26Z–07:06:42Z** aralığında reader ile açıldı. Jose `package.json` version **6.2.12**, Rust `Cargo.toml` version **10.1.0** doğrulandı. GitHub tag-tree cevapları Jose `505a55b8f73536082367b2614cb77e927ba96ec1`, Rust `655abeb971208fb5771a40e2fba66a937fa20f86` tree kimliklerini döndürdü ([Jose tree](https://api.github.com/repos/panva/jose/git/trees/v6.2.12?recursive=1), [Rust tree](https://api.github.com/repos/Keats/jsonwebtoken/git/trees/v10.1.0?recursive=1)); bunlar tree SHA, checkout commit/hash veya package lock digest'i diye etiketlenmez.

| Kaynak / exact version / section-symbol | source-confirmed bulgu | evidenceLimit |
|---|---|---|
| [Jose package](https://raw.githubusercontent.com/panva/jose/v6.2.12/package.json), v6.2.12 `type/exports/main` | ESM, `dist/webapi` entrypoint; ayrı Node crypto backend seçimi yok | Installed package veya native runtime test değil |
| [Jose dispatch](https://raw.githubusercontent.com/panva/jose/v6.2.12/src/lib/jws_algorithms.ts), `JWS` / `ecdsa` | `ES256` = EC/P-256, ECDSA/SHA-256; `EdDSA` ve exact `Ed25519` ayrı identifier entries | ES256 allowlist ayrıca gerekir; destek bütün alg'leri kabul etmek demek değil |
| [Jose signer](https://raw.githubusercontent.com/panva/jose/v6.2.12/src/lib/jws_sign.ts), `createSignature/createCompactSignature` | `base64url(protected).base64url(payload)` exact signing input, `crypto.subtle.sign`, compact3 segment | Gerçek software signature/JWS64byte interoperability not-executed |
| [Jose verify](https://raw.githubusercontent.com/panva/jose/v6.2.12/src/lib/jws_verify.ts), `prepareVerify/verifySignature/verifyCompact` | Configured algorithms set header alg'i kısıtlar; `crypto.subtle.verify`; compact3 segment; key resolver çağrısı authentication öncesinde | Resolver/token header trust kaynağı olamaz; app authorization yok |
| [Jose import](https://raw.githubusercontent.com/panva/jose/v6.2.12/src/key/import.ts), `importJWK/importSPKI` + [key core](https://raw.githubusercontent.com/panva/jose/v6.2.12/src/lib/key.ts), `jwkToKey/rawKey/checkCryptoKey` | Public EC JWK veya PEM SPKI import; WebCrypto JWK import + expected ECDSA/P-256/usage checks | Native issuer bootstrap veya actual KMS key import ölçülmedi |
| [Jose JWT verify](https://raw.githubusercontent.com/panva/jose/v6.2.12/src/jwt/verify.ts), `jwtVerify` | Signature sonra claims validation; JWT unencoded payload ret | Native peer cert/domain grants bağlanmaz |
| [Jose claims](https://raw.githubusercontent.com/panva/jose/v6.2.12/src/lib/jwt_claims_set.ts), `validateClaimsSet` | `requiredClaims` own-property presence; issuer/subject/audience options presence de ister; exp `<=now−tolerance` ret, nbf `>now+tolerance` ret; default tolerance0; `currentDate` injection | Single floored wall-clock instant, conservative interval değil; presence-only domain/jti/cnf type validator değil |
| Aynı Jose claims, `normalizeTyp/JSON.parse` | `typ` lowercased ve `application/` prefix normalize edilir; payload JSON.parse kullanır; `iat` numeric-type check, maxTokenAge varsa age check | Exact-byte protected-type equality ve duplicate rejection otomatik varsayılmaz; `requiredClaims:['cnf']` nested thumbprint kontrol etmez |
| [Rust manifest](https://raw.githubusercontent.com/Keats/jsonwebtoken/v10.1.0/Cargo.toml), v10.1.0 `features/rust-version` + [lib](https://raw.githubusercontent.com/Keats/jsonwebtoken/v10.1.0/src/lib.rs), cfg compile_error | MSRV1.85/edition2024; default yalnız `use_pem`; `rust_crypto` ve `aws_lc_rs` tam **biri** gerekli, ikisi birlikte/yok compile_error | Native source/lock yokken final backend/feature pin yapılmadı |
| [Rust algorithms](https://raw.githubusercontent.com/Keats/jsonwebtoken/v10.1.0/src/algorithms.rs), `Algorithm/FromStr` | ES256/ES384 ve EdDSA mevcut; exact `Ed25519` identifier yok | Legacy alias/downgrade veya üçüncü stack seçilmez |
| [Rust decoding](https://raw.githubusercontent.com/Keats/jsonwebtoken/v10.1.0/src/decoding.rs), `from_ec_components/from_jwk/from_ec_der/decode/verify_signature_body` | x/y base64url decode→`0x04 + x + y` concatenated SEC1; from_ec_der byte'ı aynen saklar, SPKI parse etmez; from_jwk EC x/y alır ama curve metadata'yı bu branch'te kontrol etmez; decode signature/algorithm sonra typed claims+standard validation | Trusted import wrapper EC/P-256/x/y32byte/metadata'yı ayrıca denetlemeli; token JWK import yok |
| [RustCrypto ECDSA](https://raw.githubusercontent.com/Keats/jsonwebtoken/v10.1.0/src/crypto/rust_crypto/ecdsa.rs), `Es256Verifier/define_ecdsa_verifier` | P256 `VerifyingKey::from_sec1_bytes`, `Signature::from_slice`, `Verifier::verify` | Runtime key/signature parsing veya platform-link success değil |
| [AWS-LC ECDSA](https://raw.githubusercontent.com/Keats/jsonwebtoken/v10.1.0/src/crypto/aws_lc/ecdsa.rs), `Es256Verifier` | `ECDSA_P256_SHA256_FIXED.verify_sig(key,msg,signature)`; ASN.1 DER-signature route değil | AWS-LC software backend, actual AWS KMS deneyine eşit değil |
| [Rust validation](https://raw.githubusercontent.com/Keats/jsonwebtoken/v10.1.0/src/validation.rs), `Validation::new/set_required_spec_claims/validate/get_current_timestamp` | Default required exp, leeway60, validate_exp=true, validate_nbf=false; helper yalnız exp/nbf/aud/iss/sub; exp ret `<now−leeway` (equality allowed), nbf ret `>now+leeway`; SystemTime seconds; aud/iss arrays intersection kabul edebilir | iat/jti/cnf/domain/type ve conservative interval dış gate ister; helper'a bunları eklemek onları required yapmaz |
| [Node TLS](https://nodejs.org/download/release/v22.23.1/docs/api/tls.html), v22.23.1 `tls.createServer/secureConnection/TLSSocket.getPeerCertificate/isSessionReused` | `requestCert:true`, `rejectUnauthorized:true`, supplied CA ile standard client-auth; event handshake sonrasında; `authorized` inspect; getPeerCertificate.raw actual X509 DER; self-signed client CA örneği mevcut; reused session flag API mevcut | Native Ed25519 leaf/current cert chain Node/Nest ingress ile runtime compatible diye kanıt değil; exact Nest adapter/CA/session-resumption config native source olmadan pinned değil |
| [RFC7519](https://www.rfc-editor.org/rfc/rfc7519#section-4), May2015 §§4/4.1.4/4.1.5 | exp anında/sonrasında ret, nbf anında izin; RFC duplicate-name reject **veya** lexically-last parser kabul eder | Lab daha dar duplicate reject ister; RFC kendi başına app schema/limit seçmez |
| [RFC8705](https://www.rfc-editor.org/rfc/rfc8705#section-3.1), Feb2020 §§3–3.1 | TLS layer actual certificate eşleşmesi; full DER SHA256 unpadded base64url `cnf.x5t#S256`; token application data, handshake sonrası | Full OAuth/client registration implementasyonu veya native session association proof değil |

**Araştırma sonucu:** İki candidate source ES256 yönünü destekliyor. Native source/manifests/lock/driver olmadan backend seçiminden oluşan yeni bir “ready” spec üretilmedi. Public import için kaynakta destekli yol bağımsız configured EC/P-256 JWK x/y→SEC1; `from_ec_der(SPKI)` yanlış varsayımı dışlandı. Future Rust gate signature doğrulamasını kapatmaz. Fixed lab clock için crate'in SystemTime time kontrolleri yerine yalnız o kontrollerin delege edilmesi (`validate_exp=false`, `validate_nbf=false`, `leeway=0`; required exp/nbf ve diğer standard equality kontrolleri korunarak) ve **başarılı signature+typed decode sonrası zorunlu conservative custom gate** gerekir; signature disable/dangerous decode yolu kullanılmaz. Bu kaynak gereksinimi tamamlanmış caller/config/ABI implementasyonu değildir.

## 1A — lab contract gereksinimleri ve açık spec boşlukları

Kaynak kapsamı: yukarıdaki tagged sources/RFC'ler ve local hash'li profile/ADR/feasibility. Aşağıdaki tablo **mantıksal requirement**; unknown native grammar/ABI, yeni function adı veya production schema seçimi değildir. Her comparator token/network/caller dışındaki trusted kaynaktan gelir. Future lab signer private fixture yalnız authority process'inde; raw token/private key log/report'a girmez.

| Mantıksal alan / girdi | Producer | Trusted comparator | Missing/malformed/mismatch rejection |
|---|---|---|---|
| Compact signed JWS / protected alg | Jose authority software signer; immutable ES256 policy | Rust verifier `Validation::new(Algorithm::ES256)` + bağımsız allowed headers | Not3 segments, bad signature, none/HS256/EdDSA/Ed25519, wrong curve/key-family ret; no downgrade |
| Protected kid | Authority's configured key identifier | Independently provisioned issuer key allowlist + learned revoke state | Missing/non-string/unknown/revoked ret; jku/jwk/x5u key learning yok |
| Protected typ | Authority fixed **lab-only** token class | Independent exact literal (henüz source-backed literal sabitlenemedi) | Missing/non-string/wrong literal ret; Jose typ normalization tek başına exact equality sayılmaz |
| iss/sub/aud | Authority synthetic eligibility/account/PC fixture | PC'ye ayrı verilen immutable issuer/account/PC kayıtları | Required, canonical lab type ve exact equality; missing/null/array-if-not-profile/string mismatch ret, real account enrollment iddiası yok |
| iat/nbf/exp | Authority controlled clock | PC controlled trusted interval `[nowLower,nowUpper]` | Missing/type/overflow/invalid ordering ret; `nowUpper>=exp` veya `nowLower<nbf` ret; iat consistency explicit; unknown bound online bekler |
| jti | Authority capability identity | Current admitted capability/context + local deny/version | Missing/wrong type/invalid bounded identity ret; global one-shot nonce değil; unchanged valid token fresh TLS ile tekrar sunulabilir |
| cnf.x5t#S256 | Ingress **actual** authenticated leaf DER→SHA256 | PC'nin aynı fresh native session actual leaf DER hash'i | Missing/not-object/missing nested field/bad encoding/bad length/hash mismatch ret;32byte hash/43char unpadded b64url; SPKI/raw/root hash ret |
| Account/pair/phone/PC/roles | Authority independently provisioned synthetic mapping | PC local fixture + bilateral SAS completed immutable identity snapshot | Her alan ayrı required/type/mismatch ret; caller fixture değiştiremez; reversed role/başka peer/account ret |
| Scope/operations | PC-approved synthetic root/op fixture→authority | PC local root/op approval intersection | Missing/malformed/expanded root/op ret; server dosya catalog/path öğrenmez |
| Installation epoch / security-grant version | Native continuity + synthetic authorized version fixture | PC immutable enrolled epoch/local learned deny-version high-water | Missing/unknown/mismatch ret; late allow stale state'yi geri alamaz; retained key tek başına continuity değil |
| Actual leaf SPKI / certificate possession | Full native CertificateVerify/Finished | Bilateral SAS immutable expected peer key; server trust ayrı | Missing/unknown/delegated different leaf ret; request cert/header/string comparator olmaz |
| Issuance→close→PC session continuity | Aynı native Engine/key/epoch/cert cache (historical-only shape) | Actual key/SAS snapshot equality + DER byte equality + full session linkage | Session yok/old proof/PSK/0RTT/context swap ret; new Engine/new DER token'ı devralmaz |
| Native admitted context / capability update | Native verifier, başarılı bütün gates | Immutable actual session association/current grant-capability | Caller bool/handle authority üretemez; değiştirilmiş context yeni admission ister |
| List request / fixture filenames | Fresh temp root exact fixture set + dış-root sentinel | PC native admitted scoped list gate | Preadmission/wrong root/wrong op hiçbir filename/data döndürmez; sentinel leakage yok; full path/open/commit atomicity proof değil |
| Unknown/duplicate fields ve bounded sizes | Producer contract / source serializer | Strict allowlist+duplicate-aware native decode at each nesting level | Required absence, malformed/unknown/duplicate ret; byte count/depth/string/list bounds uygulanmadan admission yok |

**Blocked exact design dimensions:** protected type literal; domain/private claim names/types and full nesting allowlist; byte/depth/string/array/token/frame/server body limits; issuer request/response transport grammar; fixed-clock injection ABI/caller; signer/session open-close/leaf-DER lookup/admission ABI; source-backed Engine/cert refresh mechanism; independently provisioned fixture command grammar; exact scoped-list files/sentinel/driver input; single Rust backend/features/lock pin; Node/Nest direct termination wiring/full-handshake policy; every new/change function/file/caller; reproducible future smoke commands. Historical16KiB DER/64KiB records/30s/128steps/11byte probe summaries are not current serializer definitions and must not silently become new token/frame limits. No execution-plan stub was written.

Historical native source absence blocks **Android–PC and iOS–PC native paths** alike. Available Rust targets/SDKs do not resolve it. Same-key new-DER renewal→old token rejection→authenticated reissue stays unverified; donor another-key cert is not a substitute. Node documented standard client-auth capability means source support exists, not that native leaf trust works; failure in future lab is blocker, never requestCert off / rejectUnauthorized false / private export / custom handshake fallback.

## 1A —14 future feasibility groups, iki pair mapping

Source: local hash'li [feasibility matrix](issuance-admission-feasibility-plan.md), §§Gelecekte yürütülecek doğrulama matrisi. G01–G14 aşağıda yalnız **bu raporun sıra etiketleri**, canonical acceptance ID'leri değiştirmez. Android–PC ve iOS–PC kolonlarının her biri **planned-only / not-executed**, exact driver input source olmadığı için grammar uydurulmaz. Varyantlar her pair'de ayrı koşulacak; pair pass paylaşılmaz.

| Group | Planned input varyantları → expected observation | Acceptance ilişkisi | Android–PC | iOS–PC |
|---|---|---|---|---|
| G01 | Native issuance→close→fresh PC full mTLS→list: enrollment actual DER bound token; exact approved filenames | 02/31/32 | planned-only / not-executed | planned-only / not-executed |
| G02 | No possession / ingress JSON-cert spoof / header-cert spoof: no signed token/admission/new authority | 01/02/03 | planned-only / not-executed | planned-only / not-executed |
| G03 | Wrong account / phone / PC / role / scope / forbidden op: ayrı ret, fixture unchanged, no filename | 04/05 | planned-only / not-executed | planned-only / not-executed |
| G04 | Signature bit-flip / protected-or-payload tamper / issuer / kid / type / alg / curve mismatch: real wire verifier ret, no trust mutation | 27/27a/28 | planned-only / not-executed | planned-only / not-executed |
| G05 | cnf thumbprint as SPKI / raw key / root hash: DER binding ret, SAS snapshot preserved | 31 | planned-only / not-executed | planned-only / not-executed |
| G06 | Trusted root keyA, actual leaf/CV keyB: immutable actual leaf pin ret despite valid token | 03/31b | planned-only / not-executed | planned-only / not-executed |
| G07 | Captured handshake / consumed proof replay / cross-session relay / concurrent proof / old SAS MAC-Done / PSK /0RTT: no new admission or early data | 06/07/08/30 | planned-only / not-executed | planned-only / not-executed |
| G08 | Same unchanged valid token + two independently fresh legitimate reconnects: current authority required each, no jti one-shot/window reset | 06/07/09 | planned-only / not-executed | planned-only / not-executed |
| G09 | Each required domain field missing / malformed / epoch mismatch / version mismatch: ret, no reset/migration/expansion | 04/09/21 | planned-only / not-executed | planned-only / not-executed |
| G10 | exp−epsilon / equality /+epsilon; nbf before / equality; conservative intervals crossing bound: strict allow/ret, unknown time online wait | 09/14 | planned-only / not-executed | planned-only / not-executed |
| G11 | Same key + new actual DER: old capability ret, authenticated new-DER reissue same-scope admit, key/grant unchanged | 31a | planned-only / not-executed | planned-only / not-executed |
| G12 | Local deny / version advance / stale token / late allow, active and fresh session: list cut, no old allow undo | 16/18/18a | planned-only / not-executed | planned-only / not-executed |
| G13 | Unknown kid / learned revoked signer / independently trusted overlap-update: first two ret, only provisioned rotation works, no exp/window extension | 27/28 | planned-only / not-executed | planned-only / not-executed |
| G14 | Unavailable / unknown continuity / time / transient provider: online wait, preserve key/state, no reset/plaintext fallback | 14/15/22 | planned-only / not-executed | planned-only / not-executed |

## 1A —36 exact acceptance ID coverage ledger

Source: local hash'li [canonical acceptance](../security/capability-acceptance.md). **Her satırın mevcut authority status'u `not-executed`, yeni observed coverage'u `unexercised`.** Aşağıdaki “future subset” G-group'un ileride kapsamayı amaçladığı kısmı gösterir, `partial pass` değildir. “Excluded” future14-group lab'in full acceptance criterion'ını kapatmayacağı kapsamdır; historical TLS/SAS alt-gate'ler buraya pass taşınmaz.

| Exact ID | Future subset / intentionally unexercised remainder | Current authority status | New observed coverage |
|---|---|---|---|
| 01 | G02 possession/no-grant ret subset; real registration/PC approval unexercised | not-executed | unexercised |
| 02 | G01/G02 fresh same-key issuance/admission subset | not-executed | unexercised |
| 03 | G02/G06 key spoof/delegated leaf subset; production mapping unexercised | not-executed | unexercised |
| 04 | G03/G09 synthetic equality/required-domain subset; real account enrollment unexercised | not-executed | unexercised |
| 05 | G03 actual scoped-list root/op subset; complete filesystem enforcement unexercised | not-executed | unexercised |
| 06 | G07/G08 fresh context/replay/reconnect subset | not-executed | unexercised |
| 07 | G07/G08 proof/context reuse subset; actual concurrency/atomicity source design open | not-executed | unexercised |
| 08 | G07 replay subset; full SAS-to-grant transition unexercised | not-executed | unexercised |
| 09 | G08/G09/G10 time/claim/version subset; full offline cache/window unexercised | not-executed | unexercised |
| 10 | Excluded: reciprocal SAS + real PC approval + correlated grant transition | not-executed | unexercised |
| 11 | G03 bounded list/sentinel subset only; traversal/encoded escape/symlink/mount/open/publication races excluded | not-executed | unexercised |
| 12 | Excluded: production elapsed24h equality across status/list/download/upload/commit/stream | not-executed | unexercised |
| 13 | Excluded: real successful request-start t0 +24h late-response window | not-executed | unexercised |
| 14 | G10/G14 controlled interval/fail-closed subset; OS clock/suspend/time bounds excluded | not-executed | unexercised |
| 15 | G14 unknown continuity wait subset; actual suspend/process/OS restart/cert persistence excluded | not-executed | unexercised |
| 16 | G12 synthetic local deny subset; actual authenticated center deny/network-error/durable fence excluded | not-executed | unexercised |
| 17 | Excluded: durable revoke-before-commit / commit-before-revoke publication order | not-executed | unexercised |
| 18 | G12 local fixture version/deny subset; durable restart/real response-correlation excluded | not-executed | unexercised |
| 18a | G12 controlled late-allow subset; actual concurrent response persistence excluded | not-executed | unexercised |
| 19 | Excluded: unknown central revoke during actual offline LAN + remaining24h bound | not-executed | unexercised |
| 20 | Excluded: account recovery/login/MFA resets + PC reapproval/re-pair | not-executed | unexercised |
| 21 | G09 epoch mismatch subset; actual retained-key/missing-epoch installation transition excluded | not-executed | unexercised |
| 22 | G14 unavailable-provider wait subset; physical lock/background/provider recovery excluded | not-executed | unexercised |
| 23 | Excluded: actual private-key loss/re-pair/backend non-recovery | not-executed | unexercised |
| 24 | Excluded: retained epoch + actual missing/inconsistent SDK DB/new account | not-executed | unexercised |
| 25 | Excluded: physical backup/restore/rollback suspicion and exclusion | not-executed | unexercised |
| 26 | Excluded: authority-free journal preservation vs publication/completed | not-executed | unexercised |
| 27 | G04/G13 fixed issuer/alg/type/kid + attacker key metadata ret subset; production trust bootstrap excluded | not-executed | unexercised |
| 27a | G04 exact ES256/no label aliases/wrong key-family/curve subset | not-executed | unexercised |
| 28 | G04/G13 configured rotation/revoked/unknown kid subset; actual custody/compromise/cache distribution excluded | not-executed | unexercised |
| 29 | Excluded: actual LAN classifier/first-pair/new-device/new-scope/recovery/remote eligibility | not-executed | unexercised |
| 30 | G07 full handshake/resumption/0RTT subset; product socket policy excluded | not-executed | unexercised |
| 31 | G01/G05 actual full-DER binding separate from SAS-SPKI subset | not-executed | unexercised |
| 31a | G11 same key/new-DER/authenticated reissue subset | not-executed | unexercised |
| 31b | G06 actual leaf/CV keyB under rootA ret subset | not-executed | unexercised |
| 32 | G01 admitted authorized real list subset; real account authority/scoped reconcile/durable final/completed excluded | not-executed | unexercised |

## 1A hand-off statüsü

**Historical1A: accessible inventory complete; eski exact native execution spec blocked.** SDK byte-signer patch historical SHA256 `5b56cfe81e41fd7f31e32d20ffa829f7315b8b3699e979379f0255b46b45cc87` ile byte-verified; [retention/recovery](../security/evidence-retention-and-recovery.md). Eski final native public source/manifests/locks/ABI/drivers/source-hash/caller provenance eksik; literal candidates independent final hashes olmadan executable değildir. Original191-member `proof.tar.gz` SHA256 `db9e72a619acb9b619f0912978d4c8fdd45de0ffab9d5e4d35d3f3c873adc241` unavailable; bytes/container identity reconstructed değil, global irrecoverability iddiası yok. Bu recovery gap güncel Kloda P-256 prerequisite'i değildir.

`experimentExecuted:false`; `runtimeEs256Interoperability:not-executed`; `nativeAuthorityEnrollment:not-executed`; `nativePeerDerSessionBinding:not-executed`; `kmsFeasibility:not-executed`; `es256Provisional:true`; `productionReady:false`. All36 authority targets remain not-executed/unexercised. Historical1B/1C execution never occurred; old plan is superseded, not pending P-256 execution. Current2C/full2B adoption remain open on current source/decision/system gates, not upstream byte signer or full historical corpus recovery. Documentation/recovery-storage smoke is separately historical, not native/runtime proof; no build/test/lint/format/install/service/device/cloud experiment in this cutover.

## Birleşik preparation sonucu — 1A ve2A

| Paket / sonuç | Kanıt ve kalan prerequisite |
|---|---|
| 1A erişilebilir envanter | Tamamlandı: safe path/version ve installed-target metadata, exact JOSE/Rust source ve producer/comparator/rejection gereksinimleri;14 grup ×2 pair future-only mapping,36 unique ID unexercised ledger |
| Historical1A kesin native execution spec | **blocked / superseded scope**: patch historical hash ile kurtarıldı, verified final core/manifests/lock/ABI/driver corpus yok. Current P-256 plan old corpus recovery beklemez; native grammar/caller/komut uydurulmadı |
| Tamamlanmış2A kaynak araştırması | [Dört hattın sonucu](../security/production-readiness-research.md): historical source-limited; Matrix/SAS/upstream/fork archive non-actionable. Platform/KMS/lifecycle source support current QR/native/authority runtime proof değil; rerun yapılmaz |
| Yeni issuer entegrasyon prerequisite'i | Pinned jose6.2.12 key-input/WebCrypto signing API arbitrary remoteKMS callback sunmuyor. KMS ES256 primitive/DER encoding desteği supported production issuer integration demek değil. G02/G06 için approved source-backed nonexport remote signing yolu hâlâ open2B karar/prerequisite; manual/custom JOSE, key export veya üçüncü stack seçilmedi |
| Deney/ürün statüsü | experimentExecuted:false; runtimeEs256Interoperability, nativeAuthorityEnrollment, nativePeerDerSessionBinding ve kmsFeasibility:not-executed; es256Provisional:true; productionReady:false. Eski1B/1C yürütülmedi;2C not-executed. D01 auth retired, D03 retained; D02/D04 açık, full2B/adoption kapanışı yok |

**Executable native plan stub oluşturulmadı.** Eski `local://kloda-issuance-admission-execution-plan.md` final source-backed native/caller corpus olmadan complete sayılmaz ve artık yeni P-256 acceptance talimatı değildir. Historical archive/source ileride erişilebilir olursa digest/final source-hash/lock/ABI/driver/allowlist kuralları provenance için korunur; yalnız patch/candidate metadata yeterli değildir. Böyle bir recovery veya yeni dar prerequisite hazırlığı deney execution izni vermez; Kloda ilerlemesi upstream API/full old corpus beklemez.

**Implementation sırası — ADR0009 + ADR0013:** bağımsız prerequisite-ready dilimler korunur; [frozen V1 protocol/minimum native contract](../security/qr-pairing-v1-protocol.md) esas alınır, actual native LAN/persistence source/API/ABI mapping ve integration proof açık; eski corpus/upstream işi değil. Genel implementation talimatı exact provider/schema/ABI seçimi, feasibility execution veya physical/production waiver değildir. Başlangıç [handoff](implementation-session-handoff.md).

## Documentation smoke ve ayrı review sonucu

**Historical hazırlık smoke/review:** aşağıdaki mevcut sonuçlar ADR0012 cutover'ını doğrulamaz; yeni check çalıştırılmadı.

Yazım sonrası read-only smoke altı preparation/research/plan/roadmap/index/gate belgesinde **79 relative-link occurrence** için mevcut dosya hedefini doğruladı; canonical matrix ile **36 unique exact ID** eşleşti ve hepsi not-executed/unexercised kaldı. **14 unique future group ×2 platform=28** planned-only/not-executed mapping ile dört2A research başlığı ve source-limited/provisional/no-execution durum ayrımı doğrulandı. Bu linked-path/coverage smoke, external URL availability veya archive/source hash revalidation, Markdown visual render, runtime/crypto/security proof değildir.

İki ayrı read-only reviewer geçişi native inventory/36-ID mapping ve dört production source hattını canonical policy/provenance ile karşılaştırdı; primary-source spot check yaptı, maddi bulgu bildirmedi. Parent integration review yeni checkpoint ve G02/G06 kaydının aynı source-only sınırı koruduğunu doğruladı. Deney/code/build/test/lint/install/device/cloud çalıştırılmadı; kaynak okuma ve safe version/path komutları dışında preparation execution yok.

## 1D blocked-result coverage ledger

2026-10-05 kesintisiz roadmap ilerlemesi: mevcut somut recovery/preparation blocker'ı [roadmap1D](stages-one-two-roadmap.md) kapsamında coverage girdisi olarak bağlandı;1B/1C deneyi çalıştırılmadı. Bu **blocked-result documentary delivery**, başarılı feasibility exit veya native suite replay değildir. @smol yalnız canonical ID/statü ve public recovery metadata çıkarımını yaptı; private artifact body'leri okunmadı.

**Historical1D scope:** aşağıdaki eski source/spec blocker satırları yeni P-256 acceptance veya aktif corpus recovery talimatı değildir; sonuçlar ve36-ID unexercised statüsü aynen korunur.

| Platform | Native execution | Somut prerequisite | Canonical authority coverage |
|---|---|---|---|
| Android–PC | blocked / not-executed | Verified final public source/manifests/resolved lock/ABI/driver ve exact native spec eksik;1B sonucu yok | 36 hedef not-executed / unexercised |
| iOS–PC | blocked / not-executed | Aynı source/spec ve1B bağımlılığı; Android historical sonucu iOS'a aktarılmaz | 36 hedef not-executed / unexercised |

Canonical ID ve future-only subset eşlemesi yukarıdaki **1A —36 exact acceptance ID coverage ledger** ile [acceptance matrix](../security/capability-acceptance.md) içindedir; ikinci kopya/status authority kurulmadı.01–32 ve18a/27a/31a/31b =36 unique hedef. Historical Rust17/native52/TLS25-per-pair/host8 sayıları authority pass veya partial coverage değildir. Yeni desktop source-ID/target-isolation smoke'ları da native capability coverage değildir.

Kaynaklar: [recovery sonucu](../security/evidence-retention-and-recovery.md), yukarıdaki **Birleşik preparation sonucu** ve public inventory metadata `historicalArchiveRecovered:false`, `nativeExecutionSpecReady:false`. Değişmeyen sonuç: `labComplete:false`, `productionReady:false`;1A blocked,1B/1C not-executed. Source/API/ABI/clock/backend/frame tahmin edilmedi, toplu rebuild yapılmadı.


## 2D not-ready readiness ledger

Eski1D blocked-result +2C eksikleriyle teslim edilen not-ready assessment Stage3 authority cutover değildir. **Current scope ADR0013 QR contract/native LAN/persistence; D01 Matrix/SAS/upstream/fork non-actionable, D03 retained, D02/D04 açık.** Backend issuer/account seçimi initial offline QR trust blocker'ı değildir; file authority gate'leri ayrı kalır. Tamamlanmış2A rerun yok.

| Gate | Kabul edilmiş yön / mevcut kanıt | Implementation biçimini belirleyen eksik prerequisite | Stage3 readiness |
|---|---|---|---|
| G01 | Hardware-preferred P-256; Android device-local CertificateVerify CLOSED/PASS (SM-S921B/API36), aggregate open | QR actual mutual TLS/PC SPKI equality + exact provider/channel API/ABI; actual Android↔PC LAN/final app/native bridge/iOS physical/desktop hardware/background/fallback proof açık | not-ready |
| G02 | Server ES256 provisional; jose/Rust source support runtime/KMS veya device identity proof'u değil | Supported source-backed nonexport issuer integration + gerçek sign/verify/import/type/alg/time rejection ve KMS message/digest/DER↔R+S runtime proof. Exact capability format hâlâ seçilmedi; old1B spec automatic adoption değil | not-ready |
| G03 | Backend-independent QR direction accepted / implementation not executed; [V1 bytes/minimum native behavior frozen](../security/qr-pairing-v1-protocol.md); Matrix/SAS gereği yok | Actual native API/ABI/adoption/integration; atomic reservation/exact PC approval/durable pin+consume/ACK recovery implementation ve adversarial tests | not-ready |
| G05 | QR local pins + fresh mutual session; exact-DER file capability retained,36 hedef not-executed | Live native possession/pin/channel association + actual DER/capability/scope/time/deny/fence correlation; QR PC key actual TLS SPKI'dır, remote binding ayrı. Account/file enrollment ayrı | not-ready |
| G06 | Provider/custody/hosting/trusted issuer bootstrap/rotation seçilmedi | D02 supported nonexport signer integration önce; sonra named custody/provider/hosting/trust seçimi, actual system erişimi ve runtime kanıtı | not-ready |
| G09 | D03-A DER persistence + QR durable pins/consume/ACK recovery required | PC-local consume+pin transaction, phone pin-before-ACK, same-key postconsume recovery; key/cert/epoch/authority backup/restore continuity. SameDER/newDER reissue/time policy ayrı | not-ready |

**Historical erişim eksikliği ile current source eksikliği ayrıdır:** eski corpus kaybı tarihsel, recovery/upstream beklemek yeni checkpoint değil. Current gate'ler QR protocol/native LAN/persistence ve D02/D04 kapsam kararlarıdır; issuer backend initial QR trust blocker'ı değildir.2C gerçek platform/signer/system erişimi ve exact spec olmadan hazır değil; fake trust factory/manual JOSE/key export/simulator real proof substitute değildir.

Kullanıcının kesintisiz çalışma talimatı hazır kapsamda rutin adım onayı bekleme gerekçesi değildir. Buradaki durma nedeni eksik implementation-shaping girdiler ve seçilmemiş mimaridir; önceki araştırma izin metinleri yeni kullanıcı talimatının yerine otomatik approval blocker olarak kullanılmaz. Cloud/provider/key açma veya production/physical waiver seçilmedi. Bağımsız prerequisite-ready implementation ilerleyebilir; Stage3 authority kapsamı bu değerlendirmeyle hazır olmadı.

Sonuç: `stage3AuthorityReady:false`, `es256Provisional:true`, `actualKms:not-executed`, `productionReady:false`. G01/G02/G03/G05/G06/G09 ve P01–P09 açık; G04/G07/G08/G10/G11/G12/G13/G14/G15/G16 ayrı ürün/karar/kanıt kapsamlarıdır. Desktop'taki iki local prerequisite dilimi bunları kapatmaz.


### 1D/2D documentary doğrulama

**Historical1D/2D smoke/review:** current cutover'ın doğrulaması değildir; counts/results eski teslim kapsamıyla korunur.

`node .local-evidence/roadmap-ledger-smoke.mjs` exit0:36 unique canonical ID not-executed/unexercised,6 not-ready gate,8 roadmap paket satırı,96 relative-link occurrence ve12 heading anchor pass. Ayrı yazım-sonrası review1D'nin blocked-result,2D'nin not-ready assessment teslimi olduğunu;1A/1B/1C/2B/2C'nin positive exit olmadığını, historical/desktop smoke'ların authority coverage sayılmadığını ve rutin onay ile eksik source/decision/system prerequisite'in ayrı tutulduğunu kontrol etti. Maddi çelişki bulunmadı.

Public belge/source-hash/komut/sonuç ve driver restore kanıtı `.local-evidence/archives/roadmap-ledger-2026-10-05.*` altında tutulur; ignored/proje-local/bağımsız yedeksiz sınır değişmedi. Bu yeni docs smoke'udur; eski archive recovery, upstream/network availability, native/runtime/crypto/device/KMS/production proof değildir. Ürün kodu/lint/test/build yeniden çalıştırılmadı.

