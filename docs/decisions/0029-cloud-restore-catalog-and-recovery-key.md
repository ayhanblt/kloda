# ADR0029 — Cloud restore catalog and recovery key (restore on a new device)

- Date: 2026-11-03.
- Status: **draft; the four open questions were answered by the user 2026-11-03** (see the end).
  No implementation, runtime or physical acceptance yet.

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
- Recovery code shown on screen: Android blocks screenshots, iOS hides it when the app leaves the
  foreground; copying is explicit and time-limited (decision 6); the screen warns.

## User decisions (2026-11-03, answers to the former open questions)

1. **Code format:** grouped Base32 (no word-list asset or licence); groups plus a check
   character, independent of the UI language.
2. **Mandatory:** the code is created, shown and confirmed on the first enable of any
   cloud destination; enabling does not continue without it.
3. **Regeneration:** allowed, as a full re-sign. A new secret replaces the old one; every
   Completed receipt on this device is catalogued again under the new key as a new delta
   chain, so the old code is no longer needed. Old deltas stay on the destination
   (no cloud deletion, ADR0022) and are ignored by an import with the new code. Added to 29/2.
4. **Scope:** mobile cloud destinations only (DAV + OAuth). Desktop and the PC/LAN path are
   out of scope.
5. **Hidden by default, unlocked by the device lock** (added 2026-11-03). The code screen never
   shows the code on its own; a "Show code" button asks for the phone's own screen lock
   (fingerprint/Face ID or PIN/pattern/passcode: iOS `LAContext` `.deviceOwnerAuthentication`,
   Android `BiometricPrompt` BIOMETRIC_STRONG|DEVICE_CREDENTIAL on API 30+, otherwise the
   Keyguard credential screen). Native code returns the code only after that check succeeds;
   the secret itself stays readable without it (29/2 needs it in background runs). The code is
   hidden again when the app leaves the foreground; Android marks the window FLAG_SECURE while
   it is shown. A phone without a screen lock cannot show the code, so it cannot enable a cloud
   destination (`recovery_lock_required`); the secret is created only after the first successful check.
6. **Viewing again and copying** (added 2026-11-03). After confirmation the code stays reachable from
   Settings ("Recovery code for cloud backups", listing the cloud destinations it currently covers) and
   from a short "Protected by the recovery code" line on each cloud card; showing it always asks for the
   device lock again. While shown, a copy button puts it on the clipboard (user decision; replaces the
   former "no clipboard" default): iOS local-only (no Universal Clipboard) with an expiry, Android marked
   sensitive (API 33+) and cleared after a short timeout where the app still owns the clip. The code
   covers every cloud destination of this installation (DAV + OAuth), not one provider.

## Proposed slices (after 18B/5 and 18B/5r)

29/1 secret, vault, HKDF, code screen (Lovable mapping, TR/EN/DE); 29/2 catalog writer +
backfill and regeneration re-sign, shared test vectors for both platforms; 29/3 import + imported receipt migration;
29/4 restore wiring and tamper tests (altered file, injected file, deleted/replayed delta,
wrong code, interruption).

## Preserved boundaries

ADR0010 (equality alone is never authority), ADR0016/0017 (PC path unchanged), ADR0022
(E2EE, cloud delete/retention open), ADR0023/0024/0025/0027/0028 per destination.
No cross-destination completion, cloud deletion or key escrow.
