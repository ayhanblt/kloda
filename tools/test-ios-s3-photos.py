#!/usr/bin/env python3
"""Owned Simulator S3 Files or synthetic diagnostic check; no real AWS or Photos acceptance."""
from pathlib import Path
import argparse
import hashlib
import json
import plistlib
import subprocess
import tempfile
import time
import uuid

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("simulator")
parser.add_argument("--build-only", action="store_true")
parser.add_argument("--approved-owned-photos", action="store_true")
args = parser.parse_args()
assert args.build_only or args.approved_owned_photos, "Exact owned Photos approval required"
repo = Path(__file__).resolve().parent.parent
listing = json.loads(subprocess.check_output(["xcrun", "simctl", "list", "devices", "available", "-j"]))
device, = [d for values in listing["devices"].values() for d in values if d["udid"] == args.simulator]
assert device["name"] == "Kloda-Ftps16c-Disposable", "Use the existing owned disposable Simulator only"
wire = Path("/tmp/kloda-s3-step17/verification-20261104/native-wire")
assert not (wire / "TEARDOWN.json").exists()
ready = json.loads((wire / "setup-success.json").read_text())
assert ready["ca"] == hashlib.sha256((wire / "ca.der").read_bytes()).hexdigest()
before_counts = json.loads((wire / "counts.json").read_text())
native = repo / "apps/mobile/modules/my-module/ios"
sources = [native / (name + ".swift") for name in ["IosSyncJournal", "IosS3Journal", "IosS3Catalog", "IosS3Profile", "IosS3Vault", "IosS3Profiles", "IosS3Bridge", "IosS3Client", "IosS3Publisher", "IosS3Sources", "IosS3Files", "IosS3Download", "IosS3RestoreJournal", "IosS3FilesRestore", "IosFilesSource", "IosFilesSnapshot", "IosSourceScanner", "IosFilesRestoreJournal", "IosLocalRestorePublication", "IosRestoreDestination", "IosWebDavContext"]]
sources += [repo / "packages/s3-native/apple/tests/IosS3PhotosApp.swift", repo / "packages/s3-native/apple/tests/IosS3FilesFixtureSupport.swift", repo / "packages/s3-native/apple/tests/IosS3PhotosFixtureSupport.swift"]
sources += [native / name for name in ["IosS3Runs.swift", "IosS3Queue.swift", "IosS3Copy.swift", "IosS3PhotoManifest.swift", "IosS3Photos.swift", "IosS3PhotosState.swift", "IosS3PhotosJournal.swift", "IosS3PhotosImport.swift", "IosS3PhotosRestore.swift", "IosPhotoJson.swift", "IosPhotoManifest.swift", "IosPhotosSource.swift", "IosPhotosImportMedia.swift"]]
inputs = sources + [native / "IosFilesQueue.swift", Path(__file__).resolve(), repo / "packages/s3-native/target/aarch64-apple-ios-sim/aarch64-apple-ios-sim/debug/libkloda_s3_native.a", wire / "ca.der"]
hashes = {str(p.relative_to(repo)) if p.is_relative_to(repo) else p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs}
fingerprint = hashlib.sha256(json.dumps(hashes, sort_keys=True).encode()).hexdigest()
root = Path(tempfile.mkdtemp(prefix="kloda-s3-photos17-"))
bundle = "com.kloda.fixture.s3photos17.r" + uuid.uuid4().hex
app = root / "S3SelectedFiles.app"
app.mkdir()
(root / "ownership.json").write_text(json.dumps({"bundle": bundle, "simulator": args.simulator, "inputs": hashes, "variant": "owned-photos"}, indent=2))
# Match the existing host journal fixture: unrelated PC/DAV tables are not exercised.
stub = root / "UnrelatedJournalTables.swift"
# Exact production selected-source declaration; unrelated PC transport queue is excluded.
selection_source = (native / "IosFilesQueue.swift").read_text().split("final class IosFilesQueue",1)[0]
stub.write_text(selection_source)

sdk = subprocess.check_output(["xcrun", "--sdk", "iphonesimulator", "--show-sdk-path"], text=True).strip()
# Simulator-only iOS group; the host ad-hoc signature has no Keychain rights.
rights = root / "Fixture.entitlements"
der = root / "Fixture.der"
allowed = {"keychain-access-groups": [bundle]}
rights.write_bytes(plistlib.dumps(allowed))
subprocess.run(["/usr/bin/derq", "query", "--raw", "-f", "xml", "-i", str(rights), "-o", str(der)], check=True)
assert plistlib.loads(subprocess.check_output(["/usr/bin/derq", "query", "-i", str(der), "--xml"])) == allowed
linker = []
for section, path in [("__entitlements", rights), ("__ents_der", der)]:
    linker += ["-Xlinker", "-sectcreate", "-Xlinker", "__TEXT", "-Xlinker", section, "-Xlinker", str(path)]
