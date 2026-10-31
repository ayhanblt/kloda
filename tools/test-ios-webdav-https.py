#!/usr/bin/env python3
"""Build an isolated UIKit fixture from production native DAV client/snapshot/SQLite code."""
from pathlib import Path
import argparse
import json
import hashlib
import plistlib
import subprocess
import shutil

parser = argparse.ArgumentParser()
parser.add_argument("simulator")
parser.add_argument("--run", action="store_true", help="Install and launch the freshly built owned fixture")
parser.add_argument("--keychain-experiment", action="store_true", help="Approved owned Simulator Photos/vault experiment; may be blocked at launch")
parser.add_argument("--photos-restore-experiment", action="store_true", help="Approved own PhotoKit restore-copy and recorded-copy cleanup")
args = parser.parse_args()
if args.photos_restore_experiment and not args.keychain_experiment:
    parser.error("--photos-restore-experiment requires the exact approved --keychain-experiment")
repo = Path(__file__).resolve().parent.parent
root = Path("/tmp/kloda-step15/ios-https")
root.mkdir(parents=True, exist_ok=True)
app = root / "WebDavChecks.app"
app.mkdir(exist_ok=True)
shutil.rmtree(app / "_CodeSignature", ignore_errors=True)
listing = json.loads(subprocess.check_output(["xcrun", "simctl", "list", "devices", "available", "-j"]))
matched = [item for values in listing["devices"].values() for item in values if item["udid"] == args.simulator]
if len(matched) != 1 or matched[0]["name"] != "Kloda-WebDAV15-Disposable":
    raise SystemExit("Only the explicitly owned Kloda-WebDAV15-Disposable simulator is allowed")
native = repo / "apps/mobile/modules/my-module/ios"
sdk = subprocess.check_output(["xcrun", "--sdk", "iphonesimulator", "--show-sdk-path"], text=True).strip()
# Compile actual native core and bridge; no substituted PC tables, identity receipts or OS leases.
sources = sorted(path for path in native.glob("*.swift") if "import ExpoModulesCore" not in path.read_text())
sources += sorted((native / "NativePairing").glob("*.swift"))
bridge = native / "NativePairing"
fixture = repo / "packages/pairing-native/apple/tests/IosWebDavHttpsApp.swift"
photos_fixture = repo / "packages/pairing-native/apple/tests/IosWebDavPhotosAppChecks.swift"
restore_fixture = repo / "packages/pairing-native/apple/tests/IosWebDavPhotosRestoreAppChecks.swift"
inputs = sources + [bridge / "KlodaPairingNative.h", bridge / "KlodaPairingNative.xcframework/ios-arm64-simulator/libkloda_pairing_native.a", fixture, photos_fixture, restore_fixture, Path(__file__).resolve()]
def fingerprint():
    value = hashlib.sha256()
    value.update(b"simulated-keychain-group:" + str(args.keychain_experiment).encode())
    value.update(b"photos-restore-copy:" + str(args.photos_restore_experiment).encode())
    for path in inputs:
        value.update(str(path.relative_to(repo)).encode()); value.update(b"\0"); value.update(path.read_bytes())
    return value.hexdigest()
# Xcode's embedded-simulator linker spec separates simulated iOS rights from the host macOS signature.
linker = []
if args.keychain_experiment:
    entitlements = root / "OwnedFixtureGroups.entitlements"
    der = root / "OwnedFixtureGroups.der"
    allowed = {"keychain-access-groups": ["com.kloda.fixture.webdav15"]}
    entitlements.write_bytes(plistlib.dumps(allowed))
    subprocess.run(["/usr/bin/derq", "query", "--raw", "-f", "xml", "-i", str(entitlements), "-o", str(der)], check=True)
    assert plistlib.loads(subprocess.check_output(["/usr/bin/derq", "query", "-i", str(der), "--xml"])) == allowed
    for section, path in [("__entitlements", entitlements), ("__ents_der", der)]:
        linker += ["-Xlinker", "-sectcreate", "-Xlinker", "__TEXT", "-Xlinker", section, "-Xlinker", str(path)]
source_hash = fingerprint()
with (root / "build.log").open("w") as log:
    subprocess.run(["xcrun", "--sdk", "iphonesimulator", "swiftc", "-swift-version", "5", "-sdk", sdk,
        "-target", "arm64-apple-ios16.4-simulator", *map(str, sources), "-import-objc-header", str(bridge / "KlodaPairingNative.h"),
        str(bridge / "KlodaPairingNative.xcframework/ios-arm64-simulator/libkloda_pairing_native.a"),
        str(fixture), str(photos_fixture), str(restore_fixture), *linker,
        "-framework", "UIKit", "-framework", "Security", "-framework", "Network", "-framework", "BackgroundTasks", "-lsqlite3", "-o", str(app / "WebDavChecks")], check=True, stdout=log, stderr=subprocess.STDOUT)
if fingerprint() != source_hash:
    raise SystemExit("Native inputs changed during compilation; do not install this fixture")
(root / "source-fingerprint.txt").write_text(source_hash + "\n")
(app / "Info.plist").write_bytes(plistlib.dumps({"CFBundleExecutable": "WebDavChecks", "CFBundleIdentifier": "com.kloda.fixture.webdav15",
    "KLODAFixtureSourceHash": source_hash, "KLODAFixturePhotos": args.keychain_experiment, "KLODAFixturePhotosRestore": args.photos_restore_experiment, "CFBundleName": "Owned WebDAV checks", "CFBundlePackageType": "APPL", "CFBundleVersion": "1", "CFBundleShortVersionString": "1",
    "MinimumOSVersion": "16.4", "UIDeviceFamily": [1], "UILaunchScreen": {}, "NSLocalNetworkUsageDescription": "Owned loopback HTTPS fixture only.",
    "NSPhotoLibraryUsageDescription": "Owned disposable simulator Photos fixture only.",
    "UIBackgroundModes": ["processing"], "BGTaskSchedulerPermittedIdentifiers": ["com.kloda.app.webdav.processing"]}))
# Host signature stays unentitled; only the approved Simulator sections above carry the exact test group.
subprocess.run(["codesign", "--force", "--sign", "-", "--identifier", "com.kloda.fixture.webdav15", str(app)], check=True)
print("Built actual native-core UIKit fixture; Expo/product UI, physical hardware and normal background cadence are not exercised")

if args.run:
    subprocess.run(["xcrun", "simctl", "terminate", args.simulator, "com.kloda.fixture.webdav15"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    subprocess.run(["xcrun", "simctl", "install", args.simulator, str(app)], check=True)
    subprocess.run(["xcrun", "simctl", "launch", args.simulator, "com.kloda.fixture.webdav15"], check=True)
    container = subprocess.check_output(["xcrun", "simctl", "get_app_container", args.simulator, "com.kloda.fixture.webdav15", "data"], text=True).strip()
    print(json.dumps({"sourceHash": source_hash, "result": str(Path(container) / "Documents/webdav-result.json")}))
