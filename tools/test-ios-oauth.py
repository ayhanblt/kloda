#!/usr/bin/env python3
"""Owned Kloda-Cloud18-Disposable simulator; the user signs in to their own account in the sheet (ADR0028, approved 2026-11-02)."""
from pathlib import Path
import argparse
import json
import plistlib
import subprocess
import time

parser = argparse.ArgumentParser()
parser.add_argument("simulator")
parser.add_argument("provider", choices=["dropbox", "onedrive", "yandex", "google-drive"])
parser.add_argument("--diagnose", action="store_true")
args = parser.parse_args()
repo = Path(__file__).resolve().parent.parent
BUNDLE = "com.kloda.fixture.oauth"
listing = json.loads(subprocess.check_output(["xcrun", "simctl", "list", "devices", "available", "-j"]))
matched = [item for values in listing["devices"].values() for item in values if item["udid"] == args.simulator]
if len(matched) != 1 or matched[0]["name"] != "Kloda-Cloud18-Disposable":
    raise SystemExit("Only the explicitly owned Kloda-Cloud18-Disposable simulator is allowed")

root = Path("/tmp/kloda-step18/ios-oauth")
app = root / "OAuthChecks.app"
app.mkdir(parents=True, exist_ok=True)
native = repo / "apps/mobile/modules/my-module/ios"
sources = [native / name for name in ["IosWebDavProfile.swift", "IosWebDavClient.swift", "IosOAuthVault.swift", "IosOAuthLogin.swift"]]
sources.append(repo / "packages/pairing-native/apple/tests/IosOAuthApp.swift")
sdk = subprocess.check_output(["xcrun", "--sdk", "iphonesimulator", "--show-sdk-path"], text=True).strip()
# Simulator Keychain needs an access group; only this owned fixture group is embedded (same method as step15).
entitlements, der = root / "OAuth.entitlements", root / "OAuth.der"
entitlements.write_bytes(plistlib.dumps({"keychain-access-groups": [BUNDLE]}))
subprocess.run(["/usr/bin/derq", "query", "--raw", "-f", "xml", "-i", str(entitlements), "-o", str(der)], check=True)
linker = []
for section, path in [("__entitlements", entitlements), ("__ents_der", der)]:
    linker += ["-Xlinker", "-sectcreate", "-Xlinker", "__TEXT", "-Xlinker", section, "-Xlinker", str(path)]
subprocess.run(["xcrun", "--sdk", "iphonesimulator", "swiftc", "-swift-version", "5", "-sdk", sdk, "-target", "arm64-apple-ios16.4-simulator",
    *map(str, sources), *linker, "-framework", "UIKit", "-framework", "Security", "-framework", "AuthenticationServices",
    "-o", str(app / "OAuthChecks")], check=True)
(app / "Info.plist").write_bytes(plistlib.dumps({"CFBundleExecutable": "OAuthChecks", "CFBundleIdentifier": BUNDLE,
    "CFBundleName": "Owned OAuth checks", "CFBundlePackageType": "APPL", "CFBundleVersion": "1", "CFBundleShortVersionString": "1",
    "MinimumOSVersion": "16.4", "UIDeviceFamily": [1], "UILaunchScreen": {}}))
subprocess.run(["codesign", "--force", "--sign", "-", "--identifier", BUNDLE, str(app)], check=True)

subprocess.run(["xcrun", "simctl", "bootstatus", args.simulator, "-b"], check=True, stdout=subprocess.DEVNULL)
subprocess.run(["xcrun", "simctl", "terminate", args.simulator, BUNDLE], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
subprocess.run(["xcrun", "simctl", "install", args.simulator, str(app)], check=True)
data = Path(subprocess.check_output(["xcrun", "simctl", "get_app_container", args.simulator, BUNDLE, "data"], text=True).strip()) / "Documents"
(data / "oauth-result.json").unlink(missing_ok=True)
subprocess.run(["xcrun", "simctl", "launch", args.simulator, BUNDLE, args.provider] + (["diagnose"] if args.diagnose else []), check=True, stdout=subprocess.DEVNULL)
print(f"Sign in to {args.provider} in the simulator sheet (10 minutes).", flush=True)

deadline = time.time() + 600
while time.time() < deadline:
    result = data / "oauth-result.json"
    if result.exists():
        report = json.loads(result.read_text())
        if report.get("status") != "RUNNING":
            print(json.dumps(report))
            if args.diagnose:
                raise SystemExit(0)
            assert report["status"] == "PASS" and report["provider"] == args.provider, "iOS OAuth checks failed"
            print(f"PASS ios cloud18-{args.provider}")
            raise SystemExit(0)
    time.sleep(1)
raise SystemExit("iOS OAuth checks timed out")
