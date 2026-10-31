# SMB16a — native receipt and Photos contract proposal

Status: user approved A (Files + separate SMB Photos contract) on 2026-10-30. D6A approved the exact SDK compatibility patch;
it did not define a durable SMB backup/restore format. ADR0017 is PC-specific and
ADR0024 is WebDAV-specific. Do not invent PC IDs, treat SMB rename as DAV MOVE,
or silently adopt another protocol's recovery authority.

## Proposed narrow contract

- Kotlin/Swift own native credentials, source/foreground/OS admission, current
  target/source generations and a separate durable SMB journal. Rust owns SMB
  wire I/O. No global multi-protocol queue or pairing-key dependency.
- Immutable job header: native operation UUID, installation/source/asset/revision
  as applicable, exact host/port/share/root/account target, credential/source
  generation, safe relative path and private snapshot SHA256/byte count. Passwords
  are never journal fields. Observed server/session/file IDs are correlation and
  continuity evidence, not cryptographic pins or ownership grants.
- Complete only after known create-exclusive/write/flush/no-replace rename ACKs,
  durable local ACK recording, full final byte hash/size and current native
  source/context checks. Persist a received ACK before a later context fence.
  Unknown/lost responses remain review-required even if path/hash match. No
  overwrite, remote adoption, automatic header rebinding or cross-target retry.
  Source/target changes stop old pending work and preserve its immutable evidence.
  ADR0025's explicit WebDAV reauthorization is not silently extended to SMB.
- Files paths must be safely representable under the selected SMB target. Reject
  unsupported names visibly; do not silently apply SDK name mapping/normalization.
  A failed item is not a completed backup. Foreign-final conflicts remain review,
  with an explicit keep-both action using the existing collision-safe alias rule.
- Photos uses a separate versioned SMB sidecar: installation/source asset/revision,
  resource role/original name/MIME/SHA256/size, albums/favorite and safe resource
  paths on the same target. Only this device's locally Completed SMB resource
  receipts may be referenced. The sidecar requires its own same completion proof.
  No PC-issued IDs or fabricated DAV receipts. Generated resource paths do not
  alter original metadata names.
- Own-backup catalog/restore uses this device's target-bound Completed receipts;
  verify sidecar and every resource again. Native local-file publication and
  PhotoKit/MediaStore creation-receipt reconciliation preserve no-blind-duplicate
  behavior. Source and restored-library IDs remain distinct. No other-device
  discovery/adoption, old NAS migration, remote deletion/retention or new gallery
  editing policy. No new SDK import-mutation test permission is inferred here.

Option A approves the above Files + separate SMB Photos contract. Option B
approves the Files receipt/path portion first; Photos remains explicitly blocked
pending its own contract. Neither option enables a product capability before
required native/recovery/SDK checks pass or closes12/13/15/20/21 acceptance gates.

## Implementation reach and smallest verification

After decision: SMB-specific native profile/vault/context/journal, Rust/mobile
bridge and actual byte publication, then selected-source/queue/catalog/restore/UI
using existing mechanisms. Do not create a probe-only placeholder layer.
First one Files source and the existing owned Samba fixture: source snapshot,
create/write/flush/no-clobber ACK, bounded final bytes and native receipt. Then
only affected lost-response/context/restart/restore checks. Add Photos codec and
native integration if A is selected. Real media writes require their exact owned
fixture approval; physical work remains step21. Full ABI matrix waits for a stable
native checkpoint; current accepted SDK host+one Android+one iOS proofs are reused.
