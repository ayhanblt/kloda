import { join } from 'node:path';
import { buildCargo, packageLibrary, root, targetDirectory } from './native-build-common.mjs';

const libraries = {
  darwin: 'libkloda_pairing_native.dylib',
  linux: 'libkloda_pairing_native.so',
  win32: 'kloda_pairing_native.dll',
};
const library = libraries[process.platform];
if (!library) throw new Error(`Unsupported desktop native build platform: ${process.platform}`);

// Explicit host target prevents a user Cargo default target from packaging another architecture.
const targets = {
  'darwin-arm64': 'aarch64-apple-darwin',
  'darwin-x64': 'x86_64-apple-darwin',
  'linux-arm64': 'aarch64-unknown-linux-gnu',
  'linux-x64': 'x86_64-unknown-linux-gnu',
  'win32-arm64': 'aarch64-pc-windows-msvc',
  'win32-x64': 'x86_64-pc-windows-msvc',
};
const target = targets[`${process.platform}-${process.arch}`];
if (!target) throw new Error(`Unsupported desktop native architecture: ${process.platform}-${process.arch}`);
buildCargo(['--features', 'desktop-node', '--target', target]);
packageLibrary(
  join(targetDirectory, target, 'release', library),
  join(root, 'apps/desktop/dist/native/kloda_pairing.node'),
);
