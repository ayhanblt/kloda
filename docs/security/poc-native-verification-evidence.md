# Matrix verification ve aynı-key native TLS — tarihsel kalıcı kanıt

Belgeleme tarihi: **2026-10-04**. Geçmiş public sonuç/rapor/source sınırları konsolide edildi; bu turda deney, kurulum, build/lint/test, servis veya cihaz/cloud işlemi yapılmadı. Yeni mimari kararı veya üretim SDK cutover'ı değildir. [Sanitized machine-readable özet](evidence/poc-native-verification-summary.json), exact case ID/pair/status ve kaynak SHA256'larını repo'da tutar. Tarihsel transport sonucu ayrı [transport kaydında](poc-transport-evidence.md): **fiziksel Android14 pass/1 direct inconclusive; iOS URLSession simulator inconclusive**. Daha sonraki simulator verification/TLS başarıları bunların yerine geçmez.

**Current supersession — [ADR0013](../decisions/0013-qr-based-local-lan-pairing.md):** Bütün case/count/pin/hash/provenance ve aşağıdaki eski closing gate ifadeleri **Matrix Ed25519 same-key/software-only scope'unun historical kaydıdır**. Matrix/SAS/SDK/store/homeserver/upstream/fork current pairing dependency değildir; eski corpus recovery yeni gate değildir. [ADR0012](../decisions/0012-kloda-owned-p256-device-identity.md) Kloda-owned P-256 identity/hardware preference için korunur; backend registry local pin yaratmaz.

Current QR first trust actual PC TLS Kloda P-256 canonical SPKI equality + real mutual CertificateVerify + same-channel secret HMAC + exact candidate PC approval + PC atomic consume/pin + phone PENDING-before-proof/durable pin/ACK/recovery'dir. Backend/login/internet gerekmez fakat account enrollment/step-up/scope/capability/file authority yaratmaz. [KLODA-QR-PAIR-V1](qr-pairing-v1-protocol.md) protocol bytes ve minimum native davranış frozen; actual API/ABI/adoption/integration unverified, implementation not executed. [QR roadmap](../implementation/qr-pairing-implementation-roadmap.md) future implementation/test planıdır. Full-DER capability hash QR SPKI hash'inden ayrı; renewal online reissue ve remote DTLS/signaling profile ayrımı korunur.

Required local key/pin/pairing/epoch continuity kaybı fresh QR trust + ayrı gerekli online authorization ister. Bu historical deneylerde QR/P-256/hardware/session/remote proof yoktur. [Production gates](production-gates.md) ayrı mevcut SM-S921B/API36 device-local hardware-backed P-256→TLS1.3 CertificateVerify **CLOSED/PASS**'ını kaydeder; actual Android↔PC LAN/final app/Rust bridge/iOS physical/desktop/platform/authority gates kapanmaz. Historical counts/hash/results korunur; yeni rerun/rebuild/research yapılmadı.

## Historical aşamalar birbirine eklenmez veya yeni P-256 proof yerine kullanılmaz

| Aşama | Platform / pair | Final kanıt | Tamamlanan sınırlı kapı |
|---|---|---:|---|
| İzole Matrix public-API feasibility | Rust1.98.1, macOS arm64; iki `OlmMachine` | **17 pass /0 gap /0 fail** | Homeserver olmadan gerçek SDK verification/store/restart/sign capability |
| Historical native verification | AndroidAPI35/Android15 arm64 emulator ↔ macOS Electron | **26/26** | JNI/native OS-storage/SAS/diagnostic possession/UI path |
| Historical native verification | iOS26.5 arm64 simulator ↔ macOS Electron | **26/26** | Swift-C/native Keychain/SAS/diagnostic possession/UI path |
| Aynı-key TLS kopyası, host | Rust signer/TLS/input regressions | **8/8** | Exact-byte signer ve normal TLS adversary/input kontrolleri |
| Aynı-key TLS kopyası | AndroidAPI35 emulator ↔ Electron | **TLS25/25 + verification26/26** | Native TLS1.3 aynı device key ve kopyalanmış verification regression |
| Aynı-key TLS kopyası | iOS26.5 simulator ↔ Electron | **TLS25/25 + verification26/26** | Native TLS1.3 aynı device key ve kopyalanmış verification regression |

