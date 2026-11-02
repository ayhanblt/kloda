#!/usr/bin/env python3
"""Build-only isolated Windows SFTP fixture. Photos is disabled until exact approval."""
from pathlib import Path
import argparse
import hashlib
import json
import plistlib
import subprocess
import tempfile
import uuid

parser = argparse.ArgumentParser()
parser.add_argument('kind', choices=['files','photos'])
args = parser.parse_args()
repo = Path(__file__).resolve().parent.parent
native = repo/'apps/mobile/modules/my-module/ios'
root = Path(tempfile.mkdtemp(prefix='kloda-windows-sftp16b-'+args.kind+'-'))
print('Evidence: '+str(root), flush=True)
nonce = str(uuid.uuid4())
kind = args.kind.title()
bundle = 'com.kloda.fixture.sftp16.windows'+('photos' if args.kind=='photos' else '')+'.r'+uuid.uuid4().hex
executable = 'SftpWindows'+kind
app = root/(executable+'.app'); app.mkdir()
source = repo/f'packages/sftp-native/apple/tests/IosSftpWindows{kind}App.swift'
sources = sorted(p for p in native.glob('*.swift') if 'import ExpoModulesCore' not in p.read_text())+sorted((native/'NativePairing').glob('*.swift'))
libraries = [native/'NativePairing/KlodaPairingNative.xcframework/ios-arm64-simulator/libkloda_pairing_native.a',native/'NativeSftp/KlodaSftpNative.xcframework/ios-arm64-simulator/libkloda_sftp_native.a']
bridge = native/'NativePairing/KlodaPairingNative.h'
rights = root/'Fixture.entitlements'; der = root/'Fixture.der'
rights.write_bytes(plistlib.dumps({'keychain-access-groups':[bundle]}))
subprocess.run(['derq','query','--raw','-f','xml','-i',str(rights),'-o',str(der)],check=True,capture_output=True)
assert plistlib.loads(subprocess.check_output(['derq','query','-i',str(der),'--xml']))=={'keychain-access-groups':[bundle]}
linker = []
for section,path in [('__entitlements',rights),('__ents_der',der)]:
    linker += ['-Xlinker','-sectcreate','-Xlinker','__TEXT','-Xlinker',section,'-Xlinker',str(path)]
hashes = {str(p.relative_to(repo)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [*sources,source,bridge,*libraries]}
(root/'ownership.json').write_text(json.dumps({'bundle':bundle,'nonce':nonce,'address':'192.168.1.54','port':2222,'fingerprint':'SHA256:JO6gTt4ojeX0s5ivDmtoHrvZ+0DLuXAeKcW2+ZNTmzQ','remoteRoot':'/upload','simulator':'497AAA0F-967E-4781-9468-3F05CA2D3D5A','inputs':hashes,'kind':args.kind,'scope':'Build-only; Files uses owned4097-byte picker source/restore. Photos requires exact separate approval, flag=false. Native source/profile/route owners; no fabricated Completed or remote deletion.'},indent=2)+'\n')
sdk = subprocess.check_output(['xcrun','--sdk','iphonesimulator','--show-sdk-path'],text=True).strip()
with (root/'build.log').open('w') as log:
    subprocess.run(['xcrun','--sdk','iphonesimulator','swiftc','-swift-version','5','-sdk',sdk,'-target','arm64-apple-ios16.4-simulator','-D','KLODA_SFTP_NATIVE','-module-cache-path',str(root/'cache'),*map(str,sources),str(source),'-import-objc-header',str(bridge),*map(str,libraries),*linker,'-framework','UIKit','-framework','Security','-framework','Network','-framework','SystemConfiguration','-framework','BackgroundTasks','-lsqlite3','-o',str(app/executable)],check=True,stdout=log,stderr=subprocess.STDOUT)
assert all(hashlib.sha256((repo/p).read_bytes()).hexdigest()==value for p,value in hashes.items())
info = {'CFBundleExecutable':executable,'CFBundleIdentifier':bundle,'CFBundleDisplayName':'Owned SFTP Windows16b','CFBundleName':'Owned SFTP Windows16b','CFBundlePackageType':'APPL','CFBundleVersion':'1','CFBundleShortVersionString':'1','MinimumOSVersion':'16.4','UIDeviceFamily':[1],'UILaunchScreen':{},'UIFileSharingEnabled':True,'LSSupportsOpeningDocumentsInPlace':True,'FixtureNonce':nonce,'NSLocalNetworkUsageDescription':'Only the owned Windows SFTP test server 192.168.1.54:2222.','BGTaskSchedulerPermittedIdentifiers':json.loads((repo/'apps/mobile/app.json').read_text())['expo']['ios']['infoPlist']['BGTaskSchedulerPermittedIdentifiers']}
if args.kind=='photos':
    info.update(FixtureMediaEnabled=False,NSPhotoLibraryUsageDescription='Separately approved owned PNG source and restore in this disposable Simulator only.')
(app/'Info.plist').write_bytes(plistlib.dumps(info))
subprocess.run(['codesign','--force','--sign','-','--identifier',bundle,str(app)],check=True,capture_output=True)
print('PASS build/sign '+args.kind+'; NOT_RUN; Photos flag=false',flush=True)
