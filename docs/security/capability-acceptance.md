# Kloda — Capability/authority kabul matrisi

**36 hedefin tamamı `not-executed`.** [Profile yönleri](capability-profile.md) ADR0004 ile kabul edildi; ES256 provisional ve production gate'leri açıktır, authority implementasyonu yoktur. Eski01–32 ID'leri korunur;27a/18a/31a/31b eklenir. Her varyant gerçek native/admission/operation/publication sonucuyla doğrulanmalı; mock/source-text assertion yetmez.

Kaynak anahtarları: **AC** tarihsel32 hedefin bu belgede korunmuş01–32 karşılığı; **ADR** [ADR0003](../decisions/0003-secure-pairing-and-offline-authorization.md); **SD** [security design](secure-pairing-design.md); **VM** [Matrix/device continuity ADR0007](../decisions/0007-matrix-verification-and-device-continuity.md); **D** [capability profile](capability-profile.md) tabloları. TLS/SAS historical alt-gate tam satırın runtime kanıtı değildir. Public inspection recorded DER/key analizi, live handshake/token/renewal testi değildir. Kökenler [session inventory](../implementation/session-documentation-index.md) içinde kayıtlıdır.

Ortak kalıcılık invariant'ı: ret/fence/recovery trusted mapping/key/scope'u attacker input'tan genişletmez; yeni admitted authority, publication veya completed üretmez. Önceden geçerli durably committed normal PC final, journal/staging/ciphertext ve mevcut key korunur. Journal authority değildir. Scope dışı dosyalarda read/write/publication yok. Bu invariant'ların runtime kanıtı bütün satırlarda eksiktir.