Historical native toplamı **52 pass,0 fail/blocked/inconclusive**, `nativePocComplete=true`, `productionReady=false`. Sonraki kopyadaki verification toplam52 ayrı regression koşusudur; historical52'yi104 benzersiz test gibi sunma. TLS50 ve host8 farklı suite'lerdir. Native TLS raporu `sameKeyBinarySigning=true`, `nativeTlsAndroidElectron=true`, `nativeTlsIosElectron=true`, **`sdkPatchRequired=true`**; `productionReady=false`, `physicalDevicesValidated=false`, `realPeerNetworkValidated=false`, `authorityImplemented=false` kaydeder.

## 1. Matrix public-API deneyi —17 exact vaka

`matrix-sdk-crypto`/`matrix-sdk-sqlite` **0.19.1** ile standard request→ready→start→accept→key→MAC→done akışı çalıştı. Gerçek iki crypto engine, random ephemeral/identity key'leri, signed device uploads, SDK MAC/commitment/signature kontrolleri, encrypted SQLite store ve PHONE/PC için ayrı **child-process restart** vardı. Fixture tek sentetik account/device registry, in-memory to-device queue ve public accept/confirm çağrılarıyla kullanıcı onayını modelledi. `testing` feature veya manual trust override kullanılmadı. Matrix homeserver kurulmadı; NestJS/account/step-up/PC scope/real network uygulaması değildir.

| Case ID | Final runtime gözlemi |
|---|---|
| `standard-two-approvals` | İlk onay `Confirmed`, trust false/false; iki onay+MAC/done sonrası iki uç Done/verified |
| `commitment` | Commitment mutation iki uçta cancel, trust false/false |
| `wrong-flow` | Yanlış flow Done/trust açmadı |
| `wrong-account` | Yanlış account sender Done/trust açmadı |
| `ephemeral-key-substitution` | İki uç cancel, trust false/false |
| `invalid-key-mac` | İki uç cancel, trust false/false |
| `user-sas-mismatch` | Kullanıcı mismatch'i temsil eden cancel; iki uç trust false/false |
| `done-before-confirmation-and-mac` | Erken/sahte done başarı yaratmadı |
| `old-flow-mac-replay` | Eski MAC yeni flow'da Done/trust açmadı |
| `old-mac-relabelled-as-new-flow` | Flow relabelling eski MAC'i geçerli yapmadı |
| `duplicate-accept-no-trust` | Duplicate accept erken/ek trust yaratmadı |
| `reordered-key-before-accept` | Sırası değişmiş key Done/trust açmadı |
| `cached-device-key-replacement-rejected` | Advertised replacement benimsenmedi; cached orijinal peer korundu ve meşru verification tamamlanabildi |
| `first-discovery-same-device-id-key-substitution` | Saldırgan registry key'i gerçekten adopted oldu; SAS sayıları aynı olsa da identity-key MAC mismatch iki ucu iptal etti |
| `one-approval-process-restart` | PHONE/PC kimlikleri korundu, trust false ve eski aktif flow yok; reload edilen key yeni challenge imzaladı |
| `completed-pair-process-restart` | PHONE/PC kimlik/peer/trust korundu, eski aktif flow yok; reload key signature doğrulandı |
| `long-term-device-signature-capability` | Yeni challenge doğru key ile doğrulandı, başka challenge/key aynı signature'ı doğrulamadı |

