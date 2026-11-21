"""iOS fixture build and verification: disposable bundle identity, linked entitlements, provenance.

The fixture is built once into a fresh scratch root outside the repository from a mirror of
the product iOS project; its only Keychain group is its own bundle identifier. A run may use it
only while its recorded inputs, recipe, app tree and identity still match.
"""
import hashlib
import inspect
import json
import plistlib
import re
import shutil
import subprocess
import sys
import uuid
from pathlib import Path

from common import CaptureError, atomic_write_json, sha256_file

IOS = Path('apps/mobile/ios')
APP = 'KlodaSecurePhotosSync'
NATIVE_INPUTS = ['Podfile.lock', 'Pods/Manifest.lock', f'{APP}.xcodeproj/project.pbxproj',
                 'Pods/Pods.xcodeproj/project.pbxproj', f'{APP}/Info.plist', f'{APP}/{APP}.entitlements',
                 f'{APP}/AppDelegate.swift']
TREE_INPUTS = ['apps/mobile/modules', 'apps/mobile/package.json', 'apps/mobile/app.json',
               'tools/ui-capture/ios_fixture.rb']
BUNDLE_PREFIX = 'com.kloda.fixture.capture25.r'
# Local Rust xcframeworks ship only an arm64 simulator slice.
BUILD_SETTINGS = ['-configuration', 'Debug', '-sdk', 'iphonesimulator', '-destination',
                  'generic/platform=iOS Simulator', 'ARCHS=arm64', 'ONLY_ACTIVE_ARCH=YES', 'CODE_SIGNING_ALLOWED=NO']
PRODUCTS = Path('derived/Build/Products/Debug-iphonesimulator')
FIXTURE_KEYS = ('fixtureID', 'bundle', 'inputsSha256', 'appTreeSha256')


def _sh(argv, timeout=120):
    return subprocess.run(argv, capture_output=True, text=True, check=True, timeout=timeout).stdout.strip()


def _digest(data):
    return hashlib.sha256(data).hexdigest()


def _recipe():
    """Build identity: this whole build module (every helper and constant a build step can reach),
    minus only the read-only run-time check `verify_fixture`. Runtime ios.py/JS edits are outside."""
    source = inspect.getsource(sys.modules[__name__])
    return _digest(source.replace(inspect.getsource(verify_fixture), '').encode())


def input_hashes(repo):
    files = [IOS / name for name in NATIVE_INPUTS]
    for name in TREE_INPUTS:
        base = repo / name
        if not base.is_dir():
            files.append(Path(name))
            continue
        # Native module inputs only: files below an `ios/` directory of each local module.
        files += [p.relative_to(repo) for p in sorted(base.rglob('*'))
                  if p.is_file() and '/ios/' in f'/{p.relative_to(base)}']
    hashes = {str(p): sha256_file(repo / p) if (repo / p).is_file() else 'MISSING' for p in files}
    hashes['xcode'] = _sh(['xcodebuild', '-version']).replace('\n', ' ')
    hashes['recipe'] = _recipe()
    return hashes


def _link_all(source, target, keep):
    target.mkdir(parents=True)
    for entry in sorted(source.iterdir()):
        if entry.name not in keep:
            (target / entry.name).symlink_to(entry)


def _stage_mirror(repo, scratch):
    """Product-relative mirror: symlinks everywhere except copied, writable build inputs."""
    mirror, ios = scratch / 'mirror', repo / IOS
    _link_all(repo, mirror, {'apps'})
    _link_all(repo / 'apps', mirror / 'apps', {'mobile'})
    _link_all(repo / 'apps/mobile', mirror / 'apps/mobile', {'ios'})
    _link_all(ios, mirror / IOS, {f'{APP}.xcodeproj', f'{APP}.xcworkspace', 'Pods', 'build'})
    _link_all(ios / 'Pods', mirror / IOS / 'Pods', {'Pods.xcodeproj', 'Target Support Files'})
    for name in (f'{APP}.xcodeproj', f'{APP}.xcworkspace', 'build', 'Pods/Pods.xcodeproj',
                 'Pods/Target Support Files'):
        shutil.copytree(ios / name, mirror / IOS / name, symlinks=True)
    return mirror / IOS


def _entitlements(root, bundle):
    allowed = {'keychain-access-groups': [bundle]}
    xml, der = root / 'Fixture.entitlements', root / 'Fixture.der'
    xml.write_bytes(plistlib.dumps(allowed))
    _sh(['/usr/bin/derq', 'query', '--raw', '-f', 'xml', '-i', str(xml), '-o', str(der)])
    if plistlib.loads(_sh(['/usr/bin/derq', 'query', '-i', str(der), '--xml']).encode()) != allowed:
        raise CaptureError('DER entitlement round-trip mismatch')
    return allowed, xml, der


def _readback(app, bundle, xml, der, fixture_hash):
    info = plistlib.loads((app / 'Info.plist').read_bytes())
    exe = app / info['CFBundleExecutable']
    checks = {'bundle': info.get('CFBundleIdentifier') == bundle,
              'platform': info.get('DTPlatformName') == 'iphonesimulator',
              'provenance': info.get('KLODAFixtureSourceHash') == fixture_hash,
              'noDebugDylib': not (app / f'{exe.name}.debug.dylib').exists(),
              'noExtension': not (app / 'PlugIns' / 'KlodaLiveActivity.appex').exists()}
    for section, expected in (('__entitlements', xml), ('__ents_der', der)):
        out = xml.parent / f'readback{section}'
        out.unlink(missing_ok=True)
        subprocess.run(['segedit', str(exe), '-extract', '__TEXT', section, str(out)], capture_output=True, timeout=60)
        checks[section] = out.is_file() and out.read_bytes() == expected.read_bytes()
    checks['simulatorBuild'] = 'IOSSIMULATOR' in _sh(['vtool', '-show-build', str(exe)])
    return checks


