#!/usr/bin/env python3
"""Owned emulator-5584 + Samba Files fixture only; no media API writes."""
from pathlib import Path
import hashlib
import json
import os
import shutil
import subprocess
import argparse

parser = argparse.ArgumentParser()
parser.add_argument("--photos-owned-fixture", action="store_true", help="Separate exact user approval required; writes one owned source PNG and at most four owned restored PNGs across four attempts in the disposable AVD")
parser.add_argument("--release-candidate", action="store_true", help="Use the verified fixed-path arm64 release candidate")
parser.add_argument("--product-native", action="store_true", help="Use bundled native library and validate product factory/service registration; no Photos writes")
args = parser.parse_args()
assert not (args.product_native and args.photos_owned_fixture)
scope = "smb-product" if args.product_native else "smb-photos-owned" if args.photos_owned_fixture else "smb-files"
repo = Path(__file__).resolve().parent.parent
sdk = Path.home() / "Library/Android/sdk"
adb = [str(sdk / "platform-tools/adb"), "-s", "emulator-5584"]
def capture(args, **kwargs):
    return subprocess.check_output(args, text=True, **kwargs)
assert capture(adb + ["emu", "avd", "name"]).splitlines()[0].strip() == "KlodaWebDavStep15"
assert capture(adb + ["shell", "getprop", "sys.boot_completed"]).strip() == "1"
ledger = json.loads(Path("/tmp/kloda-smb16-preflight/owned-containers.json").read_text())
strict = next(c for c in ledger["containers"] if c["mode"] == "strict")
container = json.loads(capture(["docker", "inspect", strict["id"]]))[0]
assert container["Config"]["Labels"].get("kloda.fixture") == "smb16" and container["State"]["Running"]
assert not container.get("Mounts")
assert container["HostConfig"]["PortBindings"]["445/tcp"] == [{"HostIp": "127.0.0.1", "HostPort": "27445"}]
source = Path("/tmp/kloda-smb16-adopt-cross/aarch64-linux-android/aarch64-linux-android/debug/libkloda_storage_native.so")
if args.release_candidate:
    source = Path("/tmp/kloda-smb16-release/aarch64-linux-android/aarch64-linux-android/release/libkloda_storage_native.so")
    metadata = json.loads(Path("/tmp/kloda-smb16-release/aarch64-linux-android/artifact-check.json").read_text())
    assert metadata["target"] == "aarch64-linux-android" and metadata["release"] and Path(metadata["artifact"]) == source
    assert metadata["sha256"] == hashlib.sha256(source.read_bytes()).hexdigest()
    assert metadata["alignments"] and all(value >= 16384 for value in metadata["alignments"])

assets = repo / "apps/mobile/modules/my-module/android/src/androidTest/assets/kloda-smb16"
assets.mkdir(exist_ok=True)
shutil.copyfile(source, assets / source.name)
(assets / "sha256.txt").write_text(hashlib.sha256(source.read_bytes()).hexdigest() + "\n")
subprocess.run(["./gradlew", ":my-module:assembleDebugAndroidTest", "--console=plain", *(["-PklodaSmbNative=true"] if args.product_native else [])],
    cwd=repo / "apps/mobile/android", env={**os.environ, "ANDROID_HOME": str(sdk), "ANDROID_SDK_ROOT": str(sdk)}, check=True)
outputs = repo / "apps/mobile/modules/my-module/android/build/outputs/apk/androidTest/debug"
metadata = json.loads((outputs / "output-metadata.json").read_text())
assert metadata["applicationId"] == "com.kloda.sync.test" and len(metadata["elements"]) == 1
apk = outputs / metadata["elements"][0]["outputFile"]
assert apk.parent == outputs and apk.is_file()
subprocess.run(adb + ["install", "-r", "-t", str(apk)], check=True)
existing = capture(adb + ["reverse", "--list"]).splitlines()
matching = [line.split() for line in existing if "tcp:27445" in line.split()]
assert all(line[-2:] == ["tcp:27445", "tcp:27445"] for line in matching)
created = not matching
try:
    if created: subprocess.run(adb + ["reverse", "tcp:27445", "tcp:27445"], check=True)
    result = capture(adb + ["shell", "am", "instrument", "-w", "-r", "-e", "scope", scope,
        "com.kloda.sync.test/com.kloda.sync.AndroidFilesQueueRecoveryInstrumentation"], timeout=120)
    print(result)
    assert "INSTRUMENTATION_CODE: -1" in result
    expected = ["smb-owned-photos-restore"] if args.photos_owned_fixture else ["smb-owned-files", "smb-owned-sources", "smb-photos-codec-authority"]
    if args.product_native: expected += ["smb-product-factory-service", "smb-owned-os-files"]
    assert all("PASS " + group in result for group in expected)
finally:
    if created: subprocess.run(adb + ["reverse", "--remove", "tcp:27445"], check=True)
