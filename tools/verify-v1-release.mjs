import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));

console.log('1. Checking V1 1.0.0 version consistency...');
assert.equal(readJson('package.json').version, '1.0.0', 'root package.json version');
assert.equal(readJson('packages/sync-core/package.json').version, '1.0.0', 'sync-core package.json version');
const desktopPkg = readJson('apps/desktop/package.json');
assert.equal(desktopPkg.version, '1.0.0', 'desktop package.json version');
assert.equal(desktopPkg.dependencies['@kloda/sync-core'], '1.0.0', 'desktop sync-core dependency');
assert.equal(readJson('apps/mobile/package.json').version, '1.0.0', 'mobile package.json version');
assert.equal(readJson('apps/mobile/app.json').expo.version, '1.0.0', 'expo app.json version');

const appGradle = read('apps/mobile/android/app/build.gradle');
assert(/versionName\s+"1\.0\.0"/.test(appGradle), 'android app/build.gradle versionName');
const moduleGradle = read('apps/mobile/modules/my-module/android/build.gradle');
assert(/version\s*=\s*'1\.0\.0'/.test(moduleGradle), 'my-module build.gradle version');
assert(/versionName\s+"1\.0\.0"/.test(moduleGradle), 'my-module build.gradle versionName');

const infoPlist = read('apps/mobile/ios/KlodaSecurePhotosSync/Info.plist');
assert(/<key>CFBundleShortVersionString<\/key>\s*<string>1\.0\.0<\/string>/.test(infoPlist), 'iOS Info.plist version');
const pbxproj = read('apps/mobile/ios/KlodaSecurePhotosSync.xcodeproj/project.pbxproj');
const marketingMatches = pbxproj.match(/MARKETING_VERSION\s*=\s*1\.0\.0;/g) ?? [];
assert.equal(marketingMatches.length, 4, 'project.pbxproj must have 4 MARKETING_VERSION = 1.0.0 entries');
assert(!/MARKETING_VERSION\s*=\s*(0\.0\.0|1\.0);/.test(pbxproj), 'stale MARKETING_VERSION left in project.pbxproj');

console.log('2. Checking V1 native flags and ProGuard JNI keep rules...');
const gradleProps = read('apps/mobile/android/gradle.properties');
for (const expected of [
  'klodaSmbNative=true',
  'klodaSftpNative=true',
  'klodaFtpsNative=true',
  'klodaS3Native=false',
  'android.enableMinifyInReleaseBuilds=true',
  'android.enableShrinkResourcesInReleaseBuilds=true',
]) {
  assert(new RegExp(`^${expected}$`, 'm').test(gradleProps), `Missing gradle.properties flag: ${expected}`);
}
const podspec = read('apps/mobile/modules/my-module/ios/KlodaSyncRuntime.podspec');
assert(podspec.includes("ENV['KLODA_SMB_NATIVE'] != '0'"), 'podspec SMB default must be enabled');
assert(podspec.includes("ENV['KLODA_SFTP_NATIVE'] != '0'"), 'podspec SFTP default must be enabled');
assert(podspec.includes("ENV['KLODA_FTPS_NATIVE'] != '0'"), 'podspec FTPS default must be enabled');
assert(podspec.includes("ENV['KLODA_S3_NATIVE'] == '1'"), 'podspec S3 default must stay off');

const proguard = read('apps/mobile/modules/my-module/android/consumer-rules.pro');
for (const token of [
  'KlodaPairingJni',
  'KlodaPairingPlatform',
  'SmbNativeEngine',
  'SmbNativeReceipt',
  'SftpNativeEngine',
  'SftpNativeReceipt',
  'FtpsNativeEngine',
  'FtpsNativeReceipt',
  'connect(java.lang.String,int)',
]) {
  assert(proguard.includes(token), `Missing ProGuard rule token: ${token}`);
}

