import ftplib, ssl, sys
ca, pwfile = sys.argv[1:3]
ctx = ssl.create_default_context(cafile=ca); ctx.minimum_version = ctx.maximum_version = ssl.TLSVersion.TLSv1_2
class F(ftplib.FTP_TLS):
    def ntransfercmd(self, cmd, rest=None):
        print("ctrl session_reused=%s has_session=%s id_len=%s ticket=%s" % (self.sock.session_reused, self.sock.session is not None, len(self.sock.session.id), self.sock.session.has_ticket))
        return super().ntransfercmd(cmd, rest)
f = F(context=ctx, timeout=10); f.connect("localhost", 27449); f.auth(); f.login("kloda_probe", open(pwfile).read().strip()); f.prot_p(); f.set_pasv(True)
try: f.nlst()
except Exception as e: print("nlst:", type(e).__name__, e)
