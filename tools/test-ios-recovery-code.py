#!/usr/bin/env python3
"""ADR0029 29/1 host check: production IosRecoveryCode.swift against the shared vectors; no device."""
from pathlib import Path
import subprocess
import tempfile

repo = Path(__file__).resolve().parent.parent
subprocess.run(["python3", "-I", str(repo / "tools/recovery-code-vectors.py")], check=True)
with tempfile.TemporaryDirectory(prefix="kloda-recovery-") as scratch:
    binary = Path(scratch) / "ios-recovery-checks"
    subprocess.run(["xcrun", "swiftc", "-parse-as-library", str(repo / "apps/mobile/modules/my-module/ios/IosRecoveryCode.swift"),
        str(repo / "packages/pairing-native/apple/tests/IosRecoveryChecks.swift"), "-o", str(binary)], check=True, cwd=repo)
    subprocess.run([str(binary)], check=True, timeout=20)
