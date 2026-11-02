#!/usr/bin/env python3
"""Owned Simulator importer component; --photos-owned-fixture --run needs exact D7 permission."""
from pathlib import Path
import argparse
import hashlib
import json
import plistlib
import subprocess
import tempfile
import time
import uuid

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('simulator')
parser.add_argument('--run', action='store_true')
parser.add_argument('--photos-owned-fixture', action='store_true', help='Enable media mode; execution requires separate exact D7 approval')
args = parser.parse_args()
repo = Path(__file__).resolve().parent.parent
listing = json.loads(subprocess.check_output(['xcrun', 'simctl', 'list', 'devices', 'available', '-j']))
device, = [d for values in listing['devices'].values() for d in values if d['udid'] == args.simulator]
assert args.simulator == '497AAA0F-967E-4781-9468-3F05CA2D3D5A' and device['name'] == 'Kloda-WebDAV15-Disposable'
root = Path(tempfile.mkdtemp(prefix='kloda-smb-import16a-'))
native = repo / 'apps/mobile/modules/my-module/ios'
sources = sorted(p for p in native.glob('*.swift') if 'import ExpoModulesCore' not in p.read_text())
sources += sorted((native / 'NativePairing').glob('*.swift'))
fixture = repo / 'packages/storage-native/apple/tests/IosSmbPhotoImportApp.swift'
bridge = native / 'NativePairing/KlodaPairingNative.h'
libraries = [native / 'NativePairing/KlodaPairingNative.xcframework/ios-arm64-simulator/libkloda_pairing_native.a',
             native / 'NativeStorage/KlodaStorageNative.xcframework/ios-arm64-simulator/libkloda_storage_native.a']
inputs = sources + [fixture, bridge, *libraries, Path(__file__).resolve()]
hashes = {str(p.relative_to(repo)): hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs}
source_hash = hashlib.sha256(json.dumps({'inputs': hashes, 'media': args.photos_owned_fixture}, sort_keys=True).encode()).hexdigest()
bundle = 'com.kloda.fixture.smb16.import.r' + uuid.uuid4().hex
app = root / 'SmbImport.app'; app.mkdir()
(root / 'ownership.json').write_text(json.dumps({'bundle': bundle, 'simulator': args.simulator, 'sourceHash': source_hash,
    'photosEnabled': args.photos_owned_fixture, 'inputs': hashes}, indent=2) + '\n')
print('Evidence: ' + str(root), flush=True)
sdk = subprocess.check_output(['xcrun', '--sdk', 'iphonesimulator', '--show-sdk-path'], text=True).strip()
with (root / 'build.log').open('w') as log:
    subprocess.run(['xcrun', '--sdk', 'iphonesimulator', 'swiftc', '-swift-version', '5', '-sdk', sdk,
        '-module-cache-path', str(root / 'cache'), '-target', 'arm64-apple-ios16.4-simulator', '-D', 'KLODA_SMB_NATIVE',
        *map(str, sources), str(fixture), '-import-objc-header', str(bridge), *map(str, libraries),
        '-framework', 'UIKit', '-framework', 'Security', '-framework', 'Network', '-framework', 'SystemConfiguration',
        '-framework', 'BackgroundTasks', '-lsqlite3', '-o', str(app / 'SmbImport')], check=True, stdout=log, stderr=subprocess.STDOUT)
assert all(hashlib.sha256(p.read_bytes()).hexdigest() == hashes[str(p.relative_to(repo))] for p in inputs), 'Inputs changed during build'
(app / 'Info.plist').write_bytes(plistlib.dumps({'CFBundleExecutable': 'SmbImport', 'CFBundleIdentifier': bundle,
    'CFBundleName': 'Owned SMB import component', 'CFBundlePackageType': 'APPL', 'CFBundleVersion': '1',
    'CFBundleShortVersionString': '1', 'MinimumOSVersion': '16.4', 'UIDeviceFamily': [1], 'UILaunchScreen': {},
    'KLODAFixtureSourceHash': source_hash, 'KLODAFixtureMediaEnabled': args.photos_owned_fixture,
    'NSPhotoLibraryUsageDescription': 'Only an explicitly approved new owned SMB importer PNG in this disposable Simulator.'}))
subprocess.run(['codesign', '--force', '--sign', '-', '--identifier', bundle, str(app)], check=True, capture_output=True)
print('PASS build/sign; component only, no LAN/upload/BG/product UI acceptance', flush=True)
if not args.run:
    print('NOT_RUN execution; Photos permission not inferred from building', flush=True)
    raise SystemExit(0)
booted_here = device['state'] == 'Shutdown'
media_granted = False
try:
    if booted_here: subprocess.run(['xcrun', 'simctl', 'boot', args.simulator], check=True, capture_output=True)
    subprocess.run(['xcrun', 'simctl', 'bootstatus', args.simulator, '-b'], check=True, capture_output=True)
    subprocess.run(['xcrun', 'simctl', 'install', args.simulator, str(app)], check=True, capture_output=True)
    container = Path(subprocess.check_output(['xcrun', 'simctl', 'get_app_container', args.simulator, bundle, 'data'], text=True).strip())
    if args.photos_owned_fixture:
        subprocess.run(['xcrun', 'simctl', 'privacy', args.simulator, 'grant', 'photos', bundle], check=True, capture_output=True)
        media_granted = True
    for mode in (['seed', 'reopen', 'cleanup'] if args.photos_owned_fixture else ['local']):
        subprocess.run(['xcrun', 'simctl', 'launch', args.simulator, bundle, mode], check=True, capture_output=True)
        result_file = container / 'Documents' / (mode + '-result.json')
        deadline = time.monotonic() + 60
        while not result_file.exists() and time.monotonic() < deadline: time.sleep(.2)
        result = json.loads(result_file.read_text())
        (root / (mode + '-result.json')).write_text(json.dumps(result, sort_keys=True) + '\n')
        assert result == {'mode': mode, 'sourceHash': source_hash, 'status': 'PASS'}, result
        print('PASS ' + mode, flush=True)
        subprocess.run(['xcrun', 'simctl', 'terminate', args.simulator, bundle], check=True, capture_output=True)
finally:
    subprocess.run(['xcrun', 'simctl', 'terminate', args.simulator, bundle], capture_output=True)
    try:
        if media_granted: subprocess.run(['xcrun', 'simctl', 'privacy', args.simulator, 'reset', 'photos', bundle], check=True, capture_output=True)
    finally:
        if booted_here: subprocess.run(['xcrun', 'simctl', 'shutdown', args.simulator], check=True, capture_output=True)
print('PASS scoped component; actual admitted LAN/bookmark/OS BG/signing/independent/physical gates remain open', flush=True)
