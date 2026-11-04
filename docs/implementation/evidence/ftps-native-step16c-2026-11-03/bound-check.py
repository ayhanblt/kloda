import ctypes as C,hashlib,json,os,socket,tempfile,uuid
from pathlib import Path
lib=C.CDLL('/private/tmp/kloda-ftps16c-fixture-host/debug/libkloda_ftps_native.dylib')
assert lib.kloda_ftps_owned_fixture_marker()==16
Receipt=C.CFUNCTYPE(C.c_int,C.c_void_p,C.c_int,C.c_uint64)
Connect=C.CFUNCTYPE(C.c_int,C.c_void_p,C.c_void_p,C.c_size_t,C.c_uint16)
for name in ['kloda_ftps_publish_bound','kloda_ftps_read_bound']:
 f=getattr(lib,name);f.argtypes=[C.c_char_p,C.c_size_t,C.c_int,C.c_int,Receipt,Connect,C.c_void_p];f.restype=C.c_int
payload=bytes(i%251 for i in range(65537));results={}
with tempfile.TemporaryDirectory(prefix='kloda-ftps-bound-') as temp:
 root=Path(temp);source=root/'source';source.write_bytes(payload);source.chmod(0o600)
 base=dict(address='127.0.0.1',port=27449,hostname='localhost',username='probe',password='unused',root='/',operationId=str(uuid.uuid4()),finalPath='bound-'+str(uuid.uuid4())+'/file.bin',size=str(len(payload)),sha256=list(hashlib.sha256(payload).digest()),responseTimeoutMs=3000)
 def invoke(req,read=False,revoke_after=None,deny=False,fail_record=None):
  events=[];data_fds=[]
  @Receipt
  def receipt(_,event,count):
   if event==0:return int(revoke_after is not None and any(e[0]==revoke_after for e in events))
   if event==fail_record:return 1
   events.append([event,count]);return 0
  @Connect
  def connect(_,address,length,port):
   if deny or C.string_at(address,length)!=b'127.0.0.1':return -1
   s=socket.create_connection(('127.0.0.1',port),timeout=3);s.settimeout(None);fd=s.detach();data_fds.append(fd);return fd
  output=root/('output-'+str(uuid.uuid4()))
  fd=os.open(output,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600) if read else os.open(source,os.O_RDONLY)
  s=socket.create_connection(('127.0.0.1',27449),timeout=3);s.settimeout(None);wire=s.detach()
  raw=json.dumps(req).encode();code=getattr(lib,'kloda_ftps_read_bound' if read else 'kloda_ftps_publish_bound')(raw,len(raw),fd,wire,receipt,connect,None)
  for consumed in [fd,wire,*data_fds]:
   try:os.fstat(consumed)
   except OSError:pass
   else:raise AssertionError('FD not consumed')
  return code,events,output
 code,events,_=invoke({**base,'hostname':'wrong.example'});assert (code,events)==(6,[]);results['wrongHostname']={'code':code,'events':events}
 code,events,_=invoke(base);assert code==0 and events==[[1,0],[2,len(payload)],[3,0]],(code,events);results['publication']={'code':code,'events':events}
 code,events,out=invoke(base,read=True);assert code==0 and not events and out.read_bytes()==payload;results['readbackRestore']='PASS bytes, private staging, consumed FDs'
 code,events,_=invoke({**base,'operationId':str(uuid.uuid4())});assert (code,events)==(10,[]);results['existingRefused']={'code':code,'events':events}
 code,events,_=invoke({**base,'finalPath':'denied-'+str(uuid.uuid4())},deny=True);assert code!=0 and not events;results['dataOwnerDenied']={'code':code,'events':events}
 code,events,_=invoke({**base,'finalPath':'revoked-'+str(uuid.uuid4())},revoke_after=2);assert code==2 and events==[[1,0],[2,len(payload)]];results['revokedAfterUploadAck']={'code':code,'events':events}
 code,events,_=invoke({**base,'finalPath':'receipt-fail-'+str(uuid.uuid4())},fail_record=3);assert code==3 and events==[[1,0],[2,len(payload)]];results['verificationReceiptFailure']={'code':code,'events':events}
 code,events,_=invoke({**base,'finalPath':'drop-ack-'+str(uuid.uuid4())});assert code==8 and events==[[1,0]];results['lostUploadAck']={'code':code,'events':events}
Path('/private/tmp/kloda-ftps16c-engine/bound-result.json').write_text(json.dumps(results,indent=2)+'\n')
print('PASS new consuming C ABI: publication/private restore, TLS mismatch, collision, data-owner denial, revocation, receipt failure, lost ACK; all transferred FDs consumed')
