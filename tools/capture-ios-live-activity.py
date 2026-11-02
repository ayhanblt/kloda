#!/usr/bin/env python3
"""Step19/20 scripted capture: render the production Live Activity lock card on an iOS Simulator.

Usage: python3 -I tools/capture-ios-live-activity.py <simulator UDID> <output dir>
Needs the prebuild output apps/mobile/ios/KlodaLiveActivity (theme, strings, icons, fonts from the config plugin).
Writes lock-card-<tr|en|de>-<dark|light|dark-xxxl|dark-ax2>.png: every phase, one sheet per language and variant.
"""
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

repo = Path(__file__).resolve().parent.parent
generated = repo / "apps/mobile/ios/KlodaLiveActivity"
targets = repo / "apps/mobile/targets/live-activity"
LANGUAGES = ["tr", "en", "de"]

if len(sys.argv) != 3:
    sys.exit(__doc__)
udid, output = sys.argv[1], Path(sys.argv[2]).resolve()
if not (generated / "KlodaLiveActivityTheme.swift").exists():
    sys.exit("missing prebuild output: run expo prebuild for apps/mobile first")
output.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix="kloda-live-activity-capture-") as scratch:
    bundle = Path(scratch)
    sources = [targets / name for name in ["KlodaLiveActivityViews.swift", "KlodaLiveActivityCopy.swift", "KlodaLiveActivityIntents.swift"]]
    sources += [repo / "apps/mobile/modules/my-module/ios/KlodaBackupAttributes.swift", generated / "KlodaLiveActivityTheme.swift",
        repo / "packages/pairing-native/apple/tests/IosLiveActivityCapture.swift"]
    subprocess.run(["xcrun", "-sdk", "iphonesimulator", "swiftc", "-swift-version", "5", "-parse-as-library",
        "-target", "arm64-apple-ios17.0-simulator", *map(str, sources), "-o", str(bundle / "capture")], check=True)
    subprocess.run(["xcrun", "actool", str(generated / "Assets.xcassets"), "--compile", str(bundle), "--platform", "iphonesimulator",
        "--minimum-deployment-target", "17.0", "--output-format", "human-readable-text"], check=True, stdout=subprocess.DEVNULL)
    for item in ["Inter-Regular.ttf", "Inter-SemiBold.ttf", *[f"{language}.lproj" for language in LANGUAGES]]:
        (shutil.copytree if (generated / item).is_dir() else shutil.copy)(generated / item, bundle / item)
    for language in LANGUAGES:
        subprocess.run(["xcrun", "simctl", "spawn", udid, str(bundle / "capture"), str(output), language,
            "-AppleLanguages", f"({language})", "-AppleLocale", language], check=True, timeout=120)
for image in sorted(output.glob("lock-card-*.png")):
    print(image.name, image.stat().st_size)
