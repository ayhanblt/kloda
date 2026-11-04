#!/usr/bin/env python3
"""ADR0029 29/2 + 29/3 + 29/4 host check: production code parser, catalog codec, SQLite journal, writer, importer and the
restore download of imported receipts against the shared vectors and an in-memory create-only destination (tampered
copies for import and restore); no Keychain, device lock, network or user-selected restore folder."""
from pathlib import Path
import re
import subprocess
import tempfile

repo = Path(__file__).resolve().parent.parent
native = repo / "apps/mobile/modules/my-module/ios"
subprocess.run(["python3", "-I", str(repo / "tools/recovery-catalog-vectors.py")], check=True, stdout=subprocess.DEVNULL)
with tempfile.TemporaryDirectory(prefix="kloda-catalog-") as scratch:
    root = Path(scratch)
    # The transport protocol is taken verbatim from production; its DAV/Dropbox implementations and the HTTP client
    # (whose URLSession use does not build against the macOS host SDK) are not compiled.
    protocol = re.search(r"protocol IosBackupTransport: AnyObject \{.*?\n\}\nstruct IosRemoteChild[^\n]*\n", (native / "IosCloudTarget.swift").read_text(), re.S)
    kinds = re.search(r"  static let oauthKinds: Set<String> = \[[^\]]*\]\n", (native / "IosCloudTarget.swift").read_text())
    stub = root / "Stubs.swift"
    stub.write_text("import Foundation\nenum IosPairingFailure: Error { case native(String) }\nstruct IosWebDavReply { var size: Int64 = 0; var sha256 = \"\" }\n"
        + "enum IosWebDavContext { static func restoreTarget(_ target: String) throws -> IosCloudTarget { throw IosPairingFailure.native(\"unsupported\") } }\n"
        + "enum IosCloudTarget {\n" + kinds.group(0) + "  func targetId() throws -> String { \"\" }\n  func transport(snapshots: IosFilesSnapshot, check: @escaping () throws -> Void) throws -> IosBackupTransport {\n    throw IosPairingFailure.native(\"unsupported\")\n  }\n}\n" + protocol.group(0) + "extension IosSyncJournal {\n" + "\n".join(
        f"  func {name}() throws {{}}" for name in ["createFilesJobs", "createFilesRuns", "createPhotos", "createAutomatic", "createAutomaticPlan"]) + "\n}\n")
    binary = root / "ios-catalog-checks"
    sources = [native / name for name in ["IosSyncJournal.swift", "IosWebDavProfile.swift",
        "IosWebDavJournal.swift", "IosWebDavPublication.swift",
        "IosPhotoJson.swift", "IosPhotoManifest.swift", "IosWebDavPhotoManifest.swift",
        "IosWebDavRuns.swift", "IosWebDavSchedule.swift", "IosWebDavPublicationPath.swift", "IosWebDavReviewAuthorization.swift",
        "IosFilesRestoreJournal.swift", "IosLocalRestorePublication.swift", "IosWebDavRestoreJournal.swift", "IosAutomaticPolicy.swift",
        "IosRecoveryCode.swift", "IosRecoveryCatalog.swift", "IosRecoveryCatalogJournal.swift", "IosRecoveryCatalogWriter.swift",
        "IosRecoveryImport.swift", "IosRecoveryImportJournal.swift", "IosWebDavListing.swift",
        "IosFilesSource.swift", "IosFilesSnapshot.swift", "IosWebDavDownload.swift", "IosWebDavBackups.swift"]]
    subprocess.run(["xcrun", "swiftc", "-swift-version", "5", *map(str, sources), str(stub),
        str(repo / "packages/pairing-native/apple/tests/IosRecoveryCatalogChecks.swift"),
        str(repo / "packages/pairing-native/apple/tests/IosRecoveryImportChecks.swift"),
        str(repo / "packages/pairing-native/apple/tests/IosRecoveryRestoreChecks.swift"), "-o", str(binary)], check=True, cwd=repo)
    subprocess.run([str(binary), str(root / "journal.sqlite")], check=True, timeout=60)
