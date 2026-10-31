# ADR0022 — Advanced destination transport and credential custody

- Date: 2026-10-29.
- Status: approved by the user, step14 D1/D2/D3 responses.
- Scope: advanced destination security policy; not adapter/runtime/physical acceptance.

## D1: LAN transport

SMB is LAN-only, SMB3 or newer with encryption and signing required. No plaintext,
older-dialect or unencrypted fallback. This is the approved advanced SMB transport
profile, not a change to PC-native pinned TLS/PC-local ACL.

The FTP option is explicit FTPS: TLS-protected control and data (`AUTH TLS`,
`PROT P`), full certificate and hostname verification, LAN-only. Plain FTP,
clear data, CCC or downgrade fallback are not permitted. Nonconforming servers
remain visible as blocked; no provider is silently removed. Implicit FTPS,
private-CA/custom pin trust or an alternative transport profile is not approved.

## D2: SFTP host identity and initial auth

Before connecting, the user obtains the server SHA256 host fingerprint through
an independent channel/administrator and supplies it for the exact host+port.
The client verifies it before releasing login credentials. Unknown or changed
keys stop the operation; a replacement requires independent verification and an
explicit update. No automatic TOFU or silent host-key rotation.

The first narrow auth slice uses username/password in the device-native secure
store. SSH private-key import/export/agent integration is not approved here.
The Kloda nonexportable device identity is not an SSH key and is never reused or
exported for this purpose.

## D3: Cloud credentials

Use device-native secure storage and only verified provider-supported native
public-client login flows. Do not create a central OAuth broker or server-side
token store, embed a confidential client secret, or adopt another tool's built-in
application credentials. Box remains visibly blocked until a secret-free native
flow is verified; it remains in scope, not silently omitted.

No provider account, app registration, billing resource, bucket, role or service
is created by this approval. Account/tenant/endpoint/root and credential revision
must remain bound to durable work; old receipts do not authorize another target.
A provider SDK/package/version and its dependency/license/platform validation
are separate implementation checks, not automatically accepted by this ADR.

## Preserved boundaries

ADRs0010/0016/0017/0018/0019/0020 remain unchanged in their scopes. No identity,
pin, epoch, authority, personal archive migration/reset or software-key fallback.
Cloud delete/retention, Kloda media E2EE/key lifecycle, final remote authority and
physical acceptance remain open. This ADR does not choose one-vs-many automatic
backup destinations when PC and WebDAV coexist; step15 records that product gate.

[Research and remaining checks](../implementation/provider-decision-matrix-step14-2026-10-29.md).