| ID | status | policySource | proposedEnforcement | availableEvidence | missingRuntimeProof | futureInput | expectedOutcome |
|---|---|---|---|---|---|---|---|
| 01 | not-executed | AC01; VM; D1/3 | PC local grant gate | Historical SAS/TLS alt-gate | Matrix trust→PC grant separation | Matrix verified/cross-signed; grant yok | Ret; fresh online PC onayı+SAS+grant gerekir |
| 02 | not-executed | AC02; VM; D3; RFC8446 | Fresh full same-key TLS before admission | Historical native full TLS alt-gate | Capability/admission combined enforcement | Grant/token/SAS geçmişi var; fresh possession yok | Yeni session/operation ret |
| 03 | not-executed | AC03; VM; D1/3 | Actual leaf SPKI equals immutable keyA | Public key comparisons; historical TLS pin alt-gate | Production mapping/capability key substitution | Discovery/cert/token/proof keyB; trusted SAS keyA | Ret; A snapshot/grant değişmez |
| 04 | not-executed | AC04; D1/2/3; RFC8725 | Account/pair/PC/phone/role/aud equality | Source-level JWT validation; TLS alt-gate | Trusted real account registration + domain gate | Ayrı phoneB, PC2, accountY ve reversed-role varyantları | Her mismatch ret; mapping değişmez |
| 05 | not-executed | AC05; ADR; D2/Responsibility | PC-approved root/operation intersection | Policy only | Scope and operation enforcement | Başka root, same-root forbidden op, expanded token | Ret; online PC approval olmadan scope genişlemez |
| 06 | not-executed | AC06; D3; RFC8446/8705 | Fresh handshake context + fixed admission grant | Historical TLS alt-gate | Session/channel/admission context enforcement | Session1 handshake proof'u Session2/channel'a relay; başka capability context | Captured proof ret; unchanged valid token+fresh TLS reconnect ayrı allowed case |
| 07 | not-executed | AC07; D3 | Native single handshake state + atomic one-context admission | Standard TLS design; historical native alt-gate | Concurrent duplicate admission/state mutation | Aynı consumed/pending handshake proof'u iki admission'a eşzamanlı | İlgili proof/context en fazla bir admission; jti global one-shot yapılmaz |
| 08 | not-executed | AC08; VM; D1/3 | Active SAS flow/local confirmation + fresh TLS gate | Historical SAS/TLS alt-gate | Replay combined with grant acceptance | Eski MAC/Done; expired/consumed session proof replay | Yeni confirmation/grant/session yok |
| 09 | not-executed | AC09; ADR; D2/Offline | Signature/type/version/time/deny precedence | Library source only | Current authority and stale token enforcement | Expired/revoked token veya başka authority record ile karışım | Ret; yeni cache/window yok |
| 10 | not-executed | AC10; ADR; VM; D4 | Reciprocal SAS + PC approval + correlated center grant | Historical SAS confirmation alt-gate | Authority pair acceptance transition | Bir uç confirmed, diğeri cancel/timeout/mismatch | Grant/completed yok; pending cancel edilebilir |
| 11 | not-executed | AC11; SD; DResponsibility/Offline | Scope-safe resolve/open/publication boundary | Policy only | Real filesystem path/open/rename races | `..`, absolute, encoded escape, symlink, mount/open race ayrı | Root dışı read/write/publication yok |
| 12 | not-executed | AC12; ADR; DOffline | Trusted elapsed upper strict `<24h`; all ops/fence | Policy + document walkthrough | Time/stream/commit integration | Upper=24h tam sınır; status/list/download/upload/commit | Hepsi ret; stream kesilir; completed yok |
| 13 | not-executed | AC13; ADR; DOffline | Correlated successful request-start t0 | Document walkthrough | Native timer + response ordering | Response t0+24h veya sonra; token exp hâlâ geçerli | Window açılmaz; yeni başarılı kontrol gerekir |
| 14 | not-executed | AC14; ADR; D2/Offline | Independent trusted token-time and elapsed bounds | Source shows wall-clock limitation | Platform trusted time/bound implementation | Wall-clock geri/ileri; elapsed veya token time belirsiz | Pencere uzamaz; bound yoksa online bekle |
| 15 | not-executed | AC15; VM; D5/Offline | Suspend/restart continuity or fail closed | Engine cert cache scoped observation | Cert persistence + native elapsed across suspend/restart | Suspend/process/OS restart; bound continuity yok | Online bekle; t0/deadline/epoch keyfi reset yok |
| 16 | not-executed | AC16; ADR; DOffline | Reachable authenticated deny precedes offline fallback | Policy only | Network-error/explicit-deny separation + durable fence | Valid token varken explicit center deny | Ret; aktif erişim kesilir; durable deny |
| 17 | not-executed | AC17; SD; DOffline | Single PC authorization/publication order | Document walkthrough | Atomic durable revoke vs commit/filesystem | Revoke-before-commit ve valid durable commit-before-revoke | İlki yeni final yok; ikincinin final'i korunur; fence durable |
| 18 | not-executed | AC18; ADR; DOffline | Durable learned version/deny precedes stale allow | Policy only | Response correlation/order + durable restart enforcement | Öğrenilmiş revoke/version sonrası eski token/allow | Ret; fence geri alınmaz |
| 18a | not-executed | AC18; DOffline | Deny high-water cannot be overwritten by late success | Document walkthrough | Actual concurrent response persistence | Allow request başladı; deny öğrenildi; eski allow geç gelir | Durable deny sürer; late success window/admission açmaz |
| 19 | not-executed | AC19; ADR; DOffline | Only remaining same-scope LAN cached bound | Policy only | Offline unknown central revoke + reconnect boundary | PC unaware offline iken merkez pair/device/account revoke | Anlık revoke vaadi yok; yalnız kalan dar window; 24h'de ret; online deny öğrenilince fence |
| 20 | not-executed | AC20; ADR; VM; D4/5 | Recovery cannot resurrect old pairing | Policy only | Recovery/session/device/pair invalidation | Account recovery, login/MFA yeniden kurulum | Eski grant yok; online PC onayı+SAS+yeni grant; final korunur |
| 21 | not-executed | AC21; VM; D5 | Key presence not install authorization | Historical epoch policy/alt-gate only | Production retained-key/missing-epoch transitions | OS key var; sandbox epoch yok; eski token | Offline ret; online approved re-pair; mevcut key korunur |
| 22 | not-executed | AC22; VM; D5 | Provider failure→wait, never silent identity reset | Historical provider alt-gate only | Real device lock/background/provider recovery | Transient locked/unavailable/UI-required provider | Bekle/ret; key reset/plaintext fallback/new identity yok |
| 23 | not-executed | AC23; VM; D5 | Private-key possession cannot be recovered via login | Policy; source-bound TLS possession | Real key loss + authority behavior | Private key kayıp; login/token mevcut | Ret; re-pair; backend private-key recovery yok |
| 24 | not-executed | AC24; VM; D5 | Retained epoch with missing SDK DB offline closed | Explicit prior evidence gap | Native DB loss/mismatch + account recreation | Epoch var, SDK DB yok; SDK yeni account üretir | Eski grant/snapshot yeni key'e geçmez; online PC+SAS+grant |
| 25 | not-executed | AC25; VM; D5 | Suspected restore→offline closed | Policy only | Backup exclusion/physical restore continuity | Key/epoch/DB full restore/rollback suspicion | Online re-pair; her tam rollback'in software ile tespiti vaat edilmez |
| 26 | not-executed | AC26; SD; DResponsibility | Resume/reconcile never creates authority | Existing backup journal is not peer authority | PC peer recovery/commit/completed integration | Journal var; token/possession/current authority yok | Pending korunur; publication/completed yok |
| 27 | not-executed | AC27; RFC8725; D2/6/7 | Fixed issuer/alg/type/key allowlists | Versioned library sources only | Real rejection + trust store invariants | Wrong issuer/key/alg/type; attacker jku/jwk/kid/x5u | Ret; attacker data trust anchor oluşturmaz |
| 27a | not-executed | RFC9864; D6 | Exact ES256 allowlist/key family, no aliases | jose exact Ed25519 support; Rust exact identifier gap | Cross-runtime confusion rejection | Ed25519↔EdDSA label switch, none/HS256 or wrong curve on ES256 key | Ret; no legacy downgrade/type confusion |
| 28 | not-executed | AC28; RFC8725; D7 | Only authenticated issuer rotation; known revoke cuts token | Source API support, not trust integration | Trust bootstrap/cache/rotation/compromise | Unknown kid offline; known old signer revoke; trusted overlap separately | Unknown/revoked ret; overlap doesn't extend exp/window |
| 29 | not-executed | AC29; ADR; DOffline | Narrow LAN exception only existing approved same-scope | Policy only | Real LAN classifier + first/new/remote gates | İlk pair/new device/scope/recovery/remote; uncertain LAN ayrı | Online gerekir; offline grant/window yok |
| 30 | not-executed | AC30; D3; RFC8446 | Full cert-auth handshake; no early application authority | Historical full TLS alt-gate | Production resumption/0RTT/socket policy | PSK, 0RTT, eski socket ile yeni file session | Fresh proof yoksa ret; early publication yok |
| 31 | not-executed | AC31; RFC8705; D2/3/5 | Exact DER token binding separate from SAS-SPKI identity | Public DER≠SPKI hashes; native key alt-gate | Certificate-bound token validator/lifecycle | Certificate renewal; SPKI/raw-key/root thumb substituted | Old token doesn't transfer; correct profile/reissue gerekir |
| 31a | not-executed | RFC8705 §3.1; D5 | Same key/new DER requires online authenticated reissue | Document reasoning only; no renewal runtime | Real native new cert+old capability admission | Same SAS private/public key, differently encoded/new leaf DER | Old bound token ret; key-bound grant unchanged; online reissue |
| 31b | not-executed | VM; D3; RFC8446 | Actual leaf key pin, not merely root/anchor | Historical delegated-leaf TLS regression alt-gate | Capability+production leaf validator combined | Root keyA trusted, leaf/CV keyB signed/delegated by A | Ret despite root/cert token hash match; SAS keyA pin preserved |
| 32 | not-executed | AC32; SD; DResponsibility | Current online allow + fresh same-context TLS + scoped reconcile | Native positive TLS alt-gate only | End-to-end issuance/admission/fence/durable final | Current valid grant/capability; same-scope pending journal; successful real commit | İşleme izin; yalnız gerçekten durably committed final/completed; önceki final korunur |

