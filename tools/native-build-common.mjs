import { spawnSync } from 'node:child_process';
import { accessSync, constants, copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const crate = join(root, 'packages/pairing-native');
export const targetDirectory = join(crate, 'target');
export const rustToolchain = '1.99.0';

export function requireFile(path, executable = false) {
  try { accessSync(path, executable ? constants.X_OK : constants.R_OK); }
  catch { throw new Error(`Missing or inaccessible ${executable ? 'tool' : 'file'}: ${path}`); }
  return path;
}

export function buildCargo(args, environment = {}) {
  const selected = spawnSync('rustup', ['which', '--toolchain', rustToolchain, 'rustc'], { encoding: 'utf8' });
  if (selected.error || selected.status !== 0) throw new Error(`Unable to locate Rust ${rustToolchain} compiler.`);
  const compiler = requireFile(selected.stdout.trim(), true);
  const result = spawnSync('rustup', [
    'run', rustToolchain, 'cargo', 'build', '--locked', '--release',
    '--manifest-path', join(crate, 'Cargo.toml'),
    '--target-dir', targetDirectory, '--no-default-features', ...args,
  ], { cwd: root, env: { ...process.env, ...environment, RUSTC: compiler }, stdio: 'inherit' });
  if (result.error) throw new Error(`Unable to run Cargo: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`Cargo failed (${result.signal ?? result.status}). No native artifact packaged.`);
}

export function packageLibrary(source, destination) {
  requireFile(source);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
}
