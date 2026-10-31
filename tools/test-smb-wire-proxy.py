#!/usr/bin/env python3
"""Owned loopback-only adversarial wire checks; never stores credentials or payloads."""
import json
import socket
import struct
import threading

COUNTS = {"unsigned_setup": 0, "corrupt_encrypted": 0}
LOCK = threading.Lock()

def exact(stream, size):
    result = bytearray()
    while len(result) < size:
        block = stream.recv(size - len(result))
        if not block:
            raise EOFError()
        result.extend(block)
    return bytes(result)

def relay(source, target, mode, response):
    changed = False
    while True:
        header = exact(source, 4)
        length = int.from_bytes(header, "big")
        if not 0 < length <= 2 * 1024 * 1024:
            raise ValueError("owned fixture frame bound")
        frame = bytearray(exact(source, length))
        mutate = False
        if response and not changed:
            if mode == "unsigned_setup" and len(frame) >= 64 and frame[:4] == b"\xfeSMB":
                status, command = struct.unpack_from("<I", frame, 8)[0], struct.unpack_from("<H", frame, 12)[0]
                if command == 1 and status == 0:
                    flags = struct.unpack_from("<I", frame, 16)[0]
                    struct.pack_into("<I", frame, 16, flags & ~8)
                    frame[48:64] = bytes(16)
                    mutate = True
            elif mode == "corrupt_encrypted" and len(frame) > 52 and frame[:4] == b"\xfdSMB":
                frame[-1] ^= 1
                mutate = True
        if mutate:
            changed = True
            with LOCK:
                COUNTS[mode] += 1
                print(json.dumps(COUNTS), flush=True)
        target.sendall(header + frame)

def connection(client, mode):
    upstream = None
    try:
        upstream = socket.create_connection(("127.0.0.1", 27445), timeout=10)
        client.settimeout(10)
        def forward():
            try:
                relay(client, upstream, mode, False)
            except (OSError, EOFError, ValueError):
                try: upstream.shutdown(socket.SHUT_RDWR)
                except OSError: pass
        threading.Thread(target=forward, daemon=True).start()
        relay(upstream, client, mode, True)
    except (OSError, EOFError, ValueError):
        pass
    finally:
        client.close()
        if upstream: upstream.close()

def listen(port, mode):
    server = socket.socket()
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(("127.0.0.1", port)); server.listen(4)
    print(f"OWNED_PROXY_READY {mode} 127.0.0.1:{port}", flush=True)
    while True:
        client, _ = server.accept()
        threading.Thread(target=connection, args=(client, mode), daemon=True).start()

if __name__ == "__main__":
    threading.Thread(target=listen, args=(27448, "unsigned_setup"), daemon=True).start()
    listen(27449, "corrupt_encrypted")
