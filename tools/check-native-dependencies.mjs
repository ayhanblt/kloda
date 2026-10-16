import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const policy = {
  axum: ['0.8.9', false, ['http1', 'tokio']],
  tokio: ['1.50.0', false, ['rt', 'net', 'io-util', 'sync', 'time']],
  rustls: ['0.23.45', false, ['std', 'ring']],
  'tokio-rustls': ['0.26.6', false, []],
  hyper: ['1.12.0', false, ['client', 'http1']],
  'hyper-util': ['0.1.21', false, ['tokio']],
  rusqlite: ['0.39.0', false, ['bundled']],
  'cap-std': ['4.0.3', false, []],

  ring: ['0.17.14', true, []],
  socket2: ['0.6.1', true, ['all']],
  zeroize: ['1.8.2', true, []],
};
const sorted = (values) => [...values].sort();
const registry = 'registry+https://github.com/rust-lang/crates.io-index';

function validate(metadata) {
  const root = metadata.packages.find((pkg) => pkg.id === metadata.resolve.root);
  assert.equal(root?.name, 'kloda_pairing_native', 'metadata must describe the native owner');
  assert.deepEqual(root.features.default, [], 'native default features must remain disabled');
  for (const [name, [version, defaults, features]] of Object.entries(policy)) {
    const dependencies = root.dependencies.filter((dep) => dep.name === name);
    assert.equal(dependencies.length, 1, `${name}: one direct dependency required`);
    const [dep] = dependencies;
    assert.equal(dep.req, `=${version}`, `${name}: exact approved pin required`);
    assert.equal(dep.source, registry, `${name}: crates.io source required`);
    assert.equal(dep.kind, null, `${name}: runtime dependency required`);
    assert.equal(dep.target, null, `${name}: must not be target restricted`);
    assert.equal(dep.optional, false, `${name}: must not be optional`);
    assert.equal(dep.uses_default_features, defaults, `${name}: unsafe default features`);
    assert.deepEqual(sorted(dep.features), sorted(features), `${name}: unapproved direct features`);
    const packages = metadata.packages.filter((pkg) => pkg.name === name);
    assert.equal(packages.length, 1, `${name}: duplicate package versions forbidden`);
    assert.equal(packages[0].version, version, `${name}: resolved version differs`);
    assert.equal(packages[0].source, registry, `${name}: resolved source differs`);
    if (['rustls', 'tokio-rustls', 'cap-std'].includes(name)) {
      const node = metadata.resolve.nodes.find((entry) => entry.id === packages[0].id);
      assert.deepEqual(sorted(node.features), sorted(features), `${name}: unsafe unified features`);
    }
    if (name === 'hyper' || name === 'hyper-util') {
      const node = metadata.resolve.nodes.find((entry) => entry.id === packages[0].id);
      const allowed = name === 'hyper'
        ? ['client', 'default', 'http1', 'server']
        : ['default', 'http1', 'server', 'service', 'tokio'];
      assert.deepEqual(sorted(node.features), sorted(allowed), `${name}: unsafe unified HTTP features`);
    }
  }
  const primitives = metadata.packages.filter((pkg) => pkg.name === 'cap-primitives');
  assert.equal(primitives.length, 1, 'one cap-primitives package required');
  assert.equal(primitives[0].version, '4.0.3', 'cap-primitives must resolve to 4.0.3');
  assert.equal(primitives[0].source, registry, 'cap-primitives crates.io source required');
  const sqlite = metadata.packages.filter((pkg) => pkg.name === 'libsqlite3-sys');
  assert.equal(sqlite.length, 1, 'one native SQLite library required');
  assert.equal(sqlite[0].version, '0.37.0', 'patched SQLite 3.51.3 required');
  assert.equal(sqlite[0].source, registry, 'SQLite crates.io source required');
  const sqliteNode = metadata.resolve.nodes.find((node) => node.id === sqlite[0].id);
  assert(sqliteNode.features.includes('bundled'), 'native SQLite must use the verified bundled source');
  assert(!sqliteNode.features.includes('sqlcipher') && !sqliteNode.features.includes('loadable_extension'),
    'unapproved SQLite library mode');
  for (const pkg of metadata.packages) {
    if (!pkg.rust_version) continue;
    const [major, minor, patch = 0] = pkg.rust_version.split('.').map(Number);
    assert(major < 1 || (major === 1 && (minor < 99 || (minor === 99 && patch === 0))),
      `${pkg.name}@${pkg.version}: MSRV ${pkg.rust_version} exceeds Rust 1.99.0`);
  }
}

