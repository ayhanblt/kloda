import { spawnSync } from 'node:child_process';
import { dirname, delimiter, join } from 'node:path';
import { root, rustToolchain, requireFile } from './native-build-common.mjs';

const options = process.argv.slice(2);
if (options.length > 1 || options.some(x => !['--owned-fixture', '--owned-publication'].includes(x)))
  throw new Error('Unsupported test option');
const fixture = options.length === 1;
const selected = spawnSync('rustup', ['which', '--toolchain', rustToolchain, 'rustc'], { encoding: 'utf8' });
if (selected.status !== 0) throw new Error('Required Rust toolchain unavailable');
const compiler = requireFile(selected.stdout.trim(), true), bin = dirname(compiler);
const env = { ...process.env, PATH: bin + delimiter + process.env.PATH,
  RUSTC: compiler, RUSTDOC: requireFile(join(bin, 'rustdoc'), true) };
if (fixture) env.KLODA_SMB16_FIXTURE = 'owned-loopback';
const args = ['test', '--locked', '--manifest-path', join(root, 'packages/storage-native/Cargo.toml'),
  '--target-dir', process.env.KLODA_STORAGE_HOST_TARGET || join(root, 'packages/storage-native/target')];
if (fixture) args.push('--test', options[0] === '--owned-publication' ? 'publication_owned' : 'smb_candidate',
  '--', '--ignored', '--nocapture');
const result = spawnSync(requireFile(join(bin, process.platform === 'win32' ? 'cargo.exe' : 'cargo'), true), args,
  { cwd: root, env, stdio: 'inherit' });
if (result.error || result.status !== 0) process.exit(result.status || 1);
