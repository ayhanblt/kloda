#!/usr/bin/env python3
"""Create a source-only overlay; never read Git, owner state, dependencies or artifacts."""
import argparse
import hashlib
import io
import json
import re
import stat
import tempfile
import unittest
import zipfile
from pathlib import Path

TREES = {
    'apps/desktop/electron': {'.ts', '.cts'},
    'apps/desktop/src': {'.ts', '.tsx', '.css', '.json'},
    'packages/pairing-native/src': {'.rs'},
    'packages/sync-core/src': {'.ts'},
    'docs/decisions': {'.md'},
}
REQUIRED = (
    'AGENTS.md', '.omp/AGENTS.md', 'package.json', 'package-lock.json', 'eslint.config.mjs',
    'apps/desktop/package.json', 'apps/desktop/index.html', 'apps/desktop/tsconfig.json',
    'apps/desktop/tsconfig.main.json', 'apps/desktop/vite.config.ts', 'apps/desktop/vitest.config.ts',
    'apps/desktop/public/tray-logo.png', 'packages/pairing-native/Cargo.toml',
    'packages/pairing-native/Cargo.lock', 'packages/pairing-native/build.rs',
    'packages/sync-core/package.json', 'packages/sync-core/tsconfig.json', 'packages/sync-core/tsconfig.build.json',
    'tools/build-native-desktop.mjs', 'tools/native-build-common.mjs', 'tools/build-electron-sqlite.mjs',
    'tools/check-native-dependencies.mjs', 'tools/check-rust-size.mjs', 'tools/create-windows-handoff.py',
    'docs/implementation/codex-migration-handoff.md', 'docs/implementation/implementation-session-handoff.md',
    'docs/implementation/qr-pairing-implementation-roadmap.md', 'docs/implementation/first-vertical-slice-status.md',
    'docs/implementation/desktop-platform-validation-plan.md', 'docs/implementation/windows-source-transfer.md',
    'docs/implementation/windows-native-startup-diagnostics.md',
    'docs/security/production-gates.md', 'docs/security/qr-pairing-v1-protocol.md',
    'docs/security/qr-pairing-v1-protocol-vectors.json',
    'docs/product/computer-backup-files-and-photos.md',
)
OPTIONAL = ('tsconfig.json', 'tsconfig.base.json')
OUTPUT = '.local-evidence/windows-startup-diagnostics-2026-10-20/transfer'
README = '''KLODA — WINDOWS SOURCE OVERLAY, BUILD ONLY

This package includes dirty/untracked source from the current working tree. It is
not a Git commit, a complete fresh clone, a runtime backup or platform acceptance.
Verify the external ZIP SHA256 through a trusted channel before extraction.
Extract into a NEW EMPTY staging directory, never directly over the old project.
Read WINDOWS-SOURCE-MANIFEST.json and docs/implementation/windows-source-transfer.md.
Compare every selected path with the Windows checkout; back up custom source edits
outside this package before resolving conflicts manually. Do not blindly overwrite,
mirror, delete or copy the staging directory recursively into the checkout.
Do not replace user configuration, credentials or authority state. No LocalAppData,
TPM key, pin, certificate, epoch, SQLite, archive or existing backup is included.

Prerequisites: existing approved x64 MSVC/Windows SDK, genuine Python, Node/npm,
and explicitly installed Rust 1.99.0-x86_64-pc-windows-msvc. Do not reinstall or
change these speculatively. Run in the normal account, not as administrator.
After reviewed source overlay, run from the WINDOWS repository root only:
  npm.cmd ci
  npm.cmd run build --workspace @kloda/desktop
Stop on the first failure. npm ci replaces dependency node_modules; build writes
native/main/renderer artifacts. Neither command authorizes opening a native owner.
Do not launch Electron/dev:desktop, run any probe/device command, create a QR,
change TPM/firewall/authority state or start physical acceptance. Physical pause
remains until explicitly lifted. No software-key fallback, reset or migration.

This overlay is not a mirror: extra Windows source files are not removed. Review
stale files separately; do not silently delete them to make a build pass.
Only Desktop/native/sync-core source is included. Other workspace package.json
files preserve npm's lock/workspace graph; mobile/API source is NOT transferred.
Do not run the root all-workspace build/test using this partial overlay as proof.
'''


