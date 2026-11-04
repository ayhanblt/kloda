import ftplib,hashlib,io,json,ssl,subprocess,sys,time,uuid
from pathlib import Path
R=Path(__file__).resolve().parent
# Reuse certificate/server setup only; recorded checks are not rerun.
setup=(R/'check.py').read_text().split("log=(R/'server.log')")[0]
setup=setup.replace('extendedKeyUsage=serverAuth', 'extendedKeyUsage=serverAuth\\nsubjectKeyIdentifier=hash\\nauthorityKeyIdentifier=keyid,issuer')
setup=setup.replace("'-days','2','-subj'", "'-days','2','-addext','keyUsage=critical,keyCertSign,cRLSign','-subj'")
exec(setup)
log=(R/'practical-server.log').open('w')
p=subprocess.Popen([sys.executable,str(R/'check.py'),'serve'],stdout=log,stderr=log)
try:
 for _ in range(100):
  if (R/'port').exists():break
  if p.poll() is not None:raise RuntimeError('fixture failed')
  time.sleep(.05)
 ctx=ssl.create_default_context(cafile=str(R/'ca.crt'))
 f=ftplib.FTP_TLS(context=ctx,timeout=5)
 f.connect('localhost',int((R/'port').read_text()));f.auth();f.login('probe','unused');f.prot_p()
 sentinel=R/'root/practical-sentinel';sentinel.write_bytes(b'keep-original')
 assert 'practical-sentinel' in f.nlst()
 # Existing visible names are refused, never passed to STOR.
 name='kloda-'+uuid.uuid4().hex+'.bin'
 assert name not in f.nlst()
 payload=b'Kloda disposable practical FTPS check\n'*113
 response=f.storbinary('STOR '+name,io.BytesIO(payload))
 assert response.startswith('226'),response
 received=io.BytesIO();f.retrbinary('RETR '+name,received.write)
 assert len(received.getvalue())==len(payload)
 assert hashlib.sha256(received.getvalue()).digest()==hashlib.sha256(payload).digest()
 assert sentinel.read_bytes()==b'keep-original'
 f.quit()
 result={'scope':'new practical publication representative path; Python protocol fixture only, not native libcurl adapter acceptance','checks':{'explicitTlsProtP':'PASS','existingNameNotUploaded':'PASS','newNameUploadAck':'PASS','freshReadbackSizeSha256':'PASS','sentinelPreserved':'PASS'},'bytes':len(payload),'sha256':hashlib.sha256(payload).hexdigest(),'limitations':['existence check has a race; no atomic no-clobber guarantee','no power-loss durability guarantee','native route/generation and lost-ACK recovery NOT_RUN'],'serverStopped':True}
finally:
 p.terminate();p.wait(timeout=5);log.close()
 for n in ['ca.key','server.key']:(R/n).unlink(missing_ok=True)
(R/'practical-result.json').write_text(json.dumps(result,indent=2)+'\n')
print('PASS: new practical upload+fresh readback; existing sentinel preserved; fixture stopped, keys removed.')
