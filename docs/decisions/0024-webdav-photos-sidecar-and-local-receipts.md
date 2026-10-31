# ADR0024 — WebDAV Photos sidecar and local receipts

- Date: 2026-10-29.
- Status: approved by the user.

WebDAV Photos uses a separate versioned sidecar. Preserve source-installation,
source asset and revision, resource role/original name/MIME/SHA256/size,
source albums and favorite metadata. Bind resources by safe relative paths on
the same WebDAV destination. Only resources completed locally after a received
no-overwrite MOVE ACK and exact-byte verification may be referenced.

The sidecar itself requires the same publication/verification before it becomes
restorable. Restore validates the sidecar and each referenced resource again,
using this device's target-bound local completed receipts. Source identities
remain distinct from target library/asset identities; existing native import
intent/reconciliation and no-blind-duplicate rules remain.

PC ADR0017 strict sidecar, PC-issued operation IDs and PC-local authority are
unchanged. Do not fabricate PC operation IDs for DAV resources. No other-device
discovery/adoption, remote ownership inference from equal hashes, cloud deletion
or retention policy is authorized. ADR0010 unknown-result fences, ADR0022 native
credential custody and ADR0023 independent explicit destinations remain.

This approves the contract, not implementation, runtime or physical acceptance.
