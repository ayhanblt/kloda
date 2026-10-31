#!/usr/bin/env python3
"""Owned disposable HTTPS DAV fault server. Private fixture keys remain under /tmp."""
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlsplit, unquote
import argparse
import base64
import json
import os
import shutil
import socket
import ssl
import subprocess
import threading

parser = argparse.ArgumentParser()
parser.add_argument("mode", choices=["prepare", "serve"])
args = parser.parse_args()
root = Path("/tmp/kloda-step15/https-fixture")
root.mkdir(parents=True, exist_ok=True, mode=0o700)
repo = Path(__file__).resolve().parent.parent

def openssl(*values):
    subprocess.run(["openssl", *values], cwd=root, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

if args.mode == "prepare":
    if not (root / "ca.crt").exists():
        (root / "ca.conf").write_text("[req]\ndistinguished_name=dn\nx509_extensions=v3_ca\nprompt=no\n[dn]\nCN=Kloda disposable DAV fixture CA\n[v3_ca]\nbasicConstraints=critical,CA:true\nkeyUsage=critical,keyCertSign,cRLSign\nsubjectKeyIdentifier=hash\n")
        openssl("req", "-new", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "3650", "-config", "ca.conf", "-keyout", "ca.key", "-out", "ca.crt")
    for name, san in [("server", "IP:10.0.2.2,IP:127.0.0.1"), ("wrong-host", "IP:127.0.0.1"), ("ios-wrong-host", "IP:10.0.2.2")]:
        if not (root / (name + ".crt")).exists():
            (root / (name + ".ext")).write_text("basicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=" + san + "\n")
            openssl("req", "-new", "-newkey", "rsa:2048", "-nodes", "-subj", "/CN=Kloda disposable DAV fixture", "-keyout", name + ".key", "-out", name + ".csr")
            openssl("x509", "-req", "-in", name + ".csr", "-CA", "ca.crt", "-CAkey", "ca.key", "-CAcreateserial", "-days", "365", "-extfile", name + ".ext", "-out", name + ".crt")
    for key in root.glob("*.key"):
        key.chmod(0o600)
    output = repo / "apps/mobile/modules/my-module/android/src/androidTest/res/raw/kloda_dav_fixture_ca.crt"
    output.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(root / "ca.crt", output)
    print("Prepared public test-APK CA; all private keys stay under /tmp/kloda-step15/https-fixture")
    raise SystemExit(0)

storage = root / "objects"
storage.mkdir(exist_ok=True, mode=0o700)
(storage / "dav").mkdir(exist_ok=True, mode=0o700)
lock = threading.RLock()
counts = {"put": 0, "move": 0, "cookies": 0, "redirectSink": 0, "wrongHostRequests": 0}
faulted = set()

def sync(path):
    fd = os.open(path, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)

class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    def log_message(self, *values):
        pass
    def reply(self, status, body=b"", headers=None):
        self.send_response(status)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Set-Cookie", "fixture-cookie=must-not-return")
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)
    def path_value(self, raw):
        value = urlsplit(raw)
        if value.query or value.fragment:
            raise ValueError()
        decoded = unquote(value.path, encoding="utf-8", errors="strict")
        parts = decoded.strip("/").split("/")
        if any(not part or part in (".", "..") or "\\" in part or any(ord(c) < 32 for c in part) for part in parts):
            raise ValueError()
        return storage.joinpath(*parts), parts
    def disconnect(self):
        self.close_connection = True
        self.connection.shutdown(socket.SHUT_RDWR)
        self.connection.close()
    def handle_dav(self):
        with lock:
            if self.server.server_port in (26444, 26445):
                counts["wrongHostRequests"] += 1
            if self.headers.get("Cookie"):
                counts["cookies"] += 1
            expected = "Basic " + base64.b64encode(b"owned:disposable-https-fixture").decode()
            if self.headers.get("Authorization") != expected:
                self.reply(401, headers={"WWW-Authenticate": 'Basic realm="owned fixture"'})
                return
            path, parts = self.path_value(self.path)
            mode = next((p for p in parts if p in ("normal", "lost-put", "lost-move", "foreign-final", "redirect", "disk-full", "excess", "ack-body")), "normal")
            if self.command == "GET" and parts[-2:] == ["__fixture", "counts"]:
                self.reply(200, json.dumps(counts).encode()); return
            if "redirect-sink" in parts:
                counts["redirectSink"] += 1
            if mode == "redirect":
                self.reply(302, headers={"Location": "/__fixture/redirect-sink"}); return
            if self.command == "MKCOL":
                if path.exists(): self.reply(405); return
                if not path.parent.is_dir(): self.reply(409); return
                path.mkdir(mode=0o700); sync(path.parent); self.reply(201); return
            if self.command == "PUT":
                size = int(self.headers.get("Content-Length", "-1"))
                if size < 0 or size > 16777216: self.reply(413); return
                body = self.rfile.read(size)
                if len(body) != size: self.disconnect(); return
                if mode == "disk-full": self.reply(507); return
                if self.headers.get("If-None-Match") != "*" or path.exists(): self.reply(412); return
                if not path.parent.is_dir(): self.reply(409); return
                fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
                with os.fdopen(fd, "wb") as file:
                    file.write(body); file.flush(); os.fsync(file.fileno())
                sync(path.parent); counts["put"] += 1
                if mode == "lost-put" and str(path) not in faulted:
                    faulted.add(str(path)); self.disconnect(); return
                if mode == "ack-body":
                    self.send_response(201); self.send_header("Content-Length", "999999"); self.end_headers()
                    self.wfile.write(b"x"); self.wfile.flush(); self.disconnect(); return
                self.reply(201); return
            if self.command == "MOVE":
                destination = self.headers.get("Destination", "")
                url = urlsplit(destination)
                if url.scheme != "https" or url.hostname not in ("10.0.2.2", "127.0.0.1") or url.port != self.server.server_port or self.headers.get("Overwrite") != "F":
                    self.reply(400); return
                final, _ = self.path_value(destination)
                if final.exists(): self.reply(412); return
                if not path.is_file(): self.reply(404); return
                os.link(path, final, follow_symlinks=False); sync(final.parent)
                path.unlink(); sync(path.parent); counts["move"] += 1
                if mode == "lost-move" and str(final) not in faulted:
                    faulted.add(str(final)); self.disconnect(); return
                self.reply(201); return
            if self.command == "GET":
                if mode == "foreign-final" and path.name == "payload.bin" and not path.exists():
                    temporary = list(path.parent.glob(".kloda-upload-*")) if path.parent.exists() else []
                    if temporary: shutil.copyfile(temporary[0], path); sync(path)
                if not path.is_file(): self.reply(404); return
                body = path.read_bytes()
                if mode == "excess": body += b"unexpected-trailing-byte"
                self.reply(200, body); return
            self.reply(405)
    def do_GET(self): self.handle_dav()
    def do_PUT(self): self.handle_dav()
    def do_MOVE(self): self.handle_dav()
    def do_MKCOL(self): self.handle_dav()

servers = []
for port, name in [(26443, "server"), (26444, "wrong-host"), (26445, "ios-wrong-host")]:
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    server.daemon_threads = True
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(root / (name + ".crt"), root / (name + ".key"))
    server.socket = context.wrap_socket(server.socket, server_side=True)
    servers.append(server)
    threading.Thread(target=server.serve_forever, daemon=True).start()
print("READY owned HTTPS DAV ports26443/26444/26445; loopback only", flush=True)
try:
    threading.Event().wait()
finally:
    for server in servers: server.shutdown(); server.server_close()