**SAS sayı eşitliği tek başına identity-key trust değildir.** First-discovery poisoning bu ayrımı çalıştırdı; commitment, identity context, iki comparison approval, key/list MAC ve done adımı çıkarılmaz. İlk harness cached key'in advertised key ile değiştiğini varsaydığı için3 failed expectation verdi:1 advertised/adopted-key karışması ve2 cancelled-handle/cache gözlem varsayımı. Bu SDK açığı değildi. Terminal handle'lar mutation öncesi tutuldu, gerçek adopted key assertion eklendi ve first-discovery injection ayrı çalıştırıldı. Initial `artifact://812`, ara814/816 ve final824 farklı provenance kayıtlarıdır; final17 sonuç bu belgede kalıcıdır.

İlk to-device-only dispatcher gerçek `keys-query` isteğinde hata verdi; outgoing request ID ve gerçek uploaded device keys üzerinden registry response üretince akış çalıştı. No-network-I/O SDK, generic iki mesajlık byte relay değildir; Matrix-shaped metadata/request-response adapter gerekir. Bu bulgu full homeserver zorunluluğunu kanıtlamadı ve production NestJS endpoint'ini uygulamadı.

Historical `cargo run --locked` ve `cargo clippy --locked -- -D warnings` final başarı kaydı vardır. Encrypted SQLite child-restart secret'ı random test secret idi; OS Keystore/Keychain/safeStorage veya hardware/background erişim kanıtı değil. `OlmMachine::sign` diagnostic signing capability kanıtladı, production session transcript/role/scope/derivation seçmedi. Geçici DB'ler son koşuda kaldırıldı; repo/arşiv private materyal taşımaz.

## 2. Historical native verification —26 case her pair

Tek exact0.19.1 Rust core **JNI / Swift-C / C Node-API** sınırlarından çalıştı. Native Android APK, iOS simulator app ve Electron addon gerçekten linklendi ve çalıştı. Aynı SAS-verified SDK Ed25519 device key, domain-separated diagnostic possession proof üretti; store secret DB encryption içindir, ikinci possession identity değildir. File-channel grant/capability/backend/transport uygulanmadı.

Her pair'in26 case'i: mutual-SAS/same-key proof; single-confirm sonrası cancel; completed/incomplete process restart; commitment, ephemeral key, MAC, wrong-account, wrong-flow, legacy-MAC adversary; duplicate accept; first-discovery long-term key substitution; key-before-accept reorder; old-MAC replay (**14 verification vaka**). Sonra PC ve mobile uçlarının her biri için unavailable/missing/corrupt/wrong-secret/missing-epoch (**10 storage vaka**) ve iki uçta closed-handle ABI (**2 vaka**). Android mobile endpoint ANDROID, iOS endpoint IOS'tur. Exact ID/status çiftleri public JSON'da saklıdır.

Storage failure sonrasında DB digest'leri değişmedi; iki suite'de toplam20 post-failure sign çağrısı CLOSED döndü. Missing SDK DB + **retained epoch** birlikte kayıp senaryosu çalıştırılmadı: bu deney genel restore-proof implementation kanıtı değildir. `unavailable` provider vakaları injected; gerçek Keychain locking yapılmadı.

### Ortam ve OS-storage sınırı

- Rust1.99.0 commit `b940084d7eb6a299eb4bfeb8e34901bc051e7ac4`, LLVM23.1.1; Xcode27.0/build27A266a; Swift6.4/language5; Clang21.0.0.
- Native environment kaydı macOS26.6.2/build25G83/arm64 bildirir; bu koşunun historical metadata'sıdır, mevcut workstation OS'sine veya bütün macOS sürümlerine başarı taşımaz.
- AndroidAPI35/google_apis/arm64 image revision9, NDK27.1.12297006, build-tools35.0.0, Java17. Emulator wrapping-key hardware claim **false**.
- iOS26.5 simulator, SDK27.0, deployment target16.4 simulator; ad-hoc signing + Mach-O embedded Keychain entitlements. Fiziksel provisioning/signing değildir.
- Electron44.4.5, embedded Node24.21.0, runtime N-API10/addon target8, darwin/arm64. Published native Node binding'in runtime veya production adoption kanıtı değildir.
- Android native Keystore wrapper + CE secret, iOS `AfterFirstUnlockThisDeviceOnly` Keychain ve macOS main-process safeStorage paths native proof scope'udur; Matrix identity software RAM'de kullanılır. OS-protected at-rest state, hardware-non-exportable identity veya RAM/process-compromise isolation değildir.
- safeStorage async API plaintext base64 JavaScript string copy üretir; deterministic erase/zero-copy garanti edilmez. OS store secret mobile JS/desktop renderer'a possession key diye verilmez.

