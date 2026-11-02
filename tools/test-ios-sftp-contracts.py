#!/usr/bin/env python3
"""Source generation, local restore and Photos codec/SQLite contracts; no device/media/network."""
from pathlib import Path
import subprocess
import tempfile
repo = Path(__file__).resolve().parent.parent
native = repo / "apps/mobile/modules/my-module/ios"
root = Path(tempfile.mkdtemp(prefix="kloda-sftp-sources16-"))
print("Evidence: " + str(root), flush=True)
stub = root / "UnrelatedJournalTables.swift"
stub.write_text("import Foundation\nextension IosSyncJournal {\n" + "\n".join(
    f"func {name}() throws {{}}" for name in ["createFilesJobs", "createRestoreIntents", "createFilesRuns", "createPhotos", "createAutomatic", "createAutomaticPlan"]
) + "\n}\n")
def run(name, command):
    with (root / (name + ".log")).open("w") as log:
        subprocess.run(list(map(str, command)), cwd=repo, check=True, stdout=log, stderr=subprocess.STDOUT)
    print("PASS " + name, flush=True)
run("source-build", ["xcrun", "swiftc", "-swift-version", "5", "-D", "KLODA_SFTP_NATIVE", "-module-cache-path", root / "cache",
    *[native / (name + ".swift") for name in ["IosSyncJournal", "IosSftpJournal", "IosSftpSources"]],
    repo / "packages/sftp-native/apple/tests/IosSftpSourcesChecks.swift", stub, "-o", root / "checks"])
for mode in ["seed", "reopen"]:
    run(mode, [root / "checks", mode, root])
restore_stub = root / "RestoreUnrelatedTables.swift"
restore_stub.write_text("import Foundation\nenum IosWebDavContext { static let lock = NSRecursiveLock() }\n" + stub.read_text().replace("func createRestoreIntents() throws {}", "") +
    "\nenum IosPairingFailure: Error { case native(String); var code: String { switch self { case .native(let value): return value } } }\n")
restore_sources = [native / (name + ".swift") for name in ["IosSyncJournal", "IosSftpJournal", "IosSftpRestoreJournal",
    "IosFilesSource", "IosFilesSnapshot", "IosFilesRestoreJournal", "IosLocalRestorePublication", "IosRestoreDestination"]]
run("restore-build", ["xcrun", "swiftc", "-swift-version", "5", "-D", "KLODA_SFTP_NATIVE", "-module-cache-path", root / "cache", *restore_sources,
    repo / "packages/sftp-native/apple/tests/IosSftpRestoreChecks.swift", restore_stub, "-o", root / "restore-checks"])
for mode in ["seed", "reopen"]:
    run("restore-" + mode, [root / "restore-checks", mode, root])
photo_stub = root / "PhotoUnrelatedTables.swift"
photo_stub.write_text("import Foundation\nenum IosWebDavContext { static let lock = NSRecursiveLock() }\n" + stub.read_text() + "\nenum IosPairingFailure: Error { case native(String) }\n")
photo_sources = [native / (name + ".swift") for name in ["IosSyncJournal", "IosSftpJournal", "IosSftpPhotosState", "IosSftpCopyRequests", "IosSftpReviewEntries", "IosSftpIssues", "IosSftpUi", "IosSftpRuns", "IosSftpSchedule", "IosAutomaticPolicy", "IosSftpPhotoManifest", "IosPhotoManifest", "IosPhotoJson"]]
run("photos-build", ["xcrun", "swiftc", "-swift-version", "5", "-D", "KLODA_SFTP_NATIVE", "-module-cache-path", root / "cache", *photo_sources,
    repo / "packages/sftp-native/apple/tests/IosSftpPhotosChecks.swift", photo_stub, "-o", root / "photos-checks"])
run("photos-codec-authority", [root / "photos-checks", root, repo / "packages/sftp-native/fixtures/sftp-photo-v1.json"])
print("PASS isolated SFTP source generation, local restore reopen and Photos codec/receipt contracts; synthetic ACKs are not wire/Photos-library evidence")
