#!/usr/bin/env python3
"""Owned Kloda-Cloud18-Disposable simulator + owned loopback Nextcloud fixture only; no Photos access (ADR0027)."""
from pathlib import Path
import argparse
import json
import plistlib
import subprocess
import sys
import time

parser = argparse.ArgumentParser()
parser.add_argument("simulator")
args = parser.parse_args()
repo = Path(__file__).resolve().parent.parent
IMAGE = "nextcloud@sha256:07ec73cc816e58d6f45a162cd53ef886462c29271a23fc68d0124cec276e3767"
BUNDLE = "com.kloda.fixture.cloud18"
listing = json.loads(subprocess.check_output(["xcrun", "simctl", "list", "devices", "available", "-j"]))
matched = [item for values in listing["devices"].values() for item in values if item["udid"] == args.simulator]
if len(matched) != 1 or matched[0]["name"] != "Kloda-Cloud18-Disposable":
    raise SystemExit("Only the explicitly owned Kloda-Cloud18-Disposable simulator is allowed")
container = json.loads(subprocess.check_output(["docker", "inspect", "kloda-step18-nextcloud"]))[0]
assert container["Config"]["Image"] == IMAGE and container["State"]["Running"]
assert container["HostConfig"]["PortBindings"]["443/tcp"] == [{"HostIp": "127.0.0.1", "HostPort": "18443"}]

root = Path("/tmp/kloda-step18/ios")
app = root / "NextcloudChecks.app"
app.mkdir(parents=True, exist_ok=True)
native = repo / "apps/mobile/modules/my-module/ios"
sources = [native / name for name in ["IosWebDavProfile.swift", "IosWebDavVault.swift", "IosWebDavClient.swift", "IosNextcloudLogin.swift"]]
sources.append(repo / "packages/pairing-native/apple/tests/IosNextcloudApp.swift")
sdk = subprocess.check_output(["xcrun", "--sdk", "iphonesimulator", "--show-sdk-path"], text=True).strip()
# Simulator Keychain needs an access group; only this owned fixture group is embedded (same method as step15).
entitlements, der = root / "Cloud18.entitlements", root / "Cloud18.der"
allowed = {"keychain-access-groups": [BUNDLE]}
entitlements.write_bytes(plistlib.dumps(allowed))
subprocess.run(["/usr/bin/derq", "query", "--raw", "-f", "xml", "-i", str(entitlements), "-o", str(der)], check=True)
linker = []
for section, path in [("__entitlements", entitlements), ("__ents_der", der)]:
    linker += ["-Xlinker", "-sectcreate", "-Xlinker", "__TEXT", "-Xlinker", section, "-Xlinker", str(path)]
subprocess.run(["xcrun", "--sdk", "iphonesimulator", "swiftc", "-swift-version", "5", "-sdk", sdk, "-target", "arm64-apple-ios16.4-simulator",
    *map(str, sources), *linker, "-framework", "UIKit", "-framework", "Security", "-o", str(app / "NextcloudChecks")], check=True)
(app / "Info.plist").write_bytes(plistlib.dumps({"CFBundleExecutable": "NextcloudChecks", "CFBundleIdentifier": BUNDLE,
    "CFBundleName": "Owned Nextcloud checks", "CFBundlePackageType": "APPL", "CFBundleVersion": "1", "CFBundleShortVersionString": "1",
    "MinimumOSVersion": "16.4", "UIDeviceFamily": [1], "UILaunchScreen": {}, "NSLocalNetworkUsageDescription": "Owned loopback fixture only."}))
subprocess.run(["codesign", "--force", "--sign", "-", "--identifier", BUNDLE, str(app)], check=True)

subprocess.run(["xcrun", "simctl", "bootstatus", args.simulator, "-b"], check=True, stdout=subprocess.DEVNULL)
subprocess.run(["xcrun", "simctl", "keychain", args.simulator, "add-root-cert", "/tmp/kloda-step15/https-fixture/ca.crt"], check=True)
subprocess.run(["xcrun", "simctl", "terminate", args.simulator, BUNDLE], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
subprocess.run(["xcrun", "simctl", "install", args.simulator, str(app)], check=True)
data = Path(subprocess.check_output(["xcrun", "simctl", "get_app_container", args.simulator, BUNDLE, "data"], text=True).strip()) / "Documents"
for name in ["nextcloud-result.json", "nextcloud-login.json"]:
    (data / name).unlink(missing_ok=True)
subprocess.run(["xcrun", "simctl", "launch", args.simulator, BUNDLE], check=True, stdout=subprocess.DEVNULL)

driver = repo / "tools/nextcloud-login-driver.py"
handled = set()
deadline = time.time() + 300
while time.time() < deadline:
    login = data / "nextcloud-login.json"
    if login.exists():
        line = json.loads(login.read_text())["line"]
        if line not in handled:
            handled.add(line)
            kind, url = line.split(" ", 1)
            subprocess.run([sys.executable, "-I", str(driver), url] + (["--deny"] if kind == "DENY" else []), check=True)
    result = data / "nextcloud-result.json"
    if result.exists():
        report = json.loads(result.read_text())
        if report.get("status") != "RUNNING":
            print(json.dumps(report))
            assert report["status"] == "PASS", "iOS checks failed"
            print("PASS ios cloud18-nextcloud")
            raise SystemExit(0)
    time.sleep(0.5)
raise SystemExit("iOS checks timed out")
