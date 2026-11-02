from pathlib import Path
import subprocess,json,time,socket
r=Path('/tmp/kloda-sftp16b-preflight');owned=json.loads((r/'owned-runtime.json').read_text());c=owned['container']
info=json.loads(subprocess.check_output(['docker','inspect',c],text=True))[0]
assert info['Config']['Labels']['kloda.fixture']=='sftp16b' and not info.get('Mounts')
assert info['HostConfig']['PortBindings']['22/tcp']==[{'HostIp':'127.0.0.1','HostPort':'27448'}]
for _ in range(30):
 try:
  with socket.create_connection(('127.0.0.1',27448),timeout=1) as connection:assert connection.recv(256).startswith(b'SSH-2.0-')
  break
 except OSError:time.sleep(.2)
else:raise RuntimeError('Owned SSH endpoint did not become ready')
p=subprocess.run(['docker','exec',c,'ssh-keygen','-l','-E','sha256','-f','/etc/ssh/ssh_host_ed25519_key.pub'],capture_output=True,text=True,check=True)
pin=p.stdout.split()[1];assert pin.startswith('SHA256:');(r/'independent-fixture-fingerprint.txt').write_text(p.stdout)
with (r/'russh-host-runtime2.log').open('w') as log:
 result=subprocess.run([str(r/'target/debug/kloda_sftp16b_candidate'),pin],stdout=log,stderr=subprocess.STDOUT,timeout=60)
server=subprocess.check_output(['docker','logs',c],text=True,stderr=subprocess.STDOUT);(r/'sshd-runtime2.log').write_text(server)
print((r/'russh-host-runtime2.log').read_text());print('exit',result.returncode)
if result.returncode==0:
 assert server.count('Accepted password for owned-sftp')==1
 print('PASS server confirms exactly one password authentication; rejected pin reached key callback')
raise SystemExit(result.returncode)
