import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { root, rustToolchain, requireFile } from './native-build-common.mjs';

// Candidate compile/link only: no app packaging, signing, device or capability activation.
const target = process.argv[2];
const release = process.argv[3] === '--release';
if (process.argv.length > 4 || (process.argv[3] && !release)) throw new Error('Unsupported candidate build option');
const android = {
  'aarch64-linux-android': 'aarch64-linux-android',
  'armv7-linux-androideabi': 'armv7a-linux-androideabi',
  'x86_64-linux-android': 'x86_64-linux-android',
  'i686-linux-android': 'i686-linux-android',
};
const apple = { 'aarch64-apple-ios': 'iphoneos', 'aarch64-apple-ios-sim': 'iphonesimulator' };
if (!Object.hasOwn(android, target) && !Object.hasOwn(apple, target)) throw new Error('Supply one documented mobile target');
function capture(command, args) {
  const value = spawnSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 32 * 1024 * 1024 });
  if (value.error || value.status !== 0) throw new Error(`Required tool failed: ${command}`);
  return value.stdout.trim();
}
let androidBin;
const env = { ...process.env, RUSTC: requireFile(capture('rustup', ['which', '--toolchain', rustToolchain, 'rustc']), true) };
if (Object.hasOwn(android, target)) {
  const ndk = join(process.env.ANDROID_SDK_ROOT || join(homedir(), 'Library/Android/sdk'), 'ndk/27.1.12297006');
  if (!/^Pkg\.Revision\s*=\s*27\.1\.12297006\s*$/m.test(readFileSync(join(ndk, 'source.properties'), 'utf8'))) throw new Error('Expected NDK27.1.12297006');
  const host = { darwin: 'darwin-x86_64', linux: 'linux-x86_64', win32: 'windows-x86_64' }[process.platform];
  if (!host) throw new Error('Unsupported NDK host');
  const bin = join(ndk, 'toolchains/llvm/prebuilt', host, 'bin');
  androidBin = bin;
  const key = target.replaceAll('-', '_');
  const cc = requireFile(join(bin, `${android[target]}24-clang${process.platform === 'win32' ? '.cmd' : ''}`), true);
  env[`CC_${key}`] = cc;
  env[`AR_${key}`] = requireFile(join(bin, `llvm-ar${process.platform === 'win32' ? '.exe' : ''}`), true);
  env[`CARGO_TARGET_${key.toUpperCase()}_LINKER`] = cc;
} else {
  env.SDKROOT = capture('xcrun', ['--sdk', apple[target], '--show-sdk-path']);
  env.IPHONEOS_DEPLOYMENT_TARGET = '16.4';
}
env.RUSTDOC = requireFile(capture('rustup', ['which', '--toolchain', rustToolchain, 'rustdoc']), true);
const output = process.env.KLODA_FTPS_CHECK_OUTPUT || join(root, 'packages/ftps-native/target');
const result = spawnSync('rustup', ['run', rustToolchain, 'cargo', 'build', '--locked', '--lib', ...(release ? ['--release'] : []),
  '--manifest-path', join(root, 'packages/ftps-native/Cargo.toml'),
  ...(Object.hasOwn(android, target) ? ['--features', 'android-jni'] : []), '--target', target,
  '--target-dir', join(output, target)], { cwd: root, env, stdio: 'inherit' });
if (result.error || result.status !== 0) throw new Error(`FTPS candidate ${target} failed; no artifact accepted`);
const artifact = join(output, target, target, release ? 'release' : 'debug',
  Object.hasOwn(android, target) ? 'libkloda_ftps_native.so' : 'libkloda_ftps_native.a');
const bytes = readFileSync(requireFile(artifact));
const cExports = ['kloda_ftps_publish_bound', 'kloda_ftps_read_bound'];
let exports = cExports, alignments = [];
if (androidBin) {
  const machines = { 'aarch64-linux-android': [2, 183], 'armv7-linux-androideabi': [1, 40],
    'x86_64-linux-android': [2, 62], 'i686-linux-android': [1, 3] };
  if (bytes.subarray(0, 4).toString('hex') !== '7f454c46' || bytes[4] !== machines[target][0]
    || bytes[5] !== 1 || bytes.readUInt16LE(18) !== machines[target][1]) throw new Error('Wrong ELF ABI');
  const headers = capture(requireFile(join(androidBin, 'llvm-readelf' + (process.platform === 'win32' ? '.exe' : '')), true), ['--program-headers', '--wide', artifact]);
  alignments = headers.split('\n').filter(line => /^\s*LOAD\s/.test(line)).map(line => Number(line.trim().split(/\s+/).at(-1)));
  if (!alignments.length || alignments.some(value => !Number.isSafeInteger(value) || value < 16384)) throw new Error('ELF LOAD alignment below16KB');
  exports = [...cExports, ...['publishBound', 'readBound'].map(name => 'Java_com_kloda_sync_FtpsNativeEngine_' + name)];
  const symbols = capture(requireFile(join(androidBin, 'llvm-nm' + (process.platform === 'win32' ? '.exe' : '')), true), ['--dynamic', '--defined-only', artifact]);
  const names = new Set(symbols.split('\n').map(line => line.trim().split(/\s+/).at(-1)));
  if (names.has('kloda_ftps_owned_fixture_marker')) throw new Error('Fixture-trust artifact forbidden');
  if (exports.some(name => !names.has(name))) throw new Error('Missing ftps JNI/C export');
} else {
  if (bytes.subarray(0, 8).toString() !== '!<arch>\n') throw new Error('Expected Apple static archive');
  const symbols = capture('xcrun', ['nm', '--no-llvm-bc', '-gU', artifact]);
  const names = new Set(symbols.split('\n').map(line => line.trim().split(/\s+/).at(-1)));
  if (names.has('_kloda_ftps_owned_fixture_marker')) throw new Error('Fixture-trust artifact forbidden');
  if (exports.some(name => !names.has('_' + name))) throw new Error('Missing ftps Apple C export');
}
writeFileSync(join(output, target, 'artifact-check.json'), JSON.stringify({ target, release, artifact,
  sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, exports, alignments }, null, 2) + '\n');
console.log(`FTPS_CANDIDATE_LINK_PASS ${target}; product ABI/runtime/security acceptance remains separate`);
