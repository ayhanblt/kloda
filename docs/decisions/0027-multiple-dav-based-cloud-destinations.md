# ADR0027 — Multiple DAV-based cloud destinations

- Date: 2026-10-31.
- Status: approved by the user 2026-10-31, including both proposals under
  "Decided with approval". Step 18 group A (C10 Nextcloud, C3 CloudMe, C7 Kolab
  Now). Not implementation, runtime or physical acceptance.

## Context

Step14 found Nextcloud, CloudMe and Kolab Now expose HTTPS WebDAV, so the existing
native WebDAV mechanism is the reuse candidate. That mechanism is one destination
today: one vault entry (Android `kloda-webdav-profile.v1`, iOS Keychain service
`<bundle>.webdav.native.v1` account `profile`), `backup_destination.kind IN
('pc','webdav')` and `destination()` reading a single enabled `webdav` row.
ADR0023 requires each explicitly enabled destination to have independent work,
results, recovery context and retry accounting. Upload/receipt tables already
carry a `target` column.

## Proposed decision

1. **Typed DAV destinations.** A DAV destination is `(provider, targetId)` with
   `provider ∈ webdav | nextcloud | cloudme | kolab-now`. Several may be enabled
   at once, including more than one of the same provider.
2. **Stable identity.** The existing WebDAV `targetId` formula and value stay
   unchanged, so current receipts, sidecars and review authorizations remain
   bound. New providers hash `provider` into their `targetId`; the same URL added
   under two providers is two destinations, never an adoption.
3. **Custody per destination.** Each destination has its own device-native vault
   entry keyed by `targetId` (Android Keystore-encrypted file per destination,
   iOS Keychain account per destination, `WhenUnlockedThisDeviceOnly`,
   non-synchronizable). The legacy WebDAV entry is read in place, not rewritten.
   No plaintext, shared or migrated-by-copy credential fallback.
4. **Independent work.** Queue, runs, schedule opportunity, retry, review
   (ADR0025) and Photos sidecar (ADR0024) are keyed by `targetId`. One
   destination's failure or unavailability does not consume another's
   opportunity. Credential/account/root change invalidates only that destination.
5. **Nextcloud auth.** Only Login Flow v2: anonymous `POST /index.php/login/v2`,
   open `login` in the system browser (Custom Tabs / ASWebAuthenticationSession),
   poll `poll.endpoint` (token valid 20 minutes, 404 until done). Store
   `server`, `loginName`, `appPassword`. HTTPS only; the returned `server` origin
   must equal the entered origin, otherwise stop. WebDAV root is
   `remote.php/dav/files/<loginName>/` plus the chosen folder. On removal call
   `DELETE /ocs/v2.php/core/apppassword` (`OCS-APIREQUEST: true`) best effort,
   then delete local custody regardless of the reply. No plain-password field.
6. **CloudMe and Kolab Now.** User-entered username + password/app password over
   HTTPS Basic to the provider's documented DAV endpoint. If the server requires
   another scheme (e.g. Digest only) or rejects conditional create/no-overwrite
   MOVE, the provider stays visibly blocked; no auth or overwrite downgrade.
7. **One shared schema migration.** Extending `backup_destination.kind` is a
   SQLite table rebuild on Android and iOS, needed by both this ADR and step16a
   SMB product wiring. It is done once, by one owner, at an agreed sync point.

## Preserved boundaries

ADR0010 unknown-result/no-overwrite limits, ADR0016 PC-local ACL, ADR0022 custody
(no broker, no embedded secrets), ADR0023 explicit opt-in (saving or signing in is
not enabling), ADR0024 sidecar and ADR0025 review rules apply per destination.
No cross-destination completion, adoption from equal hashes, cloud delete or
retention policy. A provider is not "working" until isolated fixture evidence
(Nextcloud container) or, for CloudMe/Kolab, separately approved account tests.

## Decided with approval

- One `backup_destination.kind` migration adds the DAV providers and `smb`
  together and lands before either step18 or step16a product wiring. It is a
  separate reviewed slice; neither side rebuilds the table on its own.
- At most 8 DAV destinations per device; adding a ninth is refused visibly.
- 2026-10-31 user decision: SMB keeps its own `smb_enabled` opt-in in the SMB journal for now,
  so its profile-generation/job fence stays in one database and transaction. The migration
  still allows `kind='smb'`; moving SMB onto `backup_destination` (for example when several
  SMB destinations are added) is a separate later decision. This narrows, for SMB only, the
  item above that both sides wire products through this table.
- 2026-11-02 user decision (18A/3): enabled DAV destinations run **sequentially**: one
  upload at a time under the existing admission lock and `begin()` order; each destination
  has its own plan (`webdav_target_plan`, the former single `webdav_plan` row moved once),
  run and retry budget, and the earliest due plan is dispatched. Only DAV destinations
  (original WebDAV, Nextcloud, Kolab Now) upload in 18A/3; the ADR0028 OAuth kinds are
  accepted by the table but cannot be enabled until their upload adapters exist.
  Known limit: reconfiguring the original WebDAV entry still renews the shared backup
  context (Codex-owned fence), which re-plans the other DAV destinations too.

Sources: [Nextcloud Login Flow](https://docs.nextcloud.com/server/latest/developer_manual/client_apis/LoginFlow/index.html),
[step14 matrix](../implementation/provider-decision-matrix-step14-2026-10-29.md).
