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
parser.add_argument("--diagnostic", action="store_true")
parser.add_argument("--abort", action="store_true")
parser.add_argument("--runs", action="store_true")
parser.add_argument("--pause-only", action="store_true")
parser.add_argument("--global-pause", action="store_true")
parser.add_argument("--automatic-only", action="store_true")
args = parser.parse_args()
if args.automatic_only: args.pause_only = True
if args.global_pause: args.pause_only = True
if args.pause_only: args.runs = True
assert sum([args.diagnostic, args.abort, args.runs]) <= 1
repo = Path(__file__).resolve().parent.parent
listing = json.loads(subprocess.check_output(["xcrun", "simctl", "list", "devices", "available", "-j"]))
device, = [d for values in listing["devices"].values() for d in values if d["udid"] == args.simulator]
assert device["name"] == "Kloda-Ftps16c-Disposable", "Use the existing owned disposable Simulator only"
wire = Path("/tmp/kloda-s3-step17/native-wire")
if not args.runs:
    assert not (wire / "TEARDOWN.json").exists(), "Owned fixture is stopped; prepare a new owned TLS fixture before running"
    ready = json.loads((wire / "setup-success.json").read_text())
    assert ready["ports"] == json.loads((wire / "ports.json").read_text())
    assert ready["ca"] == hashlib.sha256((wire / "ca.der").read_bytes()).hexdigest()
    before_counts = json.loads((wire / "counts.json").read_text())
    assert before_counts["dropped"] == 1 and (before_counts["complete"] >= 3 if (args.diagnostic or args.abort) else before_counts["complete"] == 2), "Owned host readiness mismatch"
native = repo / "apps/mobile/modules/my-module/ios"
sources = [native / (name + ".swift") for name in ["IosSyncJournal", "IosS3Journal", "IosS3Catalog", "IosS3Profile", "IosS3Vault", "IosS3Profiles", "IosS3Bridge", "IosS3Client", "IosS3Publisher", "IosS3Sources", "IosS3Files", "IosS3Download", "IosS3RestoreJournal", "IosS3FilesRestore", "IosFilesSource", "IosFilesSnapshot", "IosSourceScanner", "IosFilesRestoreJournal", "IosLocalRestorePublication", "IosRestoreDestination", "IosWebDavContext"]]
sources += [repo / ("packages/s3-native/apple/tests/IosS3RunApp.swift" if args.runs else "packages/s3-native/apple/tests/IosS3AbortApp.swift" if args.abort else "packages/s3-native/apple/tests/IosS3DiagnosticApp.swift" if args.diagnostic else "packages/s3-native/apple/tests/IosS3SelectedFilesApp.swift"), repo / "packages/s3-native/apple/tests/IosS3FilesFixtureSupport.swift"]
sources += [native / name for name in ["IosS3Runs.swift", "IosS3Queue.swift", "IosS3Copy.swift", "IosS3PhotoManifest.swift", "IosS3Photos.swift", "IosS3PhotosState.swift", "IosPhotoJson.swift", "IosPhotoManifest.swift", "IosPhotosSource.swift"]]
if args.abort: sources += [native / "IosS3Abort.swift"]
if args.diagnostic: sources += [native / "IosS3Diagnostic.swift", native / "IosS3TestGrant.swift"]
inputs = sources + [native / "IosFilesQueue.swift", Path(__file__).resolve(), repo / "packages/s3-native/target/aarch64-apple-ios-sim/aarch64-apple-ios-sim/debug/libkloda_s3_native.a", Path("/tmp/kloda-s3-step17/native-wire/ca.der")]
if args.runs: inputs = [p for p in inputs if p != wire / "ca.der"]
hashes = {str(p.relative_to(repo)) if p.is_relative_to(repo) else p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs}
fingerprint = hashlib.sha256(json.dumps(hashes, sort_keys=True).encode()).hexdigest()
root = Path(tempfile.mkdtemp(prefix="kloda-s3-files17-"))
bundle = "com.kloda.fixture.s3files17.r" + uuid.uuid4().hex
app = root / "S3SelectedFiles.app"
app.mkdir()
(root / "ownership.json").write_text(json.dumps({"bundle": bundle, "simulator": args.simulator, "inputs": hashes, "variant": "automatic-authority-component" if args.automatic_only else "runs-component" if args.runs else "abort" if args.abort else "diagnostic" if args.diagnostic else "selected-files"}, indent=2))
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
if not args.runs: shutil.copyfile("/tmp/kloda-s3-step17/native-wire/ca.der", app / "owned-ca.der")
ports = [] if args.runs else json.loads(Path("/tmp/kloda-s3-step17/native-wire/ports.json").read_text())
(app / "Info.plist").write_bytes(plistlib.dumps({"CFBundleExecutable": "S3SelectedFiles", "CFBundleIdentifier": bundle,
    "CFBundleName": "Owned S3 custody checks", "CFBundlePackageType": "APPL", "CFBundleVersion": "1",
    "CFBundleShortVersionString": "1", "MinimumOSVersion": "16.4", "UIDeviceFamily": [1], "UILaunchScreen": {}, "UIFileSharingEnabled": True, "LSSupportsOpeningDocumentsInPlace": True,
    "RunsPauseOnly": args.pause_only, "RunsGlobalPause": args.global_pause, "RunsAutomaticOnly": args.automatic_only, "KLODAFixtureSourceHash": fingerprint, "FixtureNonce": str(uuid.uuid4()), "NativeWireEndpoint": "https://owned.example.test" if args.runs else f"https://127.0.0.1:{ports[2]}"}))