### Historical native hata zinciri

1. Rust event enum `as_str()` compile hatası public Display ile düzeltildi; wrong accept-message `method` alan beklentisi kaldırıldı, negotiated v2/Curve25519/SHA256/decimal şartları korundu.
2. `rustup run cargo` PATH'teki Homebrew compiler'ı seçerek iOS std target'ı bulamadı; exact1.99.0 RUSTC/RUSTDOC seçildi. Lock resolution libc0.2.189/uuid1.26.1'e geri pinlendi, native hedefler derlendi.
3. SDK store destructor Tokio dışındaki shutdown'da panic yaptı; engine runtime içinde drop edildi.
4. Transaction-ID sıralı BTreeMap gerçek SDK MAC→done outgoing sırasını bozdu; FIFO VecDeque üretim sırasını korudu.
5. iOS Keychain **−34018** entitlement hatası verdi; simulator Mach-O entitlement bölümü eklendikten sonra gerçek Keychain adapter SDK store'u açtı.
6. İlk full Android matrix **23/26** geçti: first-discovery substitution gerçek cache doldurulduktan sonra kurulmuştu. Injection ilk mobile query'den önceye alındı, adopted-key assertion korundu.
7. Drop-only close WAL checkpoint/connection-shutdown etkilerini bırakıyordu; public `CryptoStore::close()` kullanıldı ve storage-negative digest/CLOSED assertions geçti.
8. Bir Electron screenshot eski `requested` karesiydi: native assertion başarılı olsa da iki-ekran proof kabul edilmedi. Late snapshot overwrite engellendi; capture gerçek DOM phase/decimal ve iki animation frame bekledi, capture failure reddedildi.
9. Final Android/PC decimal5558–1639–4344 ve iOS/PC4010–8992–5078 screenshot eşleşmeleri historical görsel incelemede kaydedildi. Onay **otomasyon**; insanın gerçek cihazlarda sayıları karşılaştırması değildir. Bu konsolidasyon screenshot'ları yeniden görsel doğrulamadı veya kopyalamadı.

Historical build/core/android/iOS/Electron/lab komutları, iki `node driver/run.mjs --pair … --all`, JS/shell syntax kontrolleri exit0 kaydeder. Duplicate `-lSystem` ve blake3 NEON object's macOS27.0/min13.0 mismatch linker uyarısı görünürdü; clean/warning-free/older-macOS claim yok. Ayrı manuel source review ABI ownership, runtime/store close, approval/MAC-v2, device-key sign, secret isolation ve exact Electron sender checks kapsamındaydı. Independent reviewer-agent unavailable idi; bağımsız security audit denmez.

## 3. Aynı-device-key standart native TLS1.3

### Historical UTF-8 blocker nasıl değişti?

Published0.19.1 public device signer string/UTF-8 kabul ediyordu; arbitrary binary TLS CertificateVerify içeriği yamasız karşılanmış değildi. Son izole deney **vendor kopyasının yalnız iki SDK dosyasına** exact-byte method ekledi:

- `src/olm/account.rs`: crate-private `sign_bytes(&[u8])`, mevcut account'ın device key'i ile.
- `src/machine/mod.rs`: public async `sign_bytes(&[u8])`, store cache/account üzerinden; cross-signing/master key kullanılmaz, private key export edilmez.

