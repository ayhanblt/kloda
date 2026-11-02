#!/usr/bin/env python3
"""Isolated Simulator Keychain check; no network, Photos, device or product signing."""
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
args = parser.parse_args()
repo = Path(__file__).resolve().parent.parent
listing = json.loads(subprocess.check_output(["xcrun", "simctl", "list", "devices", "available", "-j"]))
device, = [d for values in listing["devices"].values() for d in values if d["udid"] == args.simulator]
assert device["name"] == "Kloda-WebDAV15-Disposable", "Use the existing owned disposable Simulator only"
native = repo / "apps/mobile/modules/my-module/ios"
sources = [native / (name + ".swift") for name in ["IosSyncJournal", "IosSmbJournal", "IosSmbProfile", "IosSmbVault", "IosSmbProfiles"]]
sources += [repo / "packages/storage-native/apple/tests/IosSmbCustodyApp.swift"]
inputs = sources + [Path(__file__).resolve()]
hashes = {str(p.relative_to(repo)): hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs}
fingerprint = hashlib.sha256(json.dumps(hashes, sort_keys=True).encode()).hexdigest()
root = Path(tempfile.mkdtemp(prefix="kloda-smb-custody16-"))
bundle = "com.kloda.fixture.smb16.r" + uuid.uuid4().hex
app = root / "SmbCustody.app"
app.mkdir()
(root / "ownership.json").write_text(json.dumps({"bundle": bundle, "simulator": args.simulator, "inputs": hashes}, indent=2))
# Match the existing host journal fixture: unrelated PC/DAV tables are not exercised.
stub = root / "UnrelatedJournalTables.swift"
stub.write_text("import Foundation\nextension IosSyncJournal {\n" + "\n".join(
    f"func {name}() throws {{}}" for name in ["createFilesJobs", "createRestoreIntents", "createFilesRuns", "createPhotos", "createAutomatic", "createAutomaticPlan"]
) + "\n}\n")
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
    subprocess.run(["xcrun", "--sdk", "iphonesimulator", "swiftc", "-swift-version", "5", "-sdk", sdk, "-target", "arm64-apple-ios16.4-simulator",
                    *map(str, sources), str(stub), *linker, "-framework", "UIKit", "-framework", "Security", "-lsqlite3",
                    "-o", str(app / "SmbCustody")], stdout=log, stderr=subprocess.STDOUT, check=True)
assert all(hashlib.sha256(p.read_bytes()).hexdigest() == hashes[str(p.relative_to(repo))] for p in inputs), "Inputs changed during build"
(app / "Info.plist").write_bytes(plistlib.dumps({"CFBundleExecutable": "SmbCustody", "CFBundleIdentifier": bundle,
    "CFBundleName": "Owned SMB custody checks", "CFBundlePackageType": "APPL", "CFBundleVersion": "1",
    "CFBundleShortVersionString": "1", "MinimumOSVersion": "16.4", "UIDeviceFamily": [1], "UILaunchScreen": {},
    "KLODAFixtureSourceHash": fingerprint}))
subprocess.run(["codesign", "--force", "--sign", "-", "--identifier", bundle, str(app)], check=True)
booted_here = device["state"] == "Shutdown"
print("Evidence: " + str(root), flush=True)
try:
    if booted_here:
        subprocess.run(["xcrun", "simctl", "boot", args.simulator], check=True)
    subprocess.run(["xcrun", "simctl", "bootstatus", args.simulator, "-b"], check=True)
    subprocess.run(["xcrun", "simctl", "install", args.simulator, str(app)], check=True)
    container = Path(subprocess.check_output(["xcrun", "simctl", "get_app_container", args.simulator, bundle, "data"], text=True).strip())
    for mode in ["seed", "reopen", "tamper", "missing"]:
        subprocess.run(["xcrun", "simctl", "launch", args.simulator, bundle, mode], check=True)
        result_file = container / "Documents" / (mode + "-result.json")
        deadline = time.monotonic() + 30
        while not result_file.exists() and time.monotonic() < deadline:
            time.sleep(0.2)
        result = json.loads(result_file.read_text())
        (root / (mode + "-result.json")).write_text(json.dumps(result, sort_keys=True))
        assert result == {"mode": mode, "sourceHash": fingerprint, "status": "PASS"}, result
        print("PASS " + mode, flush=True)
        subprocess.run(["xcrun", "simctl", "terminate", args.simulator, bundle], check=True)
finally:
    subprocess.run(["xcrun", "simctl", "terminate", args.simulator, bundle], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if booted_here:
        subprocess.run(["xcrun", "simctl", "shutdown", args.simulator], check=True)
print("PASS isolated positive Simulator Keychain; production signing, lock/device security and OS LAN/source gates remain open")
