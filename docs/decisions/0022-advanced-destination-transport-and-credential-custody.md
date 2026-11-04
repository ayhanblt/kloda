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

## Step17 scoped credential/test approval — 2026-11-03

The user approved user-supplied, bucket/prefix-scoped access key and secret plus
optional session token in device-native secure storage, and a real-server test
with their existing Amazon S3 account. Secrets will be entered only in the app's
secure input screen. Provider/test readiness must be checked first; substantial
setup/work/time and any new resource/cost scope must be explained before proceeding.
The user has no ready test bucket/region/prefix setup and requested sequential
guidance. No new account, bucket, IAM user/role or billing resource is created
by this decision. It is not personal-media cloud/E2EE/retention/remote-authority
or physical acceptance. P5 production vendor selection remains open.

## Step17 V1 data model — user decision, 2026-11-04

The user explicitly selected option A: “V1: TLS + AWS SSE-S3 ile ilerle”. Amazon S3 V1 uses direct HTTPS/TLS and the bucket's AWS SSE-S3 server-side encryption; Kloda does not add client-side E2EE. AWS and authorized account access can read object content. Implement the product with this stated model and native credential custody. Actual personal-source transfers still require explicit source/destination opt-in in the app; the completed synthetic test does not trigger them.

Do not infer AWS at-rest guarantees for another P5 vendor. P5 vendor/at-rest verification stays open. No cloud-delete/retention/adoption policy, IAM scope expansion, further paid-resource creation or physical acceptance is authorized by this decision. Future Kloda E2EE/key recovery remains a separate design, not a blocker to this selected V1 model. LAN contracts are unchanged. [Concrete options and selected scope](../implementation/s3-personal-cloud-decision-2026-11-03.md).

## Preserved boundaries

ADRs0010/0016/0017/0018/0019/0020 remain unchanged in their scopes. No identity,
pin, epoch, authority, personal archive migration/reset or software-key fallback.
Cloud delete/retention, Kloda media E2EE/key lifecycle, final remote authority and
physical acceptance remain open. This ADR does not choose one-vs-many automatic
backup destinations when PC and WebDAV coexist; step15 records that product gate.

[Research and remaining checks](../implementation/provider-decision-matrix-step14-2026-10-29.md).

## FTPS practical verification — user decision, 2026-11-03

For FTPS only, the user approved practical transfer checks in place of the previously proposed mandatory atomic no-clobber and explicit remote durability acceptance gates. No custom server extension will be developed. Check for existing names and refuse/choose a fresh job-bound name; require successful transfer completion and a fresh full readback matching size and SHA256 before local transfer-verified admission. This is not an atomic no-overwrite guarantee or proof of persistence after power loss. Existence-check races remain a known protocol limitation. Do not advertise stronger guarantees.

Unknown create/upload/rename results remain in review; no blind retry, hash-only adoption or automatic Completed inference after a lost ACK. Retain request/job/target/source/profile binding and durable local receipts. This FTPS decision does not weaken SMB/SFTP or PC/WebDAV contracts. AUTH TLS/PROT P, full certificate+hostname validation, LAN-only and native control+data route/generation fences remain required. The separate disposable fixture CA permission does not authorize product custom-CA trust.
