from pathlib import Path
import http.server,http.client,ssl,json,socketserver,threading
p=Path('/tmp/kloda-s3-step17/rusty');upstream=json.loads((p/'ports.json').read_text())[0]
counts={'drop':0,'redirect':0,'sink':0,'error':0,'conflict':0}
def save(): (p/'fault-counts.json').write_text(json.dumps(counts))
class Handler(http.server.BaseHTTPRequestHandler):
 protocol_version='HTTP/1.1'
 def log_message(self,*args): pass
 def run(self):
  body=self.rfile.read(int(self.headers.get('Content-Length','0')));mode=self.headers.get('x-kloda-fixture-mode','')
  if self.path=='/sink':counts['sink']+=1;save();self.send_response(403);self.send_header('Content-Length','0');self.end_headers();return
  if mode in ('redirect','error','conflict'):
   counts[mode]+=1;save();data=b'<Error><Code>InternalError</Code></Error>'
   self.send_response({'redirect':307,'error':200,'conflict':409}[mode])
   if mode=='redirect':self.send_header('Location',f'https://127.0.0.1:{self.server.server_port}/sink')
   self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data);return
  context=ssl.create_default_context(cafile=str(p/'ca.crt'));con=http.client.HTTPSConnection('127.0.0.1',upstream,context=context,timeout=15)
  headers={k:v for k,v in self.headers.items() if k.lower() not in ('x-kloda-fixture-mode','connection')}
  con.request(self.command,self.path,body,headers);r=con.getresponse();data=r.read()
  if mode=='drop':
   assert self.command=='POST' and self.headers.get('if-none-match')=='*'
   assert r.status==200;counts['drop']+=1;save();self.close_connection=True;con.close();return
  self.send_response(r.status)
  for k,v in r.getheaders():
   if k.lower() not in ('connection','transfer-encoding','content-length'):self.send_header(k,v)
  self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data);con.close()
 do_GET=do_POST=do_PUT=do_DELETE=do_HEAD=run
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
ctx=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER);ctx.load_cert_chain(str(p/'certs/public.crt'),str(p/'certs/private.key'));server.socket=ctx.wrap_socket(server.socket,server_side=True)
(p/'proxy-port.txt').write_text(str(server.server_port));save();print('Owned TLS fault proxy ready',flush=True);server.serve_forever()