with (root / "build.log").open("w") as log:
    subprocess.run(["xcrun", "--sdk", "iphonesimulator", "swiftc", "-swift-version", "5", "-D", "KLODA_S3_NATIVE", "-D", "KLODA_S3_OWNED_FIXTURE", "-sdk", sdk, "-target", "arm64-apple-ios16.4-simulator",
                    *map(str, sources), str(stub), str(repo / "packages/s3-native/target/aarch64-apple-ios-sim/aarch64-apple-ios-sim/debug/libkloda_s3_native.a"), *linker, "-framework", "UIKit", "-framework", "Security", "-framework", "Photos", "-lsqlite3",
                    "-o", str(app / "S3SelectedFiles")], stdout=log, stderr=subprocess.STDOUT, check=True)
assert all(hashlib.sha256(p.read_bytes()).hexdigest() == hashes[str(p.relative_to(repo)) if p.is_relative_to(repo) else p.name] for p in inputs), "Inputs changed during build"
import shutil
shutil.copyfile(wire / "ca.der", app / "owned-ca.der")
ports = json.loads((wire / "ports.json").read_text())
(app / "Info.plist").write_bytes(plistlib.dumps({"CFBundleExecutable": "S3SelectedFiles", "CFBundleIdentifier": bundle,
    "CFBundleName": "Owned S3 Photos verification", "CFBundlePackageType": "APPL", "CFBundleVersion": "1",
    "CFBundleShortVersionString": "1", "MinimumOSVersion": "16.4", "UIDeviceFamily": [1], "UILaunchScreen": {}, "UIFileSharingEnabled": True, "LSSupportsOpeningDocumentsInPlace": True,
    "FixtureMediaEnabled": args.approved_owned_photos, "NSPhotoLibraryUsageDescription": "Only approved owned synthetic Photos fixture", "NSPhotoLibraryAddUsageDescription": "Only approved owned synthetic Photos fixture", "KLODAFixtureSourceHash": fingerprint, "FixtureNonce": str(uuid.uuid4()), "NativeWireEndpoint": f"https://127.0.0.1:{ports[2]}"}))
subprocess.run(["codesign", "--force", "--sign", "-", "--identifier", bundle, str(app)], check=True)
if args.build_only:
    print("BUILD_ONLY " + str(root), flush=True)
    raise SystemExit(0)
booted_here = device["state"] == "Shutdown"
print("Evidence: " + str(root), flush=True)
cleanup_done = False
try:
    if booted_here:
        subprocess.run(["xcrun", "simctl", "boot", args.simulator], check=True)
    subprocess.run(["xcrun", "simctl", "bootstatus", args.simulator, "-b"], check=True)
    subprocess.run(["xcrun", "simctl", "install", args.simulator, str(app)], check=True)
    subprocess.run(["xcrun", "simctl", "privacy", args.simulator, "grant", "photos", bundle], check=True)
    subprocess.run(["xcrun", "simctl", "privacy", args.simulator, "grant", "photos-add", bundle], check=True)
    container = Path(subprocess.check_output(["xcrun", "simctl", "get_app_container", args.simulator, bundle, "data"], text=True).strip())
    for mode in ["seed", "reopen", "cleanup"]:
        subprocess.run(["xcrun", "simctl", "launch", args.simulator, bundle, mode], check=True)
        result_file = container / "Documents" / (mode + "-result.json")
        deadline = time.monotonic() + 240
        phase = None
        while time.monotonic() < deadline:
            if result_file.exists():
                result = json.loads(result_file.read_text())
                if result.get("phase") != phase:
                    phase = result.get("phase"); print("PHASE " + mode + " " + str(phase), flush=True)
                if result.get("status") == "FAIL" or phase == "finished": break
            time.sleep(0.2)
        result = json.loads(result_file.read_text())
        (root / (mode + "-result.json")).write_text(json.dumps(result, sort_keys=True))
        assert result.get("status") == "PASS" and result.get("phase") == "finished", result
        if mode in ["seed", "reopen"]:
            counts = json.loads((wire / "counts.json").read_text())
            assert counts["complete"] == before_counts["complete"] + 2 and counts["dropped"] == before_counts["dropped"], counts
            (root / (mode + "-wire-counts.json")).write_text(json.dumps(counts))
        if mode == "cleanup": cleanup_done = True
        print("PASS " + mode, flush=True)
        subprocess.run(["xcrun", "simctl", "terminate", args.simulator, bundle], check=True)
finally:
    if "container" in locals() and not cleanup_done:
        subprocess.run(["xcrun", "simctl", "terminate", args.simulator, bundle], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        subprocess.run(["xcrun", "simctl", "launch", args.simulator, bundle, "cleanup"], check=True)
        cleanup = container / "Documents" / "cleanup-result.json"
        deadline = time.monotonic() + 55
        while not cleanup.exists() and time.monotonic() < deadline: time.sleep(0.2)
        assert json.loads(cleanup.read_text())["status"] == "PASS", "owned Keychain cleanup failed"
        (root / "cleanup-after-failure.json").write_text(cleanup.read_text())
    subprocess.run(["xcrun", "simctl", "terminate", args.simulator, bundle], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if booted_here:
        subprocess.run(["xcrun", "simctl", "shutdown", args.simulator], check=True)
print("PASS actual owned Photos/native S3 publish/full readback/metadata-fence/restore/repeat/reopen/exact cleanup; no AWS or real media")