def digest(data):
    return hashlib.sha256(data).hexdigest()


def reject_links(root, path):
    for component in (path, *path.parents):
        if component == root:
            break
        if component.is_symlink():
            raise ValueError(f'Symlink rejected: {path.relative_to(root)}')


def checked_file(root, relative):
    path = root / relative
    reject_links(root, path)
    mode = path.stat().st_mode
    if not stat.S_ISREG(mode):
        raise ValueError(f'Regular file required: {relative}')
    return path


def walk_source(root, directory, extensions):
    base = root / directory
    reject_links(root, base)
    if base.is_symlink() or not base.is_dir():
        raise ValueError(f'Source directory missing or symlink: {directory}')
    result = []
    for path in sorted(base.iterdir()):
        relative = path.relative_to(root).as_posix()
        if path.is_symlink():
            raise ValueError(f'Symlink rejected: {relative}')
        if path.name in {'.DS_Store', '.gitkeep'}:
            continue
        if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]*', path.name):
            raise ValueError(f'Unexpected source filename: {relative}')
        if path.is_dir():
            if path.name in {'node_modules', 'dist', 'target'}:
                raise ValueError(f'Artifact directory inside source: {relative}')
            result += walk_source(root, relative, extensions)
        elif path.suffix not in extensions:
            raise ValueError(f'Unexpected source extension: {relative}')
        else:
            if path.suffix == '.json' and relative not in {
                f'apps/desktop/src/shared/i18n/locales/{language}.json' for language in ('tr', 'en', 'de')
            }:
                raise ValueError(f'Unexpected source JSON: {relative}')
            if directory == 'docs/decisions' and not re.fullmatch(r'\d{4}-[a-z0-9-]+\.md', path.name):
                raise ValueError(f'Unexpected ADR filename: {relative}')
            result.append(relative)
    return result


def paths_to_copy(root):
    paths = set(REQUIRED)
    paths.update(name for name in OPTIONAL if (root / name).exists())
    for directory, extensions in TREES.items():
        paths.update(walk_source(root, directory, extensions))
    # Public assets are deliberately a fixed allowlist, not an arbitrary binary directory.
    public = root / 'apps/desktop/public'
    reject_links(root, public)
    for path in public.iterdir():
        if path.name != '.DS_Store' and path.name != 'tray-logo.png':
            raise ValueError(f'Unexpected public asset: {path.name}')
        if path.is_symlink():
            raise ValueError('Symlink in public assets')
    package = json.loads(checked_file(root, 'package.json').read_text())
    if package.get('workspaces') != ['apps/*', 'packages/*']:
        raise ValueError('Unexpected workspace patterns; review the transfer allowlist')
    for parent in ('apps', 'packages'):
        reject_links(root, root / parent)
        for directory in (root / parent).iterdir():
            if directory.is_symlink():
                raise ValueError(f'Symlink workspace rejected: {directory.name}')
            if directory.is_dir() and (directory / 'package.json').exists():
                paths.add(f'{parent}/{directory.name}/package.json')
    if len({name.casefold() for name in paths}) != len(paths):
        raise ValueError('Case-insensitive Windows path collision')
    for name in paths:
        for part in Path(name).parts:
            stem = part.split('.')[0].upper()
            if part.endswith('.') or stem in {'CON', 'PRN', 'AUX', 'NUL'} or re.fullmatch(r'(COM|LPT)[1-9]', stem):
                raise ValueError(f'Unsafe Windows filename: {name}')
        checked_file(root, name)
    return sorted(paths)