Eski string signer korundu; registry SDK kaynakları değişmedi. Blocker **isolated patched feasibility** bakımından superseded'dı; production/upstream exact-byte signer kanıtlanmadı. **SDK patch yalnız bu historical Matrix same-key deneyinde gerekliydi**; ADR0012 ile arbitrary-byte upstream katkı optional future, Kloda product blocker/fork/migration prerequisite değil. Public patch SHA256 aşağıdadır; methods bu eski scope'ta self-contained kaydedildi, `/tmp` kaybı yeni P-256 gereksinimi değildir.

Native core Rustls/rcgen signer bridge'i64byte signature ve5s timeout kullanır; synchronous sign yalnız awaited `spawn_blocking` içinde. JS raw byte-sign API'si eklenmedi; native shells'in yeni komutları fixture automation whitelist'ine girdi, normal UI whitelist'i genişletilmedi. Mevcut SDK public key'inden remote-key self-signed leaf; DigitalSignature + ServerAuth/ClientAuth; **normal WebPKI mutual auth**, TLS13-only, resumption/early-data/tickets kapalı. Private key extraction, custom handshake veya accept-all verifier eklenmedi. DER16KiB, records64KiB, canonical padded base64; tek Engine validation boundary, bounded session30s/128 handshake-step ve11byte fixed native probe receive buffer.

### Gerçek happy-path gözlemi

Her pair'de bilateral SAS Done/eşleşen decimal, native verified-peer snapshot key'i = certificate SPKI = **handshake'te gerçekten sunulan peer leaf SPKI**; iki endpoint'te TLSv1_3, ALPN `kloda-tls-poc/1`, CertificateVerify counter0→1 ve bilateral native binary probe received. Caller/JS key pini trusted kaynağa yükseltilmedi; pin tamamlanmış native SAS snapshot'ından geldi.

Her pair'de **20 fresh full handshake/probe/close** turu; Android1691–2727ms, iOS1577–2598ms, her tur30s sınırı ve close/join dönüşü. Gerçek native process restart device public key continuity'yi korudu; stale session/flow reddedildi ve yeni SAS ardından yeni TLS açıldı. Bu Engine-local certificate cache'in restart sonrası **aynı certificate DER/persistent certificate renewal** garantisi değildir. Aynı device key ile certificate DER değişirse certificate-bound token davranışı bu deneyde uygulanmadı.

TLS ciphertext **localhost fixture pump** üzerinden taşındı. Android emulator/lab automation ve iOS simulator/host setup bu proof'un kontrol/taşıma araçlarıdır; USB'siz iki gerçek peer ağı, LAN/remote/TURN veya URLSession file-transfer runtime'ı değildir. Gerçek SDK/native TLS crypto çalışması, gerçek transport/network acceptance anlamına gelmez. İkinci runtime identity key yok; adversary/donor cert key'leri yalnız negatif fixture'dır.

### Host/native negatif kanıt

Host8-case suite'in kapsamı exact256byte domain, invalidUTF-8/NUL mesaj imzası; changed byte/string/base64 surrogate reddi; missing client certificate/wrong CertificateVerify; wrong server SAN/expired cert; malformed/mismatched SPKI; TLS1.2; caller-pin/unknown-field/base64/bounds adversary kontrollerini içerir. Bunlar farklı alt assertion'lardır;8 üst-level case sayısı korunur.

Native25-case her pair: happy-path, incomplete/single-confirm SAS, donor-key certificate substitution, iki yönde ciphertext mutation, fresh handshaking/established session'a old-ciphertext replay,20 reconnect, real process restart, stale/wrong session ID/second-open/unknown-field/DER-record bounds ve closed/storage fault rejection. Reset/plaintext fallback yok; exact ID/pair/status public JSON'dadır.

Ayrı review **root/trust-anchor pin tek başına delegated different leaf key'i engellemiyor** bulgusunu verdi. Normal TLS host adversary bunu gerçekten gösterdi; native session, application data öncesi **sunulan gerçek leaf SPKI** kontrolüyle delegated-key adversary'yi `TLS_FAILED` reddetti. Chain-trust'u identity-leaf pin yerine koyma. Source/dataflow review'da private SDK-key export/key-log/custom-verifier bypass route bulunmaması RAM/hardware izolasyon deneyi değildir.

