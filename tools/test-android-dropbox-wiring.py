#!/usr/bin/env python3
"""Owned emulator-5590 (KlodaCloud18) only: 18B/5 Dropbox adapter wiring without network (no account, no fixture).

The test package's data is cleared first; no product app data is touched.
"""
from pathlib import Path
import json
import os
import subprocess

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
subprocess.run(adb + ["shell", "pm", "clear", "com.kloda.sync.test"], check=True, stdout=subprocess.DEVNULL)
result = capture(adb + ["shell", "am", "instrument", "-w", "-r", "-e", "scope", "cloud18-dropbox",
    "com.kloda.sync.test/com.kloda.sync.AndroidFilesQueueRecoveryInstrumentation"], timeout=600)
print(result)
assert "PASS dropbox forget disables and drops plan" in result and "INSTRUMENTATION_CODE: -1" in result, "cloud18-dropbox failed"
print("PASS android cloud18-dropbox")
