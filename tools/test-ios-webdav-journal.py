#!/usr/bin/env python3
"""Disposable host checks for production SQLite/HTTP-ACK state; no TLS/source/OS proof."""
from pathlib import Path
import re
import subprocess
import os
import tempfile

repo = Path(__file__).resolve().parent.parent
native = repo / "apps/mobile/modules/my-module/ios"


def production(name, pattern):
    match = re.search(pattern, (native / name).read_text(), re.S)
    if match is None:
        raise SystemExit(f"production declaration not found in {name}: {pattern}")
    return match.group(0)


with tempfile.TemporaryDirectory(prefix="kloda-webdav-") as scratch:
    root = Path(scratch)
    # Isolate the real generic FULL/WAL journal from unrelated PC table initializers. The HTTP client (whose URLSession
    # use does not build against the macOS host SDK) and cloud targets are not compiled; the only members the closure
    # uses, `IosWebDavClient.encode` and `IosCloudTarget.oauthKinds`, are taken verbatim from production.
    encode = production("IosWebDavClient.swift", r"  static func encode\(_ data: Data\) -> String \{\n.*?\n  \}\n")
    kinds = production("IosCloudTarget.swift", r"  static let oauthKinds: Set<String> = \[[^\]]*\]\n")
    stub = root / "UnrelatedJournalTables.swift"
    stub.write_text("import Foundation\nenum IosPairingFailure: Error { case native(String) }\n"
        + "enum IosWebDavClient {\n" + encode + "}\nenum IosCloudTarget {\n" + kinds + "}\nextension IosSyncJournal {\n" + "\n".join(
        f"  func {name}() throws {{}}" for name in [
            "createFilesJobs", "createFilesRuns", "createPhotos",
            "createAutomatic", "createAutomaticPlan"]
    ) + "\n}\n")
    binary = root / "ios-webdav-checks"
    sources = [native / name for name in ["IosSyncJournal.swift", "IosWebDavProfile.swift",
        "IosWebDavJournal.swift", "IosWebDavPublication.swift",
        "IosPhotoJson.swift", "IosPhotoManifest.swift", "IosWebDavPhotoManifest.swift",
        "IosWebDavRuns.swift", "IosWebDavSchedule.swift", "IosWebDavPublicationPath.swift", "IosWebDavReviewAuthorization.swift", "IosFilesRestoreJournal.swift", "IosLocalRestorePublication.swift", "IosWebDavRestoreJournal.swift", "IosAutomaticPolicy.swift",
        "IosRecoveryCode.swift", "IosRecoveryCatalog.swift", "IosRecoveryCatalogJournal.swift", "IosRecoveryImportJournal.swift"]]
    subprocess.run(["xcrun", "swiftc", "-swift-version", "5", *map(str, sources), str(stub),
        str(repo / "packages/pairing-native/apple/tests/IosWebDavPublicationChecks.swift"),
        "-o", str(binary)], check=True, cwd=repo)
    for mode in ["seed", "reopen"]:
        subprocess.run([str(binary), mode, str(root / "journal.sqlite")], check=True, env={**os.environ,
            "KLODA_WEBDAV_PHOTO_FIXTURE": str(repo / "apps/mobile/modules/my-module/android/src/androidTest/assets/webdav-photo-v1.json")}, timeout=20)
