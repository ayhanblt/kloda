#!/usr/bin/env python3
"""Step20 scripted capture: Connections screen on owned emulator-5590 (KlodaCloud18), driven through the app's own settings.

Usage: python3 -I tools/capture-android-connections.py <output dir>
Needs com.kloda.app running with Metro (welcome or any tab) and at least one destination added. Language and theme
come from the app's Settings rows (system locale/simctl arguments do not apply), so the rows are tapped by position.
Writes connections-<tr|en|de>-<dark|light>-<top|bottom>.png and connections-tr-dark-font130-<top|bottom>.png, plus a
uiautomator dump per screen for label/a11y checks. Ends in Turkish, dark theme, font scale restored to 1.0.
"""
from pathlib import Path
import re
import subprocess
import sys
import time

sdk = Path.home() / "Library/Android/sdk"
adb = [str(sdk / "platform-tools/adb"), "-s", "emulator-5590"]
# Settings rows and tab bar centres on the 1080x1920 KlodaCloud18 screen.
THEME = {"dark": (540, 795), "light": (540, 955)}
LANGUAGE = {"tr": (540, 1210), "en": (540, 1370), "de": (540, 1530)}
CONNECTIONS_TAB, SETTINGS_TAB = (670, 1762), (930, 1762)

def run(*args):
    subprocess.run(adb + ["shell", *map(str, args)], check=True)

def tap(point, wait=2.0):
    run("input", "tap", *point)
    time.sleep(wait)

def save(name):
    (output / f"{name}.png").write_bytes(subprocess.check_output(adb + ["exec-out", "screencap", "-p"]))
    run("uiautomator", "dump", "/sdcard/kloda-capture.xml")
    (output / f"{name}.xml").write_bytes(subprocess.check_output(adb + ["exec-out", "cat", "/sdcard/kloda-capture.xml"]))

def skip_welcome(attempts=10):
    # A font-scale change recreates the activity; the app reloads its bundle and reopens on the welcome screen.
    for _ in range(attempts):
        run("input", "swipe", 540, 1500, 540, 300, 300)
        time.sleep(1)
        run("uiautomator", "dump", "/sdcard/kloda-capture.xml")
        xml = subprocess.check_output(adb + ["exec-out", "cat", "/sdcard/kloda-capture.xml"], text=True)
        match = re.search(r'content-desc="Şimdilik atla"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml)
        if match:
            x1, y1, x2, y2 = map(int, match.groups())
            tap(((x1 + x2) // 2, (y1 + y2) // 2), 3)
            return
        time.sleep(2)
    if attempts > 1:
        sys.exit("welcome screen did not appear after the font-scale change")

def connections(name):
    tap(CONNECTIONS_TAB, 3)
    run("input", "swipe", 540, 600, 540, 1500, 300)
    time.sleep(1)
    save(f"{name}-top")
    run("input", "swipe", 540, 1500, 540, 300, 400)
    time.sleep(1)
    save(f"{name}-bottom")
    tap(SETTINGS_TAB)

if len(sys.argv) != 2:
    sys.exit(__doc__)
output = Path(sys.argv[1]).resolve()
output.mkdir(parents=True, exist_ok=True)
assert subprocess.check_output(adb + ["emu", "avd", "name"], text=True).splitlines()[0].strip() == "KlodaCloud18"
skip_welcome(attempts=1)
tap(SETTINGS_TAB)
try:
    for language in ["en", "de", "tr"]:
        tap(LANGUAGE[language])
        for theme in ["dark", "light"]:
            tap(THEME[theme])
            connections(f"connections-{language}-{theme}")
    tap(THEME["dark"])
    run("settings", "put", "system", "font_scale", "1.3")
    time.sleep(4)
    skip_welcome()
    connections("connections-tr-dark-font130")
finally:
    run("settings", "put", "system", "font_scale", "1.0")
    time.sleep(4)
    skip_welcome()
for image in sorted(output.glob("connections-*.png")):
    print(image.name, image.stat().st_size)
