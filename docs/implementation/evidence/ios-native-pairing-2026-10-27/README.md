# iOS native pairing — step5 selected evidence (27 October 2026)

Current implementation-run evidence; older test records are not counted as reruns.
See [result](result.json), [source hashes](source-sha256.json), [Simulator tests](sim-runtime-results.json),
[actual app build](app-build-final-result.json), [actual Expo calls](expo-native-runtime-final.json),
[authority/journal boundary](app-state-boundary.json), [linked symbols](app-link-symbols.json),
[mobile checks](mobile-results.json), [final checks](final-checks.json) and [scoped format](scoped-fmt-final.json).

`$REPO`, `$HOME`, `$LOCAL_STEP5` are redacted prefixes, not commands to execute.
Full compiler logs/generated libraries remain local; only selected sanitized records are tracked candidates.
All Simulator data belongs to a new empty test device. It was shut down, not erased/deleted.
The final screenshot shows the test entry's PASS label; it is not product visual/physical acceptance.

Earlier app compile failures and inactive runtime attempt are preserved. Final app uses SDK27.1
with iOS26.5 arm64 Simulator, minimum deployment16.4; oldest runtime and hardware were not checked.
Native route observation smoke injects observation state and opens no peer connection.
Host session tests use a C stub, not Secure Enclave. Simulator explicitly refuses custody;
no authority directory, key, certificate, pin or epoch was created. SQLite fixtures use synthetic rows.

Swift journal is still linked with system sqlite3; bundled SQLite symbols are also present in the real
app debug dylib (local definition of sqlite3_open_v2). The actual empty journal opens successfully,
and the joint fixture reports3.51.3. This does not establish all later transfer/journal concurrency behavior.
