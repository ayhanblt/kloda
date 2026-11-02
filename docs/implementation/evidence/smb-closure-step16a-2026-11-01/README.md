# SMB16a final Claude review packet /01.11.2026

Status: **prepared, independent review NOT_PERFORMED**. User decision: Claude reviews last; this does not block current implementation/tests. No agent was spawned and no packet/message was sent. Claude worktree remained untouched.

`review.patch.gz` contains tracked diffs against recorded HEAD plus full newly added source files for the indexed16a set. `review-source-index.json` records current source hashes and the compressed patch SHA256. SDK vendor source is not recopied; review it together with storage-native/build.rs hash/version gates and existing candidate/release evidence. Verify current inputs match this snapshot before accepting it; refresh again if code changes.

Fresh actual Windows evidence: [route/netmask fix](../smb-windows-lan-2026-11-01/manifest.json), [selected Files/native bound publication/catalog/restore/reopen](../smb-windows-files-2026-11-01/manifest.json), [exact-approved Photos source/publication/own download/import/repeat/reopen/cleanup](../smb-windows-photos-2026-11-01/manifest.json). Earlier local importer and doubles remain narrower evidence, not substitutes for these runs. The source server is now available; prior missing-server statements are historical.

Focus: short Darwin IPv4 netmask parsing reads no byte beyond sa_len, ordinary address/prefix/interface/route and ambiguous-source checks remain; actual native bound FD/lease lifecycle; credential generation and private vault; immutable ACK/Completed/recovery; only own receipts permit restore; Photos resource/manifest binding and unknown creation; atomic WebDAV/SMB automatic/manual admission fence. Test fixture visible/cancelled callbacks are explicit component controls, not OS foreground/background authority proof. The Photos cleanup source is separately retained/hashed from the seed/reopen source after an extra exact-asset membership check; only cleanup resumed, no new import.

No actor has signed off this packet and preparing it grants no activation. Product/native accessibility/OS delivery/device/signing/performance gates remain at their documented acceptance steps. SMB stays disabled by default until the required acceptance is complete.

Latest snapshot also includes the actual reconcile-guard source tests and [supported native SMB/keyboard/AX component evidence](../smb-native-ui-2026-11-01/manifest.json). Missing-profile startup now avoids unrelated PC journal access; configured persisted pause and vault/journal fail-closed controls remain. No full VoiceOver/all-screen audit is implied.
