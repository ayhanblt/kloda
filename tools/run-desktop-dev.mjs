import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, cpSync, existsSync, mkdirSync, openSync, readSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const desktop = join(root, 'apps/desktop');
const applicationId = 'com.kloda.desktop.dev';
const require = createRequire(import.meta.url);
const run = (command, args, options = {}) => execFileSync(command, args, { encoding: 'utf8', ...options });

export function validateProfile(profile, device, now = Date.now()) {
  const ent = profile.entitlements;
  if (!profile.platform.includes('OSX') || Date.parse(profile.expires) <= now || !Number.isFinite(Date.parse(profile.expires))) {
    throw new Error('A valid, unexpired macOS development profile is required.');
  }
  if (!profile.devices.includes(device) || !profile.certificates.length || ent['get-task-allow'] === false) {
    throw new Error('The development profile must include this Mac and a signing certificate.');
  }
  const team = ent['com.apple.developer.team-identifier'];
  const identifier = ent['com.apple.application-identifier'];
  if (!/^[A-Z0-9]{10}$/.test(team) || !profile.teams.includes(team)
      || identifier !== `${profile.prefix}.${applicationId}`
      || !ent['keychain-access-groups']?.some(group => group === identifier || group === `${profile.prefix}.*`)) {
    throw new Error(`The profile must authorize ${applicationId} and its own Keychain group.`);
  }
  return { team, identifier };
}

function readProfile(path) {
  const xml = run('/usr/bin/security', ['cms', '-D', '-i', path]);
  // Parse Apple's CMS payload, without exporting certificates' private keys or logging device IDs.
  return JSON.parse(run('/usr/bin/python3', ['-c', `
import sys,plistlib,json,hashlib
p=plistlib.loads(sys.stdin.buffer.read())
print(json.dumps(dict(platform=p.get('Platform',[]),expires=p['ExpirationDate'].isoformat()+'Z',
 devices=p.get('ProvisionedDevices',[]),teams=p.get('TeamIdentifier',[]),prefix=p['ApplicationIdentifierPrefix'][0],
 entitlements=p['Entitlements'],certificates=[hashlib.sha1(c).hexdigest().upper() for c in p.get('DeveloperCertificates',[])])))
`], { input: xml }));
}

function signingProfile() {
  const hardware = JSON.parse(run('/usr/sbin/system_profiler', ['SPHardwareDataType', '-json'])).SPHardwareDataType[0];
  const device = hardware.provisioning_UDID || hardware.platform_UUID;
  const identities = run('/usr/bin/security', ['find-identity', '-v', '-p', 'codesigning']);
  const explicit = process.env.KLODA_MAC_PROFILE;
  const directories = ['Library/Developer/Xcode/UserData/Provisioning Profiles', 'Library/MobileDevice/Provisioning Profiles'];
  const paths = explicit ? [resolve(explicit)] : directories.flatMap(directory => {
    const path = join(homedir(), directory);
    return existsSync(path) ? readdirSync(path).filter(name => name.endsWith('.provisionprofile')).map(name => join(path, name)) : [];
  });
  for (const path of paths) {
    try {
      const profile = readProfile(path);
      const binding = validateProfile(profile, device);
      const certificate = profile.certificates.find(hash => identities.includes(hash));
      if (!certificate) throw new Error('No locally usable signing identity matches this profile.');
      return { path, certificate, ...binding };
    } catch (error) { if (explicit) throw error; }
  }
  throw new Error(`No usable development profile for ${applicationId}. Create it in Xcode or set KLODA_MAC_PROFILE.`);
}

function isMachO(path) {
  const fd = openSync(path, 'r');
  try {
    const header = Buffer.alloc(4);
    return readSync(fd, header, 0, 4, 0) === 4 && ['cffaedfe', 'feedfacf', 'cafebabe', 'bebafeca'].includes(header.toString('hex'));
  } finally { closeSync(fd); }
}

// Children are signed before their containing bundles; symlinks are never followed.
function signingObjects(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) return [];
    if (entry.isDirectory()) return [...signingObjects(path), ...(/\.(app|framework)$/.test(entry.name) ? [path] : [])];
    return /\.(dylib|node)$/.test(entry.name) || (entry.isFile() && isMachO(path)) ? [path] : [];
  });
}

