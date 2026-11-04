"""Synthetic loopback command probes; never FTPS/LAN/product acceptance."""
import hashlib
import json
import socket
import subprocess
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CURL = ROOT / "curl-8.23.0/src/curl"


def probe(tls):
    commands, failures = [], []
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        listener.listen(1)
        listener.settimeout(8)
        port = listener.getsockname()[1]

        def serve():
            try:
                with listener.accept()[0] as control:
                    control.settimeout(5)
                    control.sendall(b"220 owned synthetic probe\r\n")
                    reader = control.makefile("rb")
                    passive = data = None
                    try:
                        while raw := reader.readline():
                            line = raw.decode("ascii").strip()
                            commands.append(line)
                            verb = line.split()[0]
                            if verb == "AUTH":
                                control.sendall(b"500 unsupported\r\n")
                            elif verb == "USER":
                                control.sendall(b"331 password\r\n")
                            elif verb == "PASS":
                                control.sendall(b"230 synthetic login\r\n")
                            elif verb == "PWD":
                                control.sendall(b'257 "/"\r\n')
                            elif verb == "EPSV":
                                passive = socket.socket()
                                passive.bind(("127.0.0.1", 0))
                                passive.listen(1)
                                passive.settimeout(5)
                                reply = f"229 passive (|||{passive.getsockname()[1]}|)\r\n"
                                control.sendall(reply.encode())
                                data = passive.accept()[0]
                            elif verb == "TYPE":
                                control.sendall(b"200 binary\r\n")
                            elif verb in {"STOR", "STOU", "APPE"}:
                                # Refuse before any payload; observe command selection only.
                                control.sendall(b"550 synthetic refusal\r\n")
                            elif verb == "QUIT":
                                control.sendall(b"221 done\r\n")
                                break
                            else:
                                raise AssertionError(f"unexpected command: {line}")
                    finally:
                        reader.close()
                        if data is not None:
                            data.close()
                        if passive is not None:
                            passive.close()
            except Exception as error:
                failures.append(repr(error))

        thread = threading.Thread(target=serve)
        thread.start()
        try:
            result = subprocess.run(
                [str(ROOT / "probe-client"), "tls" if tls else "upload",
                 f"ftp://127.0.0.1:{port}/candidate"],
                capture_output=True, text=True, timeout=7,
            )
        finally:
            thread.join(9)
        assert not thread.is_alive(), "probe thread did not finish"
        assert not failures, (failures, result.returncode, result.stderr, commands)
        assert result.returncode != 0, "probe must fail closed/refuse upload"
        return {"commands": commands, "exitCode": result.returncode,
                "stderr": result.stderr.strip()}


(ROOT / "synthetic-empty.bin").write_bytes(b"")
source = ROOT / "curl-8.23.0/lib/ftp.c"
archive = ROOT / "curl-8.23.0.tar.xz"
assert hashlib.sha256(archive.read_bytes()).hexdigest() == "8dadd7d2536a314f982ad05a651b713f426bf7d02cc2c76cffb9796f2218e6c5"
assert 'append ? "APPE %s" : "STOR %s"' in source.read_text()
tls = probe(True)
assert tls["commands"] == ["AUTH TLS", "AUTH SSL"], tls
upload = probe(False)
assert "STOR candidate" in upload["commands"], upload
assert not any(c.startswith("STOU") for c in upload["commands"]), upload
report = {
    "scope": "New diagnostic negative probes only, synthetic loopback, no real credentials or writes; not approved FTPS transport, TLS handshake, LAN ownership or product acceptance.",
    "candidate": "libcurl 8.23.0, unmodified source, diagnostic host build; configure ignored --disable-everything, not a minimal production dependency profile",
    "version": subprocess.check_output([str(CURL), "--version"], text=True).strip(),
    "sha256": {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
               for p in [archive, source, ROOT / "curl-8.23.0/COPYING", CURL, Path(__file__), ROOT / "probe-client.c", ROOT / "probe-client"]},
    "authTlsRefusal": tls,
    "customStouUpload": upload,
    "conclusion": "Negative assumptions reproduced: FTPSSLAUTH_TLS is preference, not TLS-command-only; CUSTOMREQUEST=STOU does not override upload STOR. No native/product acceptance.",
}
(ROOT / "probe-result.json").write_text(json.dumps(report, indent=2) + "\n")
print("PASS: two new diagnostic assertions; candidate assumptions rejected, no payload written.")
