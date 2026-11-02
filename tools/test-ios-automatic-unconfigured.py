#!/usr/bin/env python3
"""Execute actual native reconcile preflight guards with bounded host doubles; no network/media."""
from pathlib import Path
import subprocess
import tempfile
import hashlib
import json
repo = Path(__file__).resolve().parent.parent
root = Path(tempfile.mkdtemp(prefix='kloda-ios-unconfigured-'))
print('Evidence: ' + str(root), flush=True)
harness = '''import Foundation
enum Failure: Error { case storage, vault }
enum IosAutomaticPause { static var requested = false }
enum Vault {
 static var present = false, locked = false, reads = 0
 static func read() throws -> Int? { reads += 1; if locked { throw Failure.vault }; return present ? 1 : nil }
}
final class IosSyncJournal {
 static var reads = 0, failed = false, paused = false
 func automaticPaused() throws -> Bool { Self.reads += 1; if Self.failed { throw Failure.storage }; return Self.paused }
}
final class Check {
 var reached = false, cancelled = 0, error: Error?
 func cancelRequest() { cancelled += 1 }
 func run() { do {
 // ACTUAL_GUARDS
 _ = profile; reached = true
 } catch { self.error = error; cancelRequest() } }
}
func reset() {
 IosAutomaticPause.requested = false; Vault.present = false; Vault.locked = false; Vault.reads = 0
 IosSyncJournal.reads = 0; IosSyncJournal.failed = false; IosSyncJournal.paused = false
}
@main enum Main { static func main() {
 let control = CommandLine.arguments.contains("control")
 reset(); IosSyncJournal.failed = true
 let empty = Check(); empty.run()
 if control {
  precondition(empty.error != nil && IosSyncJournal.reads == 1 && Vault.reads == 0)
  print("PASS negative control: missing target exposed unrelated shared-journal failure"); return
 }
 precondition(empty.error == nil && !empty.reached && empty.cancelled == 1 && IosSyncJournal.reads == 0 && Vault.reads == 1)
 reset(); Vault.present = true; IosSyncJournal.failed = true
 let failed = Check(); failed.run(); precondition(failed.error != nil && !failed.reached && failed.cancelled == 1)
 reset(); Vault.present = true; IosSyncJournal.paused = true
 let paused = Check(); paused.run(); precondition(paused.error == nil && !paused.reached && paused.cancelled == 1)
 reset(); Vault.present = true; IosAutomaticPause.requested = true
 let memoryPaused = Check(); memoryPaused.run(); precondition(!memoryPaused.reached && Vault.reads == 0 && IosSyncJournal.reads == 0)
 reset(); Vault.locked = true
 let locked = Check(); locked.run(); precondition(locked.error != nil && !locked.reached && IosSyncJournal.reads == 0)
 reset(); Vault.present = true
 let ready = Check(); ready.run(); precondition(ready.reached && ready.error == nil && IosSyncJournal.reads == 1)
 print("PASS missing target/no unrelated journal; configured journal error/pause, memory pause and locked vault retain safe stop; configured healthy proceeds")
} }
'''
hashes = {}
for protocol in ['Smb', 'WebDav', 'Sftp']:
    path = repo / ('apps/mobile/modules/my-module/ios/Ios' + protocol + 'AutomaticCoordinator.swift')
    text = path.read_text(); start = text.index('    do {', text.index('  private func reconcileOnWorker(')) + len('    do {\n')
    end = text.index('      let journal =', start)
    guards = text[start:end].replace('Ios' + protocol + 'Vault', 'Vault')
    for control in [True, False]:
        body = 'guard try !(IosAutomaticPause.requested || IosSyncJournal().automaticPaused()), let profile = try Vault.read() else { cancelRequest(); return }' if control else guards
        name = protocol + ('-control' if control else '-fixed'); source = root / (name + '.swift'); binary = root / name
        source.write_text(harness.replace(' // ACTUAL_GUARDS', body))
        with (root / (name + '-build.log')).open('w') as log:
            subprocess.run(['xcrun', 'swiftc', '-swift-version', '5', '-parse-as-library', str(source), '-o', str(binary)], check=True, stdout=log, stderr=subprocess.STDOUT)
        with (root / (name + '-run.log')).open('w') as log:
            subprocess.run([str(binary)] + (['control'] if control else []), check=True, timeout=10, stdout=log, stderr=subprocess.STDOUT)
        print('PASS ' + name, flush=True)
    hashes[str(path.relative_to(repo))] = hashlib.sha256(path.read_bytes()).hexdigest()
hashes[str(Path(__file__).resolve().relative_to(repo))] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
(root / 'inputs.json').write_text(json.dumps(hashes, indent=2) + '\n')
