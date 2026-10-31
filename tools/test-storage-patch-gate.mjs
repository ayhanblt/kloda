import assert from 'node:assert/strict';
import { readFileSync, cpSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { root } from './native-build-common.mjs';

// Feed the Cargo JSON log from the successful host check; never alter the real vendor tree.
const records = readFileSync(process.argv[2], 'utf8').split('\n').flatMap(line => {
  try { return [JSON.parse(line)]; } catch { return []; }
});
const manifest = join(root, 'packages/storage-native/Cargo.toml');
const artifact = records.find(x => x.reason === 'compiler-artifact' && x.manifest_path === manifest
  && x.target.kind.includes('custom-build'));
assert(artifact, 'Successful host Cargo log must identify the exact storage build script');
const executable = artifact.executable || artifact.filenames.find(x => /[\\/]build-script-build(?:\.exe)?$/.test(x));
assert(executable, 'Storage build script binary missing');
const first = readFileSync(join(root, 'packages/storage-native/vendor/smb2.sha256'), 'utf8').split('\n')[0];
const relative = first.split('  ')[1];
assert(relative && !relative.startsWith('/') && !relative.split('/').includes('..'));
for (const changed of new Set([relative, 'src/transport/tcp.rs', 'src/rt/net.rs'])) {
  const fixture = mkdtempSync(join(tmpdir(), 'kloda-smb-source-gate-'));
  cpSync(join(root, 'packages/storage-native/vendor/smb2'), join(fixture, 'vendor/smb2'), { recursive: true });
  const file = join(fixture, 'vendor/smb2', changed);
  writeFileSync(file, readFileSync(file, 'utf8') + '\n// owned intentionally changed SDK source\n');
  const result = spawnSync(executable, [], { env: { ...process.env, CARGO_MANIFEST_DIR: fixture }, encoding: 'utf8' });
  assert.notEqual(result.status, 0, 'Changed SDK source must fail the build gate');
  assert(result.stderr.includes(`SDK hash mismatch: ${changed}`), 'Must reject the deliberately changed file');
}
console.log('PASS SDK mutations rejected for manifest-first, transport constructor and runtime wrapper; real source untouched');
