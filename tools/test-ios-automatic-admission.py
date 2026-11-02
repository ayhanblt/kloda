#!/usr/bin/env python3
"""Execute actual coordinator begin() bodies with deterministic host scheduling doubles; no media/network."""
from pathlib import Path
import hashlib
import json
import subprocess
import tempfile
repo = Path(__file__).resolve().parent.parent
native = repo / 'apps/mobile/modules/my-module/ios'
harness = repo / 'packages/storage-native/apple/tests/IosAutomaticAdmissionChecks.swift'
root = Path(tempfile.mkdtemp(prefix='kloda-ios-admission-'))
print('Evidence: ' + str(root), flush=True)
inputs = [harness, Path(__file__).resolve()]
for protocol in ['WebDav', 'Smb', 'Sftp']:
    source = native / ('Ios' + protocol + 'AutomaticCoordinator.swift'); inputs.append(source)
    text = source.read_text(); begin = text[text.index('  private func begin('):text.index('  private func future(')]
    # Normalize names only; execute the production branch/ordering/catch logic without UIKit or OS side effects.
    begin = begin.replace('IosWebDavContext', 'FixtureContext').replace('Ios' + protocol, 'Fixture')
    begin = begin.replace('FixtureFailure(code: ', 'FixtureFailure.code(')
    for control in [True, False]:
        body = begin
        if control:
            old = '    do { try FixtureContext.synchronized {\n'; close = '    } } catch {\n'
            assert body.count(old) == 1 and body.count(close) == 1
            body = body.replace(old, '    do {\n', 1).replace(close, '    } catch {\n', 1)
        code = harness.read_text().replace('  // ACTUAL_BEGIN', body)
        name = protocol + ('-control' if control else '-fixed')
        swift = root / (name + '.swift'); swift.write_text(code)
        binary = root / name
        with (root / (name + '-build.log')).open('w') as log:
            subprocess.run(['xcrun', 'swiftc', '-swift-version', '5', '-parse-as-library', str(swift), '-o', str(binary)], check=True, stdout=log, stderr=subprocess.STDOUT)
        with (root / (name + '-run.log')).open('w') as log:
            subprocess.run([str(binary)] + (['unprotected-control'] if control else []), check=True, timeout=20, stdout=log, stderr=subprocess.STDOUT)
        print('PASS ' + name, flush=True)
(root / 'inputs.json').write_text(json.dumps({str(p.relative_to(repo)): hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs}, indent=2) + '\n')
print('PASS source-derived host regression; doubles are not a real Simulator/network/OS delivery test', flush=True)
