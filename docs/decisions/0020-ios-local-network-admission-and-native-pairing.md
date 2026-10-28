# ADR0020 — iOS local-network admission and native pairing

- Date: 2026-10-26.
- Owner: Ayhan.
- Status: accepted iOS-only locality difference; implementation/runtime evidence separate.

## Approved scope

Ayhan explicitly accepted the following difference after being told why the existing
V1 pre-connect direct-route/no-gateway/no-VPN proof was not established on iOS.
This supersedes only that iOS route-evidence requirement in ADR0013/0014 and the
frozen protocol's native-locality paragraph. Android, macOS and Windows keep their
existing stricter platform route checks. QR bytes and peer protocol are unchanged.

| Requirement | iOS contract |
| --- | --- |
| Endpoint | Existing strict QR literal IP/port and range parser; no DNS, redirects or remote fallback |
| Native network choice | Network.framework native interface type/index/name mapped to actual getifaddrs address/prefix; Wi-Fi/Ethernet only |
| Socket restriction | Existing raw BSD TCP path bound to that interface/local address; read back binding and validate actual local/peer endpoints |
| Address eligibility | Peer is eligible in the selected actual local prefix; unknown interface/address evidence refuses before connecting |
| Direct/no-gateway/no-VPN proof | Not guaranteed; a Wi-Fi/Ethernet-bound same-prefix endpoint is not asserted to prove a gateway/VPN-free path |
| Network changes | Recheck native interface/address and observed path generation at existing I/O boundaries; observed change invalidates that witness permanently |
| Detection timing | Native path observations can arrive late; no instantaneous route-change or zero-byte-after-physical-change guarantee |
| TLS and authorization | Fresh full TLS1.3, hardware P-256 possession, QR/SPKI binding, exporter/HMAC, exact PC approval and durable pins remain; separate PC-local file grant remains mandatory |

The raw socket/TLS engine remains in Rust. Network.framework observes path metadata;
it is not a new byte transport, proxy preference or TLS provider. Native observations
and interface binding must not be replaced by JS booleans, guessed interface names
or a caller-supplied trusted context. No central login/JWT/KMS is introduced.

## Native integration boundaries

- Reuse existing phone owner, TLS, authority store, monotonic clock and foreground
  epoch mechanisms. Native iOS UI activity and a synchronous inactive fence must
  cover queued/asynchronous trust writes, not only the initial JS call.
- Use the existing non-exportable Secure Enclave P-256 provider, ThisDeviceOnly /
  WhenUnlocked protection and no per-operation biometric prompt. Missing hardware
  refuses; no software identity, legacy Keychain or migration/adoption fallback.
- Swift chooses private application-data location, never JS. Keep owner lock,
  epoch/certificate/pin continuity, private modes, durable writes and backup exclusion.
  Simulator cannot substitute for Secure Enclave: fail before creating authority files.
- Existing system-SQLite Swift journal and Rust bundled SQLite must be checked in
  the linked application. Do not change engines or add a second generic journal
  without an observed need and a separate decision if required.
- Files queue/restore, Photos/ADR0017–0019 and background/scheduling remain later
  mobile steps6–8. This decision does not promise locked-device background signing.

## Acceptance

Compile device and simulator targets; exercise native ABI/foreground/decoder and
platform witness failure cases in disposable fixtures. Check Android foreground,
background-owner and shared-API regressions. Record actual final-app linkage and
Expo module availability; module registration alone is not pairing success.
Simulator results are not iPhone hardware/LAN acceptance. No existing archive,
key/pin/certificate/epoch/authority or platform blocker is reset or migrated.

The selected guarantees and their deliberate limits must remain visible in handoff
and evidence. Unknown or failed native checks are errors, never synthetic ready/
paired/completed results. Release signing and physical acceptance remain separate.

## Implementation follow-up — 27 October 2026

[Files step6](../implementation/ios-files-step6-2026-10-27.md) connects the existing
sender and native current-record/foreground epoch to persistent jobs/own restore.
This is source and isolated evidence, not iPhone/PC LAN acceptance. Photos/background
remain later steps; no locality, key fallback or PC-local ACL guarantee changed.
