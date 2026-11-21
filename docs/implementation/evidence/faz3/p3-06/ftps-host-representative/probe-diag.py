import ftplib, hashlib, io, ssl, sys, time
ca, pwfile, name, ev = sys.argv[1:5]
out = open(ev, "w")
def mark(m):
    out.write("%.6f %s\n" % (time.time(), m)); out.flush()
ctx = ssl.create_default_context(cafile=ca)
ctx.minimum_version = ssl.TLSVersion.TLSv1_2; ctx.maximum_version = ssl.TLSVersion.TLSv1_2
payload = bytes(i % 251 for i in range(1048576)); sha = hashlib.sha256(payload).hexdigest()
f = ftplib.FTP_TLS(context=ctx, timeout=20)
mark("connect"); f.connect("localhost", 27449); mark("banner"); f.auth(); mark("auth_tls_done")
f.login("kloda_probe", open(pwfile).read().strip()); mark("login_done"); f.prot_p(); f.set_pasv(True)
mark("stor_start"); f.storbinary("STOR " + name, io.BytesIO(payload)); mark("stor_data_closed_and_226")
size = f.size(name); mark("size=%d" % size)
buf = io.BytesIO(); mark("retr_start"); f.retrbinary("RETR " + name, buf.write); mark("retr_data_closed_and_226")
mark("match=%s" % (hashlib.sha256(buf.getvalue()).hexdigest() == sha and size == len(payload)))
time.sleep(5); mark("quit_send")
try:
    f.quit(); mark("quit_221_received")
except Exception as e:
    mark("quit_error=%s" % type(e).__name__)
try: f.close()
finally: mark("client_closed")
