#!/usr/bin/env python3
"""Disposable emulator-5584 only; actual bound JNI, Keystore, SAF source/download/restore; Photos mode requires exact separate approval."""
from pathlib import Path
import argparse
import hashlib
import json
import os
import shutil
import socket
import subprocess
import time

parser=argparse.ArgumentParser(); modes=parser.add_mutually_exclusive_group(); modes.add_argument('--sources-only',action='store_true'); modes.add_argument('--product-only',action='store_true'); modes.add_argument('--photos-owned-fixture',action='store_true',help='Requires separate exact owned SFTP Photos fixture approval'); args=parser.parse_args()
repo=Path(__file__).resolve().parent.parent
sdk=Path.home()/'Library/Android/sdk'
adb=[str(sdk/'platform-tools/adb'),'-s','emulator-5584']
def capture(args): return subprocess.check_output(args,text=True,stderr=subprocess.STDOUT,timeout=180)
assert capture(adb+['emu','avd','name']).splitlines()[0].strip()=='KlodaWebDavStep15'
assert capture(adb+['shell','getprop','sys.boot_completed']).strip()=='1'
ledger=json.loads(Path('/tmp/kloda-sftp16b-preflight/bound-owned-runtime.json').read_text()); container=ledger['container']
info=json.loads(capture(['docker','inspect',container]))[0]
assert info['Config']['Labels'].get('kloda.fixture')=='sftp16b' and not info.get('Mounts') and info['Image']==ledger['image']
assert info['HostConfig']['PortBindings']['22/tcp']==[{'HostIp':'127.0.0.1','HostPort':'27448'}]
started=not info['State']['Running']; reverse=False
if started: subprocess.run(['docker','start',container],check=True,stdout=subprocess.DEVNULL)
try:
 for _ in range(50):
  try:
   with socket.create_connection(('127.0.0.1',27448),timeout=1) as ready:
    if ready.recv(256).startswith(b'SSH-2.0-'): break
  except OSError: time.sleep(.1)
 else: raise RuntimeError('Fixture unavailable')
 pin=capture(['docker','exec',container,'ssh-keygen','-l','-E','sha256','-f','/etc/ssh/ssh_host_ed25519_key.pub']).split()[1]
 metadata=json.loads(Path('/tmp/kloda-sftp16b-release/aarch64-linux-android/artifact-check.json').read_text())
 library=Path(metadata['artifact']); assert metadata['target']=='aarch64-linux-android' and metadata['release']
 assert hashlib.sha256(library.read_bytes()).hexdigest()==metadata['sha256'] and all(v>=16384 for v in metadata['alignments'])
 assets=repo/'apps/mobile/modules/my-module/android/src/androidTest/assets/kloda-sftp16'; assets.mkdir(exist_ok=True)
 shutil.copyfile(library,assets/library.name)
 (assets/'sha256.txt').write_text(metadata['sha256']+'\n'); (assets/'fingerprint.txt').write_text(pin+'\n')
 subprocess.run(['./gradlew',':my-module:assembleDebugAndroidTest','-PklodaSftpNative=true','-x','buildSftpNative','--console=plain'],cwd=repo/'apps/mobile/android',env={**os.environ,'ANDROID_HOME':str(sdk),'ANDROID_SDK_ROOT':str(sdk)},check=True)
 outputs=repo/'apps/mobile/modules/my-module/android/build/outputs/apk/androidTest/debug'
 apk_info=json.loads((outputs/'output-metadata.json').read_text()); assert apk_info['applicationId']=='com.kloda.sync.test' and len(apk_info['elements'])==1
 apk=outputs/apk_info['elements'][0]['outputFile']; assert apk.is_file() and apk.parent==outputs
 subprocess.run(adb+['install','-r','-t',str(apk)],check=True)
 matching=[line.split() for line in capture(adb+['reverse','--list']).splitlines() if 'tcp:27448' in line.split()]
 assert all(line[-2:]==['tcp:27448','tcp:27448'] for line in matching)
 if not matching: subprocess.run(adb+['reverse','tcp:27448','tcp:27448'],check=True); reverse=True
 result=capture(adb+['shell','am','instrument','-w','-r','-e','scope','sftp-product' if args.product_only else 'sftp-photos-owned' if args.photos_owned_fixture else 'sftp-sources' if args.sources_only else 'sftp-files','com.kloda.sync.test/com.kloda.sync.AndroidFilesQueueRecoveryInstrumentation'])
 print(result)
 expected='SFTP owned product/OS PASS' if args.product_only else 'SFTP owned Photos source/publication/download/restore/reopen PASS' if args.photos_owned_fixture else 'SFTP owned Files/profile/source/codec PASS'
 assert expected in result and 'INSTRUMENTATION_CODE: -1' in result
 print('PASS disposable Android SFTP '+('approved owned Photos fixture' if args.photos_owned_fixture else 'Files/Keystore/SAF/codec runtime; no Photos library writes'))
finally:
 if reverse: subprocess.run(adb+['reverse','--remove','tcp:27448'],check=True)
 if started: subprocess.run(['docker','stop',container],check=True,stdout=subprocess.DEVNULL)
