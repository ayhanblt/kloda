import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { root, packageLibrary } from './native-build-common.mjs';
const platform = process.argv[2];
if (!['android', 'ios'].includes(platform) || process.argv.length !== 3) throw new Error('Expected android or ios');
const output = process.env.KLODA_FTPS_CHECK_OUTPUT || join(root, 'packages/ftps-native/target');
const targets = platform === 'android' ? ['aarch64-linux-android','armv7-linux-androideabi','x86_64-linux-android','i686-linux-android'] : ['aarch64-apple-ios','aarch64-apple-ios-sim'];
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, env: { ...process.env, KLODA_FTPS_CHECK_OUTPUT: output }, stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error('Ftps native build/package failed');
}
for (const target of targets) run(process.execPath, ['tools/check-ftps-native.mjs', target, '--release']);
const artifacts = targets.map(target => JSON.parse(readFileSync(join(output, target, 'artifact-check.json'), 'utf8')));
if (platform === 'android') {
  const abis = ['arm64-v8a','armeabi-v7a','x86_64','x86'];
  artifacts.forEach((artifact, i) => packageLibrary(artifact.artifact, join(root, 'apps/mobile/modules/my-module/android/src/main/jniLibs', abis[i], 'libkloda_ftps_native.so')));
} else {
  const staging = mkdtempSync(join(output, 'ftps-package-'));
  const framework = join(staging, 'KlodaFtpsNative.xcframework');
  const args = ['-create-xcframework'];
  for (const artifact of artifacts) args.push('-library', artifact.artifact, '-headers', join(root, 'packages/ftps-native/include'));
  args.push('-output', framework); run('xcodebuild', args);
  const destination = join(root, 'apps/mobile/modules/my-module/ios/NativeFtps/KlodaFtpsNative.xcframework');
  // Only replace the generated package after both real slices/export checks succeeded.
  if (existsSync(destination)) {
    const previous = join(staging, 'previous-package'); cpSync(destination, previous, { recursive: true });
    rmSync(destination, { recursive: true });
  }
  cpSync(framework, destination, { recursive: true });
  copyFileSync(join(root, 'packages/ftps-native/include/kloda_ftps.h'), join(root, 'apps/mobile/modules/my-module/ios/NativeFtps/kloda_ftps.h'));
}
console.log('FTPS_NATIVE_PACKAGE_PASS ' + platform);
