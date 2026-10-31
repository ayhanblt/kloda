# Owned Simulator Keychain test entitlement — approval required

Status: user approved the exact narrow experiment on 2026-10-30. Not production signing approval.

Observed: actual PhotoKit permission request succeeds and the fixture creates its
new PNG/album; IosWebDavVault then fails closed with webdav_storage. securityd
reports -34018: neither application-identifier nor keychain-access-groups.
The fixture cleaned only its own album; no production key/pin/authority reset.

Proposed experiment: ad-hoc sign only /tmp/kloda-step15/ios-https/WebDavChecks.app,
bundle com.kloda.fixture.webdav15, with a single keychain-access-groups entitlement
[com.kloda.fixture.webdav15]. Install/run only Simulator
497AAA0F-967E-4781-9468-3F05CA2D3D5A / Kloda-WebDAV15-Disposable.
No fabricated Team ID/application-identifier, provisioning profile, paid account,
production bundle/signing identity/access group or software credential fallback.
Native vault still uses ThisDeviceOnly, non-synchronizable exact service/account.

Risk: this grants a new access group to that disposable test app; it changes the
fixture access boundary and does not prove production signing/hardware custody.
It may still fail to launch on this Simulator. No retry via broader entitlement.

Automatic approval review rejected the signing command because this entitlement
change was outside the prior test/storage approval. The command did not execute.
Only the proposed plist was written under /tmp; fixture signature was unchanged.

Alternative: leave the full PhotoKit+native-vault/review runtime BLOCKED; continue
source/build/pure-journal/other tests and Files/Photos restore implementation.
The prior HTTPS synthetic component proof remains separate and historical.

Format correction under the same approved group (no additional entitlement):
Swift's [embedded-simulator linker specification](https://github.com/swiftlang/swift-build/blob/swift-6.3-RELEASE/Sources/SWBApplePlatform/Specs/Embedded-Simulator.xcspec)
uses __TEXT,__entitlements and __TEXT,__ents_der. The initial attempt put an iOS
group in the macOS host signature and was denied. The fixture builder now uses
only the exact approved group in those Simulator sections, verifies DER roundtrip,
and leaves the host signature unentitled. No application/team identifier,
production group, entitlement widening, credential fallback or device signing.
Runtime PASS: the exact approved simulated group supports the real native vault, PhotoKit source, metadata-only DAV revision and explicit review. Source hash422d0b3cab2f6df44f82a591698bf2ed293a1897ddb7ec409376ab2ea62d2bb9. The host signature has no entitlements; no group widening or app/team ID. This is not a production signing or hardware-custody claim. Actual PhotoKit restore-copy remains separately unapproved/NOT_RUN.
