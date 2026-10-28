# KLODA-QR-PAIR-V1 — frozen protocol and minimum native contract

Date: 2026-10-08 (execution clock). **Frozen protocol and minimum native behavioral contract; implementation evidence and hardware adoption limits recorded in the [QR roadmap](../implementation/qr-pairing-implementation-roadmap.md).** This remains the sole normative byte/native/state source under ADR0013; MUST/MUST NOT are normative. Constants are Kloda V1 choices, not RFC-selected values. Implementation was authorized separately under ADR0014; this document itself authorizes no packages, camera or device experiment. This status update changes no normative bytes.

Initial local trust works without backend/internet/login. Local pins never create account enrollment, same-account eligibility, operation step-up, PC scope approval, signed capability, offline file grant or file access. Registry/backend metadata cannot overwrite a local pin. Remote DTLS/signaling is separate.

## Sources and evidence boundary

- [RFC5480](https://www.rfc-editor.org/rfc/rfc5480): EC SPKI algorithms and point encoding; Kloda chooses the strict P-256 uncompressed DER profile below.
- [RFC4648](https://www.rfc-editor.org/rfc/rfc4648): base64url and canonical spare bits; Kloda forbids padding and requires round-trip equality.
- [RFC4291](https://www.rfc-editor.org/rfc/rfc4291) and [RFC5952](https://www.rfc-editor.org/rfc/rfc5952): IPv6 syntax and producer normalization; Kloda chooses bounded address/locality support.
- [RFC2104](https://www.rfc-editor.org/rfc/rfc2104): standard HMAC; domain, lengths and framing below are Kloda choices.
- [RFC8446 §4.4.3](https://www.rfc-editor.org/rfc/rfc8446#section-4.4.3) and [§7.5](https://www.rfc-editor.org/rfc/rfc8446#section-7.5): CertificateVerify and normal TLS1.3 exporter. [RFC5705 §4](https://www.rfc-editor.org/rfc/rfc5705#section-4) supplies exporter background, not the TLS1.3 key schedule.
- rustls **0.23.45** source documentation: [Connection](https://docs.rs/rustls/0.23.45/rustls/enum.Connection.html), [CommonState](https://docs.rs/rustls/0.23.45/rustls/struct.CommonState.html), [WebPkiClientVerifier](https://docs.rs/rustls/0.23.45/rustls/server/struct.WebPkiClientVerifier.html). Exporter/peer-certificate APIs exist; this is not library adoption, a working provisional verifier, hardware bridge or LAN exporter evidence.

[Synthetic documentation vectors](qr-pairing-v1-protocol-vectors.json) are public fake inputs. Calculations/model checks are documentation consistency only, not TLS, native storage, physical or runtime security passes.

## QR wire and strict parsing

Wire is exact ASCII `KLODA-PAIR:` followed by unpadded RFC4648 base64url of UTF-8 JSON. Entire scan MUST be at most **512 ASCII bytes**, including the 11-byte prefix; decoded JSON MUST be at most **375 bytes**. Check scan/encoded size before decode/allocation. No trimming, URL wrapper, percent decoding, padding `=`, `+`, `/`, nonalphabet characters or base64 whitespace. Decode/re-encode equality is required, including zero spare bits. The total bound permits at most 501 encoded characters (512−11); valid unpadded encodings of at most375 decoded bytes occupy at most500 characters. A 501-character suffix is invalid base64 length.

Exactly required top-level fields are `v,sid,pc_spki_sha256,secret,lan`; `lan` contains exactly `ip,port`. Reject unknown or duplicate fields at every level **before map overwrite**, including escaped-name aliases. Strict UTF-8, no BOM, no trailing JSON. Arrays/null/coercion are forbidden; object depth at most2. `v` numeric token is exactly `1`; unsupported version rejects without downgrade. Port token must match `[1-9][0-9]{0,4}` and value1–65535; float/exponent/string/bool are forbidden.

| Field | Decoded value / generation |
|---|---|
| `sid` | Independent16 CSPRNG bytes, canonical22 base64url characters |
| `pc_spki_sha256` |32 hash bytes, canonical43 base64url characters |
| `secret` | Independent32 CSPRNG bytes, canonical43 base64url characters |
| `lan.ip` | Validated IP string below; hint, never authority |
| `lan.port` | Decimal numeric token1–65535 |

Generation failure creates no invitation. A sid colliding with an existing local consumed record is redrawn before display. No time/key-derived secret. Producer emits compact JSON in the field order above, `lan.ip` then `lan.port`. Consumer accepts reordered fields and legal JSON whitespace within bounds. No JCS: JSON spellings never enter HMAC; decoded field values do.

IPv4 is four decimal octets0–255, no leading zero except `0`; accepted ranges are RFC1918 10/8,172.16/12,192.168/16 and169.254/16. IPv6 is pure-hex RFC4291 text, producer RFC5952 normalized; consumer accepts valid expanded/uppercase spellings. Only ULA fc00::/7 and global2000::/3 are accepted, on directly connected LAN. Reject DNS names, brackets, embedded/mapped IPv4, zone IDs, loopback, unspecified, multicast and IPv6 link-local fe80::/10: V1 has no phone-local scope, never guess an interface. Reject actual interface subnet network/broadcast endpoints.

Native connection MUST have an OS-confirmed directly connected Wi-Fi/Ethernet route on a bound interface: no gateway, VPN, cellular, proxy, DNS, redirect or remote fallback. Unknown locality fails **before connect**; maintain the bound route/interface restriction through connection and fail on loss/change. Syntax alone is not locality or identity proof. No suitable address means visible unavailable invitation, not schema extension. This is bounded V1 LAN support, not remote connectivity.

**iOS-only scoped override — 2026-10-26:** [ADR0020](../decisions/0020-ios-local-network-admission-and-native-pairing.md)
permits native Wi-Fi/Ethernet interface evidence, same-prefix eligibility and
interface/address-bound raw sockets without claiming pre-connect gateway/VPN-free
direct-route proof or instantaneous change detection. Observed path changes and
failed current interface/address checks reject. Android/macOS/Windows retain the
paragraph above. Literal endpoint/no application proxy/DNS/redirect/fallback,
TLS/SPKI/exporter/HMAC, durable trust and separate PC-local file authorization remain.

No account/JWT/name/scope/phone-key/authority fields. Raw payload/secret MUST NOT enter logs, analytics, crash reports, URL query or DB; only transient scanner/display/native memory. Public fixtures contain labelled fake values, never actual configuration.

## Canonical fingerprint and TLS profile

Canonical SPKI is91 bytes: hex `3059301306072a8648ce3d020106082a8648ce3d03010703420004` || X32 || Y32, unsigned big-endian affine coordinates padded to32 bytes. OIDs: id-ecPublicKey `1.2.840.10045.2.1`, named secp256r1/prime256v1 `1.2.840.10045.3.1.7`. Validate on-curve, non-infinity and field bounds. Normalize provider public coordinates here; never hash PEM/JWK/platform blobs.

Actual TLS certificate SPKI MUST be strict DER with those OIDs and uncompressed65-byte point. Reject compressed/hybrid points, explicit or NULL parameters and other curves; do not create alternate fingerprints. Phone extracts the actual handshake certificate public coordinates after profile validation, constructs this canonical91-byte encoding, computes SHA256, and compares raw32 bytes with decoded `pc_spki_sha256`. QR encoding is unpadded base64url of that raw hash. Never hash the entire certificate or IP. Same key/new certificate retains pin; capability exact-DER reissue remains separate.

Dedicated ALPN ASCII `kloda-pair/1`; direct TCP TLS1.3 only. V1 suite **TLS_AES_128_GCM_SHA256** only; ECDHE **secp256r1**; CertificateVerify **ecdsa_secp256r1_sha256**. Require phone client certificate in the initial handshake, never post-handshake auth. Disable PSK, resumption, caches, ticket issuance/acceptance and0RTT on both ends; reject resumed handshakes. Standard TLS engine validates CertificateVerify and Finished; no custom handshake or caller success flag.

Explicit pinned-certificate profile, not accept-all: exactly one self-signed X509v3 leaf, at most4096 DER bytes, canonical P-256 SPKI, verified ECDSA-SHA256 self-signature, issuer=subject. Required critical basicConstraints CA=false; required critical keyUsage digitalSignature only. Required EKU serverAuth for PC, clientAuth for phone (both allowed). Reject duplicate extensions, unrecognized critical extensions and malformed validity. Require local OS UTC within inclusive notBefore/notAfter; missing time, invalid/expired certificate fails visibly, never bypasses or requires backend time. SAN/CN is not identity; no DNS/hostname pin substitute, intermediate/CA-chain or OCSP network fetch. Same-key renewal does not reset TTL, trust or authority.

Phone compares actual PC key to scanned/persisted expected fingerprint/pin. PC provisional verifier applies **all** certificate/key/handshake requirements but permits previously unknown phone-key possession for initial pairing only; this sets no durable trust or file permission. Recovery additionally requires exact consumed phone pin. Root-based `allow_unauthenticated`/`no_client_auth` are not substitutes. Actual verifier/provider integration remains unverified.

## Exporter, transcript and HMAC

Lengths are octets; `||` means concatenation. ASCII has no terminator except explicit `00`.

- Label: exact ASCII `EXPORTER-KLODA-QR-PAIR-V1`, no NUL.
- C = ASCII `KLODA-QR-PAIR-V1` || `00` || version`01` || sid16 || pcFingerprint32 || phoneFingerprint32 =98 bytes.
- CB = RFC8446 §7.5 **normal** TLS exporter(label,C,32), never early exporter. Each endpoint independently derives CB from its own completed full mutual TLS session, after peer CertificateVerify/Finished and version/ALPN/profile checks. Use actual live keys and validated sid, never peer-supplied CB. Error aborts channel; no hash/random fallback.
- T = ASCII `KLODA-QR-PAIR-V1-PROOF` || `00` || version`01` || role`01` || type`01` || sid16 || pcFingerprint32 || phoneFingerprint32 || CB32 =138 bytes.
- Roles:01 phone,02 PC; type01 phone_proof. Fixed PC,phone ordering; no JSON, timestamp, IP, name or account fields.

| Value | C offsets (inclusive) | T offsets (inclusive) |
|---|---|---|
| ASCII domain |0–15 |0–21 |
| NUL |16 |22 |
| Version |17 |23 |
| Role |absent |24 |
| Type |absent |25 |
| sid |18–33 |26–41 |
| PC fingerprint |34–65 |42–73 |
| Phone fingerprint |66–97 |74–105 |
| CB |absent |106–137 |

Tag = HMAC-SHA256(raw secret32,T), full32 bytes. Standard HMAC library; check tag length then constant-time comparison. No HKDF or directional keys: uniform dedicated secret and explicit domain/role/type serve this single purpose. Tag is binary on TLS wire; lowercase64-character hex is documentation only.

Only phone_proof uses QR-secret HMAC. Commit, ACK, recovery and completion are authenticated by a fresh mutually authenticated pinned TLS session and exact sid/state/direction checks; they have no retained-secret or secondary homemade MAC. Their application transcript is exactly the frame body below under TLS record protection. A secret tag is never another message type.

Phone zeroes raw secret after constructing/sending its single proof. Exact tag may remain only for same-channel duplicate handling. PC serializes verification/reservation and zeroes secret when a winner is established; it recognizes an exact duplicate from the retained winning frame/session, not HMAC recomputation. Invalidation/cancel/expiry or winning-channel failure zeroes remaining buffers. Rejecting an unrelated unproved contender does not erase live OPEN secret. Raw secret, tag and exporter MUST NOT persist; restart cannot recreate a preconsume invitation.

## Minimal frames and deadlines

Frame = u16be(bodyLength) || body. Common body = version01:u8 || type:u8 || sid16. Only body lengths18 and50; reject length>50 before allocation. Body offsets: version0, type1, sid2–17, proof tag18–49. Incremental parser MUST support fragmented/coalesced TLS reads and reject wrong length, extra fields, unknown type/version, direction/state mismatch and EOF midframe. One sid per channel; no file traffic, JSON or HTTP.

| Type | Name / sender | After common18 | State, effect and duplicate behavior |
|---|---|---|---|
|01 |phone_proof / phone |tag32; body50 |First initial-channel message after durable phone PENDING. PC OPEN+valid profile/HMAC/TTL atomically reserves. Exact duplicate on same reserved channel no-op; other candidate rejected. |
|02 |recover / phone |none; body18 |First fresh-channel message from retained pending/pin with same local identity. PC requires consumed sid, exact live phone/local key+epoch, no deny. Missing/preconsume/different-key closes; never reserves. Matching duplicate on the same recovery channel resends the same commit without changing records. |
|03 |pc_commit / PC |none; body18 |Only after durable consume+pin or replying to recover. Phone exact pending sid/PC/local identity match; atomically durable pin/PINNED_PENDING_ACK then ACK. Matching duplicate reuses record/ACK. |
|04 |phone_ack / phone |none; body18 |Only after durable phone pin and matching commit on this channel. PC CONSUMED→COMPLETE durable, then completion. Same-pair duplicate in COMPLETE is idempotent and resends completion. |
|05 |pc_complete / PC |none; body18 |Only after matching ACK and durable PC COMPLETE. Phone durably marks COMPLETE; matching duplicate no-op. Lost final reply recovers via recover→commit→ACK→complete even if PC already COMPLETE. |

PC approval is a local UI action, not a wire frame. Role derives from TLS client/server, not caller role/trust flag. Types02–05 forbid tag. Captured type01 cannot become ACK by changing type/length/state or moving to a fresh channel. Only the documented duplicates in their matching live flow are legal; unexpected messages close.

No application error frames: close on error/deny/cancel, local sanitized typed reason only. Standard TLS alerts/close_notify remain. Remote disconnect is `connection_closed`/`outcome_unknown`, not fabricated specific rejection.

Connect+handshake deadline10s; first complete frame10s after handshake; incomplete frame10s from first byte. Postconsume/recovery progress inactivity10s. Waiting human approval uses the original PC120s invitation lifetime, not10s. Valid forward progress alone resets inactivity; duplicates do not extend deadlines, and nothing renews invitation TTL. No automatic network retry loop; explicit user resume opens a fresh full channel. Duplicate scans never launch another session.

## States, atomicity, persistence and recovery

### Lifetime and linearization

One live invitation per PC pairing UI. New invitation explicitly cancels the old preconsume invitation. OPEN lifetime is120s from PC trusted elapsed clock, including suspend; unknown elapsed fails closed. TCP/TLS or invalid unproved peer does not reserve/invalidate another's OPEN invitation. Valid possession+HMAC CAS alone binds exact phone canonical key, transcript and channel generation to RESERVED and hides QR. Competitors are rejected without mutating winner. Winning preconsume disconnect/failure/cancel/deny/expiry invalidates invitation; never OPEN again with the old secret.

APPROVED is memory-only. PC serialized transaction/fence checks exact reservation, live channel/local identity/epoch, no deny and elapsed<120s; orders approval/cancel/expiry against commit authorization. At120s no new commit authorization. A transaction authorized before the deadline may finish persistence afterward; expiry cannot undo that ordered decision. Cancel/revoke arriving after authorization is ordered after the commit and, if committed, writes REVOKED rather than claiming rollback. No success before durable commit. Failure/uncertain outcome never reports complete; restart resolves durable consumed+pin to recovery, absence to invalid invitation, unreadable/uncertain storage to storage_failure/outcome_unknown.

### Durable records

PC atomic tuple: `(v=1,sid16,localCanonicalSpki91,localInstallEpoch16,peerCanonicalSpki91,state=CONSUMED|COMPLETE|REVOKED)`. Unique sid and immutable key binding. Hash derives from key; any cached hash MUST agree. Local epoch16 is CSPRNG once per installation, excluded from backup/transfer; reuse a valid existing epoch. Key/epoch loss invalidates records; temporary provider lock means wait, not regeneration. No wire install ID or extra key-generation counter: public key+local epoch+sid suffice. Peer epoch is not remotely observable; restore exclusion/perfect rollback detection remains a platform gate. Optional created_at is audit only, never TTL/trust/authority.

**Before phone_proof**, phone atomically persists `(v=1,sid16,expectedPcFingerprint32,localCanonicalSpki91,localInstallEpoch16,state=PENDING)` with no secret. PENDING is endpoint/binding continuity, not peer trust/file grant. Authenticated pc_commit atomically adds canonical PC key matching the expected hash and state PINNED_PENDING_ACK; ACK only follows durability. pc_complete durably marks COMPLETE. Phone revocation/explicit abandonment must durably disable the retained record before stale callbacks/recovery can use it.

Phone MUST separately persist validated LAN IP/port as non-authoritative retry metadata alongside PENDING, not in the trust tuple/hash/transcript. Reapply locality/profile checks on every retry. Unreachable hint means visible pending until explicit resume with a reachable saved hint or fresh QR; no DNS/discovery/remote fallback. Hint changes never change expected pin; untrusted backend metadata cannot supply a new hint. This supports restart after a lost response without rescanning a consumed QR.

Retain PC consumed/pin records beyond TTL/restarts, for installation lifetime; no expiry deletion. Revoke/cancel-after-commit writes REVOKED tombstone, never reopens sid; late ACK fails. Phone pending/pin remains until explicit abandonment/revocation. Lost pending/pin or changed local key/epoch never auto-adopts a peer: fresh QR required. Postcommit cancel promises neither distributed rollback nor remote deletion. New invitation never overwrites trust/deny automatically: active same-peer gives already_paired; revoked peer needs explicit local re-pair consent/new sid, without clearing separate file deny/grant. Session generation/close/callback serialization forbids stale-handle mutation.

### PC transitions

| Precondition / event | Transition | Durable effect | Failure |
|---|---|---|---|
|Valid identity/store/local route; UI create |New→OPEN |None; random transient sid/secret |No invitation on random/locality/continuity failure |
|Socket or invalid/unproved contender |OPEN→OPEN |None |Close contender only |
|OPEN, valid profile+proof, elapsed<120s, CAS wins |OPEN→RESERVED |None; exact candidate/channel retained |Loser closes, winner unchanged |
|Exact candidate/generation local approval |RESERVED→APPROVED |None |Stale approval has no effect |
|Serialized live reservation+identity+epoch+no deny+TTL authorization |APPROVED→CONSUMED |Consume+pin atomic tuple |Failed/unknown write: no success, invitation invalid; inspect durable result for recovery |
|Matching ACK after commit sent on this channel |CONSUMED→COMPLETE |Atomic state update, same key |No completion on failed write; retain consumed for recovery |
|Matching ACK after recovery commit, already COMPLETE |COMPLETE→COMPLETE |No duplicate pair |Resend completion |
|Consumed/complete sid, fresh exact mutual pins, same local epoch, no deny; recover |State unchanged |None; resend commit |Wrong/missing key/sid/preconsume/revoked closes |
|Preconsume winner failure/deny/cancel/expiry/restart |→INVALID |No trust; destroy transient state |Cannot reuse old secret |
|Postconsume revoke/cancel |CONSUMED/COMPLETE→REVOKED |Durable tombstone before accepting later work |Failed/uncertain write blocks work, no rollback claim |

### Phone transitions

| Precondition / event | Transition | Durable effect | Failure |
|---|---|---|---|
|Strict QR/locality/identity/profile valid, before proof |New→PENDING |Binding+hint atomic persistence |Write failure: no proof/network progress, no trust |
|PENDING durable on initial channel |PENDING→PENDING |None; send single proof, zero secret |Disconnect remains pending/outcome_unknown |
|Exact authenticated commit matching sid/expected PC/local identity+epoch |PENDING→PINNED_PENDING_ACK |Canonical PC key+pin atomic write |Write failure: no ACK |
|Pin durable, matching commit on channel |PINNED_PENDING_ACK→same |Send ACK, no added authority |Lost ACK: retain pin, explicit recovery |
|Matching completion after ACK |PINNED_PENDING_ACK→COMPLETE |Durable COMPLETE |Failed write: pending ACK state retained; recover |
|Matching duplicate commit/complete |Existing pinned state→same |Reuse record/ACK; COMPLETE never downgraded |Mismatched direction/state/key closes |
|Retained pending/pin, exact local continuity, explicit resume |State unchanged |Fresh full TLS then recover |Missing binding/local loss/wrong PC/revoked: reject, no adoption |
|Explicit abandon/revoke |→disabled/revoked |Durable disable/tombstone |Stale callbacks cannot resurrect; does not delete PC pin |

### Crash and loss table

| Boundary | Surviving state / action |
|---|---|
|Phone crash before PENDING commit |No binding; no proof may have been sent; fresh QR |
|Phone crash after PENDING, before/after proof send |PENDING+hint only; no secret restored; explicit fresh same-key recover; PC preconsume rejects, consumed returns commit |
|PC crash OPEN/RESERVED/APPROVED before consume commit |No durable trust; invitation invalid; retained phone pending cannot recreate it |
|PC crash during consume commit / uncertain result |Atomic absent or consumed+pin, never partial tuple; inspect after restart; unreadable store stays unknown |
|PC crash after consume before commit response / lost response |One consumed pin survives; phone PENDING+hint resumes exact keys and obtains commit |
|Phone crash during pin write |Atomic PENDING or pinned state; no ACK before durable pin |
|Phone crash after pin before ACK / ACK loss |Both pins may exist, PC consumed; fresh recover→commit→ACK |
|PC crash before COMPLETE write |Consumed survives; matching ACK can finish after recover |
|PC crash during/after COMPLETE write before reply |Consumed or COMPLETE atomically; no reply until durable COMPLETE; recovery idempotent |
|Final completion lost / phone crash before COMPLETE write |PC COMPLETE, phone pinned pending; recover→commit→ACK→complete |
|Phone crash during/after COMPLETE write |Pinned pending or COMPLETE atomically; repeat completion no duplicate pair |
|Any required write fails |No subsequent success/ACK depending on that write; preserve last durable state; storage failure/unknown visible |
|Duplicate recovery / wrong-key recovery / late ACK after revoke |Same exact pair idempotent / reject / reject; never reopen invitation |

Safety invariant: **one unique sid never yields two different durable peer keys**. There is no distributed all-or-nothing transaction. Pins/pending never bypass separate account/capability/scope/time/deny/publication authorization.

## Minimum native behavioral contract

Names below are conceptual operations, **not existing framework ABI/exported APIs**. Native owns identity, certificate, TLS, exporter, HMAC, secret, state and transactions. Managed UI only transiently displays/scans QR, approves/denies the exact candidate, cancels/resumes and consumes sanitized events. JS receives no private key, raw signer handle, exporter/tag, arbitrary-sign API, writable trust store or caller-created trust context.

| Operation | Input | Output / ownership | Required failure behavior |
|---|---|---|---|
|Identity ensure/open |Native installation context, no caller key override |Canonical public key/fingerprint, truthful hardware class; owned key handle internal |Create only first installation without identity-bound state; otherwise open exact key or identity_unavailable/continuity_lost. No silent software/export fallback. Hardware key signing is limited to native-owned V1 certificate TBS create/renew and standard TLS CertificateVerify callbacks; neither operation exposes arbitrary-sign or a raw key/signer handle to JS. |
|Invitation create/cancel |Local UI action / opaque operation ID |Transient QR and opaque ID; native owns120s clock/secret/listener; one active invitation |Enforce durable deny and state; cancel invalidates generations/zeroes secret; postcommit cancel revokes, not rollback |
|Scan/start |Untrusted transient QR |Strict native parser, bound route/client, opaque sanitized events |PENDING durable before proof; never a peer-pin setter. Reject duplicate scans rather than open sessions |
|Owned listener/client |Native identity/cert and validated hint/state |Real profile/possession/locality, immutable internal peer facts, internal post-handshake exporter |Unsupported actual API→native_unsupported; no fake evidence, trust bool or received exporter |
|Approve/deny |Exact opaque operation+candidate generation |Native state/TTL/identity/fence recheck and transaction; reserved, consumed_pending_ack, complete, invalid, revoked events |Stale candidate→candidate_stale; deny/cancel/revoke wins according to serialized ordering |
|Resume/status |Native retained record reference only |Fresh TLS recovery; public read-only trust/pending status |No caller sid/key override. All writes internal atomic state machine; loss/revocation cannot auto-adopt |
|Close |Owned operation reference |Cancel I/O, zero transient secret, invalidate generation |Retain owner until callbacks drain/join; promise resolution is not evidence native operations stopped. Durable consumed/pins remain subject to explicit revoke |

Events report only observed native state. `consumed_pending_ack` means PC has committed but distributed completion is not known. Local typed errors are exactly: `invalid_qr`, `unsupported_version`, `lan_unavailable`, `native_unsupported`, `identity_unavailable`, `continuity_lost`, `tls_rejected`, `proof_rejected`, `invitation_expired`, `candidate_stale`, `already_paired`, `storage_failure`, `connection_closed`, `outcome_unknown`, `cancelled`, `revoked`. No secrets or raw QR/cert/key-handle data in errors. Unsupported version is a syntactically valid non-V1 version; malformed/coerced version is invalid_qr.

Actual Swift/Kotlin/C/Node/provider API and ABI mapping remains unverified, not unspecified security behavior. Native integration requires selected source/API/ABI demonstrably meeting every requirement; no weakened TLS/profile/exporter/locality/atomic-store substitute.

## Threat review and remaining gates

SAFE means protocol reasoning under the specified endpoint assumptions, **not audit/runtime pass**. Exactly the requested12 cases:

| Threat | Result / residual | Still-open implementation gate |
|---|---|---|
|Stolen/live QR |Residual: valid own-key racer, mistaken PC approval and DoS; short lifetime/approval reduce, do not eliminate |Secret hygiene, real UI and reservation race |
|Replay |SAFE: fresh full TLS exporter+sid/state; captured tag fails new channel |Native exporter and replay rejection |
|Double scan/race |SAFE unique CAS/consume; availability residual |Actual concurrency/transactions/scanner single-flight |
|LAN MITM |SAFE against unpinned key substitution |Real TLS/profile/SPKI/locality |
|Fake QR |Residual: scanning attacker's valid PC authenticates the wrong human-intended endpoint |QR origin/UI/social engineering remains |
|Wrong PC key |SAFE fingerprint+CertificateVerify |Live key extraction/profile validation |
|Wrong phone key |SAFE substitution; stolen-secret valid-own-key candidate remains residual |Mutual TLS/proof and exact approval |
|Cross-message HMAC |SAFE role/type/length/state separation |Native parser/state/direction rejection |
|Consumed invitation |SAFE same-key recovery only; no old secret reopening |Durable tombstones/continuity/recovery |
|Malformed QR |SAFE strict bounded duplicate-aware parser |Actual codec/fuzz/boundary implementation |
|Backend substitution |SAFE registry never pin authority |No writable caller/backend trust setter |
|Approval→commit crash |SAFE atomic durable outcome+same-key recovery, not distributed atomicity |Actual store/fence/crash/write-failure proof |

[Production gates](production-gates.md) G01/G03 aggregates remain open. G03's protocol/minimum-native specification subdeliverable is frozen, not runtime closure. Real Android↔PC LAN/exporter, final Rust/native bridge, desktop hardware, iOS physical, background, remote DTLS/signaling and all [36 authority targets](capability-acceptance.md) remain open/not-executed. [QR01–QR33](../implementation/qr-pairing-implementation-roadmap.md#future-adversarial-acceptance-matrix) remain not-executed; documentation vectors do not pass them.

Android physical hardware-backed P-256→TLS1.3 CertificateVerify **CLOSED/PASS (SM-S921B/API36)** remains unchanged, device-local native server/client on one device; no rerun. Physical iOS is deferred, not simulator-proven. Native locality/exporter/provisional verifier/atomic store/elapsed continuity/restore exclusions require actual selected integration and physical evidence.

Implementation requires a **separately authorized coding task** using this frozen source and actual selected native source/API/ABI meeting the contract. The original documentation-freeze execution began no product code; subsequent authorized implementation and remaining hardware gates are recorded in ADR0014 and the QR roadmap. No new ADR is needed merely for constants.
