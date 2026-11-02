#!/usr/bin/env python3
"""Disposable host checks for the ADR0027 backup_destination kind migration; production SQLite code, no device."""
from pathlib import Path
import subprocess
import tempfile

repo = Path(__file__).resolve().parent.parent
native = repo / "apps/mobile/modules/my-module/ios"
with tempfile.TemporaryDirectory(prefix="kloda-destination-") as scratch:
    root = Path(scratch)
    # Same isolation as tools/test-ios-webdav-journal.py: real journal, unrelated PC table initializers stubbed.
    stub = root / "UnrelatedJournalTables.swift"
    stub.write_text("import Foundation\nenum IosPairingFailure: Error { case native(String) }\nextension IosSyncJournal {\n" + "\n".join(
        f"  func {name}() throws {{}}" for name in [
            "createFilesJobs", "createFilesRuns", "createPhotos",
            "createAutomatic", "createAutomaticPlan"]
    ) + "\n}\n")
    binary = root / "ios-destination-checks"
    sources = [native / name for name in ["IosSyncJournal.swift", "IosWebDavProfile.swift",
        "IosWebDavClient.swift", "IosWebDavJournal.swift", "IosWebDavPublication.swift",
        "IosPhotoJson.swift", "IosPhotoManifest.swift", "IosWebDavPhotoManifest.swift",
        "IosWebDavRuns.swift", "IosWebDavSchedule.swift", "IosWebDavPublicationPath.swift", "IosWebDavReviewAuthorization.swift", "IosFilesRestoreJournal.swift", "IosLocalRestorePublication.swift", "IosWebDavRestoreJournal.swift", "IosAutomaticPolicy.swift"]]
    # Swift 5 like test-ios-webdav-journal.py; the existing IosWebDavPublication.swift is not Swift 6 clean.
    subprocess.run(["xcrun", "swiftc", "-swift-version", "5", *map(str, sources), str(stub),
        str(repo / "packages/pairing-native/apple/tests/IosDestinationMigrationChecks.swift"),
        "-o", str(binary)], check=True, cwd=repo)
    subprocess.run([str(binary), str(root)], check=True, timeout=20)
