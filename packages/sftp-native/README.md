# SFTP native

Opt-in SFTP wire adapter for ADR0022 D2. `russh=0.65.0` uses only the ring backend;
`russh-sftp=3.0.1` supplies raw SFTPv3 requests. No libssh2/OpenSSL, SSH agent,
private-key import, TOFU, or PC/WebDAV/SMB identity or receipt reuse.

The first product slice uses existing native numeric LAN socket/route owners.
The native vault holds a username/password and an independently verified canonical
SHA256 host fingerprint bound to the exact host/port. Plain Ed25519 host keys
only. Unknown or changed keys stop before password authentication. The configured
absolute root must already exist and resolve exactly; aliases/symlinks fail closed.
Internet/remote routing is outside this slice.

Only `kloda_sftp_publish_bound` and `kloda_sftp_read_bound` are exported. Both consume
valid transferred FDs on every return. A synchronous native callback checks current
route/source/profile/pin generations and persists durable ACKs; callers own final
Completed admission. There is no unbound publication entry point.

Publication uses exclusive staging creation, bounded writes, explicit fsync support
and ACK, CLOSE ACK, SFTPv3 no-overwrite rename, then a fresh size/hash read. Unknown
results stay in review. A verified read alone cannot invent a Completed receipt or
adopt remote content. Photos has its own `kloda-sftp-photo` sidecar and receipt checks.
Enablement/profile/jobs live in the same SFTP database; no `backup_destination`
migration or shared kind/CHECK change is required.

## Build

```
KLODA_SFTP_CHECK_OUTPUT=/tmp/kloda-sftp16b-release node tools/build-sftp-native.mjs android
KLODA_SFTP_CHECK_OUTPUT=/tmp/kloda-sftp16b-release node tools/build-sftp-native.mjs ios
```

After changing app configuration, regenerate native projects with the existing
`native:generate` workflow before a product build; the generated iOS Info.plist must
include `com.kloda.app.sftp.processing` from app.json.

Android opts in with `-PklodaSftpNative=true`; iOS pod integration opts in with
`KLODA_SFTP_NATIVE=1`. Both default off. Build scripts verify C/JNI exports and
Android 16KB ELF alignment before packaging. Generated binaries stay ignored.

## Isolated checks

`tools/test-sftp-bound.py` consumes the ledger-owned loopback OpenSSH fixture and
an already-built host dylib. It checks real wire ACKs plus production Swift journal
reopen/failure fences. It is not OS LAN or physical-device evidence.
`tools/test-android-sftp.py` requires the existing disposable KlodaWebDavStep15 AVD
on emulator-5584, the same ledger-owned server, and a verified arm64 release
artifact. It exercises JNI, Keystore and SAF Files; it never writes Photos.
Neither runner discovers or cleans arbitrary servers, devices or personal files.

Photos writes require a concrete fixture and separate D7 approval. Real iOS LAN,
production signing/device custody, physical/performance acceptance and the final
Claude review remain separate gates. See CURRENT for actual results; compilation
or pure codec receipt fixtures do not close runtime acceptance.
