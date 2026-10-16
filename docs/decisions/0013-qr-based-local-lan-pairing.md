# ADR0013 — QR-based local LAN pairing

> **Current V1 LAN override — 2026-10-13:** [ADR0016](0016-v1-pc-local-file-authority.md) supersedes item 5's central enrollment/eligibility/step-up/capability/cache/online reauthorization prerequisites and item 6's exact-DER online-reissue dependency for the local ACL. **Trust is still not file authorization:** separate explicit PC-selected backup-scope approval is required; no folder means pairing only. Frozen QR bytes/state/channel proof are unchanged; valid native certificate/profile, TLS/pins/possession/continuity/revoke/fence remain. FINAL remote authorization and recovery/central revocation versus offline PC/local grants are OPEN. QR implementation evidence does not prove ACL/receiver/online unpair.

- Date: 2026-10-07 (execution clock; approval timestamp is not inferred).
- Owner: Ayhan.
- Status: **accepted direction; implementation/build/synthetic evidence recorded, physical adoption blocked**.
- Scope: current initial peer trust; supersedes Matrix/SAS first-pairing requirements and QR-optional wording in ADR0001/0003/0004/0005/0007/0008/0009/0010/0011/0012. Unrelated authorization, framework, certificate, remote and scheduling decisions remain unchanged. Historical source/evidence/results remain historical.

## Decision

1. PC creates a local invitation from its active pairing screen and displays a local QR. Phone scans QR only using expo-camera. qrcode/node-qrcode is the V1 desktop tooling candidate/roadmap target; no remote QR service. Nayuki is only a historical dependency-minimization alternative, not research, TODO or blocker. No package version or installation is selected in this documentation execution.
2. QR carries a PC LAN address hint, canonical P-256 SPKI SHA256 fingerprint (hash of public-key encoding), and one-time secret. Address is not a trust anchor. On the **actual same fresh full TLS1.3 channel**, phone verifies PC Kloda private-key possession and actual SPKI fingerprint equality; PC verifies phone P-256 TLS possession. Initial phone certificate is provisional, not an already trusted CA/pin. Native handshake signature verification is never bypassed; possession alone is not durable trust.
3. HMAC (secret-authenticated proof) binds the invitation secret to that same connection/transcript. Secret equality or caller `trusted=true` is insufficient. After explicit PC approval each endpoint durably pins the other's exact public key locally. Backend, login, Matrix/homeserver, signaling and STUN/TURN are not initial LAN trust prerequisites.
4. Matrix is removed from the current pairing path. Missing Matrix keys, SDK/source/Olm/FFI/store/homeserver, upstream signer or fork cannot re-enter as renamed gates. Separate long-lived Kloda-owned P-256 identity remains; the retired single-Matrix-key decision does not return. Second QR, SAS or fingerprint comparison is not a required V1 gate.
5. **Trust is not file authorization.** Initial QR trust/local pins can complete without internet/backend/login. They do not create account enrollment, same-account file eligibility, operation step-up, PC scope approval, capability issuance, revoke handling, offline file authorization or file access. First **file grant** cannot be created through the offline cache exception. Required identity/epoch/pin loss requires fresh local QR trust and separately necessary online authorization; recovery grant reopening follows existing control policy, not SAS.
6. In this initial LAN profile, QR fingerprint matches the Kloda P-256 key **actually used as TLS SPKI**. This resolves ADR0012's key==TLS-SPKI uncertainty only for initial QR LAN pairing. It does not derive remote DTLS/signaling binding. QR SPKI hash is not the capability's exact certificate-DER hash; certificate renewal/reissue policy remains.
7. A stolen QR photograph can let an attacker reserve a valid candidate with their own key within TTL; mistaken PC approval remains social-engineering risk. Racing/DoS remains possible. Short TTL, one-time secret, atomic reservation/consumption and PC approval reduce, not eliminate, risk. QR leakage alone is not long-lived private-key compromise, old-file decryption or PC identity compromise.
8. Remote WebRTC/DTLS, P2P-first/Cloudflare TURN fallback and signaling fingerprint↔identity remain separate. Remote proof does not reopen the accepted QR LAN direction.

## Contract and implementation boundary

[KLODA-QR-PAIR-V1 frozen protocol](../security/qr-pairing-v1-protocol.md) is the sole byte/native/state source. Its codec/SPKI/TLS/exporter/HMAC/framing/lifetime/consume/pending/pin/recovery rules remain frozen. Native Rust and Android/Electron integrations are implemented under ADR0014; build/synthetic evidence does not verify hardware custody or physical LAN adoption.

[Implementation/evidence roadmap](../implementation/qr-pairing-implementation-roadmap.md) records the separately authorized coding work and outstanding Mac signing/physical Android↔PC gates. The original documentation freeze did not authorize code by itself. Production/file-authorization gates remain open.

## Evidence limits

Android physical hardware-backed P-256→TLS1.3 CertificateVerify is a narrowly scoped CLOSED/PASS on SM-S921B/API36, device-local native server/client. It is not final-app Android↔PC LAN, Rust bridge, iOS physical, desktop hardware, background or authority proof. [Production gates](../security/production-gates.md) retain those boundaries; all [36 authority cases](../security/capability-acceptance.md) remain not-executed. No experiment is rerun here.
