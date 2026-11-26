import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { closeSync, cpSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const desktop = join(root, 'apps/desktop');
const require = createRequire(import.meta.url);
const unsigned = process.argv.includes('--unsigned');
const pkg = JSON.parse(readFileSync(join(desktop, 'package.json'), 'utf8'));
assert.equal(pkg.version, '1.0.0', 'Desktop package.json version must be 1.0.0');

for (const rel of [
  'dist/main/main.js',
  'dist/renderer/index.html',
  'dist/native/kloda_pairing.node',
  'dist/native/better_sqlite3.node',
]) {
  assert(existsSync(join(desktop, rel)), `Missing compiled desktop artifact: apps/desktop/${rel}. Run npm run build --workspace @kloda/desktop first.`);
}
const noticesPath = join(root, 'THIRD_PARTY_NOTICES.md');
assert(existsSync(noticesPath), 'Missing root THIRD_PARTY_NOTICES.md.');

const runtimeFiles = {
  'better-sqlite3': ['package.json', 'lib'],
  bindings: ['package.json', 'bindings.js'],
  'file-uri-to-path': ['package.json', 'index.js'],
  '@kloda/sync-core': ['package.json', 'dist'],
};

function stageAppDirectory(appSource, resourcesRoot) {
  mkdirSync(join(appSource, 'dist'), { recursive: true });
  const productionPkg = {
    name: pkg.name,
    private: true,
    version: pkg.version,
    type: pkg.type,
    main: pkg.main,
    productName: pkg.productName,
    klodaDesktop: {
      profile: 'production',
      applicationId: 'com.kloda.desktop',
    },
    dependencies: pkg.dependencies,
  };
  writeFileSync(join(appSource, 'package.json'), JSON.stringify(productionPkg, null, 2) + '\n');
  for (const folder of ['main', 'native', 'renderer']) {
    cpSync(join(desktop, 'dist', folder), join(appSource, 'dist', folder), { recursive: true });
  }
  for (const [name, files] of Object.entries(runtimeFiles)) {
    const destination = join(appSource, 'node_modules', name);
    mkdirSync(destination, { recursive: true });
    for (const file of files) {
      cpSync(join(root, 'node_modules', name, file), join(destination, file), { recursive: true });
    }
  }
  cpSync(noticesPath, join(resourcesRoot, 'THIRD_PARTY_NOTICES.md'));
}

if (process.platform === 'darwin') {
  const output = join(desktop, 'dist/release/macos');
  const app = join(output, 'Kloda.app');
  const electronSource = join(dirname(require.resolve('electron/package.json')), 'dist/Electron.app');
  rmSync(app, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  cpSync(electronSource, app, { recursive: true, verbatimSymlinks: true });

  const resources = join(app, 'Contents/Resources');
  rmSync(join(resources, 'default_app.asar'), { force: true });
  rmSync(join(resources, 'electron.icns'), { force: true });
  cpSync(join(desktop, 'build/icon.icns'), join(resources, 'Kloda.icns'));
  stageAppDirectory(join(resources, 'app'), resources);

  function setPlistString(plistPath, key, value) {
    try {
      execFileSync('/usr/libexec/PlistBuddy', ['-c', `Set :${key} ${value}`, plistPath], { stdio: 'pipe' });
    } catch {
      execFileSync('/usr/libexec/PlistBuddy', ['-c', `Add :${key} string ${value}`, plistPath], { stdio: 'inherit' });
    }
  }

  // Electron determines `app.isPackaged` by checking that the executable is not named "Electron".
  renameSync(join(app, 'Contents/MacOS/Electron'), join(app, 'Contents/MacOS/Kloda'));
  for (const [suffix, bundleId] of [
    ['', 'com.kloda.desktop.helper'],
    [' (GPU)', 'com.kloda.desktop.helper.gpu'],
    [' (Plugin)', 'com.kloda.desktop.helper.plugin'],
    [' (Renderer)', 'com.kloda.desktop.helper.renderer'],
  ]) {
    const helperOld = join(app, `Contents/Frameworks/Electron Helper${suffix}.app`);
    const helperNew = join(app, `Contents/Frameworks/Kloda Helper${suffix}.app`);
    if (existsSync(helperOld)) {
      renameSync(helperOld, helperNew);
      renameSync(
        join(helperNew, `Contents/MacOS/Electron Helper${suffix}`),
        join(helperNew, `Contents/MacOS/Kloda Helper${suffix}`),
      );
      const helperPlist = join(helperNew, 'Contents/Info.plist');
      for (const [key, value] of [
        ['CFBundleExecutable', `Kloda Helper${suffix}`],
        ['CFBundleName', `Kloda Helper${suffix}`],
        ['CFBundleIdentifier', bundleId],
      ]) {
        setPlistString(helperPlist, key, value);
      }
    }
  }

  const infoPlist = join(app, 'Contents/Info.plist');
  for (const [key, value] of [
    ['CFBundleIdentifier', 'com.kloda.desktop'],
    ['CFBundleExecutable', 'Kloda'],
    ['CFBundleIconFile', 'Kloda.icns'],
    ['CFBundleName', 'Kloda'],
    ['CFBundleDisplayName', 'Kloda: Secure Photos & Sync'],
    ['CFBundleShortVersionString', '1.0.0'],
    ['CFBundleVersion', '1'],
  ]) {
    setPlistString(infoPlist, key, value);
  }

  const signIdentity = process.env.KLODA_MAC_SIGN_IDENTITY?.trim();
  if (signIdentity) {
    const team = process.env.KLODA_MAC_TEAM_ID?.trim();
    const helperRights = join(output, 'helper.entitlements');
    writeFileSync(
      helperRights,
      '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>com.apple.security.cs.allow-jit</key><true/><key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/></dict></plist>\n',
    );
    const mainRights = join(output, 'production.entitlements');
    if (team) {
      const template = readFileSync(join(desktop, 'build/macos-production.entitlements.plist'), 'utf8');
      writeFileSync(
        mainRights,
        template
          .replaceAll('@APP_IDENTIFIER@', `${team}.com.kloda.desktop`)
          .replaceAll('@TEAM@', team),
      );
    } else {
      writeFileSync(
        mainRights,
        '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>com.apple.security.cs.allow-jit</key><true/><key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/></dict></plist>\n',
      );
    }
    const profilePath = process.env.KLODA_MAC_PROFILE ? resolve(process.env.KLODA_MAC_PROFILE) : null;
    if (profilePath) {
      cpSync(profilePath, join(app, 'Contents/embedded.provisionprofile'));
    }
    function isMachO(path) {
      const fd = openSync(path, 'r');
      try {
        const header = Buffer.alloc(4);
        return readSync(fd, header, 0, 4, 0) === 4 && ['cffaedfe', 'feedfacf', 'cafebabe', 'bebafeca'].includes(header.toString('hex'));
      } finally {
        closeSync(fd);
      }
    }
    function signingObjects(directory) {
      return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isSymbolicLink()) return [];
        if (entry.isDirectory()) return [...signingObjects(path), ...(/\.(app|framework)$/.test(entry.name) ? [path] : [])];
        return /\.(dylib|node)$/.test(entry.name) || (entry.isFile() && isMachO(path)) ? [path] : [];
      });
    }
    for (const target of signingObjects(join(app, 'Contents'))) {
      const args = ['--force', '--sign', signIdentity, '--timestamp', '--options', 'runtime'];
      if (target.endsWith('.app')) args.push('--entitlements', helperRights);
      args.push(target);
      execFileSync('/usr/bin/codesign', args, { stdio: 'inherit' });
    }
    execFileSync(
      '/usr/bin/codesign',
      ['--force', '--sign', signIdentity, '--timestamp', '--options', 'runtime', '--entitlements', mainRights, app],
      { stdio: 'inherit' },
    );
    execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
    console.log(`DESKTOP_MACOS_RELEASE_SIGNED ${app}`);
  } else if (unsigned) {
    console.log(`DESKTOP_MACOS_RELEASE_STAGED_UNSIGNED ${app}`);
    console.log('To sign and notarize for distribution, set KLODA_MAC_SIGN_IDENTITY="Developer ID Application: ..." (and optional KLODA_MAC_TEAM_ID), rerun, then run ditto + xcrun notarytool submit.');
  } else {
    throw new Error('Set KLODA_MAC_SIGN_IDENTITY to sign macOS release, or pass --unsigned to stage an unsigned candidate.');
  }
} else if (process.platform === 'win32') {
  const output = join(desktop, 'dist/release/win32/Kloda');
  const electronSource = join(dirname(require.resolve('electron/package.json')), 'dist');
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  cpSync(electronSource, output, { recursive: true });
  if (existsSync(join(output, 'electron.exe'))) {
    renameSync(join(output, 'electron.exe'), join(output, 'Kloda.exe'));
  }
  const resources = join(output, 'resources');
  rmSync(join(resources, 'default_app.asar'), { force: true });
  stageAppDirectory(join(resources, 'app'), resources);
  console.log(`DESKTOP_WIN32_RELEASE_STAGED ${output}`);
} else {
  throw new Error(`Unsupported V1 desktop release platform: ${process.platform}`);
}
