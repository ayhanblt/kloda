# Native SMB screen diagnostic /01.11.2026

One representative TR screen only. Real production `SmbPage`, font/theme and native `smb.status()` were used in a fresh bundle cloned from the already-built SMB-enabled Simulator app. No API was mocked and no target, source, media, SMB socket or profile was created. SQLite quick_check passed and all SMB profile/upload/run/enabled tables remained empty.

The initial cold Metro bundle exceeded the client request timeout; a relaunch used the cached bundle and rendered the screen. Native status rejected with `storage_failure`; the screen kept editing/save disabled. The journal was successfully initialized; the exact failing native operation was not instrumented. The ad-hoc clone's Keychain/signing conditions remain a possible cause, **not a proven diagnosis or product integration PASS**. No entitlement or custody check was changed. No broader locale/a11y matrix was run after this representative-path failure.

`tr-unavailable.png` is the actual final screen, including development tooling overlay. It is diagnostic evidence, not approved visual/a11y acceptance. `runtime.json` contains the native rejection, `journal-check.json` the read-only owned database check. The gzipped `/tmp` pilot and entry are retained for investigation; they are **not a completed durable capture runner** and must not be run against another device. Existing closure tests and signing proof are not replaced by this result.

Cleanup: exact fresh app terminated, owned Simulator shut down and temporary `.expo/smb-ui16a-owned.js` entry removed. No other app/device/container was reset or changed.16a remains open;16b remains held.