## Belge üzerinde karar walkthrough'ları — runtime değil

Aşağıdaki girdiler önerilen kurallara elle uygulanmıştır. “İzin” diğer account/scope/version/cert/continuity kapılarının sağlandığını varsayar; bu varsayım gerçek integration kanıtı değildir.

| Girdi | İzlenen karar | İlgili ID |
|---|---|---|
| Trusted elapsed upper=24h−1ms, token valid, aynı-scope LAN, center unreachable | Dar cache time gate geçebilir; diğer kapılar gerekir | 12/19/29 |
| Upper=24h | Ret; stream/commit/completed yok | 12 |
| Upper=24h+1ms | Ret; grace yok | 12 |
| t0 request-start; authenticated success response t0+24h | O request window açamaz; response-time t0 yapılmaz | 13 |
| t0+1h token expires; elapsed upper yalnız1h | `nowUpper>=exp` → ret; 24h token'ı uzatmaz; exp eşitliği de ret | 09/12/14 |
| Wall clock ± gün; trusted elapsed aynı | Elapsed window değişmez; token validity bound yoksa ret/online bekle | 14 |
| Suspend/restart; cert aynı olsa da elapsed üst sınır sürekliliği yok | Online bekle; normal restart epoch reset nedeni değil | 15 |
| Center reachable authenticated deny vs network unreachable | Deny → durable fence; unreachable yalnız tüm mevcut dar LAN koşullarıyla cache | 16/19 |
| Allow pending iken authenticated deny öğrenildi; eski allow geç geldi | Durable deny geri alınmaz; stale correlated response yeni t0/grant açmaz | 18/18a |
| Local revoke önce; staging commit sonra | Yeni final/completed yok; staging/journal/eski final korunur | 17 |
| Geçerli durable commit önce; revoke sonra | O final korunur; sonraki erişim/publication fenced | 17 |
| Same key, new leaf DER, old capability | SAS identity key unchanged olsa da cert hash mismatch ret; online reissue | 31/31a |
| Unknown kid veya öğrenilmiş revoked signer | Offline ret; token-supplied key trust yaratmaz | 27/28 |
| Account/PC/phone/role/scope/op mismatch — her biri ayrı | Equality/intersection gate ret; trusted mapping genişlemez | 04/05 |
| Fresh full mTLS + current authenticated authority + exact bound DER + same approved context | Admission geçebilir; scoped ops ve fence durably commit'i ayrıca denetler | 32 |

