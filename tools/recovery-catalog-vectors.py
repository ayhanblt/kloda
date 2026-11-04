#!/usr/bin/env python3
"""ADR0029 29/2 reference: canonical catalog delta bytes, HMAC-SHA256 and chain identity.
Prints the vectors hardcoded in AndroidRecoveryCatalogChecks.kt and IosRecoveryCatalogChecks.swift; both must match.

Delta file: one JSON object, no whitespace, keys in this fixed order:
  format, installation, target, chain, sequence, previous, entries[path, sha256, size, kind, identity, completed], mac
Strings escape only '"', '\\' and U+0000-U+001F (as lowercase \\u00xx); everything else is raw UTF-8.
`mac` = base64url(HMAC-SHA256(HKDF(secret, "kloda-catalog-mac-v1"), bytes of the object without `mac`)).
`chain` = hex of the first 16 bytes of HKDF(secret, "kloda-catalog-id-v1"): a new secret starts a new chain folder.
`previous` = base64url(SHA-256(previous delta file bytes)) or null for sequence 1.
Remote path: .kloda/catalog/<installation>/<chain>/<target>/<sequence>.json (two destinations of one phone may share
a remote folder, e.g. the original WebDAV entry and an added Nextcloud entry for the same account)."""
import base64
import hashlib
import hmac
from pathlib import Path

# The 29/1 reference prints when run; only its definitions (with the RFC-guarded HKDF) are reused here.
namespace: dict = {}
exec(Path(__file__).with_name("recovery-code-vectors.py").read_text().split("# RFC 5869 A.1")[0], namespace)
hkdf = namespace["hkdf"]
assert hkdf(bytes([0x0b] * 22), bytes(range(0xf0, 0xfa)), bytes(range(0x0d)), 42).hex().startswith("3cb25f25faacd57a")

def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def text(value: str) -> str:
    out = ['"']
    for char in value:
        if char in '"\\': out.append("\\" + char)
        elif ord(char) < 0x20: out.append("\\u%04x" % ord(char))
        else: out.append(char)
    return "".join(out) + '"'

def optional(value) -> str:
    if value is None: return "null"
    return text(value) if isinstance(value, str) else str(value)

def entry(path, sha256, size, kind, identity, completed) -> str:
    return ('{"path":' + text(path) + ',"sha256":' + text(sha256) + ',"size":' + str(size) + ',"kind":' + text(kind)
        + ',"identity":' + optional(identity) + ',"completed":' + optional(completed) + "}")

def delta(secret, installation, target, sequence, previous, entries) -> bytes:
    chain = hkdf(secret, b"kloda-catalog-id-v1")[:16].hex()
    body = ('{"format":1,"installation":' + text(installation) + ',"target":' + text(target) + ',"chain":' + text(chain)
        + ',"sequence":' + str(sequence) + ',"previous":' + optional(previous) + ',"entries":[' + ",".join(entries) + "]}").encode()
    mac = hmac.new(hkdf(secret, b"kloda-catalog-mac-v1"), body, hashlib.sha256).digest()
    return body[:-1] + b',"mac":' + text(b64(mac)).encode() + b"}"

secret = bytes(range(32))
installation = "00000000-0000-4000-8000-000000000001"
target = b64(hashlib.sha256(b"fixture-target").digest())
source = "11111111-1111-4111-8111-111111111111"
first = delta(secret, installation, target, 1, None, [
    entry(source + "/Belgeler/Fotoğraf \"ü\".jpg", b64(hashlib.sha256(b"one").digest()), 3, "file", "files:a\tb", 1762128000123),
    entry(source + "/photos/x.json", b64(hashlib.sha256(b"two").digest()), 0, "photo_manifest", None, None)])
second = delta(secret, installation, target, 2, b64(hashlib.sha256(first).digest()), [])
print("chain", hkdf(secret, b"kloda-catalog-id-v1")[:16].hex())
print("first", len(first), b64(hashlib.sha256(first).digest()))
print("second", len(second), b64(hashlib.sha256(second).digest()))
print(first.decode())