İlk Android TLS koşusu **22/25**: Activity Displayed33s, fixture30s deadline'ını aştı; launcher `am start -W` ile bekledi. FFI early validation invalid input'u Engine'e ulaştırmadığından active session düşmüyordu; tek Engine validation boundary'ye taşındı. İlk başarısız JSON korunur; final iki native suite passed. İlk `to_bytes` compile API hatası ve strict-lint4 bulgusu düzeltildi; final strict Clippy `--all-targets -- -D warnings` exit0. Ortam Android XML3/XML4/abis metadata, Apple duplicate `-lSystem`, bazı Electron `task_policy_set` invalid-argument diagnostics raporda görünür; suppressed veya warning-free environment denmez.

Exact TLS pins: crypto/sqlite0.19.1, vodozemac0.11.1, ruma0.17.0, rustls0.23.45, rcgen0.12.1, libc0.2.189, uuid1.26.1, cc1.5.1, tokio1.53.1; Rust/Cargo1.99.0, driver Node22.23.1, Electron44.4.5/Node24.21.0/Chromium152.0.7977.130, AndroidAPI35 emulator, iOS26.5 simulator. Final TLS results final rebuilt/installed kopya binary'lerine aittir; önceki native workspace yeniden çalıştırılmadı/değiştirilmedi.

## 4. Araştırma bulguları — source proof, runtime proof değil

Session'ın pairing/protocol/native-storage araştırması bu deneylerin kapsamını aşağıdaki gibi çerçeveledi; öneri/kaynak bulgusunu yeni accepted architecture'a çevirmiyoruz:

