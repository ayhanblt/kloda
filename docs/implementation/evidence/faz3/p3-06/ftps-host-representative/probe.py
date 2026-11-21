import ftplib, hashlib, io, ssl, sys, json
ca, pwfile, name = sys.argv[1:4]
ctx = ssl.create_default_context(cafile=ca)
ctx.minimum_version = ssl.TLSVersion.TLSv1_2
ctx.maximum_version = ssl.TLSVersion.TLSv1_2
assert ctx.check_hostname and ctx.verify_mode == ssl.CERT_REQUIRED
payload = bytes(i % 251 for i in range(1048576))
sha = hashlib.sha256(payload).hexdigest()
f = ftplib.FTP_TLS(context=ctx, timeout=20)
f.connect("localhost", 27449)
f.auth()
f.login("kloda_probe", open(pwfile).read().strip())
f.prot_p()
f.set_pasv(True)
tls = f.sock.version(); cipher = f.sock.cipher()[0]
f.storbinary("STOR " + name, io.BytesIO(payload))
size = f.size(name)
buf = io.BytesIO(); f.retrbinary("RETR " + name, buf.write)
back = buf.getvalue()
print(json.dumps({"control_tls": tls, "cipher": cipher, "payload_bytes": len(payload), "payload_sha256": sha,
 "server_size": size, "readback_bytes": len(back), "readback_sha256": hashlib.sha256(back).hexdigest(),
 "match": back == payload and size == len(payload)}))
f.quit()
