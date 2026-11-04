#!/usr/bin/env python3
"""New S3 native journal contracts only; no Keychain, network, device or media mutation."""
from pathlib import Path
import subprocess
import tempfile
import sys
repo = Path(__file__).resolve().parent.parent
native = repo / "apps/mobile/modules/my-module/ios"
root = Path(tempfile.mkdtemp(prefix="kloda-s3-journal17-"))
stub = root / "UnrelatedTables.swift"
stub.write_text("import Foundation\nenum IosWebDavContext { static let lock = NSRecursiveLock() }\nextension IosSyncJournal {\n" + "\n".join(
    f"func {name}() throws {{}}" for name in ["createFilesJobs", "createRestoreIntents", "createFilesRuns", "createPhotos", "createAutomatic", "createAutomaticPlan"]
) + "\n}\n")
command = ["xcrun", "swiftc", "-swift-version", "5", "-D", "KLODA_S3_NATIVE", "-module-cache-path", root / "cache",
    *[native / (name + ".swift") for name in ["IosSyncJournal", "IosS3Profile", "IosS3Bridge", "IosS3Vault", "IosS3Journal", "IosS3Catalog", "IosS3Profiles"]],
    repo / "packages/s3-native/apple/tests/IosS3JournalChecks.swift", stub,
    repo / "packages/s3-native/target/debug/libkloda_s3_native.a", "-o", root / "checks"]
with (root / "build.log").open("w") as log:
    subprocess.run(list(map(str, command)), cwd=repo, check=True, stdout=log, stderr=subprocess.STDOUT)
for mode in ([] if "--restore-only" in sys.argv else ["seed", "reopen"]):
    with (root / (mode + ".log")).open("w") as log:
        subprocess.run([str(root / "checks"), mode, str(root)], check=True, stdout=log, stderr=subprocess.STDOUT)
    print("PASS " + mode, flush=True)
if "--restore-only" not in sys.argv: assert (root / "job.json").is_file()
print("Evidence: " + str(root), flush=True)

restore_stub = root / "RestoreTables.swift"
restore_stub.write_text(stub.read_text().replace("func createRestoreIntents() throws {}", "") + "\nenum IosPairingFailure: Error { case native(String); var code: String { switch self { case .native(let value): return value } } }\n")
restore_sources = [native / (name + ".swift") for name in ["IosSyncJournal", "IosS3Profile", "IosS3Bridge", "IosS3Journal", "IosS3Catalog", "IosS3RestoreJournal", "IosFilesSource", "IosFilesSnapshot", "IosFilesRestoreJournal", "IosLocalRestorePublication", "IosRestoreDestination"]]
with (root / "restore-build.log").open("w") as log:
    subprocess.run(list(map(str, ["xcrun", "swiftc", "-swift-version", "5", "-D", "KLODA_S3_NATIVE", "-module-cache-path", root / "cache", *restore_sources,
        repo / "packages/s3-native/apple/tests/IosS3RestoreChecks.swift", restore_stub, repo / "packages/s3-native/target/debug/libkloda_s3_native.a", "-o", root / "restore"])), check=True, cwd=repo, stdout=log, stderr=subprocess.STDOUT)
for mode in ["seed", "reopen"]:
    with (root / ("restore-" + mode + ".log")).open("w") as log:
        subprocess.run([str(root / "restore"), mode, str(root)], check=True, stdout=log, stderr=subprocess.STDOUT)
    print("PASS restore-" + mode, flush=True)
