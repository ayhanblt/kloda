# Mac Personal Team — selected evidence

[Scope/outcome](../../macos-personal-team-validation-2026-10-26.md) · [JSON](result.json).
PASS entries describe new 26 October runs.

- native-fresh-create.txt / native-process-reopen.txt: final signed native helper;
  different PIDs and same epoch/certificate/initialized bytes after reopen.
- electron-fresh-create.txt / electron-process-reopen.txt: signed real Electron
  RUN_AS_NODE host and current production NAPI; not normal application UI.
- original-reopen-failure.txt / readonly-lookup-diagnostic.txt /
  same-state-fixed-reopen.txt: failure, diagnosis and identical first-state recovery.
- identity-tests.txt: two ephemeral negative-key tests, no persistent software key.
- native-addon-build.txt / clippy.txt: actual current addon build / final strict lint.
- native-harness.rs.txt / electron-harness.cjs.txt: replay templates replacing private
  paths with explicit configuration. Not byte-identical executed sources. Configure
  only a newly created canonical0700 disposable authority, never existing app state.
- signing-project.pbxproj.txt / signing-template.entitlements: provisioning scaffold;
  initial C main was int main(void) { return 0; }.

Relevant command shapes; team/identity/paths are private placeholders:

```text
xcodebuild -project <fixture>.xcodeproj -scheme KlodaMacValidation -configuration Debug -allowProvisioningUpdates -allowProvisioningDeviceRegistration -destination platform=macOS,arch=arm64 -derivedDataPath <private-build> DEVELOPMENT_TEAM=<private-team> build
cargo build --manifest-path packages/pairing-native/Cargo.toml --locked --offline --no-default-features --target aarch64-apple-darwin --lib
cargo test --manifest-path packages/pairing-native/Cargo.toml --locked --offline --no-default-features --target aarch64-apple-darwin --lib identity::platform::tests -- --test-threads=1
rustfmt --edition 2021 --check packages/pairing-native/src/identity_macos.rs packages/pairing-native/src/identity_macos_tests.rs
cargo clippy --manifest-path packages/pairing-native/Cargo.toml --locked --offline --no-default-features --target aarch64-apple-darwin --target-dir <isolated-lint-target> --lib -- -D warnings
node tools/build-native-desktop.mjs
codesign --force --sign <private-identity> --timestamp=none --options runtime --entitlements <authorized-entitlements> <disposable-app>
codesign --verify --deep --strict <disposable-Electron-app>
ELECTRON_RUN_AS_NODE=1 <signed-Electron-executable> <private-harness.cjs> create
ELECTRON_RUN_AS_NODE=1 <signed-Electron-executable> <private-harness.cjs> reopen
```

Cargo/compiler/Clippy used Rust1.99.0 with compiler/plugin path explicitly selected.
The temporary native harness used offline local Cargo path-dependency on the existing
crate; resolved package versions were checked against the repo lock before locked
build. No repository dependency added. Initial failures are recorded, not PASS.

Profiles, account identifiers, certificate subjects, device IDs, key tags, authority
contents, private paths and private signed bundles are excluded. Public harnesses are
parameterized templates. Production source hashes identify actual code used. Three
new hardware test identities remain private; existing key/state was not adopted or
cleaned. Apple public WWDR G3 hash is in JSON; no trust override/new root added.
No phone, archive or normal product application was opened.
