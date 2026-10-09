# Native peer-session — dar source/API/ABI prerequisite

- Güncel kayıt tarihi: 2026-10-08.
- Statü: QR native Rust/Android-Electron bridges implemented/build-tested under [ADR0014](../decisions/0014-shared-rust-qr-pairing-core.md); hardware LAN adoption blocked. P-256 identity/ADR0013/frozen V1 remain normative; Matrix/SAS/upstream are inactive.
- Kapsam: QR producer evidence is separate from ADR0010 authenticated file-result query and ADR0011 in-process query integration, which remain unimplemented. No physical/cloud execution or old corpus rebuild.

## Güncel producer ve rol ayrımı

PC local QR invitation → telefon scan → actual mutual TLS1.3 possession + PC canonical SPKI SHA256 equality → same-channel secret proof → exact reserved adaya PC approval → durable local pins yönü kabul edildi. Yerel peer pin trust kaynağı; backend registry yalnız control metadata. İlk trust internet/backend/login olmadan tamamlanabilir; account enrollment, step-up, scope, capability ve dosya yetkisi yaratmaz.

**Frozen prerequisite contract:** [KLODA-QR-PAIR-V1](../security/qr-pairing-v1-protocol.md) remains the sole normative codec/channel/state/store source. [QR roadmap](qr-pairing-implementation-roadmap.md) records native implementation,43 synthetic loopback/state/store tests, four-ABI Android APK and actual Electron error/UI smoke. Hardware provider runtime/locality/backup/background remain unverified; Mac key creation lacks entitlement, and iOS native is explicitly deferred. Previous SM-S921B/API36 device-local signer PASS is unchanged/no rerun; remote DTLS/signaling remains separate.

ADR0014 approvals now cover adopted Rust/rustls0.23.45 dependencies,365-day same-key certificates/30-day renewal and opaque JNI/Node-API integration. Native owns the producer, pins and all TLS/exporter/secret material. Source/build adoption is not physical custody or authorized file-query proof.

## Source/API/ABI exit — yalnız dependent kapsam

| Girdi | Kabul edilen yön | Hâlâ gereken somut source/contract |
| --- | --- | --- |
| İlk pairing | Backend-independent QR LAN + mutual TLS possession + secret/channel binding + PC approval + durable pins | [Frozen V1 contract](../security/qr-pairing-v1-protocol.md) ile actual native channel material/API/ABI, atomic reservation/PC-local consume+pin transaction ve same-key ACK recovery implementation/runtime proof; Matrix/SAS SDK veya ikinci comparison required değil |
| Device key | Kloda-owned long-lived ECDSA P-256, hardware-preferred non-exportable | Platform create/open/sign/public-key identity/lifetime/error/signature encoding API; lock/reboot/background, unsupported hardware/fallback/Linux ve target support kararı/kanıtı |
| LAN session | Fresh full pinned TLS1.3/SPKI + mutual Kloda device proof | QR PC SPKI hash'i actual live TLS Kloda P-256 key ile eşleşir; selected library/release/provider/features/lock, actual peer DER/SPKI/pin/channel association ve full-handshake observables. Exact-DER capability hash'i ayrı |
| Remote session | WebRTC/DTLS + signed signaling/fingerprint/mutual proof; direct P2P/Cloudflare TURN fallback | Native stack/release/ABI, exact signed metadata/role/flow/freshness/DTLS binding ve replay rejection; relay credential/bootstrap/hosting/distribution; TLS capability profile'ını otomatik taşımayan remote binding |
| Native owned binding | Swift/Kotlin ve Electron main dispatch/consume | Actual producer header/generated API, native worker callbacks, buffer ownership, cancel/close/join/generation/errors; guessed opaque context/fake factory yok |
| Persistence | Native exact DER + Kloda key/pin/pairing/epoch/authority continuity | Selected directories/provider classes, atomic update/reissue, backup/device-transfer exclusion, restore/key loss/unavailability; historical Engine cache veya hardware retention continuity proof değil |
| Authorization/query | Signed capability + local scope/deny/revoke/fence; PC operation-bound durable query | Actual account/PC approval/token-type/time/scope/native session/fence producer; exact query encoding/replay/error/commit ordering. Backend JWT user session, peer grant değil |

## Mevcut managed/native sınırı

Önceki source observation: mobile14 Files/Photos/settings declarations, desktop6 sender bridge methods; Swift/Kotlin source queue/settings registered functions ve empty central Nest module. Pairing/P-256/hardware/TLS/session-context producer veya PC receiver bulunmadı; eski parser/probe sonucu yeni native runtime pass değildir. Bu yüzden docs cutover için sender caller/test/API değişikliği gerekmedi.

Native owns authenticated connection, pin/certificate association and generation/lifetime. Close/cancel/restart fencing is implemented; hardware callback/process behavior still needs runtime evidence. Missing provider fails visibly without reset/export/software fallback; only native-generated certificate TBS and standard TLS CertificateVerify can reach the opaque signer. No per-request hardware-signature system. File query/capability/time/scope/deny/fence composition is still a separate unimplemented boundary.

Önceki [Expo module doc](https://github.com/expo/expo/blob/f99150bc99b37a14313cbee23b280ca6068c4acb/docs/pages/modules/module-api.mdx) ve [Node22.23.1 Node-API](https://nodejs.org/download/release/v22.23.1/docs/api/n-api.html) async/cleanup surface source referansıdır, installed native ABI/close-join proof değil. Platform-native provider callback/threading/error contract gerçek kaynakla sabitlenir; JS signing veya blind `block_on` seçilmez.

## iOS background sınırı

In-process native query/session iOS system-background URLSession daemon değildir. Secure Enclave key tercihi daemon signing/force-terminated transfer compatibility garantisi yaratmaz; exact APIs/process ownership/native transfer strategy ve physical-device proof ayrı gate. OS fırsatı yoksa pending/wait, fake completion yok. iOS16.4+/AndroidAPI24 hedefi korunur; no-auth/export/alternate protocol silent fallback yok.

## Historical upstream API proposal — non-actionable archive

Önceki SDK0.19.1 arbitrary-byte/device-only Ed25519 request ve [contribution policy check](upstream-byte-signer-policy-check.md) yalnız archival technical/publication bağlamıdır. Current QR trust/auth için upstream improvement, contribution, Matrix distribution, fork veya migration task/gate yok.

Historical SDK0.19.1 gap/rustls0.23.32 callback research and archive checkpoints retain their original scope. Olm/arbitrary-byte signer/Matrix TLS observations are not current P-256 hardware proof. Current Rust/rustls0.23.45 adoption is recorded in ADR0014; no upstream task was revived.

## Verification sınırı

Historical inventory/link/restore counts are not rerun or relabeled. Current source/build/synthetic/runtime limitations are in the [handoff](implementation-session-handoff.md#native-qrui-implementation-and-current-blocker--2026-10-08). Mac Secure Enclave creation returns missing entitlement `-34018`; signing/provisioning needs a user decision before hardware pairing. Previous Android signer PASS is unchanged. Physical QR LAN and all36 authority targets remain not-executed; query/fence implementation is absent.