export function prepareMac() {
  const metadata = JSON.parse(readFileSync(join(desktop, 'package.json'), 'utf8'));
  if (metadata.klodaDesktop?.profile !== 'development' || metadata.klodaDesktop.applicationId !== applicationId) {
    throw new Error('This launcher only accepts the development desktop profile.');
  }
  const profile = signingProfile();
  const output = join(desktop, 'dist/macos-development');
  const app = join(output, 'Kloda Development.app');
  const executable = join(app, 'Contents/MacOS/Electron');
  const source = join(dirname(require.resolve('electron/package.json')), 'dist/Electron.app');
  const inputStamp = createHash('sha256');
  function hashTree(path) {
    for (const entry of readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const item = join(path, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Unexpected symlink in compiled desktop inputs.');
      inputStamp.update(entry.name);
      if (entry.isDirectory()) hashTree(item); else inputStamp.update(readFileSync(item));
    }
  }
  for (const path of ['dist/main', 'dist/native']) hashTree(join(desktop, path));
  // Only main-process runtime dependencies belong in this development host; renderer uses Vite.
  const runtimeFiles = {
    'better-sqlite3': ['package.json', 'lib'], bindings: ['package.json', 'bindings.js'],
    'file-uri-to-path': ['package.json', 'index.js'], '@kloda/sync-core': ['package.json', 'dist'],
  };
  for (const [name, files] of Object.entries(runtimeFiles)) {
    const directory = join(root, 'node_modules', name);
    for (const file of files) {
      const path = join(directory, file);
      if (file === 'dist' || file === 'lib') hashTree(path); else inputStamp.update(readFileSync(path));
    }
  }
  for (const path of [join(desktop, 'package.json'), profile.path, fileURLToPath(import.meta.url),
    join(desktop, 'build/macos-development.entitlements.plist'), join(source, 'Contents/Info.plist')]) inputStamp.update(readFileSync(path));
  inputStamp.update(profile.certificate);
  const stamp = inputStamp.digest('hex');
  const stampPath = join(output, 'stamp');
  if (existsSync(executable) && existsSync(stampPath) && readFileSync(stampPath, 'utf8') === stamp) {
    run('/usr/bin/codesign', ['--verify', '--deep', '--strict', app]);
    return executable;
  }
  // Replace only our generated copy; node_modules/Electron and authority data are untouched.
  rmSync(app, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  cpSync(source, app, { recursive: true, verbatimSymlinks: true });
  const resources = join(app, 'Contents/Resources');
  rmSync(join(resources, 'default_app.asar'), { force: true });
  const appSource = join(resources, 'app');
  mkdirSync(join(appSource, 'dist'), { recursive: true });
  cpSync(join(desktop, 'package.json'), join(appSource, 'package.json'));
  for (const folder of ['main', 'native']) cpSync(join(desktop, 'dist', folder), join(appSource, 'dist', folder), { recursive: true });
  for (const [name, files] of Object.entries(runtimeFiles)) {
    const destination = join(appSource, 'node_modules', name);
    mkdirSync(destination, { recursive: true });
    for (const file of files) cpSync(join(root, 'node_modules', name, file), join(destination, file), { recursive: true });
  }
  run('/usr/libexec/PlistBuddy', ['-c', `Set :CFBundleIdentifier ${applicationId}`, join(app, 'Contents/Info.plist')]);
  cpSync(profile.path, join(app, 'Contents/embedded.provisionprofile'));
  const mainRights = join(output, 'main.entitlements');
  const template = readFileSync(join(desktop, 'build/macos-development.entitlements.plist'), 'utf8');
  writeFileSync(mainRights, template.replaceAll('@APP_IDENTIFIER@', profile.identifier).replaceAll('@TEAM@', profile.team));
  const helperRights = join(output, 'helper.entitlements');
  writeFileSync(helperRights, '<?xml version="1.0"?><plist version="1.0"><dict><key>com.apple.security.cs.allow-jit</key><true/></dict></plist>');
  for (const path of signingObjects(join(app, 'Contents'))) {
    // Only executable hosts need JIT; restricted Keychain rights belong solely to the main host.
    const rights = path.endsWith('.app') ? ['--entitlements', helperRights] : [];
    run('/usr/bin/codesign', ['--force', '--sign', profile.certificate, '--timestamp=none', '--options', 'runtime', ...rights, path], { stdio: 'pipe' });
  }
  run('/usr/bin/codesign', ['--force', '--sign', profile.certificate, '--timestamp=none', '--options', 'runtime', '--entitlements', mainRights, app]);
  run('/usr/bin/codesign', ['--verify', '--deep', '--strict', app]);
  writeFileSync(stampPath, stamp);
  console.log('Kloda macOS development signature verified.');
  return executable;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const executable = process.platform === 'darwin' ? prepareMac() : require('electron');
    if (!process.argv.includes('--prepare-only')) {
      const args = process.platform === 'darwin' ? [] : [desktop];
      const environment = { ...process.env };
      delete environment.ELECTRON_RUN_AS_NODE;
      const child = spawn(executable, args, { cwd: desktop, env: environment, stdio: 'inherit' });
      for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
      child.on('error', error => { console.error(error.message); process.exitCode = 1; });
      child.on('exit', code => { process.exitCode = code ?? 1; });
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