def _sign(app, bundle):
    nested = sorted(p for p in app.rglob('*') if p.suffix in ('.framework', '.dylib'))
    for item in reversed(nested):
        _sh(['codesign', '--force', '--sign', '-', str(item)])
    _sh(['codesign', '--force', '--sign', '-', '--identifier', bundle, str(app)])


def _build(mirror_ios, scratch, log_path):
    with open(log_path, 'w') as log:
        return subprocess.run(['xcodebuild', '-workspace', str(mirror_ios / f'{APP}.xcworkspace'), '-scheme', APP,
                               *BUILD_SETTINGS, '-derivedDataPath', str(scratch / 'derived'), 'build'],
                              stdout=log, stderr=subprocess.STDOUT, timeout=3600).returncode


def _tree_hash(app):
    files = sorted(p for p in app.rglob('*') if p.is_file() and not p.is_symlink())
    return _digest('\n'.join(f'{p.relative_to(app)} {sha256_file(p)}' for p in files).encode())


def prepare(repo, out, scratch_base):
    """Build the fixture once into a fresh scratch root; record identity, inputs and readback."""
    out.mkdir(parents=True)
    fixture_id = uuid.uuid4().hex
    bundle = f'{BUNDLE_PREFIX}{fixture_id}'
    scratch = (scratch_base / fixture_id).resolve()
    scratch.mkdir(parents=True)
    inputs = input_hashes(repo)
    fixture_hash = _digest(json.dumps(inputs, sort_keys=True).encode())
    record = {'fixtureID': fixture_id, 'bundle': bundle, 'scratch': str(scratch), 'inputs': inputs,
              'inputsSha256': fixture_hash, 'status': 'STAGING'}
    atomic_write_json(out / 'fixture.json', record)
    mirror_ios = _stage_mirror(repo, scratch)
    allowed, xml, der = _entitlements(scratch, bundle)
    info = plistlib.loads((repo / IOS / APP / 'Info.plist').read_bytes())
    info.update(CFBundleDisplayName='Kloda Capture25', KLODAFixtureSourceHash=fixture_hash, KLODAFixtureID=fixture_id)
    plist = scratch / 'Fixture-Info.plist'
    plist.write_bytes(plistlib.dumps(info))
    staged = _sh(['ruby', str(repo / 'tools/ui-capture/ios_fixture.rb'), 'stage_project',
                  str(mirror_ios / f'{APP}.xcodeproj'), bundle, str(plist), str(xml), str(der)])
    record.update(staged=json.loads(staged), entitlements=allowed, status='BUILDING')
    atomic_write_json(out / 'fixture.json', record)
    record['xcodebuildExit'] = code = _build(mirror_ios, scratch, out / 'xcodebuild.log')
    if code != 0:
        record['status'] = 'BUILD_FAILED'
        atomic_write_json(out / 'fixture.json', record)
        raise CaptureError(f'xcodebuild exit {code}; see xcodebuild.log')
    app = scratch / PRODUCTS / f'{APP}.app'
    _sign(app, bundle)
    checks = _readback(app, bundle, xml, der, fixture_hash)
    if input_hashes(repo) != inputs:
        checks['inputsStable'] = False
    record.update(app=str(app), appTreeSha256=_tree_hash(app), readback=checks,
                  status='READY' if all(checks.values()) else 'READBACK_FAILED')
    atomic_write_json(out / 'fixture.json', record)
    if record['status'] != 'READY':
        raise CaptureError(f'fixture readback failed: {checks}')
    return record


def verify_fixture(repo, fixture_path):
    """A run may only use a READY fixture bound to its own ID, unchanged inputs and app tree."""
    try:
        record = json.loads(Path(fixture_path).read_text())
    except (OSError, ValueError):
        return None, 'fixture record unreadable'
    fid = str(record.get('fixtureID', ''))
    if record.get('status') != 'READY':
        return None, f'fixture status {record.get("status")}'
    if not re.fullmatch(r'[0-9a-f]{32}', fid) or record.get('bundle') != BUNDLE_PREFIX + fid:
        return None, 'fixture identity mismatch'
    if not record.get('readback') or not all(record['readback'].values()):
        return None, 'fixture readback incomplete'
    scratch, app = Path(record.get('scratch', '')), Path(record.get('app', ''))
    if scratch.name != fid or app != scratch / PRODUCTS / f'{APP}.app':
        return None, 'fixture app is not bound to its scratch identity'
    if input_hashes(repo) != record.get('inputs'):
        return None, 'fixture inputs changed; prepare-ios required (run never builds)'
    if not app.is_dir() or _tree_hash(app) != record.get('appTreeSha256'):
        return None, 'fixture app missing or changed'
    info = plistlib.loads((app / 'Info.plist').read_bytes())
    if (info.get('CFBundleIdentifier'), info.get('KLODAFixtureID'), info.get('KLODAFixtureSourceHash')) != \
            (record['bundle'], fid, record.get('inputsSha256')):
        return None, 'fixture app identity mismatch'
    return record, None