- [Matrix SAS standard](https://spec.matrix.org/v1.18/client-server-api/#short-authentication-string-sas-verification): standard request framework, commitment responder ephemeral key + original canonical initiator start; identity/flow/key MAC/done zorunlu. Custom sayı/hash truncation/SAS state machine değil. Kloda phone/PC rolü/account/scope Matrix initiator/acceptor transcript'inin otomatik alanı değildir.
- Exact0.19.1 SDK default **v2-only değil**: legacy MAC, v2 ve MSC alias advertise/fallback var. Native negotiated policy `hkdf-hmac-sha256.v2`, `curve25519-hkdf-sha256`, SHA256/decimal şartını kontrol etti; SDK start event'ini rewrite ederek commitment değiştirme yolu seçilmedi.
- Software Ed25519 SDK account/sign/pickle ile encrypted SQLite record storage, public source ve runtime signer capability'dir. OS wrapper **store secret**'ı korur, Matrix identity RAM'e gelir; bütün DB dosyasına SQLCipher denmez. `open_with_key(..., Some(secret))`; provider unavailable'da `None`/plaintext fallback kabul edilmez.
- Published binding araştırması: Apple crypto-onlyFFI0.17.0/core0.17.0; official native Node0.6.6/Node≥24/N-API8/core0.18.0 gitrev `90db5fe383a9a325667c817e144ea6a711c90468`; WASM18.9.0/core0.19.1 daha geniş features; fullFFI0.19.1 daha geniş client defaults. Bunlar native custom0.19.1 core PoC sonuçlarının hazır production package'e aktarılması değildir. Android matching0.19.1 AAR/minSdk official-source kanıtı yoktu; README'deki stale libolm adımları production reçetesi yapılmadı.
- Core metadata MSRV1.96/edition2024/Apache2; transitive vodozemac libolm-compat/experimental-session-config/insecure-pk-encryption feature adları gözlendi. Feature isimleri SAS açığı kanıtı değil; full SBOM/license/advisory audit yapılmadı. Hedefli RustSec0318/0159/2025-0041 incelemesi pinned version'ın listed fixed thresholds'ı geçtiğini kaydetti, “no vulnerabilities” sonucu değildir.
- Native-storage araştırması Android no-per-run-auth OS wrapper + CE, iOS AfterFirstUnlockThisDeviceOnly ve desktop secure-provider profile önerdi. First-unlock sonrası screen-lock erişimi OS job/file/network fırsatıyla koşullu; passcode-less aynı güvenlik bariyeri değildir. Missing key/corruption re-pair, geçici unavailable bekleme; key veya eski grant otomatik recreation yok. iOS Keychain reinstall'da kalabilir ve ThisDeviceOnly same-device restore mümkün: mutlak uninstall erase veya backup-outside iddiası yok.
- Electron44.4.5 async availability **güvenli Linux backend kanıtı değil**: pinned Chromium PosixKeyProvider fixed-key fallback bulundu. Güvenli backend yoksa fail-closed/noninteractive provider gerekir; Windows/Linux native PoC çalıştırılmadı. DPAPI roaming/domain backup istisnaları hardware device-bound guarantee değildir.
- Kullanıcının seçtiği compatibility/support **hedefi iOS16.4+/Android7(API24)+** vardır. Framework/source floor ile product release approval ve physical/minimum runtime compatibility ayrı; macOS13/Windows10 teknik Electron floor'u universal success değildir.

Ayrıntıların kaynak provenance'ı: historical `local://kloda-pairing-protocol-research.md` ve `local://kloda-protocol-native-storage-research.md`. Bu konsolidasyon dış kaynakları yeniden live audit etmedi; historical source-research bulgularıdır. Yayın/version değişimi veya production package adoption için yeniden exact-profile kanıtı gerekir.

## 5. Açık fiziksel ve production kapıları

**Historical bölüm — eski Matrix single-key scope.** Aşağıdaki eski prerequisites current acceptance contract değildir; current QR/P-256 gate'ler ADR0013 ve [production gates](production-gates.md) içindedir.

**Physical-device-required:** Android/iOS minimum/current native ABI ve genuine iki-cihaz SAS comparison; gerçek screen lock/first unlock/reboot, task/background, OS wrapper/provider lock, backup/restore/reinstall/credential/biometry transitions; retained epoch + lost SDK DB; APK/iOS real signing/provisioning; source/WAL/DataProtection; temporary-unavailable ile real key loss ayrımı. Simulator entitlement success bunları kapatmaz.

**Historical production-gate list (eski scope):** Expo integration, matching minimal-feature Matrix packaging/signer support, desktop/real peer networks, account mapping, PC scope/capability/session admission, cert persistence/renewal, revoke/time/publication, filesystem, issuer/enrollment/file transfer açık kalmıştı. Güvenilir **Matrix-key** native TLS feasibility file authorization/hardware proof değildi. ADR0012 byte signer blocker'ını retired yaptı; ADR0013 standard SAS SDK/cryptographic Kloda binding gerekliliklerini de current path'ten çıkardı. Current QR protocol/native TLS-SPKI/secret-channel/persistence/physical gate'leri [production gates](production-gates.md) içindedir. Eski52/50/8 sonuçlar bu gate'lere aktarılmaz.

## Kaynak haritası, hash ve arşivsel sınır

Aşağıdaki public report/archive/patch byte'ları salt okunur **2026-10-04'te hash edildi**; ilk Rust ve native report/archive ile TLS archive hash'leri original session kayıtlarıyla eşleşti. Yeni hash, historical çalıştırmayı tekrar yürütmek veya bağımsız kriptografik audit etmek değildir.

| Aşama / original public kaynak | SHA256 |
|---|---|
| `/tmp/kloda-matrix-pairing.mYGX18/report.json` | `f7b0741cecc03a08acc0e2bd63daa7caa0039e27b1a3c04104b54e50a1d21a17` |
| aynı root `kloda-matrix-pairing-evidence.tar.gz` | `518642ac3a8c752645fc9d380f5df76ea3682c37ad5e08c3370d9706778960aa` |
| `/tmp/kloda-native-verification.ZjL8Y0/report.json` | `6c8141fe0523a71dcce6a964f30236ab1ab2cefffd48b544e39a9fd7303320d1` |
| `/tmp/kloda-native-verification-proof.tar.gz` | `83aed3c915418d346a6a12599e2d488cf50cb1367d87e4e971c881d4fe0179dc` |
| `/tmp/kloda-same-key-tls.hjUS9L/report.json` | `c4729b6cdf1a4a70015fed16936bd2079fffcb8344ae4c425b985db4579c50d7` |
| aynı root `proof.tar.gz` | `db9e72a619acb9b619f0912978d4c8fdd45de0ffab9d5e4d35d3f3c873adc241` |
| aynı root `sdk-byte-signer.patch` | `5b56cfe81e41fd7f31e32d20ffa829f7315b8b3699e979379f0255b46b45cc87` |

Source→claim mapping:

- Rust `RESULT.md` §§Deneyin gerçek ve modellenmiş parçaları/Kabul matrisi/Advertised key/Storage/FFI + `report.json`:17 case observations, fixture scope,3 initial wrong expectations, no production/native/file channel. Original local result ayrıca commands/archive hash/provenance sağladı.
- Native `RESULT.md`26×2 table + `evidence/environment.json`, `execution.json`, `build-observations.txt`, final report: native52 count, OS/native runtime versions, command exit0, storage-failure/DOM readiness and warnings. `local://kloda-native-verification-poc-result.md` diagnostic chronology/20 CLOSED signs/historical screenshot visual observations sağladı.
- TLS `RESULT.md` §§Son doğrulama/Değişiklik kaydı/Negatif kanıtlar/İlk koşu/Kapsam sınırları + `report.json`, `sdk-byte-signer.patch`, public `evidence/{android-pc,ios-pc}/tls-cases.json`: host8, TLS25/pair, copied verification26/pair, actual leaf pin,20 cycles,22/25 chronology, two-method patch, false production/physical/network/authority gates. `local://kloda-same-key-tls-feasibility-result.md` original archive hash ve isolation boundaries sağladı.

Historical native archive kaydı75 member/1,261,164byte; TLS archive191 regular-file member olarak bildirilmişti. Bu tur member inventory yeniden taranmadı. Original archive policy DB/WAL/SHM, OS wrappers, live epoch, signing private key/runtime state, APK keystore/native binary ve secrets'ı dışlar; proof source/lock/public JSON/screenshot/hash taşır. **Repo'da tam arşiv, raw trace, screenshot veya native binary saklanmıyor**, yalnız self-contained sonuç/sınır ve allowlisted case/hash summary saklanıyor. Hash dosya kimliğini kontrol eder, dosya içeriğini geri üretmez. Ephemeral `/tmp` veya dış source arşivi kaybolursa bütün eski execution byte'larıyla reproduksiyon mümkün değildir; native binary/source hash kayıtları bu saklama eksikliğini çözmez.

Sonraki2026-10-05 [retention/recovery kaydı](evidence-retention-and-recovery.md) SDK byte patch'in exact historical SHA256 ile kurtarıldığını ve yalnız1-member yeni paketin `.local-evidence/` proje-local/Git-dışı alanda tutulduğunu kaydeder. Full original archive/raw source corpus geri gelmedi;2026-10-04 archival sınırı history olarak korunur. Recovery byte doğrulaması eski suite rerun/production approval değildir; clone bu local artifact'ları taşımaz.

Private DB/key/epoch/state, account credential, private hostname/port/serial veya medya byte'ı bu konsolidasyonda açılmadı/kopyalanmadı. Original PoC/session artifact'leri değiştirilmedi. Eski UTF-8 blocker, native23/26 ve TLS22/25 başarısız koşular tarihsel olarak korunur; final success onları hiç yaşanmamış yapmaz. No-op, mocked trust veya planlanmış-only case runtime pass olarak eklenmez.
