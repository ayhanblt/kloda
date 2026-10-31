# Local upstream report draft — NOT SENT

Title: NEGOTIATE omits ENCRYPTION capability, Samba4.19.5 required-encryption returns no cipher

Candidate: crates.io smb2=0.36.2, upstream
8a7bfc60a5119fd3d8c16d39a7ecefeea02fbb0e, Tokio feature only. Server:
Samba4.19.5, server min protocol=SMB3_00, max=SMB3_11, server signing=mandatory,
server smb encrypt=required, a new disposable local share. No real credentials
or user server is needed; the observed failure occurs before authentication.

Reproduction: Connection::connect -> set_compression_requested(false) ->
set_response_timeout(test budget) -> negotiate -> params. Actual first-NEGOTIATE
wire metadata: request capabilities0x7 (no0x40 ENCRYPTION), response dialect0x0311,
capabilities0x7, negotiate context types1 and8, no encryption context. params.cipher
is None. A consumer requiring an explicitly negotiated cipher stops here.

Source-supported explanation: client Connection::negotiate advertises only
DFS|LEASING|LARGE_MTU. Samba4.19.5 source3/smbd/smb2_negprot.c gates its encryption
capability/context on the client's ENCRYPTION capability. The client already
supports/advertises encryption algorithms, so the omitted capability makes these
peers fail to negotiate encryption. See the linked MS-SMB2 client negotiation
rules in the alternative checkpoint. This is an interoperability report, not a
claim of a demonstrated exploit or a CVE.

Proposed smallest fix: include Capabilities::ENCRYPTION in the request's
capabilities when SMB3 encryption is supported/offered. A separate local copy with
only this bit added negotiated AES-128-GCM, passed1MiB/exclusive create/flush/
no-clobber rename/foreign preservation/readback and rejected wrong password,
SMB2-only, encryption-off, stripped final-auth signature and corrupt ciphertext.
Four Android ABI and two iOS target compile/link proofs are separate records.
The production SDK has not been patched or adopted; no on-wire mutation or cipher
guess was used as a workaround. Packet observer stored fields only, no payloads.

Suggested upstream regression: negotiate with encryption+signing-required Samba,
assert ENCRYPTION request bit and a selected cipher, then actual encrypted I/O.
Keep existing guest/SMB2 tests for the upstream general-purpose library.

This draft is local evidence only. Do not submit an issue/PR/message without a
new explicit user instruction. No account, repository fork, remote or commit was
created by this evaluation.
