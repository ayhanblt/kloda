# Stitch UI Reference

2026-10-24 **Mobile scoped adaptation approved and implemented:** Ayhan approved reuse of the existing Stitch visual language for source selection → native QR trust → separate PC-side folder/grant guidance → Activity/history, retaining WebDAV as advanced. [Mobile mapping and evidence](../implementation/mobile-pc-first-stitch-mapping.md). This supersedes the mobile mapping approval gap below only for these existing functions; it does not implement iOS native transport, background execution or grant/readiness APIs, and is not native/platform/physical acceptance.

2026-10-17 approved scoped Desktop adaptation: Ayhan selected option1 in the [PC-first mapping](../implementation/desktop-pc-first-stitch-mapping.md#approved-mapping--2026-10-17). Existing visual language may be adapted to the already implemented native receiver/QR/separate ACL/devices/incoming/background settings. This closes the mapping decision for those functions only; the missing-state inventory below remains historical/design scope for other features. No new product/security behavior or physical/platform acceptance is approved by this visual adaptation.

## Design source

`stitch_private_photo_cloud/` is Kloda's approved UI/UX reference. All seven supplied HTML compositions, their screenshots, the logo asset, and `private_photo_cloud/DESIGN.md` were inspected. The source describes a mobile-first design system and explicitly documents desktop/tablet adaptation, but it does not prescribe a mobile or desktop implementation framework.

| Source | Reference coverage |
| --- | --- |
| `private_photo_cloud/DESIGN.md` | Palette, typography, spacing, shapes, elevation, responsive layout, buttons, badges, cards, inputs, search, and floating media dock |
| `private_photo_cloud_logo/` | 120 × 120 SVG logo and raster preview |
| `onboarding_folder_selection/` | First-run source/folder and schedule selection |
| `onboarding_storage_connection/` | Storage protocol, credentials, connection-test progress and direct-success presentation |
| `main_gallery_sync_status/` | Gallery, filters, selection mode, per-item sync state, tab navigation |
| `backup_activity_queue/` | Transfer queue, pause/resume controls, pending/offline state, completed history |
| `photo_detail_destinations/` | Immersive photo detail, backup destinations, integrity and local-prune actions |
| `storage_management/` | Connected storage health, destination controls, cleanup and audit settings |

`screen.png` is readable for the folder-selection, backup-activity, and logo references. The other four screen PNG files resolve to a source placeholder (`<FIFE Image failed to fetch>`); their HTML remains the available source of truth for those compositions.

The reference still uses the legacy visible string “Private Photo Cloud” in `DESIGN.md`, image alternative text, and examples. The Stitch source remains unchanged as required; all future application code, documentation, and user-facing chrome use **Kloda: Secure Photos & Sync**.

## Screens

| Screen | Shell and layout | Observed purpose and states |
| --- | --- | --- |
| Folder selection | `mobile_blank`; single vertical setup canvas; sticky bottom primary action | “Step 1 of 2”; curated starter card, selectable local folders, a summary of selected count/size, and auto-sync frequency cards |
| Storage connection | `mobile_stack`; fixed top bar with back action; stacked form and status cards | “Step 2 of 2”; protocol tabs, host/path/user/password fields, testing indicator, direct-success result, primary gallery-entry action, retest action |
| All Photos | `mobile_tab`; fixed translucent top bar and bottom tab bar; date-grouped photo grid | Sync status pill, horizontal filters, photo selection overlays, per-item synced/uploading/not-backed-up indicators, batch action surface |
| Backup Activity | `mobile_tab`; fixed header and bottom tab bar; scrollable queue with sticky action dock | Overall transfer progress, active item, pending queue, sleeping destination/Wake-on-LAN message, collapsible completed history, pause/resume and sync-all actions |
| Photo detail and destinations | `mobile_stack`; immersive rounded media stage with overlay controls; metadata and destination cards below | Favorite, share, info, overflow actions; local/encrypted/queued destination states; manual sync, checksum verification, destructive local-copy prune, transient toast feedback |
| Storage management | `mobile_tab`; capacity summary followed by destination cards and settings cards | Primary/mirror switches, last-sync / scheduled status, manual sync, add destination, auto-free-space switch, checksum audit link |
| Logo | Standalone 120 × 120 mark | Dark rounded square, incomplete light ring, green center dot |

No dedicated empty gallery, zero-storage, blocked-permission, invalid-form, connection-failure, or migration screen is present.

## Navigation

- Primary post-onboarding navigation is a fixed four-item bottom tab bar: **Photos**, **Sync Queue**, **Storage**, and **Settings**. The active tab receives a warm filled rounded rectangle; Sync Queue can carry a numeric badge.
- The gallery links conceptually to photo detail. Photo detail exposes a “Gallery” back action and overlay favorite/share/info/more controls.
- Storage connection and photo detail use a stacked back affordance in the fixed top bar.
- Folder selection continues to storage setup. Storage connection exposes “Start Backup & Enter Gallery”; its source interaction simulates catalog sync then gallery redirection.
- Storage management contains an “Add New Destination” entry point. This is post-onboarding management, not the first-run starting point.
- Backup queue supports local interaction states: individual and global pause/resume, completed-list accordion, and Wake-on-LAN feedback.

The supplied HTML uses `href="#"`, `history.back()`, and presentation-only JavaScript rather than an application route map. It establishes intended information flow, not implementation routing.

## Components

- **Brand/header:** logo, connection subtitle/status dot, account icon or stack back button; translucent, blurred fixed top bar.
- **Setup controls:** curated preset, folder rows with thumbnail/icon and switches, select-all control, frequency cards with trailing check indicators, protocol segmented tabs, text/password fields, password-visibility toggle, sticky continue action.
- **Forms:** host, path, username, and password fields; leading Material Symbols; 12 px rounded inputs; protocol-specific example values. No validation-error UI is supplied.
- **Status and feedback:** compact status pills, 6 px status pips, progress bars, direct-connection result card, test spinner, storage metrics, queue rows, collapsible completed section, toast confirmation.
- **Gallery:** filter chips, search icon button, selection mode, thumbnail grid, selected overlay, per-photo state badges, batch action surface.
- **Storage and integrity:** destination cards, primary/mirror switches, sync-now control, checksum verification row, scheduled-audit row, local-prune action, auto-free-space switch.
- **Photo detail:** immersive media stage, frosted overlay actions, destination-status cards, favorite toggle.
- **Icons:** Material Symbols Outlined is used throughout. Meaningful icons include photo library, search, favorite, sync, pause/play, Wi‑Fi, schedule, storage/NAS, WebDAV/cloud, SMB/folder share, lock, shield, verified, router, Wake-on-LAN, checksum, delete, and navigation icons. The product logo is a separate SVG mark.

## Design tokens

### Color

`DESIGN.md` provides a Material-style warm-stone token set. Notable source values:

| Role | Value |
| --- | --- |
| Root surface/background | `#fff8f5` in token YAML; style guidance also names Stone 50 `#FAFAF9` |
| Primary / primary container | `#141010` / `#292524` |
| Text primary / secondary / muted | `#1C1917` / `#57534E` / `#A8A29E` |
| Card / elevated surface | `#F5F5F4` / `#FFFFFF` |
| Hairline border | `#E7E5E4` |
| Synced / secure | `#10B981` |
| Syncing / processing | `#F59E0B` |
| Pending / offline | `#94A3B8` |
| Error | `#EF4444`; token YAML error is `#ba1a1a` |

The logo specifically uses `#292524` canvas, `#F5F5F4` ring, and `#10B981` center dot.

### Typography

- Family: **Inter**.
- Headlines: 40/48 px desktop XL, 32/38 px mobile XL, 28/34 px LG, 22/28 px MD, 18/24 px SM; all weight 600 with small negative tracking.
- Body: 16/24 px, 14/20 px, and 13/18 px at weight 400.
- Labels: 12/16 px weight 500 and 11/14 px weight 600, with positive tracking for dense metadata.
- Source intent: gallery chronology uses large headings; metadata and EXIF use labels for compact scannability.

### Spacing, shape, and elevation

- Core spacing: 4, 8, 16, 24, and 40 px (`space-xs` through `space-xl`); standard gutter 16 px, mobile gutter 4 px; desktop/mobile margins 32/16 px.
- Mobile photo grids narrow gaps to 2–4 px; desktop photo streams use 8–12 px and editorial content uses 16–24 px.
- Radii: 4, 8, 12, 16, 24 px and full pills. Media cards use 16–24 px; form controls and modals use 12–16 px.
- Elevated elements use warm, low-opacity shadows; floating trays use translucent warm glass and 16 px blur; immersive media uses a 94% `#1C1917` overlay.
- Desktop guidance: 1024 px+ supports a collapsible 260 px metadata/navigation rail. Tablet guidance: 768–1023 px uses a 6–8-column photo grid. These are visual requirements, not framework choices.

## Onboarding mapping

This table records the historical WebDAV-first visual baseline, not the complete current product contract. [ADR0005](../decisions/0005-computer-first-files-and-photos-backup.md) subsequently selected PC-first/general files and default opportunistic Live; [ADR0006](../decisions/0006-account-mfa-and-recovery-policy.md) records account/MFA. Source assets remain read-only; these policy updates do not approve a redesigned screen or claim implemented UI.

| AGENTS.md section 4 requirement | Stitch reference | Coverage |
| --- | --- | --- |
| Open directly to first setup; do not start with “Add storage” | `onboarding_folder_selection` is the initial “Step 1 of 2” screen; Add New Destination exists only under post-onboarding storage management | Covered |
| Select sync folders | Curated Starter, Camera Roll, Screenshots, WhatsApp & Downloads, and Raw/Lightroom rows with toggles; select-all and selected-count summary | Partial: Files select-all conflicts with ADR0001/0005 and must not be implemented; explicit multiple sources and Photos permissions remain separate |
| Live default or12/24 schedule, plus manual Sync Now | Every12/24 hours and ambiguous Instant / Live Sync card | Historical first-slice mapping was manual Sync Now; current Live means first OS opportunity, not continuous realtime. Distinct policy now exists; approved visual/interaction adaptation is still missing |
| Enter storage address and credentials for WebDAV/SMB/other | Storage setup has Home NAS, WebDAV, and Local SMB tabs plus host, path, username, and password fields | Partial: no explicit “other” protocol path; protocol-specific constraints are incomplete |
| Run connection test | Loading “Testing connection…” card, direct-success result, metric cells, and Test Again action | Covered for loading and direct success only |

The source layout groups folders then frequency before Storage Setup. This is historical WebDAV visual order, not approval of a PC-first account/approval flow. ADR0005 now defines distinct opportunistic Live and manual Sync Now; a source label must not silently collapse them or promise continuous execution. Current UI design adaptation requires review against that policy without editing source assets.

## Missing states

- **Onboarding:** no permission request/denial, no empty or unavailable folder pool, no zero-selection continue state, field validation, invalid-address feedback, or explicit “other” storage-protocol path.
- **QR LAN pairing:** [ADR0013](../decisions/0013-qr-based-local-lan-pairing.md) and [future-only roadmap](../implementation/qr-pairing-implementation-roadmap.md) require invitation/TTL display, QR-only camera permission/denial/no-camera/duplicate-scan handling, exact reserved candidate approval/deny, hidden QR after reservation, pending ACK/recovery, expiry/cancel/malformed payload/TLS/proof/persistence errors and separate “trusted, no file grant” state. At the reference-only checkpoint no approved Stitch mapping for these states existed. The2026-10-17 scoped Desktop adaptation approval and implementation close that mapping gap for the already implemented Desktop QR/ACL surfaces; mobile/new behavior and other missing states are not approved by implication. Source assets remain unchanged.
- **Connection test:** no authentication failure, unreachable host, timeout, malformed address, insufficient-space, unsupported protocol, or retry-after-failure result. No visual result confirms the required WAN-IP versus public-IP comparison or a CGNAT decision.
- **Relay:** no distinct CGNAT/HTTP(S) relay state. Advanced WebDAV relay/SMB LAN-only rules remain. [ADR0012](../decisions/0012-kloda-owned-p256-device-identity.md) selects pinned LAN TLS and remote WebRTC/DTLS/direct P2P with Cloudflare TURN fallback; this does not adopt/deploy provider/native transport or approve new UI. No relay/source success graphic is connectivity, Kloda-key binding or authority proof; Stitch assets remain unchanged.
- **Sync:** pending, active, paused, completed, queued, sleeping destination, Wi‑Fi wait, and per-photo backed-up/uploading/not-backed-up are represented. Failed, canceled, partially completed, conflict, quota/capacity-exhausted, and retryable item states are not.
- **Gallery:** no empty library, no loading/skeleton, no media-load failure, no search state, no no-filter-results state, and no photo-deletion/error state.
- **Storage:** no destination-connection failure, unavailable/remotely unreachable destination, credential expiry, add/edit storage form, or confirmation/error flow for destructive local pruning.
- **Migration:** SHA256 content+durable record is selected by ADR0005; scan/progress/ambiguity/review/error states and implementation remain missing. Existing FolderSync media was not scanned or modified.

## Conflicts with AGENTS.md

Policy/design coverage remains incomplete: source Files select-all conflicts with approved explicit selection; legacy Live/manual label is no longer a complete mapping; PC-first/account/scope/MFA/restore/conflict states are missing. This document records these gaps, does not resolve them by inventing a new design or treating prototype script behavior as authority.

## Implementation notes

- Use this source as the visual authority: warm-stone surfaces, Inter scale, low-elevation layering, soft radii, Material Symbols, and the supplied logo geometry should be reproduced rather than replaced with an unrelated design system.
- Preserve the source’s mobile shells and its desktop/tablet visual guidance, but do not select a frontend framework, navigation library, platform configuration, bundle identifier, or desktop runtime.
- Do not treat demonstration HTML values as production configuration. The source includes hostnames, paths, usernames, and a password-looking example value; real values must remain user input and never enter the repository.
- The source JavaScript is visual-prototype behavior only: fixed delays, alerts, and optimistic state changes do not define runtime behavior, validation, relay selection, storage protocols, security, or error handling.
- Keep manual **Sync Now** independent. Current default Live is opportunistic first OS execution opportunity (ADR0005), not continuous realtime;12/24 mode does not upload immediately on change detection. Historical manual-only mapping no longer defines all current policy.
- When rendering storage choices, show that WebDAV supports direct remote access or HTTP(S) relay when needed, while SMB is available only on the local LAN.
- Replace legacy product strings in future application UI with the approved Kloda display name; do not modify the Stitch source assets themselves.

## Current implementation status

- Existing product baseline state is [first-vertical-slice-status.md](../implementation/first-vertical-slice-status.md): Files/Photos source/schedule/WebDAV setup foundations, incomplete mobile transfer/activity/native scheduling and desktop recovery. It is not implemented PC-first receiver/account/Live/restore/conflict UI.
- Desktop PC-first integration now has scoped host Chromium/token/responsive visual review for the approved existing functions; see the [mapping evidence](../implementation/desktop-pc-first-stitch-mapping.md#delivered-integration-and-acceptance--2026-10-17). Advanced WebDAV foundations remain separate. This is not full product/physical visual acceptance.
- Product onboarding/Backup Activity physical/visual comparison is not validated. Native PoC diagnostic screenshots/physical transport UI are different surfaces and do not make product UI Stitch-complete.

## Open questions

1. Should folder and schedule selection remain combined in one visual step, or should they be separate screens while preserving the mandated order?
2. What exact presentation follows the connection test for public-IP direct access versus CGNAT WebDAV relay access?
3. Which validation, failure, retry, permission, empty, loading, and migration-deduplication states require approved designs?
4. What approved designs cover the current PC-first/Live/account/Files–Photos behavior while retaining advanced WebDAV/SMB? Product scope and migration hash direction are selected, but gallery/search scope and visual adaptation/implementation are still open.
