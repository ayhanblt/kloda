#!/usr/bin/env python3
"""Disposable host checks for production SQLite/HTTP-ACK state; no TLS/source/OS proof."""
from pathlib import Path
import subprocess
import os
import tempfile

repo = Path(__file__).resolve().parent.parent
native = repo / "apps/mobile/modules/my-module/ios"
with tempfile.TemporaryDirectory(prefix="kloda-webdav-") as scratch:
    root = Path(scratch)
    # Isolate the real generic FULL/WAL journal from unrelated PC table initializers.
    stub = root / "UnrelatedJournalTables.swift"
    stub.write_text("import Foundation\nenum IosPairingFailure: Error { case native(String) }\nextension IosSyncJournal {\n" + "\n".join(
        f"  func {name}() throws {{}}" for name in [
            "createFilesJobs", "createFilesRuns", "createPhotos",
            "createAutomatic", "createAutomaticPlan"]
    ) + "\n}\n")
    binary = root / "ios-webdav-checks"
    sources = [native / name for name in ["IosSyncJournal.swift", "IosWebDavProfile.swift",
        "IosWebDavClient.swift", "IosWebDavJournal.swift", "IosWebDavPublication.swift",
        "IosPhotoJson.swift", "IosPhotoManifest.swift", "IosWebDavPhotoManifest.swift",
        "IosWebDavRuns.swift", "IosWebDavSchedule.swift", "IosWebDavPublicationPath.swift", "IosWebDavReviewAuthorization.swift", "IosFilesRestoreJournal.swift", "IosLocalRestorePublication.swift", "IosWebDavRestoreJournal.swift", "IosAutomaticPolicy.swift",
        "IosRecoveryCode.swift", "IosRecoveryCatalog.swift", "IosRecoveryCatalogJournal.swift"]]
    subprocess.run(["xcrun", "swiftc", "-swift-version", "5", *map(str, sources), str(stub),
        str(repo / "packages/pairing-native/apple/tests/IosWebDavPublicationChecks.swift"),
        "-o", str(binary)], check=True, cwd=repo)
    for mode in ["seed", "reopen"]:
        subprocess.run([str(binary), mode, str(root / "journal.sqlite")], check=True, env={**os.environ,
            "KLODA_WEBDAV_PHOTO_FIXTURE": str(repo / "apps/mobile/modules/my-module/android/src/androidTest/assets/webdav-photo-v1.json")}, timeout=20)
