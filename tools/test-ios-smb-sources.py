#!/usr/bin/env python3
"""Selected-source generation/SQLite checks plus complete native iOS typecheck; no device/media/network."""
from pathlib import Path
import subprocess
import tempfile
import argparse

parser = argparse.ArgumentParser()
parser.add_argument("--contracts-only", action="store_true")
parser.add_argument("--expo-modules", action="store_true")
args = parser.parse_args()

repo = Path(__file__).resolve().parent.parent
native = repo / "apps/mobile/modules/my-module/ios"
root = Path(tempfile.mkdtemp(prefix="kloda-smb-sources16-"))
print("Evidence: " + str(root), flush=True)
stub = root / "UnrelatedJournalTables.swift"
stub.write_text("import Foundation\nextension IosSyncJournal {\n" + "\n".join(
    f"func {name}() throws {{}}" for name in ["createFilesJobs", "createRestoreIntents", "createFilesRuns", "createPhotos", "createAutomatic", "createAutomaticPlan"]
) + "\n}\n")
def run(name, command):
    with (root / (name + ".log")).open("w") as log:
        subprocess.run(list(map(str, command)), cwd=repo, check=True, stdout=log, stderr=subprocess.STDOUT)
    print("PASS " + name, flush=True)
run("source-build", ["xcrun", "swiftc", "-swift-version", "5", "-module-cache-path", root / "cache",
    *[native / (name + ".swift") for name in ["IosSyncJournal", "IosSmbJournal", "IosSmbSources"]],
    repo / "packages/storage-native/apple/tests/IosSmbSourcesChecks.swift", stub, "-o", root / "checks"])
for mode in ["seed", "reopen"]:
    run(mode, [root / "checks", mode, root])
restore_stub = root / "RestoreUnrelatedTables.swift"
restore_stub.write_text(stub.read_text().replace("func createRestoreIntents() throws {}", "") +
    "\nenum IosPairingFailure: Error { case native(String); var code: String { switch self { case .native(let value): return value } } }\n")
restore_sources = [native / (name + ".swift") for name in ["IosSyncJournal", "IosSmbJournal", "IosSmbRestoreJournal",
    "IosFilesSource", "IosFilesSnapshot", "IosFilesRestoreJournal", "IosLocalRestorePublication", "IosRestoreDestination"]]
run("restore-build", ["xcrun", "swiftc", "-swift-version", "5", "-module-cache-path", root / "cache", *restore_sources,
    repo / "packages/storage-native/apple/tests/IosSmbRestoreChecks.swift", restore_stub, "-o", root / "restore-checks"])
for mode in ["seed", "reopen"]:
    run("restore-" + mode, [root / "restore-checks", mode, root])
photo_stub = root / "PhotoUnrelatedTables.swift"
photo_stub.write_text(stub.read_text() + "\nenum IosPairingFailure: Error { case native(String) }\n")
photo_sources = [native / (name + ".swift") for name in ["IosSyncJournal", "IosSmbJournal", "IosSmbPhotosState", "IosSmbCopyRequests", "IosSmbReviewEntries", "IosSmbIssues", "IosSmbUi", "IosSmbRuns", "IosSmbSchedule", "IosAutomaticPolicy", "IosSmbPhotoManifest", "IosPhotoManifest", "IosPhotoJson"]]
run("photos-build", ["xcrun", "swiftc", "-swift-version", "5", "-module-cache-path", root / "cache", *photo_sources,
    repo / "packages/storage-native/apple/tests/IosSmbPhotosChecks.swift", photo_stub, "-o", root / "photos-checks"])
run("photos-codec-authority", [root / "photos-checks", root, repo / "packages/storage-native/fixtures/smb-photo-v1.json"])
if args.contracts_only:
    print("PASS native contracts; full iOS typecheck deliberately not selected")
    raise SystemExit(0)
sources = sorted(p for p in native.glob("*.swift") if args.expo_modules or "import ExpoModulesCore" not in p.read_text())
sources += sorted((native / "NativePairing").glob("*.swift"))
sdk = subprocess.check_output(["xcrun", "--sdk", "iphonesimulator", "--show-sdk-path"], text=True).strip()
expo_flags = []
if args.expo_modules:
    roots = [repo / "apps/mobile/ios/Pods", repo / "node_modules/expo-modules-jsi/apple/Products"]
    for folder in roots:
        for framework in folder.glob("**/*.framework"):
            if "simulator" in str(framework) and "maccatalyst" not in str(framework):
                expo_flags += ["-F", framework.parent]
    expo_flags += ["-I", repo / "apps/mobile/ios/Pods/Headers/Public"]
    macro = repo / "node_modules/@expo/expo-modules-macros-plugin/apple/ExpoModulesMacros-tool"
    if macro.is_file(): expo_flags += ["-Xfrontend", "-load-plugin-executable", "-Xfrontend", str(macro) + "#ExpoModulesMacros"]
run("native-simulator-types", ["xcrun", "--sdk", "iphonesimulator", "swiftc", "-swift-version", "5", "-module-cache-path", root / "cache",
    "-sdk", sdk, "-target", "arm64-apple-ios16.4-simulator", *expo_flags, "-D", "KLODA_SMB_NATIVE", "-typecheck",
    "-import-objc-header", native / "NativePairing/KlodaPairingNative.h", *sources])
print("PASS source generation persistence/fences and complete iOS native types; actual bookmark/SMB runtime acceptance remains open")
