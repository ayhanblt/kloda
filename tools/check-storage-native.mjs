import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { root, rustToolchain, requireFile } from './native-build-common.mjs';

// Candidate compile/link only: no app packaging, signing, device or capability activation.
const target = process.argv[2];
const android = {
  'aarch64-linux-android': 'aarch64-linux-android',
  'armv7-linux-androideabi': 'armv7a-linux-androideabi',
  'x86_64-linux-android': 'x86_64-linux-android',
  'i686-linux-android': 'i686-linux-android',
};
const apple = { 'aarch64-apple-ios': 'iphoneos', 'aarch64-apple-ios-sim': 'iphonesimulator' };
if (!Object.hasOwn(android, target) && !Object.hasOwn(apple, target)) throw new Error('Supply one documented mobile target');
function capture(command, args) {
  const value = spawnSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  if (value.error || value.status !== 0) throw new Error(`Required tool failed: ${command}`);
  return value.stdout.trim();
}
const env = { ...process.env, RUSTC: requireFile(capture('rustup', ['which', '--toolchain', rustToolchain, 'rustc']), true) };
if (Object.hasOwn(android, target)) {
  const ndk = join(process.env.ANDROID_SDK_ROOT || join(homedir(), 'Library/Android/sdk'), 'ndk/27.1.12297006');
  if (!/^Pkg\.Revision\s*=\s*27\.1\.12297006\s*$/m.test(readFileSync(join(ndk, 'source.properties'), 'utf8'))) throw new Error('Expected NDK27.1.12297006');
  const host = { darwin: 'darwin-x86_64', linux: 'linux-x86_64', win32: 'windows-x86_64' }[process.platform];
  if (!host) throw new Error('Unsupported NDK host');
  const bin = join(ndk, 'toolchains/llvm/prebuilt', host, 'bin');
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
const output = process.env.KLODA_STORAGE_CHECK_OUTPUT || join(root, 'packages/storage-native/target');
const result = spawnSync('rustup', ['run', rustToolchain, 'cargo', 'build', '--locked', '--lib',
  '--manifest-path', join(root, 'packages/storage-native/Cargo.toml'),
  ...(Object.hasOwn(android, target) ? ['--features', 'android-jni'] : []), '--target', target,
  '--target-dir', join(output, target)], { cwd: root, env, stdio: 'inherit' });
if (result.error || result.status !== 0) throw new Error(`Storage candidate ${target} failed; no artifact accepted`);
console.log(`STORAGE_CANDIDATE_LINK_PASS ${target}; product ABI/runtime/security acceptance remains separate`);
