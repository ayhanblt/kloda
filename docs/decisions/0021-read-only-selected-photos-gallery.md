# ADR0021 — Selected Photos read-only gallery

- Date: 2026-10-29.
- Status: user-approved scope; implementation/validation tracked separately.

The user approved gallery browsing only for previously selected Photos sources and
OS-accessible items. Limited access displays incomplete-scope guidance; it does
not relax full-membership backup/manifest/import requirements in ADR0017.

Previews remain in application memory. No app-owned persistent thumbnail cache,
automatic iCloud original download, new catalog, search, EXIF editing, favorite
mutation, sharing or phone deletion is authorized. Platform-managed image caching
is distinct from an app-owned persistent cache. Permission/source checks apply to
page, preview and history reads; UI departure/background discards preview state.

Existing local transfer receipts may be shown explicitly as history, separated
into media and manifest receipts. A historical receipt is not a current PC/ACL,
current asset-content, remote existence or deletion check. Missing receipt means
unknown, not successful backup or proof that the photo has never been backed up.
Source locators and their earlier versions may have changed or been reused.

No key/pin/authority migration, receiver mutation, provider/auth decision or
physical acceptance authorization follows from this decision. Step12 native
visual/gesture/accessibility gaps and platform gates remain open.