subprocess.run(["codesign", "--force", "--sign", "-", "--identifier", bundle, str(app)], check=True)
booted_here = device["state"] == "Shutdown"
print("Evidence: " + str(root), flush=True)
cleanup_done = False
try:
    if booted_here:
        subprocess.run(["xcrun", "simctl", "boot", args.simulator], check=True)
    subprocess.run(["xcrun", "simctl", "bootstatus", args.simulator, "-b"], check=True)
    subprocess.run(["xcrun", "simctl", "install", args.simulator, str(app)], check=True)
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
        if mode == "seed" and not args.runs:
            counts = json.loads(Path("/tmp/kloda-s3-step17/native-wire/counts.json").read_text())
            assert counts["complete"] == before_counts["complete"] + (0 if args.abort else 1) and counts["dropped"] == before_counts["dropped"], counts
            (root / "wire-counts.json").write_text(json.dumps(counts))
        if mode == "cleanup": cleanup_done = True
        print("PASS " + mode, flush=True)
        subprocess.run(["xcrun", "simctl", "terminate", args.simulator, bundle], check=True)
finally:
    if "container" in locals() and not cleanup_done:
        subprocess.run(["xcrun", "simctl", "terminate", args.simulator, bundle], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        subprocess.run(["xcrun", "simctl", "launch", args.simulator, bundle, "cleanup"], check=True)
        cleanup = container / "Documents" / "cleanup-result.json"
        deadline = time.monotonic() + 20
        while not cleanup.exists() and time.monotonic() < deadline: time.sleep(0.2)
        assert json.loads(cleanup.read_text())["status"] == "PASS", "owned Keychain cleanup failed"
        (root / "cleanup-after-failure.json").write_text(cleanup.read_text())
    subprocess.run(["xcrun", "simctl", "terminate", args.simulator, bundle], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if booted_here:
        subprocess.run(["xcrun", "simctl", "shutdown", args.simulator], check=True)
print("PASS native automatic/manual authority/default-off/revocation/reopen/cleanup component; no network or OS-delivery claim" if args.automatic_only else "PASS native run-store/independent pause/store-failure/reopen component; fake ACKs only, no network or media" if args.runs else "PASS native own multipart abort/stale authority/terminal/reopen; no AWS or media" if args.abort else "PASS native synthetic diagnostic/grant/replay/disabled general backup/reopen; no real AWS or Photos acceptance" if args.diagnostic else "PASS real owned Files pickers/snapshot/S3 publication/unchanged reuse/own restore/repeat/reopen; no real AWS or Photos acceptance")