console.log('3. Checking THIRD_PARTY_NOTICES.md files...');
for (const rel of [
  'THIRD_PARTY_NOTICES.md',
  'packages/ftps-native/THIRD_PARTY_NOTICES.md',
  'packages/sftp-native/THIRD_PARTY_NOTICES.md',
]) {
  assert(existsSync(join(root, rel)), `Missing notices file: ${rel}`);
}

console.log('4. Checking B2 fixture-CA symbol exclusion across native artifacts...');
const forbiddenMarkers = [
  'owned_fixture_marker',
  'kloda_ftps_owned_fixture',
  'kloda_sftp_owned_fixture',
  'kloda_smb_owned_fixture',
  'fixture_ca',
];
function assertNoFixtureSymbols(symbols, label) {
  for (const marker of forbiddenMarkers) {
    assert(!symbols.includes(marker), `Forbidden fixture symbol (${marker}) found in ${label}`);
  }
}

const sdk = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || join(homedir(), 'Library/Android/sdk');
const host = { darwin: 'darwin-x86_64', linux: 'linux-x86_64', win32: 'windows-x86_64' }[process.platform];
const llvmNm = join(sdk, 'ndk/27.1.12297006/toolchains/llvm/prebuilt', host, `bin/llvm-nm${process.platform === 'win32' ? '.exe' : ''}`);
assert(existsSync(llvmNm), `Missing Android NDK llvm-nm: ${llvmNm}`);

for (const abi of ['arm64-v8a', 'armeabi-v7a', 'x86_64', 'x86']) {
  for (const lib of ['libkloda_pairing_native.so', 'libkloda_storage_native.so', 'libkloda_sftp_native.so', 'libkloda_ftps_native.so']) {
    const path = join(root, 'apps/mobile/modules/my-module/android/src/main/jniLibs', abi, lib);
    assert(existsSync(path), `Missing Android native lib: ${path}`);
    const symbols = execFileSync(llvmNm, ['--dynamic', '--defined-only', path], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    assertNoFixtureSymbols(symbols, `Android ${abi}/${lib}`);
    if (lib === 'libkloda_pairing_native.so') {
      assert(symbols.includes('Java_com_kloda_sync_KlodaPairingJni_open'), `Missing JNI export in ${abi}/${lib}`);
      assert(symbols.includes('Java_com_kloda_sync_KlodaPairingJni_transfer'), `Missing JNI export in ${abi}/${lib}`);
    }
  }
}

if (process.platform === 'darwin') {
  for (const [dir, lib] of [
    ['NativePairing/KlodaPairingNative.xcframework', 'libkloda_pairing_native.a'],
    ['NativeStorage/KlodaStorageNative.xcframework', 'libkloda_storage_native.a'],
    ['NativeSftp/KlodaSftpNative.xcframework', 'libkloda_sftp_native.a'],
    ['NativeFtps/KlodaFtpsNative.xcframework', 'libkloda_ftps_native.a'],
  ]) {
    const xc = join(root, 'apps/mobile/modules/my-module/ios', dir);
    assert(existsSync(xc), `Missing iOS xcframework: ${xc}`);
    const slices = readdirSync(xc, { withFileTypes: true }).filter((e) => e.isDirectory());
    assert(slices.length >= 2, `Expected >=2 slices in ${dir}`);
    for (const slice of slices) {
      const archive = join(xc, slice.name, lib);
      assert(existsSync(archive), `Missing iOS slice archive: ${archive}`);
      const symbols = execFileSync('xcrun', ['nm', '--no-llvm-bc', '-gU', archive], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
      assertNoFixtureSymbols(symbols, `iOS ${dir}/${slice.name}/${lib}`);
    }
  }
  const desktopNode = join(root, 'apps/desktop/dist/native/kloda_pairing.node');
  assert(existsSync(desktopNode), `Missing desktop native addon: ${desktopNode}`);
  const desktopSymbols = execFileSync('nm', ['-gU', desktopNode], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  assertNoFixtureSymbols(desktopSymbols, 'apps/desktop/dist/native/kloda_pairing.node');
}

console.log('V1_RELEASE_VERIFICATION_PASS');
