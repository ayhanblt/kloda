import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join } from 'node:path';
import { packageLibrary, requireFile, root } from './native-build-common.mjs';

const require = createRequire(import.meta.url);
// Resolve npm's existing bundled node-gyp without launching npm.cmd or a shell.
function bundledNodeGyp() {
  const npmRoots = [
    join(dirname(process.execPath), 'node_modules/npm'),
    join(dirname(process.execPath), '../lib/node_modules/npm'),
  ];
  if (process.env.npm_execpath && basename(process.env.npm_execpath) === 'npm-cli.js') {
    npmRoots.unshift(dirname(dirname(process.env.npm_execpath)));
  }
  try { npmRoots.push(dirname(require.resolve('npm/package.json'))); }
  catch { /* npm need not be resolvable from the application dependency tree. */ }
  for (const npmRoot of npmRoots) {
    const candidate = join(npmRoot, 'node_modules/node-gyp/bin/node-gyp.js');
    if (existsSync(candidate)) return requireFile(candidate);
  }
  throw new Error('Unable to locate npm bundled node-gyp. Run the build through npm with a complete Node.js/npm installation.');
}

const sqliteRoot = dirname(require.resolve('better-sqlite3/package.json'));
const electronVersion = require('electron/package.json').version;
const sqliteVersion = require('better-sqlite3/package.json').version;
const outputRoot = join(root, 'apps/desktop/dist/native');
const output = join(outputRoot, 'better_sqlite3.node');
const stampPath = join(outputRoot, 'sqlite-build.json');
const stamp = JSON.stringify({ electronVersion, sqliteVersion, platform: process.platform, arch: process.arch });
if (!(existsSync(output) && existsSync(stampPath) && readFileSync(stampPath, 'utf8') === stamp)) {
  const nodeGyp = bundledNodeGyp();
  const staging = join(outputRoot, '.sqlite-build');
  mkdirSync(staging, { recursive: true });
  try {
    // Build a separate copy: never replace the host-Node binding used by journal tests.
    for (const entry of ['binding.gyp', 'package.json', 'src', 'deps']) {
      cpSync(join(sqliteRoot, entry), join(staging, entry), { recursive: true });
    }
    const build = spawnSync(process.execPath, [nodeGyp, 'rebuild', '--release',
      `--target=${electronVersion}`, `--arch=${process.arch}`, '--dist-url=https://electronjs.org/headers',
      `--directory=${staging}`], { cwd: root, stdio: 'inherit' });
    if (build.error || build.status !== 0) throw new Error('Electron SQLite ABI build failed; no binding packaged.');
    packageLibrary(join(staging, 'build/Release/better_sqlite3.node'), output);
    writeFileSync(stampPath, stamp);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}
