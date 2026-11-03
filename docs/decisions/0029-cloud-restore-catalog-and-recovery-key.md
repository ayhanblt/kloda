# ADR0029 — Cloud restore catalog and recovery key (restore on a new device)

- Date: 2026-11-03.
- Status: **draft, not approved.** Requested by the user 2026-11-03 for V1 consideration.
  No implementation, runtime or physical acceptance. Open questions are listed at the end.

## Context

Restore from a cloud destination (ADR0024/0027/0028) is authorized only by this device's
immutable Completed receipt. Equality of remote bytes never proves who published them
(ADR0010). If the phone is lost, replaced or Kloda is reinstalled, the receipts are gone
and Kloda cannot restore anything, although the files remain in the destination.
ADR0022 leaves final remote authority and the E2EE key lifecycle open; ADR0006 leaves
recovery open. This ADR proposes a narrow, restore-only remote authority for cloud
destinations. It does not touch the PC/LAN path (ADR0016/0017), which has its own authority.

## Proposed decision

1. **Recovery secret.** On the first enable of any cloud destination, Kloda generates a
   256-bit random recovery secret, stores it in the device-native vault (iOS Keychain
   `WhenUnlockedThisDeviceOnly`, non-synchronizable; Android Keystore-encrypted file) and
   shows it once as a recovery code. Enabling continues only after the user confirms the
   code (re-entering a part of it). No server, escrow, account recovery or cloud copy.
2. **Derived keys.** HKDF-SHA256 derives purpose-labelled keys from the secret:
   `kloda-catalog-mac-v1` now; the label `kloda-media-e2ee-v1` is reserved and unused
   (E2EE stays open, ADR0022). Catalog authentication uses HMAC-SHA256: only holders of
   the secret write or verify, so signatures add nothing and need no new dependency.
3. **Catalog.** After each run that completed at least one item, the destination receives
   an authenticated catalog delta at `.kloda/catalog/<installationId>/<sequence>.json`,
   written create-only through the same journal contract (temp, no-overwrite move,
   post-commit verification; unknown stays unknown). Entry: relative path, SHA-256, size,
   kind, source identity, completion time. Header: format version, installation ID,
   destination `targetId`, sequence, previous delta hash. The MAC covers canonical bytes.
   A catalog is written only from this device's Completed receipts, never from remote
   discovery. Existing receipts are backfilled once when the secret is created.
4. **Import on a new device.** The user adds the destination (normal sign-in, ADR0027/0028)
   and enters the recovery code. Kloda reads the deltas, verifies MAC, chain and sequence,
   and records each entry as an **imported receipt**: restore-only, bound to that
   destination. It never completes, skips, settles a conflict for, or authorizes an upload,
   and never applies to another destination. Unauthenticated or unlisted files are ignored.
5. **Restore.** Imported receipts use the existing restore path: download to staging,
   SHA-256 and size must match the entry, then write. Mismatch is `hash_mismatch`.
6. **Visible limits.** A missing sequence or broken chain is shown as "some backups could
   not be verified", not silently accepted. Deleted remote files are not restorable. Losing
   both the phone and the code means no restore through Kloda; files stay in the provider.
7. **New device continues backing up** under its own installation ID; it does not take over
   the old device's paths. Create-only conflicts go through existing review (ADR0025).

## Threats considered

- Write access to the destination without the secret (synced PC malware, compromised
  provider account): cannot forge entries; can delete deltas (detected by the chain) or
  alter files (rejected by hash). Replaying old authentic deltas restores only authentic data.
- Catalog contents (names, sizes) are as visible as the files themselves; no new exposure
  while media is not end-to-end encrypted.
- Recovery code shown on screen: no screenshot/clipboard by default; the screen warns.

## Open questions for the user

1. Code format: grouped Base32 (no asset) or a word list (needs a licence-checked list).
2. Code at first cloud enable mandatory, or optional and created later from settings
   (backups made before it are then not recoverable on a new device).
3. Should the user be able to regenerate the code (new secret; older deltas stay under
   the old code)?
4. Scope: mobile cloud destinations only (DAV + OAuth); Desktop out of scope.

## Proposed slices (after 18B/5 and 18B/5r)

29/1 secret, vault, HKDF, code screen (Lovable mapping, TR/EN/DE); 29/2 catalog writer +
backfill, shared test vectors for both platforms; 29/3 import + imported receipt migration;
29/4 restore wiring and tamper tests (altered file, injected file, deleted/replayed delta,
wrong code, interruption).

## Preserved boundaries

ADR0010 (equality alone is never authority), ADR0016/0017 (PC path unchanged), ADR0022
(E2EE, cloud delete/retention open), ADR0023/0024/0025/0027/0028 per destination.
No cross-destination completion, cloud deletion or key escrow.
