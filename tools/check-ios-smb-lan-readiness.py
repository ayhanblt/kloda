#!/usr/bin/env python3
"""Metadata-only production iOS route probe for owned fixture topology. No sockets/media/auth/network edits."""
from pathlib import Path
import argparse
import hashlib
import ipaddress
import json
import os
import subprocess
import tempfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('simulator')
parser.add_argument('--owned-peer', type=ipaddress.ip_address, help='Explicit owned test endpoint; metadata only')
args = parser.parse_args()
repo = Path(__file__).resolve().parent.parent
root = Path(tempfile.mkdtemp(prefix='kloda-smb-lan-readiness-'))
print('Evidence: ' + str(root), flush=True)
ledger = json.loads(Path('/tmp/kloda-smb16-preflight/owned-containers.json').read_text())
strict, = [c for c in ledger['containers'] if c['mode'] == 'strict']
container, = json.loads(subprocess.check_output(['docker', 'inspect', strict['id']], text=True))
assert container['Config']['Labels'].get('kloda.fixture') == 'smb16' and not container.get('Mounts')
assert container['HostConfig']['PortBindings']['445/tcp'] == [{'HostIp': '127.0.0.1', 'HostPort': str(strict['port'])}]
network_name, = container['NetworkSettings']['Networks']
network, = json.loads(subprocess.check_output(['docker', 'network', 'inspect', network_name], text=True))
gateway = ipaddress.ip_address(network['IPAM']['Config'][0]['Gateway'])
subnet = ipaddress.ip_network(network['IPAM']['Config'][0]['Subnet'])
assert gateway in subnet and gateway.is_private
cases = [{'kind': 'published-loopback', 'peer': '127.0.0.1', 'livePeerClaim': False},
         {'kind': 'docker-vm-network-gateway-metadata', 'peer': str(gateway), 'livePeerClaim': False}]
private_peer = container['NetworkSettings']['Networks'][network_name].get('IPAddress')
if private_peer:
    address = ipaddress.ip_address(private_peer)
    assert address in subnet and address != gateway
    cases.append({'kind': 'owned-container-private-address', 'peer': str(address), 'livePeerClaim': False})
if args.owned_peer:
    assert args.owned_peer.is_private and not args.owned_peer.is_loopback
    cases.append({'kind': 'explicit-owned-lan-peer', 'peer': str(args.owned_peer), 'livePeerClaim': False})
topology = {'container': strict['id'], 'running': container['State']['Running'], 'hostMounts': False,
    'publishedEndpoint': '127.0.0.1:' + str(strict['port']), 'network': network['Id'], 'subnet': str(subnet),
    'note': 'Gateway is a routing metadata target, not an asserted SMB endpoint; no connection is attempted.'}
(root / 'owned-topology.json').write_text(json.dumps(topology, indent=2) + '\n')
listing = json.loads(subprocess.check_output(['xcrun', 'simctl', 'list', 'devices', 'available', '-j']))
device, = [d for values in listing['devices'].values() for d in values if d['udid'] == args.simulator]
assert args.simulator == '497AAA0F-967E-4781-9468-3F05CA2D3D5A' and device['name'] == 'Kloda-WebDAV15-Disposable'
source_root = repo / 'packages/pairing-native/src'
fixture = repo / 'packages/pairing-native/apple/tests/IosLanReadinessMain.rs'
shim = repo / 'packages/pairing-native/apple/IosRouteWitness.m'
inputs = [Path(__file__).resolve(), fixture, shim, *[source_root / n for n in ['route_address.rs', 'route_ios.rs', 'route_ios_if.rs', 'route_ios_query.rs']]]
hashes = {str(p.relative_to(repo)): hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs}
crate = root / 'crate'; (crate / 'src').mkdir(parents=True)
(crate / 'Cargo.toml').write_text('''[package]
name = "kloda_ios_lan_readiness"
version = "0.1.0"
edition = "2024"
publish = false
[dependencies]
socket2 = { version = "=0.6.1", features = ["all"] }
libc = "=0.2.177"
''')
source = fixture.read_text().replace('"__ADDRESS_PATH__"', json.dumps(str(source_root / 'route_address.rs'))).replace('"__IOS_PATH__"', json.dumps(str(source_root / 'route_ios.rs')))
assert '__ADDRESS_PATH__' not in source and '__IOS_PATH__' not in source
(crate / 'src/main.rs').write_text(source)
def run(name, command, **kwargs):
    with (root / (name + '.log')).open('w') as log:
        subprocess.run(list(map(str, command)), cwd=repo, check=True, stdout=log, stderr=subprocess.STDOUT, **kwargs)
    print('PASS ' + name, flush=True)
