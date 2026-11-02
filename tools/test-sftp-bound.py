#!/usr/bin/env python3
"""Real bound SFTP ABI against the ledger-owned loopback OpenSSH fixture; no OS LAN proof."""
import argparse
import ctypes as C
import hashlib
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import uuid

parser = argparse.ArgumentParser()
parser.add_argument('--rename-admission-control', action='store_true', help='Prove the pre-fix library can rename after revocation during parent checks')
args = parser.parse_args()
repo = Path(__file__).resolve().parent.parent
ledger = json.loads(Path('/tmp/kloda-sftp16b-preflight/bound-owned-runtime.json').read_text())
container = ledger['container']
def capture(*args):
    return subprocess.check_output(args, text=True, stderr=subprocess.STDOUT)
info = json.loads(capture('docker', 'inspect', container))[0]
assert info['Config']['Labels'].get('kloda.fixture') == 'sftp16b'
assert not info.get('Mounts') and info['Image'] == ledger['image']
assert info['HostConfig']['PortBindings']['22/tcp'] == [{'HostIp':'127.0.0.1','HostPort':'27448'}]
started = not info['State']['Running']
if started:
    subprocess.run(['docker','start',container], check=True, stdout=subprocess.DEVNULL)
try:
    for _ in range(50):
        try:
            with socket.create_connection(('127.0.0.1',27448), timeout=1) as ready:
                if ready.recv(256).startswith(b'SSH-2.0-'): break
        except OSError:
            time.sleep(.1)
    else:
        raise RuntimeError('Owned fixture unavailable')
    # Independent management path, never obtained from the SFTP connection being authenticated.
    pin = capture('docker','exec',container,'ssh-keygen','-l','-E','sha256','-f','/etc/ssh/ssh_host_ed25519_key.pub').split()[1]
    lib = C.CDLL(str(Path(os.environ.get('KLODA_SFTP_HOST_TARGET','/tmp/kloda-sftp16b-host-target')) / 'debug/libkloda_sftp_native.dylib'))
    callback_type = C.CFUNCTYPE(C.c_int, C.c_void_p, C.c_int, C.c_uint64)
    for name in ['kloda_sftp_publish_bound','kloda_sftp_read_bound']:
        fn = getattr(lib,name)
        fn.argtypes = [C.c_char_p,C.c_size_t,C.c_int,C.c_int,callback_type,C.c_void_p]
        fn.restype = C.c_int
    data = bytes(i % 251 for i in range(131073))
    with tempfile.TemporaryDirectory(prefix='kloda-sftp-bound-') as tmp:
        source = Path(tmp) / 'source'; source.write_bytes(data); source.chmod(0o600)
        request = dict(address='127.0.0.1',port=27448,fingerprint=pin,username='owned-sftp',password='owned-disposable-fixture',root='/home/owned-sftp',operationId=str(uuid.uuid4()),finalPath='bound-'+str(uuid.uuid4())+'/file.bin',size=str(len(data)),sha256=list(hashlib.sha256(data).digest()),responseTimeoutMs=3000)
        def invoke(req, read=False, fence=None):
            events = []
            @callback_type
            def callback(_context,event,count):
                if event == 0:
                    return int(fence is not None and fence(events))
                events.append((event,count)); return 0
            fd = os.open(Path(tmp)/('output-'+str(uuid.uuid4())),os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600) if read else os.open(source,os.O_RDONLY)
            sock = socket.create_connection(('127.0.0.1',27448),timeout=3)
            sock.settimeout(None)
            socket_fd = sock.detach()
            raw = json.dumps(req).encode()
            result = getattr(lib,'kloda_sftp_read_bound' if read else 'kloda_sftp_publish_bound')(raw,len(raw),fd,socket_fd,callback,None)
            for consumed in [fd,socket_fd]:
                try: os.fstat(consumed)
                except OSError: pass
                else: raise AssertionError('Transferred FD was not consumed')
            return result,events
        before = capture('docker','logs',container).count('Accepted password for owned-sftp')
        wrong = {**request,'fingerprint':'SHA256:'+'A'*43}
        assert invoke(wrong) == (6,[])
        assert capture('docker','logs',container).count('Accepted password for owned-sftp') == before
        result, events = invoke(request)
        assert result == 0 and events == [(1,0),(2,len(data)),(3,0),(4,0),(5,0)], (result,events)
        assert invoke(request,read=True) == (0,[])
        output = next(Path(tmp).glob('output-*')); assert output.read_bytes() == data
        # Existing final content survives a new exclusive publication attempt.
        collision = {**request,'operationId':str(uuid.uuid4())}
        result, events = invoke(collision)
        assert result != 0 and [e[0] for e in events] == [1,2,3]
        assert invoke(request,read=True) == (0,[])
        # A durable rename ACK survives revoked admission; it cannot become verified/Completed.
        fenced = {**request,'operationId':str(uuid.uuid4()),'finalPath':request['finalPath']+'.fenced'}
        result,events = invoke(fenced,fence=lambda events:any(e[0]==4 for e in events))
        assert result == 2 and [e[0] for e in events] == [1,2,3,4]
        late_calls = [0]
        def revoke_during_parents(events):
            if not any(e[0] == 3 for e in events): return False
            late_calls[0] += 1
            return late_calls[0] >= 2
        late = {**request,'operationId':str(uuid.uuid4()),'finalPath':request['finalPath']+'.late-parent'}
        result,events = invoke(late,fence=revoke_during_parents)
        if args.rename_admission_control:
            assert result == 2 and [e[0] for e in events] == [1,2,3,4], (result,events)
            print('PASS negative control: pre-fix library renamed after admission was revoked during parent checks')
            raise SystemExit(0)
        assert result == 2 and [e[0] for e in events] == [1,2,3], (result,events)
        print('PASS revoked admission during parent checks stops before rename')
        assert invoke({**request,'root':'/home/owned-sftp/../owned-sftp'}) == (1,[])
        assert invoke({**request,'root':'/missing-owned-root'}) == (11,[])
        native = repo / 'apps/mobile/modules/my-module/ios'
        stub = Path(tmp) / 'UnrelatedOwners.swift'
        stub.write_text('import Foundation\nenum IosPairingFailure: Error { case native(String) }\nenum IosWebDavContext { static let lock = NSRecursiveLock() }\nextension IosSyncJournal {\n' + '\n'.join(
            f'func {name}() throws {{}}' for name in ['createFilesJobs','createRestoreIntents','createFilesRuns','createPhotos','createAutomatic','createAutomaticPlan']) + '\n}\n')
        for check in ['Publication','Profile']:
            binary = Path(tmp) / ('swift-' + check)
            subprocess.run(['xcrun','swiftc','-swift-version','5','-D','KLODA_SFTP_NATIVE',str(native/'IosSyncJournal.swift'),str(native/'IosSftpJournal.swift'),str(native/'IosSftpPublication.swift'),str(native/'IosSftpProfile.swift'),str(stub),str(repo/f'packages/sftp-native/apple/tests/IosSftp{check}Checks.swift'),'-L',str(Path(lib._name).parent),'-lkloda_sftp_native','-Xlinker','-rpath','-Xlinker',str(Path(lib._name).parent),'-o',str(binary)],check=True)
            for mode in (['seed','reopen'] if check == 'Publication' else ['codec']):
                subprocess.run([str(binary),mode,tmp],check=True,timeout=60,env={**os.environ,'KLODA_SFTP16_FIXTURE':'owned-loopback','KLODA_SFTP_FIXTURE_PIN':pin})
        print('PASS real bound ABI: independent pin before password; durable ACK order; fresh verified read; no overwrite; admission fence; root checks; consuming FDs')
finally:
    if started:
        subprocess.run(['docker','stop',container],check=True,stdout=subprocess.DEVNULL)
