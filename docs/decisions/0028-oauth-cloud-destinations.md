# ADR0028 — OAuth cloud destinations (Dropbox, Google Drive, OneDrive, Yandex Disk)

- Date: 2026-11-02.
- Status: approved by the user 2026-11-02. Step 18 group B (C4 Dropbox, C5 Google
  Drive, C9 OneDrive, C11 Yandex Disk). Not implementation, runtime or physical acceptance.

## Context

ADR0022 D3 allows only verified native public-client login flows with device-native
custody: no broker, server-side token store or embedded confidential secret. ADR0027
covers DAV providers only; group B providers each have their own REST upload API.
The user registered public clients on 2026-11-01 (IDs in the step18–20 checkpoint).

## Decision

1. **Login.** OAuth 2.0 authorization code + PKCE (S256) in the system browser:
   ASWebAuthenticationSession on iOS, Custom Tabs on Android, with the registered
   redirect captured only by Kloda. No embedded web view, password field or client
   secret. Exception: Google Drive on Android uses Google's own authorization API
   (`play-services-auth`), because Google does not support custom-scheme redirects
   for new Android clients. That dependency's version, license and size are checked
   before adoption; a device without Google Play services shows Drive as blocked.
2. **Custody.** The refresh token (and the account identity it was issued for) is
   stored per destination in the device-native vault, keyed by `targetId`
   (iOS Keychain account, `WhenUnlockedThisDeviceOnly`, non-synchronizable; Android
   Keystore-encrypted file). Access tokens stay in memory only. No plaintext,
   shared or copied fallback.
   **Yandex exception (user decision 2026-11-02):** Yandex refreshes tokens only
   with the app secret (tested: refresh without it refused), so its long-lived
   access token and expiry are stored in the same vault instead of a refresh
   token. After expiry the destination needs a new sign-in; no secret is embedded.
   **Android Google Drive (user decision 2026-11-02):** Play services holds the
   grant; the vault stores no token, only the account ID and the device account
   name used to ask Play services for a fresh access token silently.
3. **Identity.** `targetId` hashes provider, the provider's stable account ID and the
   root folder. Signing in to another account or choosing another root is a new
   destination; old receipts never authorize it. Signing in to an account that is
   already added is refused, not merged.
4. **Narrowest scope.** App folder only: Dropbox App folder access, Drive
   `drive.file`, OneDrive `Files.ReadWrite.AppFolder` (+ `offline_access`),
   Yandex `cloud_api:disk.app_folder`. Kloda never sees other user files.
5. **Transport.** One native adapter per provider, mapped onto the existing journal
   contract: create-only/no-overwrite commit, resumable upload where the provider
   offers it, post-commit verification, unknown results stay unknown (ADR0010).
   Provider hashes/ETags do not replace Kloda's own SHA-256 or receipts. Upload
   wiring waits for the per-target queue (18A/3); the four new `backup_destination`
   kinds need a separate reviewed migration slice.
6. **Removal.** Local custody is deleted regardless of the reply. Provider token
   revocation is best effort where a public client can revoke; where it cannot
   (OneDrive, and Yandex if revocation needs a secret) the screen tells the user to
   remove Kloda's access in the provider's account settings. Android Drive's
   Play services revoke is bounded (15 s) because an older Play services may not
   answer (seen on 24.23); the screen then gives the same advice.
7. **Limit and opt-in.** All cloud destinations together (ADR0027 DAV + these)
   stay within 8 per device. Signing in or saving is not enabling (ADR0023).

## V1 scope decision (user, 2026-11-03)

Group C is out of V1: Box (no verified secret-free public client; a broker conflicts with
the serverless model), MEGA (own SDK, session and key custody) and Google Cloud Storage
(no narrow app scope via OAuth; user-owned bucket with bucket-scoped keys was considered
and declined for V1, no ADR draft). They stay in the catalogue as unavailable.

## Preserved boundaries

ADR0010, ADR0016, ADR0022, ADR0023, ADR0024, ADR0025 and ADR0027 apply per
destination. No cross-destination completion, cloud delete/retention, E2EE key
lifecycle or final remote authority. A provider is not "working" until a separately
approved real-account test; release signing keys and provider production review
(Google brand verification, Dropbox production status) are pre-release gates.

Sources: [step14 matrix](../implementation/provider-decision-matrix-step14-2026-10-29.md),
[RFC 8252](https://www.rfc-editor.org/rfc/rfc8252), [RFC 7636](https://www.rfc-editor.org/rfc/rfc7636).