def capture(root):
    paths = paths_to_copy(root)
    files = {name: checked_file(root, name).read_bytes() for name in paths}
    if paths_to_copy(root) != paths:
        raise ValueError('Source file list changed during capture; retry after edits finish')
    for name, data in files.items():
        if checked_file(root, name).read_bytes() != data:
            raise ValueError(f'Source changed during capture: {name}')
    return files


def archive_bytes(files):
    payload = {**files, 'WINDOWS-BUILD-ONLY.txt': README.encode()}
    manifest = json.dumps({'schemaVersion': 1, 'mode': 'source-overlay-no-delete', 'files': [
        {'path': name, 'bytes': len(data), 'sha256': digest(data)} for name, data in sorted(payload.items())
    ]}, indent=2, ensure_ascii=False).encode() + b'\n'
    payload['WINDOWS-SOURCE-MANIFEST.json'] = manifest
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for name, data in sorted(payload.items()):
            info = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data)
    return output.getvalue(), manifest


def create_bundle(root):
    data, manifest = archive_bytes(capture(root))
    output = root / OUTPUT
    # Reject a symlinked evidence/output ancestor before writing any package.
    for path in (output, *output.parents):
        if path == root:
            break
        if path.is_symlink():
            raise ValueError('Symlinked output directory rejected')
    output.mkdir(parents=True, exist_ok=True)
    name = f'kloda-windows-source-{digest(data)[:16]}'
    outputs = {name + '.zip': data, name + '.manifest.json': manifest,
               name + '.sha256': f'{digest(data)}  {name}.zip\n'.encode()}
    for filename, contents in outputs.items():
        destination = output / filename
        if destination.exists() or destination.is_symlink():
            raise ValueError(f'Output already exists; not overwritten: {destination}')
        with destination.open('xb') as handle:
            handle.write(contents)
    print(json.dumps({'zip': str(output / (name + '.zip')), 'sha256': digest(data),
                      'manifest': str(output / (name + '.manifest.json')), 'sourceFiles': len(json.loads(manifest)['files']) - 1}))


class PackageChecks(unittest.TestCase):
    def test_deterministic_archive_and_hashes(self):
        files = {'apps/desktop/src/new.ts': b'untracked fixture', 'package.json': b'{}'}
        first, manifest = archive_bytes(files)
        self.assertEqual(first, archive_bytes(dict(reversed(list(files.items()))))[0])
        with zipfile.ZipFile(io.BytesIO(first)) as archive:
            self.assertEqual(archive.read('WINDOWS-SOURCE-MANIFEST.json'), manifest)
            for entry in json.loads(manifest)['files']:
                data = archive.read(entry['path'])
                self.assertEqual((len(data), digest(data)), (entry['bytes'], entry['sha256']))
            self.assertNotIn('.git', '/'.join(archive.namelist()))

    def test_source_allowlist_rejects_unexpected_files_and_symlinks(self):
        with tempfile.TemporaryDirectory(prefix='kloda-transfer-selftest-') as temporary:
            root = Path(temporary)
            source = root / 'apps/desktop/src'
            source.mkdir(parents=True)
            (source / 'new.ts').write_text('untracked source')
            self.assertEqual(walk_source(root, 'apps/desktop/src', {'.ts'}), ['apps/desktop/src/new.ts'])
            (source / 'private.db').write_text('disallowed')
            with self.assertRaises(ValueError):
                walk_source(root, 'apps/desktop/src', {'.ts'})
            (source / 'private.db').unlink()
            (source / 'escape.ts').symlink_to(root / 'outside.ts')
            with self.assertRaises(ValueError):
                walk_source(root, 'apps/desktop/src', {'.ts'})


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        unittest.main(argv=['create-windows-handoff.py'], exit=True)
    else:
        create_bundle(Path(__file__).resolve().parent.parent)
