#!/usr/bin/env python3
"""Owned host SQLite + real Rust SMB C ABI; no Simulator, signing or OS-route proof."""
from pathlib import Path
import os
import json
import subprocess
import tempfile

repo = Path(__file__).resolve().parent.parent
native = repo / "apps/mobile/modules/my-module/ios"
ledger = json.loads(Path("/tmp/kloda-smb16-preflight/owned-containers.json").read_text())
strict = next(c for c in ledger["containers"] if c["mode"] == "strict")
container = json.loads(subprocess.check_output(["docker", "inspect", strict["id"]], text=True))[0]
assert container["Config"]["Labels"].get("kloda.fixture") == "smb16" and container["State"]["Running"]
assert not container.get("Mounts")
assert container["HostConfig"]["PortBindings"]["445/tcp"] == [{"HostIp": "127.0.0.1", "HostPort": "27445"}]
compiler = Path(subprocess.check_output(["rustup", "which", "--toolchain", "1.99.0", "rustc"], text=True).strip())
env = {**os.environ, "RUSTC": str(compiler), "RUSTDOC": str(compiler.with_name("rustdoc")),
       "PATH": str(compiler.parent) + os.pathsep + os.environ["PATH"]}
target = Path(os.environ.get("KLODA_STORAGE_HOST_TARGET", "/tmp/kloda-smb16-adopt-target"))
subprocess.run([str(compiler.with_name("cargo")), "build", "--locked", "--lib", "--manifest-path",
                str(repo / "packages/storage-native/Cargo.toml"), "--target-dir", str(target)], check=True, env=env)
with tempfile.TemporaryDirectory(prefix="kloda-smb-swift-") as scratch:
    root = Path(scratch)
    stub = root / "UnrelatedJournalTables.swift"
    stub.write_text("import Foundation\nenum IosPairingFailure: Error { case native(String) }\nextension IosSyncJournal {\n" + "\n".join(
        f"  func {name}() throws {{}}" for name in ["createFilesJobs", "createRestoreIntents", "createFilesRuns", "createPhotos", "createAutomatic", "createAutomaticPlan"]
    ) + "\n}\n")
    binary = root / "smb-native-checks"
    subprocess.run(["xcrun", "swiftc", "-swift-version", "5", "-D", "KLODA_SMB_NATIVE",
        str(native / "IosSyncJournal.swift"), str(native / "IosSmbJournal.swift"), str(native / "IosSmbPublication.swift"),
        str(stub), str(repo / "packages/storage-native/apple/tests/IosSmbPublicationChecks.swift"),
        "-L", str(target / "debug"), "-lkloda_storage_native", "-Xlinker", "-rpath", "-Xlinker", str(target / "debug"),
        "-o", str(binary)], check=True, cwd=repo)
    for mode in ["seed", "reopen"]:
        subprocess.run([str(binary), mode, str(root)], check=True,
            env={**env, "KLODA_SMB16_FIXTURE": "owned-loopback"}, timeout=60)
