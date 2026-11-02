#!/usr/bin/env python3
"""Scoped LAN bridge checks. Requires prebuilt native libraries; no external network or Photos."""
from pathlib import Path
import argparse
import json
import os
import subprocess
import tempfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("simulator")
parser.add_argument("--pairing-library", type=Path, required=True)
parser.add_argument("--storage-library", type=Path, required=True)
args = parser.parse_args()
repo = Path(__file__).resolve().parent.parent
root = Path(tempfile.mkdtemp(prefix="kloda-ios-lan16-"))
print("Evidence: " + str(root), flush=True)
listing = json.loads(subprocess.check_output(["xcrun", "simctl", "list", "devices", "available", "-j"]))
device, = [d for values in listing["devices"].values() for d in values if d["udid"] == args.simulator]
assert device["name"] == "Kloda-WebDAV15-Disposable", "Use the existing owned disposable Simulator only"
assert args.pairing_library.is_file() and args.storage_library.is_file()
def run(name, command, **kwargs):
    with (root / (name + ".log")).open("w") as log:
        subprocess.run(list(map(str, command)), cwd=repo, check=True, stdout=log, stderr=subprocess.STDOUT, **kwargs)
    print("PASS " + name, flush=True)
native = repo / "apps/mobile/modules/my-module/ios"
tests = repo / "packages/storage-native/apple/tests"
stub = root / "UnrelatedJournalTables.swift"
stub.write_text("import Foundation\nextension IosSyncJournal {\n" + "\n".join(
    f"func {name}() throws {{}}" for name in ["createFilesJobs", "createRestoreIntents", "createFilesRuns", "createPhotos", "createAutomatic", "createAutomaticPlan"]
) + "\n}\n")
sources = [native / (name + ".swift") for name in ["IosSyncJournal", "IosSmbJournal", "IosSmbProfile", "IosSmbProfiles", "IosSmbPublication", "IosSmbLan"]]
swift = ["-swift-version", "5", "-module-cache-path", root / "swift-cache", "-D", "KLODA_SMB_NATIVE"]
run("host-rust-build", ["rustup", "run", "1.99.0", "rustc", "--edition", "2021", "--test", "packages/pairing-native/tests/ios_lan_socket.rs", "-o", root / "route-checks"])
run("host-rust", [root / "route-checks"], timeout=30)
run("host-c-build", ["xcrun", "clang", "-Wall", "-Wextra", "-Werror", "-c", tests / "IosSmbLanDouble.c", "-o", root / "double.o"])
run("host-swift-build", ["xcrun", "swiftc", *swift, *sources, tests / "IosSmbLanChecks.swift", stub, root / "double.o", "-o", root / "swift-checks"])
run("host-swift", [root / "swift-checks"], timeout=30)
sdk = subprocess.check_output(["xcrun", "--sdk", "iphonesimulator", "--show-sdk-path"], text=True).strip()
run("sim-swift-link", ["xcrun", "--sdk", "iphonesimulator", "swiftc", *swift, "-sdk", sdk, "-target", "arm64-apple-ios16.4-simulator",
    *sources, native / "IosSmbVault.swift", tests / "IosSmbLanSimulatorChecks.swift", stub,
    "-import-objc-header", repo / "packages/pairing-native/apple/include/KlodaPairingNative.h",
    args.pairing_library.resolve(), args.storage_library.resolve(), "-framework", "Security", "-framework", "Network", "-framework", "SystemConfiguration",
    "-o", root / "sim-checks"])
run("sim-witness-build", ["xcrun", "--sdk", "iphonesimulator", "clang", "-target", "arm64-apple-ios16.4-simulator", "-isysroot", sdk,
    "-fobjc-arc", "-fblocks", "-Wall", "-Wextra", "-Werror", "packages/pairing-native/apple/tests/IosRouteWitnessChecks.m",
    "-framework", "Foundation", "-framework", "Network", "-o", root / "witness-checks"])
for binary in ["sim-checks", "witness-checks"]:
    run(binary + "-sign", ["codesign", "--force", "--sign", "-", root / binary])
booted_here = device["state"] == "Shutdown"
try:
    if booted_here:
        run("sim-boot", ["xcrun", "simctl", "boot", args.simulator])
    run("sim-boot-ready", ["xcrun", "simctl", "bootstatus", args.simulator, "-b"])
    for binary in ["sim-checks", "witness-checks"]:
        run(binary, ["xcrun", "simctl", "spawn", args.simulator, root / binary], timeout=30)
finally:
    if booted_here:
        run("sim-shutdown", ["xcrun", "simctl", "shutdown", args.simulator])
print("PASS scoped bridge checks; admitted real LAN/selected Files/physical acceptance remain open")
