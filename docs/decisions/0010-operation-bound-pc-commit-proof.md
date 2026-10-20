# ADR 0010 — PC işlem-bağlı durable commit kanıtı

> **Current V1 LAN override — 2026-10-13:** [ADR0016](0016-v1-pc-local-file-authority.md) replaces central issuer/account/step-up/`<24h` and exact-DER online reissue prerequisites below with native current local ACL and explicit PC backup-scope approval. Operation-bound durable result, own-peer/scope authority, fresh native authenticated channel and revoke/publication fence remain; prior result is not current permission. FINAL remote authorization and recovery/central revocation versus offline PC/local grants are OPEN. Neither this result direction nor the ACL decision proves a receiver, safe filesystem or online unpair implementation.

2026-10-15 status clarification: the original direction-only status below is historical. The approved sequential contract is implemented in the native receiver/journal/result-query and sender, with software-fixture mTLS/restart/hash/revoke evidence under ADR0016 and the [current handoff](../implementation/codex-migration-handoff.md); physical/platform acceptance remains OPEN.

- Kalıcı kayıt tarihi: 2026-10-05
- Durum: yön kabul edildi; source/API/ABI, gerçek receiver veya production proof değil
- Karar sahibi: Ayhan
- Onay: ambiguous recovery için “PC işlem-bağlı commit kanıtı” seçildi; sınırlı byte-presence receipt alternatifi seçilmedi.

2026-10-07 scoped supersession: [ADR0013](0013-qr-based-local-lan-pairing.md) SAS-bound ilk trust/binding ifadelerini yerel QR-established pins ile değiştirir; işlem-bağlı commit/query, scope/current-authority ve durable publication kararları korunur.

## Bağlam

