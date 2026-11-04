import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { root, packageLibrary } from './native-build-common.mjs';
const platform = process.argv[2];
if (!['android', 'ios'].includes(platform) || process.argv.length !== 3) throw new Error('Expected android or ios');
const output = process.env.KLODA_S3_CHECK_OUTPUT || join(root, 'packages/s3-native/target');
const targets = platform === 'android' ? ['aarch64-linux-android','armv7-linux-androideabi','x86_64-linux-android','i686-linux-android'] : ['aarch64-apple-ios','aarch64-apple-ios-sim'];
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, env: { ...process.env, KLODA_S3_CHECK_OUTPUT: output }, stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error('S3 native build/package failed');
}
for (const target of targets) run(process.execPath, ['tools/check-s3-native.mjs', target, '--release']);
const artifacts = targets.map(target => JSON.parse(readFileSync(join(output, target, 'artifact-check.json'), 'utf8')));
if (platform === 'android') {
  const abis = ['arm64-v8a','armeabi-v7a','x86_64','x86'];
  artifacts.forEach((artifact, i) => packageLibrary(artifact.artifact, join(root, 'apps/mobile/modules/my-module/android/src/main/jniLibs', abis[i], 'libkloda_s3_native.so')));
} else {
  const staging = mkdtempSync(join(output, 's3-package-'));
  const framework = join(staging, 'KlodaS3Native.xcframework');
  const args = ['-create-xcframework'];
  for (const artifact of artifacts) args.push('-library', artifact.artifact, '-headers', join(root, 'packages/s3-native/include'));
  args.push('-output', framework); run('xcodebuild', args);
  const destination = join(root, 'apps/mobile/modules/my-module/ios/NativeS3/KlodaS3Native.xcframework');
  // Only replace the generated package after both real slices/export checks succeeded.
  if (existsSync(destination)) {
    const previous = join(staging, 'previous-package'); cpSync(destination, previous, { recursive: true });
    rmSync(destination, { recursive: true });
  }
  cpSync(framework, destination, { recursive: true });
  copyFileSync(join(root, 'packages/s3-native/include/kloda_s3.h'), join(root, 'apps/mobile/modules/my-module/ios/NativeS3/kloda_s3.h'));
}
console.log('S3_NATIVE_PACKAGE_PASS ' + platform);
