import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildCargo, packageLibrary, requireFile, root, targetDirectory } from './native-build-common.mjs';

const ndkVersion = '27.1.12297006';
const api = 24;
const hosts = { darwin: 'darwin-x86_64', linux: 'linux-x86_64', win32: 'windows-x86_64' };
const host = hosts[process.platform];
if (!host || !['x64', 'arm64'].includes(process.arch)) {
  throw new Error(`Unsupported Android native build host: ${process.platform}-${process.arch}`);
}
const sdk = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME
  || (process.platform === 'darwin' ? join(homedir(), 'Library/Android/sdk') : undefined);
const suppliedNdk = process.argv[2] || process.env.ANDROID_NDK_HOME || process.env.ANDROID_NDK_ROOT;
if (!suppliedNdk && !sdk) throw new Error('Set ANDROID_SDK_ROOT or ANDROID_NDK_HOME to the installed NDK 27.1.12297006.');
const ndk = resolve(suppliedNdk || join(sdk, 'ndk', ndkVersion));
const properties = readFileSync(requireFile(join(ndk, 'source.properties')), 'utf8');
if (!/^Pkg\.Revision\s*=\s*27\.1\.12297006\s*$/m.test(properties)) {
  throw new Error(`Expected Android NDK ${ndkVersion}: ${ndk}`);
}
const bin = join(ndk, 'toolchains/llvm/prebuilt', host, 'bin');
const executableSuffix = process.platform === 'win32' ? '.exe' : '';
const clangSuffix = process.platform === 'win32' ? '.cmd' : '';
const ar = requireFile(join(bin, `llvm-ar${executableSuffix}`), true);
const targets = [
  ['arm64-v8a', 'aarch64-linux-android', 'aarch64-linux-android'],
  ['armeabi-v7a', 'armv7-linux-androideabi', 'armv7a-linux-androideabi'],
  ['x86_64', 'x86_64-linux-android', 'x86_64-linux-android'],
  ['x86', 'i686-linux-android', 'i686-linux-android'],
];
// Validate every compiler before starting; no placeholder libraries are ever emitted.
const compilers = targets.map(([abi, target, compiler]) => ({
  abi, target,
  cc: requireFile(join(bin, `${compiler}${api}-clang${clangSuffix}`), true),
  cxx: requireFile(join(bin, `${compiler}${api}-clang++${clangSuffix}`), true),
}));
for (const { abi, target, cc, cxx } of compilers) {
  const key = target.replaceAll('-', '_');
  buildCargo(['--features', 'android-jni', '--target', target], {
    [`CARGO_TARGET_${key.toUpperCase()}_LINKER`]: cc,
    [`CC_${key}`]: cc,
    [`CXX_${key}`]: cxx,
    [`AR_${key}`]: ar,
    ANDROID_NDK_HOME: ndk,
  });
  packageLibrary(
    join(targetDirectory, target, 'release/libkloda_pairing_native.so'),
    join(root, 'apps/mobile/modules/my-module/android/src/main/jniLibs', abi, 'libkloda_pairing_native.so'),
  );
}