## Kanıt kapsamı ve sonraki runtime kapısı

- Tarihsel public inspection iki çiftin DER/JWK32/native-recorded-peer/SAS-key ve full-DER vs SPKI hash karşılaştırmasını çalıştırdı. [Exact stdout](evidence/certificate-binding-stdout.json) kalıcıdır; bu dokümantasyon işinde live native handshake veya crypto inspection yeniden yürütülmedi.
- **36 authority hedefi, issuance/enrollment/JWT sign/verify/revoke/fence/path/restore yürütülmedi.** Historical native sayılar bu matrise pass taşınmaz; physical/real-peer-network/production false kalır.
- Dört yön ADR0004 ile onaylı; [feasibility planı](../implementation/issuance-admission-feasibility-plan.md) hazır fakat execution ayrıca onay bekliyor. Serialization/type, trusted enrollment, custody/time ve durable scope fence production prerequisite'leridir; doküman onayı runtime/code/SDK cutover değildir.

## Ayrı review geçişi — tamamlandı

`AcceptancePolicyReview`, orijinal01–32 ve ADR/SD/VM ile karşılaştırdı:36 unique ID, altı named evidence/enforcement/input/outcome kolonu ve tüm `not-executed` statüleri mevcut; kaybolan varyant veya policy çelişkisi bulunmadı. `CapabilityProfileReview` bağımsız RFC/tagged-source ve kanıt kapsamı geçişinde actionable finding bulmadı. Request-start/strict24h, expiry, deny/late-allow, iki commit sırası, preservation/reconcile ve cert/key ayrımı belge üzerinde takip edildi.

Bu ayrı yazım-sonrası review'dur;36 test pass, peer-DER admission export, JWT interoperability, filesystem atomikliği veya fiziksel/real-network güvenlik sertifikası değildir. Runtime eksikleri yukarıdaki kolonlarda açık kalır.