const result = spawnSync('rustup', ['run', '1.99.0', 'cargo', 'metadata', '--manifest-path',
  'packages/pairing-native/Cargo.toml', '--format-version', '1', '--locked',
  '--no-default-features', '--all-features'], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
if (result.error) throw result.error;
if (result.stderr) process.stderr.write(result.stderr);
if (result.status !== 0) process.exit(result.status ?? 1);
const metadata = JSON.parse(result.stdout);
validate(metadata);

if (process.argv.includes('--self-test')) {
  const rootId = metadata.resolve.root;
  const mutations = [
    (copy) => { copy.packages.find((pkg) => pkg.id === rootId).dependencies.find((dep) => dep.name === 'tokio-rustls').uses_default_features = true; },
    (copy) => { copy.packages.find((pkg) => pkg.id === rootId).dependencies.find((dep) => dep.name === 'rustls').features = ['std', 'aws_lc_rs']; },
    (copy) => { const pkg = copy.packages.find((entry) => entry.name === 'rustls'); copy.resolve.nodes.find((node) => node.id === pkg.id).features.push('tls12'); },
    (copy) => { const pkg = copy.packages.find((entry) => entry.name === 'tokio-rustls'); copy.resolve.nodes.find((node) => node.id === pkg.id).features.push('early-data'); },
    (copy) => { copy.packages.find((entry) => entry.name === 'tokio-rustls').rust_version = '1.100.0'; },
    (copy) => { copy.packages.find((pkg) => pkg.name === 'libsqlite3-sys').version = '0.30.1'; },
    (copy) => { copy.packages.find((pkg) => pkg.id === rootId).dependencies.find((dep) => dep.name === 'cap-std').features = ['fs_utf8']; },
    (copy) => { copy.packages.find((pkg) => pkg.id === rootId).dependencies.find((dep) => dep.name === 'cap-std').uses_default_features = true; },
    (copy) => { copy.packages.find((pkg) => pkg.name === 'cap-primitives').version = '4.0.2'; },
    (copy) => { const pkg = copy.packages.find((entry) => entry.name === 'cap-std'); copy.resolve.nodes.find((node) => node.id === pkg.id).features.push('fs_utf8'); },
    (copy) => { const pkg = copy.packages.find((entry) => entry.name === 'libsqlite3-sys'); copy.resolve.nodes.find((node) => node.id === pkg.id).features = []; },
    (copy) => { copy.packages.find((pkg) => pkg.id === rootId).dependencies.find((dep) => dep.name === 'hyper').features.push('http2'); },
    (copy) => { copy.packages.find((pkg) => pkg.id === rootId).dependencies.find((dep) => dep.name === 'hyper-util').uses_default_features = true; },
    (copy) => { const pkg = copy.packages.find((entry) => entry.name === 'hyper'); copy.resolve.nodes.find((node) => node.id === pkg.id).features.push('http2'); },
    (copy) => { const pkg = copy.packages.find((entry) => entry.name === 'hyper-util'); copy.resolve.nodes.find((node) => node.id === pkg.id).features.push('client-proxy'); },
  ];
  for (const mutate of mutations) {
    const copy = structuredClone(metadata);
    mutate(copy);
    assert.throws(() => validate(copy), assert.AssertionError, 'dependency policy must reject unsafe regression');
  }
  console.log(`Native dependency policy negative controls: pass (${mutations.length})`);
}
console.log('Native dependency policy: pass (locked all-feature metadata, ring-only TLS, Rust 1.99.0 MSRV)');
