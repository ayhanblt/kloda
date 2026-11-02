#!/usr/bin/env python3
"""Step19 host check: Live Activity state mapping (production Swift) against the home-status rules; no device."""
from pathlib import Path
import subprocess
import tempfile

repo = Path(__file__).resolve().parent.parent
native = repo / "apps/mobile/modules/my-module/ios"
with tempfile.TemporaryDirectory(prefix="kloda-live-activity-") as scratch:
    binary = Path(scratch) / "live-activity-checks"
    for version in ["5", "6"]:
        subprocess.run(["xcrun", "swiftc", "-swift-version", version, str(native / "KlodaBackupAttributes.swift"),
            str(native / "IosLiveActivityStatus.swift"),
            str(repo / "packages/pairing-native/apple/tests/IosLiveActivityStatusChecks.swift"), "-o", str(binary)], check=True)
        subprocess.run([str(binary)], check=True, timeout=20)
