#!/usr/bin/env python3
"""Owned disposable Nextcloud fixture for step18 group A. Loopback only; keys and data stay under /tmp."""
from pathlib import Path
import argparse
import secrets
import subprocess
import time
import urllib.request
import ssl

IMAGE = "nextcloud@sha256:07ec73cc816e58d6f45a162cd53ef886462c29271a23fc68d0124cec276e3767"  # nextcloud:31-apache, 31.0.14
NAME = "kloda-step18-nextcloud"
PORT = 18443
root = Path("/tmp/kloda-step18/nextcloud")
ca = Path("/tmp/kloda-step15/https-fixture")

parser = argparse.ArgumentParser()
parser.add_argument("mode", choices=["start", "stop"])
args = parser.parse_args()

def run(*values, **options):
    return subprocess.run(values, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, **options).stdout

def openssl(*values):
    run("openssl", *values, cwd=root)

if args.mode == "stop":
    subprocess.run(["docker", "rm", "-f", NAME], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print("Stopped " + NAME)
    raise SystemExit(0)

if not (ca / "ca.crt").exists():
    raise SystemExit("Fixture CA missing; run tools/mobile-webdav-https-fixture.py prepare first")
root.mkdir(parents=True, exist_ok=True, mode=0o700)
if not (root / "server.crt").exists():
    (root / "server.ext").write_text("basicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\n"
        "extendedKeyUsage=serverAuth\nsubjectAltName=IP:10.0.2.2,IP:127.0.0.1\n")
    openssl("req", "-new", "-newkey", "rsa:2048", "-nodes", "-subj", "/CN=Kloda disposable Nextcloud fixture",
        "-keyout", "server.key", "-out", "server.csr")
    openssl("x509", "-req", "-in", "server.csr", "-CA", str(ca / "ca.crt"), "-CAkey", str(ca / "ca.key"),
        "-CAserial", str(root / "ca.srl"), "-CAcreateserial", "-days", "30", "-extfile", "server.ext", "-out", "server.crt")
    (root / "server.key").chmod(0o644)  # mounted read-only into the owned container only
password = root / "admin-password"
if not password.exists():
    password.write_text(secrets.token_urlsafe(24))
    password.chmod(0o600)

subprocess.run(["docker", "rm", "-f", NAME], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
run("docker", "run", "-d", "--name", NAME, "-p", "127.0.0.1:%d:443" % PORT,
    "-e", "SQLITE_DATABASE=kloda", "-e", "NEXTCLOUD_ADMIN_USER=owned",
    "-e", "NEXTCLOUD_ADMIN_PASSWORD=" + password.read_text(),
    "-e", "NEXTCLOUD_TRUSTED_DOMAINS=127.0.0.1:%d 10.0.2.2:%d" % (PORT, PORT), "-e", "OVERWRITEPROTOCOL=https",
    "-v", "%s:/etc/ssl/certs/ssl-cert-snakeoil.pem:ro" % (root / "server.crt"),
    "-v", "%s:/etc/ssl/private/ssl-cert-snakeoil.key:ro" % (root / "server.key"), IMAGE,
    # TLS is enabled before the image entrypoint installs and starts Apache once.
    "sh", "-c", "a2enmod ssl >/dev/null && a2ensite default-ssl >/dev/null && exec /entrypoint.sh apache2-foreground")

context = ssl.create_default_context(cafile=str(ca / "ca.crt"))
# The step15 fixture CA predates Python's strict X.509 profile (no authority key id); chain and host are still verified.
context.verify_flags &= ~ssl.VERIFY_X509_STRICT
deadline = time.time() + 300
while True:
    try:
        with urllib.request.urlopen("https://127.0.0.1:%d/status.php" % PORT, context=context, timeout=5) as reply:
            body = reply.read().decode()
            if '"installed":true' in body:
                break
    except Exception:
        pass
    if time.time() > deadline:
        raise SystemExit("Nextcloud fixture did not become ready")
    time.sleep(3)
print("Nextcloud fixture ready at https://127.0.0.1:%d (emulator: https://10.0.2.2:%d); admin password in %s" % (PORT, PORT, password))
