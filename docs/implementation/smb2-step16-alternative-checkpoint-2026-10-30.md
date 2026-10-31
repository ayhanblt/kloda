> D6A kullanıcı tarafından onaylandı; exact patch adoption ve dar güncel kanıt new-chat handoff girişindedir. Aşağıdaki tanı/karar kaydı tarihseldir. D7A da onaylandı; güncel native iş [tek checkpointte](smb-native-publication-checkpoint-2026-10-30.md).

# SMB16a — alternative Rust candidate and narrow compatibility decision

D5 A approved: evaluate alternative shared-Rust engine without carrying the
SSPI/RSA fork. **SMB remains disabled;16a is incomplete.** No alternative SDK,
patch, JNI/C/Swift export or app linkage was adopted in the product crate.

## Exact candidate and dependency/platform results

Published `smb2=0.36.2`, MIT OR Apache-2.0, source commit
8a7bfc60a5119fd3d8c16d39a7ecefeea02fbb0e.0.36.0 was initially resolved during
lookup; testing uses the newer published patch0.36.2 at a fixed checksum/lock.
Features: defaults off, Tokio only.71 resolved registry versions; OSV query had
zero matches at capture, RSA/SSPI/Picky absent. This is not a vulnerability-free
claim. License inventory and immutable source/checksum are in evidence.

Context7 did not resolve this SDK: it returned different `smb-rs`/Go/Java/Python
clients. Their APIs were not used as documentation for this candidate. Exact
published source was read instead. Upstream main equals the published revision;
no unpublished upstream fix was found. No installer script, CLI package, issue,
PR or external message was executed/submitted.

Unmodified candidate/prototype cross-link passed all four Android API24 ABIs and
iOS16.4 arm64 device/Simulator under existing Rust1.99/NDK27.1. No mobile app,
physical device, native authority or SDK runtime acceptance follows from that.

## Required security test: unmodified candidate does not pass

The strict pre-auth prototype uses public low-level Connection/Session/Tree APIs;
high-level SmbClient DFS/reconnect/name-routing helpers are not used. Numeric
SocketAddr pins its test destination; real native LAN-route admission is still
open. No new global timeout; fixture uses its own5s remaining budget. A small
transport marker check requires encrypted frames in both directions after auth;
SDK still performs all cryptography/signature/decryption. These are /tmp evaluation
sources, not a deployed bridge. No protocol-byte rewrite is used by that guard.

On the same owned Samba4.19.5 required-encryption/signing fixture, the unmodified
client reports SMB3.1.1, no cipher, server capabilities0x7. The strict guard stops
before authentication or media payload. The positive transfer/fault matrix is
therefore **NOT_RUN for the unmodified candidate**, not PASS.

A bounded first-NEGOTIATE-only observer captured actual wire metadata, no auth,
keys or payload: request capabilities0x7, ENCRYPTION bit absent; response dialect
0x0311, capabilities0x7, context types1/8, no encryption context. The SDK source
hardcodes DFS|LEASING|LARGE_MTU in its negotiate request. Samba4.19.5 source emits
its encryption context only when the client advertises ENCRYPTION. This source
condition explains the observed interoperability failure; it is not a parser
error inferred from README claims.

Primary references:

- [Exact SDK negotiate source](https://github.com/vdavid/smb2/blob/8a7bfc60a5119fd3d8c16d39a7ecefeea02fbb0e/crates/smb2/src/client/connection.rs)
- [Samba4.19.5 negotiate source](https://github.com/samba-team/samba/blob/samba-4.19.5/source3/smbd/smb2_negprot.c)
- [MS-SMB2 SMB2-only negotiate](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-smb2/77f696b8-9aa0-4ed1-abb2-c097c0ccb05a)
- [MS-SMB2 negotiate response/cipher processing](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-smb2/3b29f3af-86f9-4962-8cf3-43471cb59363)

## Diagnostic-only one-bit variant

A separate /tmp copy of the exact SDK adds only Capabilities::ENCRYPTION to that
request. Registry cache, product Cargo.toml/lock and upstream source are untouched.
No cipher guessing, old dialect acceptance or unencrypted fallback was introduced.
This local test variant is not the user's approved fork-free production choice.
Its minimal diff is retained for review, not silently adopted.

With this single change the strict guard receives AES-128-GCM. Actual owned SDK
transfer1MiB/write+flush/received no-clobber rename/full-byte readback passes;
foreign final remains exact. Wrong password, SMB2-only and encryption-disabled
reject; the last two stop before the auth API. Real stripped-final-auth-signature
and corrupt-encrypted-TreeConnect proxies reject, with mutation counters checked.
The initial low-level negative test stopped at authentication, before the first
encrypted TreeConnect, so it did not exercise the ciphertext proxy; the fixture
was corrected to include TreeConnect, then the actual mutation/rejection passed.
It is not evidence that corrupt encryption was accepted.

Diagnostic variant platform results are recorded separately from the published
candidate. Passing diagnostic tests do not change the unmodified result or close
native LAN/context/credential admission, cancellation, durable SMB receipts,
lost create/write/rename, Files/Photos/restore/UI/OS or hardware gates.

## D6 — concrete exception to the fork-free direction

A — Allow this exact pinned one-bit compatibility patch while waiting for an
upstream release, keeping the shared Android/iOS Rust boundary. Preserve notices,
assert the exact upstream version/preimage, verify the patch is still needed on
upgrade, remove it when upstream fixes it, and run fresh native/recovery/product
gates before enabling anything. This is a much narrower maintenance obligation
than the rejected SSPI/RSA auth fork, but still a third-party source patch.

B — Keep the fork-free restriction. Leave SMB visibly blocked on the SDK fix;
retain all evidence and continue only independent roadmap/preflight work. No
silent third candidate, cipher guess, profile weakening or unapproved SDK fork.

The user must choose whether this source-patch obligation is acceptable. A
diagnostic proof does not authorize adopting it. No upstream message will be
sent without separate explicit instruction.12/13/15/20/21 acceptance limits remain.
Separate same-main-agent review only; no independent-agent review claim.
