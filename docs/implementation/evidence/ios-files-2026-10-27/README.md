# iOS Files step6 — selected evidence (27 October 2026)

See [result](result.json), [current source hashes](source-sha256.json), [Simulator runs](sim-runtime-results.json),
[final publication recovery](sim-publication-final-runtime.json), [cancellation/ABI](sim-extra-runtime-results.json),
[real app build](app-build-final-current.json), [actual Expo restart](expo-files-runtime.json),
[authority boundary](app-state-boundary.json), [mobile closure](mobile-closure.json),
[native checks](rust-results.json), [Clippy](clippy-results.json) and [independent review](independent-review.json).

These are this work group's actual runs, not inherited PASS counts. Earlier failed build/test attempts
are retained separately. Source/binary hashes identify the local outputs; raw compiler/server logs
and disposable databases remain local. `$REPO`, `$HOME`, `$LOCAL_STEP6` redact absolute prefixes.

Simulator Files fixture28 groups = journal14 + upload3 + publication4 + snapshot6 + cancellation1.
The older publication3-group run is superseded by final4, not added again. ABI7 is separate.
Upload fixture invokes the production Swift state machine with synthetic native responses; it is not
an iPhone-PC transfer. Publication tests use native descriptors in a fresh test folder, not a user provider.
Current provider-availability guard is compiled in the final app, but real iCloud/provider paths were not run.

Real Expo smoke proves module availability and persistent early failure across app process restart.
The simulator refuses Secure Enclave before authority creation. It does not prove positive pairing,
file upload, source selection, iCloud download or user-picker completion. Existing own empty simulator
was reused; it and the local server were stopped. No personal simulator, hardware, archive or key was used.
The screenshot is a test-entry PASS label, not Stitch/VoiceOver/product visual acceptance.

The older app-build-final-result.json records an intermediate exit65. Its full compiler log
was overwritten during iteration; no full replay is claimed. app-intermediate-success-summary.txt
is a later success snapshot, not that failed invocation's stderr. The final debug-build records
are separate. No source/fixture was rerun merely to replace a historical failure.
