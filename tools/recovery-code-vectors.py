#!/usr/bin/env python3
"""ADR0029 29/1 reference: recovery code (grouped Crockford Base32 + 4 check chars) and HKDF-SHA256 key labels.
Prints the vectors hardcoded in AndroidRecoveryChecks.kt and IosRecoveryChecks.swift; both must match this output."""
import hashlib
import hmac

ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

def base32(data: bytes) -> str:
    bits = int.from_bytes(data, "big") << 4  # 256 bits padded to 260 = 52 chars
    return "".join(ALPHABET[(bits >> (5 * (51 - i))) & 31] for i in range(52))

def code(secret: bytes) -> str:
    check = hashlib.sha256(b"kloda-recovery-check-v1" + secret).digest()
    tail = "".join(ALPHABET[(int.from_bytes(check[:3], "big") >> (19 - 5 * i)) & 31] for i in range(4))
    text = base32(secret) + tail
    return "-".join(text[i:i + 4] for i in range(0, 56, 4))

def hkdf(ikm: bytes, info: bytes, salt: bytes = b"", length: int = 32) -> bytes:
    prk = hmac.new(salt or bytes(32), ikm, hashlib.sha256).digest()
    out, block, counter = b"", b"", 1
    while len(out) < length:
        block = hmac.new(prk, block + info + bytes([counter]), hashlib.sha256).digest()
        out += block; counter += 1
    return out[:length]

# RFC 5869 A.1 guards the HKDF implementation itself.
assert hkdf(bytes([0x0b] * 22), bytes(range(0xf0, 0xfa)), bytes(range(0x0d)), 42).hex() == \
    "3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865"
for name, secret in [("sequence", bytes(range(32))), ("ones", bytes([0xff] * 32))]:
    print(name, code(secret), hkdf(secret, b"kloda-catalog-mac-v1").hex())
