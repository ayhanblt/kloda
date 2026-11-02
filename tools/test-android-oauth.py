#!/usr/bin/env python3
"""Owned emulator-5590 (KlodaCloud18); the user signs in to their own account in the Custom Tab (ADR0028, approved 2026-11-02)."""
from pathlib import Path
import json
import os
import subprocess
import sys

provider = sys.argv[1] if len(sys.argv) == 2 else ""
if provider not in ("dropbox", "onedrive", "yandex", "google-drive"):
    raise SystemExit("usage: test-android-oauth.py dropbox|onedrive|yandex|google-drive")

repo = Path(__file__).resolve().parent.parent
sdk = Path.home() / "Library/Android/sdk"
adb = [str(sdk / "platform-tools/adb"), "-s", "emulator-5590"]

def capture(args, **kwargs):
    return subprocess.check_output(args, text=True, **kwargs)

assert capture(adb + ["emu", "avd", "name"]).splitlines()[0].strip() == "KlodaCloud18"
assert capture(adb + ["shell", "getprop", "sys.boot_completed"]).strip() == "1"

subprocess.run(["./gradlew", ":my-module:assembleDebugAndroidTest", "--console=plain", "-q"],
    cwd=repo / "apps/mobile/android", env={**os.environ, "ANDROID_HOME": str(sdk), "ANDROID_SDK_ROOT": str(sdk)}, check=True)
outputs = repo / "apps/mobile/modules/my-module/android/build/outputs/apk/androidTest/debug"
metadata = json.loads((outputs / "output-metadata.json").read_text())
assert metadata["applicationId"] == "com.kloda.sync.test" and len(metadata["elements"]) == 1
apk = outputs / metadata["elements"][0]["outputFile"]
assert apk.parent == outputs and apk.is_file()
subprocess.run(adb + ["install", "-r", "-t", str(apk)], check=True, stdout=subprocess.DEVNULL)

process = subprocess.Popen(adb + ["shell", "am", "instrument", "-w", "-r", "-e", "scope", "cloud18-oauth", "-e", "provider", provider,
    "com.kloda.sync.test/com.kloda.sync.AndroidFilesQueueRecoveryInstrumentation"], stdout=subprocess.PIPE, text=True)
output = []
for line in process.stdout:
    output.append(line)
    sys.stdout.write(line)
    sys.stdout.flush()
process.wait(timeout=900)
result = "".join(output)
assert f"PASS cloud18-own-{provider}" in result and "INSTRUMENTATION_CODE: -1" in result, "instrumentation failed"
print(f"PASS android cloud18-{provider}")