run('lock', ['rustup', 'run', '1.99.0', 'cargo', 'generate-lockfile', '--offline', '--manifest-path', crate / 'Cargo.toml'])
run('host-route-tests', ['rustup', 'run', '1.99.0', 'cargo', 'test', '--locked', '--offline', '--manifest-path', crate / 'Cargo.toml', '--target-dir', root / 'host-target'])
sdk = subprocess.check_output(['xcrun', '--sdk', 'iphonesimulator', '--show-sdk-path'], text=True).strip()
run('native-witness-build', ['xcrun', '--sdk', 'iphonesimulator', 'clang', '-target', 'arm64-apple-ios16.4-simulator', '-isysroot', sdk,
    '-fobjc-arc', '-fblocks', '-Wall', '-Wextra', '-Werror', '-c', shim, '-o', root / 'witness.o'])
env = {**os.environ, 'IPHONEOS_DEPLOYMENT_TARGET': '16.4',
    'RUSTC': subprocess.check_output(['rustup', 'which', '--toolchain', '1.99.0', 'rustc'], text=True).strip(),
    'RUSTFLAGS': '-C link-arg=' + str(root / 'witness.o') + ' -C link-arg=-framework -C link-arg=Foundation -C link-arg=-framework -C link-arg=Network'}
run('simulator-build', ['rustup', 'run', '1.99.0', 'cargo', 'build', '--locked', '--offline', '--manifest-path', crate / 'Cargo.toml',
    '--target', 'aarch64-apple-ios-sim', '--target-dir', root / 'target'], env=env)
binary = root / 'target/aarch64-apple-ios-sim/debug/kloda_ios_lan_readiness'
run('simulator-sign', ['codesign', '--force', '--sign', '-', binary])
assert all(hashlib.sha256(p.read_bytes()).hexdigest() == hashes[str(p.relative_to(repo))] for p in inputs)
booted_here = device['state'] == 'Shutdown'; results = []
try:
    if booted_here: run('boot', ['xcrun', 'simctl', 'boot', args.simulator])
    run('boot-ready', ['xcrun', 'simctl', 'bootstatus', args.simulator, '-b'])
    for case in cases:
        run(case['kind'], ['xcrun', 'simctl', 'spawn', args.simulator, binary, case['peer']], timeout=20)
        lines = (root / (case['kind'] + '.log')).read_text().splitlines()
        report, = [json.loads(line) for line in lines if line.startswith('{')]
        assert report['socketOpened'] is False and report['credentialsReleased'] is False
        results.append({**case, **report})
finally:
    if booted_here: run('shutdown', ['xcrun', 'simctl', 'shutdown', args.simulator])
(root / 'result.json').write_text(json.dumps({'sourceSha256': hashes, 'topology': topology, 'cases': results,
    'scope': 'Production route metadata only; no SMB socket/auth, Files/Photos, OS job, network/alias/interface configuration or physical acceptance.',
    'nativeBinarySha256': hashlib.sha256(binary.read_bytes()).hexdigest()}, indent=2) + '\n')
print('READINESS route results: ' + ', '.join(c['kind'] + '=' + str(c['routeOpened']) for c in results), flush=True)
print('NOT_ACCEPTANCE no live peer/SMB transfer or route change; owned Docker state unchanged', flush=True)
