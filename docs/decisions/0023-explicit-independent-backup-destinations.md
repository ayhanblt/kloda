# ADR0023 — Explicit independent backup destinations

- Date: 2026-10-29.
- Status: approved by the user, step15 option A.

Only destinations explicitly enabled by the user receive scheduled/general
Sync Now backup work. Each enabled destination has independent persistent work,
results, recovery context and retry accounting. An unavailable PC does not
consume WebDAV's own execution opportunity. Saving/testing a WebDAV profile,
pairing trust or a demo mirror/ready state is not automatic-send opt-in.

No implicit failover, cross-target adoption or shared completion: one successful
destination does not complete another. Source settings/program and durable global
Pause/Resume rules remain; per-destination disable stops that destination safely
and retains completed bytes/recovery history. Credential/account/root changes
invalidate affected work without discarding its prior ACKs or receipts.

PC-native ACL, QR/device trust and current grant fences remain PC-only. WebDAV
uses its own typed target identity and current device-native credentials; it
cannot fabricate a PC pairing record/grant or treat a local DAV receipt as a PC
result. ADR0010's advanced-WebDAV unknown/publication/no-overwrite limits remain.

Existing sources, snapshots, journal, context/retry and OS opportunities must be
reused. No new general scheduler, central OAuth broker or SDK is selected.
Cloud retention/delete, final remote authority/E2EE lifecycle and all platform/
physical acceptance gates remain open. ADR0022 transport/custody policy is unchanged.