[Phase-bound sender recovery](../implementation/implementation-session-handoff.md#beşinci-implementation-dilimi--phase-bound-acknowledged-recovery) gerçek HTTPS fixture'da uygulanmış MOVE yanıtının kaybını gözledi. Temp yok ve final doğru byte'ları içeriyor olsa bile content equality işlemin kimin tarafından yayımlandığını kanıtlamaz. Eski blind cleanup tek original temp'i silip final yokken completed0 üretmişti. Yeni sender unknown/unacknowledged nesneleri korur; acknowledged201 + whole-body hash + atomic local settlement yolu çalışır. Bu fixture normal WebDAV/TLS modelidir, native PC authority veya fiziksel durability değildir.

## Karar

1. Ana PC-first receiver'da otomatik ambiguous recovery'nin hedefi **işlem-bağlı durable sonuç kanıtıdır**: own operation identity, source/target bağlamı ve content revision/hash aynı yayın sonucuna bağlanmalıdır. Root/peer/scope authority ve durable publication fence ADR0004/0007'ye tabidir; sender journal veya hash tek başına grant değildir.
2. Sonuç PC'de tutulur; merkezi Nest/Supabase servis medya byte'ı, plaintext medya/album kataloğu veya medya hash listesi için yeni store olmaz. Bu karar receiver endpoint possession key'i yerine server issuer signer'ı koymaz.
3. WebDAV unacknowledged/unknown temp veya final için **fail-closed** kalır: otomatik delete/adoption/receipt elevation yoktur. `prepared` niyet kaydı ownership değildir. Genel unknown/legacy final veya FolderSync arşivi bu kararla migrate/adopt edilmiş sayılmaz.
4. Next receiver diliminden önce yalnız gereken dar source/API/ABI prerequisite hazırlanır. Kayıp native corpus topluca rebuild edilmez; ADR0009 evidence-gated sıra korunur. Mevcut sender snapshot/hash/phase code'u authority/session/fence implementation'ı olarak yeniden etiketlenmez.
5. Ayhan taşıyıcı için **authenticated PC result query** seçti: PC local durable operation sonucu fresh authenticated peer kanalında sorgulanır; LAN full pinned TLS1.3 + QR-established Kloda P-256 mutual device proof yönü [ADR0012](0012-kloda-owned-p256-device-identity.md)/ADR0013'tedir. Initial QR PC fingerprint actual TLS P-256 SPKI ile eşleşir; exact-DER capability binding ayrı kalır. Matrix/SAS/SDK signer/binding current dependency değildir. Portable signed receipt, ek receipt signer veya canonical signature formatı seçilmedi; ayrı Kloda identity key receipt signer kararı değildir. Query fresh peer/session/scope/current deny/revoke koşullarını bypass etmez; historical result veya backend-independent QR trust current file grant değildir.
6. 2026-10-13 implementation session: Ayhan approved the **minimum sequential V1 contract** below rather than chunk-manifest/out-of-order transfer. The earlier exact-contract prerequisite is resolved for this narrow LAN scope. This approval is not implementation, experiment or physical acceptance evidence; hosting/custody/recovery/remote policies remain separate.

## Approved V1 sequential contract

- Native Rust owner, existing local SQLite and current PC ACL remain sole authority. HTTP/1 uses a separate `kloda-file/1` ALPN profile on the stable native LAN listener; frozen `kloda-pair/1` frames/profile remain unchanged. Full mutual pinned TLS1.3/P-256/AES128, no resumption/early data; actual native TLS peer identity, installation continuity and current authorization are required, never renderer/header authority.
- `x-kloda-pair` names the exact canonical base64url16 pairing SID; native matches the TLS-proven peer pin. PC-generated operation ID and phone-generated idempotency `requestId` are base64url16; SHA-256 is base64url32. JSON metadata is camelCase with unknown fields rejected. Native-to-native size/offset values are unsigned integers; byte requests use canonical decimal `x-kloda-offset`.
- `POST /v1/operations`: bind requestId, sourceId/sourceRevision, safe original basename, SHA-256, size and current peer/scope revision. Repeating the same request returns its own durable operation; mismatched bindings conflict. Native generates relative temp/final names; callers never choose a filesystem path.
- `PUT /v1/operations/{id}/bytes`: bounded sequential bytes, acknowledged durable offset only after file fsync and journal commit. A same-byte owned-temp retry may reconcile unacknowledged bytes; gaps/conflicts cannot truncate or overwrite them. Unknown/legacy final equality is not ownership.
- `POST /v1/operations/{id}/finalize` and `GET /v1/operations/{id}`: bounded hash work yields between native owner turns; recheck current grant/root/pin and live channel before each step/publication. Durable publishing intent precedes no-overwrite publication; lost-reply/restart recovery additionally requires immutable operation-owned file identity and correct bytes. Completed result follows durable publication and journal commit, not hash equality alone.
- `GET /v1/photos?after={id}` and `GET /v1/photos/{id}/bytes`: current-scope OWN completed results and user-triggered own restore only. No delete, other-peer browsing or automatic restore.
- `POST /v1/pair/revoke`: native exact-peer durable trust+ACL revoke, then PC-confirmed ACK; same-pin tombstone permits only idempotent retry of this control operation, never file access. Verified ACK precedes phone-local removal. Unknown online ACK retains phone trust and reports PC-unconfirmed; explicit phone-only removal requires fresh QR and never claims PC revocation. Completed media remains.
- Metadata8KiB, byte/hash steps64KiB, list pages32, pending native requests32 and total native peer work16 bound resource use. Error responses have a closed code and retryability classification; busy/full/unavailable/unknown are not success or corruption/regrant instructions.
- Native client uses exact existing locked [Hyper1.12.0 HTTP/1 handshake](https://docs.rs/hyper/1.12.0/hyper/client/conn/http1/fn.handshake.html) (`default-features=false`, `client,http1`) and [hyper-util0.1.21 TokioIo](https://docs.rs/hyper-util/0.1.21/hyper_util/rt/struct.TokioIo.html) (`default-features=false`, `tokio`), not a custom HTTP parser, new receipt signer or extra authority process. Actual unified features/RustSec/platform compile require verification; no new cloud/provider decision.

## Kabul sınırı

- Positive recovery ancak gerçek receiver'da operation binding, doğru byte'lar, durable publication/record ordering, deny/revoke precedence, restart ve lost-reply yolları gözlenerek kabul edilir. Synthetic journal veya echo/mock result bu kanıt değildir.
- PC offline ve cloud file store yoksa sender bekler; eski result/receipt mevcut file grant, current availability veya tamamlanmamış yeni transfer için completion üretmez.
- ADR0004 authority/certificate lifecycle ve ADR0009 incremental sıra korunur; ADR0012 single Matrix key/upstream-first auth varsayımını, ADR0013 initial SAS path'ini supersede eder. ES256 server issuer provisional; yeni P-256 identity/source/platform/QR contract/native LAN binding ve enrollment/schema/trusted-time/fence/KMS/release/physical gate'leri açık. Android device-local hardware signer CLOSED/PASS yalnız dar alt-gate'tir; local QR trust için issuer/backend gerekmez, file authorization kapıları ayrıdır.

## Sonuç

Direction onayı kaydedildi; PC receiver/result API veya native code bu ADR kaydıyla implemented sayılmaz. Dar prerequisite durumu [handoff](../implementation/implementation-session-handoff.md#pc-commit-proof--dar-prerequisite-sınırı) içinde tutulur.

## Approved advanced WebDAV review actions — 2026-10-20

Ayhan approved file-level review without blocking independent files: explicit recheck, keep-both only for a verified genuine collision, and skip that retains an unresolved record. Uncertain results cannot be adopted, overwritten or marked complete; aggregate success cannot conceal unresolved work. This is the advanced outgoing WebDAV adapter, not a new native receiver/result-proof contract or two-way Files implementation.

The approved conflict filename is `stem (Kloda <PC-name> <UTCYYYYMMDD-HHMMSS> <revision-first8>).extension`. The PC component is the sender computer's actual OS hostname, sanitized/bounded for a safe filename; no phone name is invented. UTC time and revision discriminator are frozen in the existing pending publication path at the first explicit choice, before MOVE. Preserve extension, enforce no-overwrite and retain that path in the existing receipt. A known occupied alternate name may use a bounded numeric suffix on a subsequent explicit choice; unknown/missing owned temp never permits rotating names or adopting an existing final. Unsupported/overlong names fail visibly and retain pending data.

Only acknowledged owned temp plus full SHA match and a current genuine final collision permit keep-both. Durable MOVE201 acknowledgment precedes local settlement; missing temp after unacknowledged MOVE remains review even if final bytes match. Current saved WebDAV target/source context and visible active trusted main-frame actions are required. Older targets/removed sources remain visible but permit only local skip until their exact current context is available; history is not authority. Confirm keep-both with default Cancel in TR/EN/DE. No new receipt signer, broad migration, remote delete right, native ACL change or central service prerequisite.

Existing timeout behavior is retained under [ADR0001's clarification](0001-mobile-sync-behavior-and-framework-constraints.md#desktop-webdav-retry-clarification--2026-10-20). Runtime/source/test evidence and outstanding platform gates remain in the [handoff](../implementation/implementation-session-handoff.md#desktop-webdav-jobs-and-final-host-review--2026-10-20).
