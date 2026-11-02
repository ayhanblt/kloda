#!/usr/bin/env python3
"""Owned emulator-5590 (KlodaCloud18) + owned loopback Nextcloud fixture only; no media writes (ADR0027)."""
from pathlib import Path
import json
import os
import re
import subprocess
import sys

repo = Path(__file__).resolve().parent.parent
sdk = Path.home() / "Library/Android/sdk"
adb = [str(sdk / "platform-tools/adb"), "-s", "emulator-5590"]
IMAGE = "nextcloud@sha256:07ec73cc816e58d6f45a162cd53ef886462c29271a23fc68d0124cec276e3767"

def capture(args, **kwargs):
    return subprocess.check_output(args, text=True, **kwargs)

assert capture(adb + ["emu", "avd", "name"]).splitlines()[0].strip() == "KlodaCloud18"
assert capture(adb + ["shell", "getprop", "sys.boot_completed"]).strip() == "1"
container = json.loads(capture(["docker", "inspect", "kloda-step18-nextcloud"]))[0]
assert container["Config"]["Image"] == IMAGE and container["State"]["Running"]
assert container["HostConfig"]["PortBindings"]["443/tcp"] == [{"HostIp": "127.0.0.1", "HostPort": "18443"}]

subprocess.run(["./gradlew", ":my-module:assembleDebugAndroidTest", "--console=plain", "-q"],
    cwd=repo / "apps/mobile/android", env={**os.environ, "ANDROID_HOME": str(sdk), "ANDROID_SDK_ROOT": str(sdk)}, check=True)
outputs = repo / "apps/mobile/modules/my-module/android/build/outputs/apk/androidTest/debug"
metadata = json.loads((outputs / "output-metadata.json").read_text())
assert metadata["applicationId"] == "com.kloda.sync.test" and len(metadata["elements"]) == 1
apk = outputs / metadata["elements"][0]["outputFile"]
assert apk.parent == outputs and apk.is_file()
subprocess.run(adb + ["install", "-r", "-t", str(apk)], check=True, stdout=subprocess.DEVNULL)

driver = repo / "tools/nextcloud-login-driver.py"
process = subprocess.Popen(adb + ["shell", "am", "instrument", "-w", "-r", "-e", "scope", "cloud18-nextcloud",
    "com.kloda.sync.test/com.kloda.sync.AndroidFilesQueueRecoveryInstrumentation"], stdout=subprocess.PIPE, text=True)
output = []
for line in process.stdout:
    output.append(line)
    sys.stdout.write(line)
    match = re.search(r"stream=(GRANT|DENY) (https://10\.0\.2\.2:18443/login/v2/flow/\S+)", line)
    if match:
        subprocess.run([sys.executable, "-I", str(driver), match.group(2)] + (["--deny"] if match.group(1) == "DENY" else []), check=True)
process.wait(timeout=300)
result = "".join(output)
assert "PASS cloud18-owned-nextcloud" in result and "INSTRUMENTATION_CODE: -1" in result, "instrumentation failed"
print("PASS android cloud18-nextcloud")
