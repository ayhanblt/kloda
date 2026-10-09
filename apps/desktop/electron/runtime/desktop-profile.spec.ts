import { existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { initializeDesktopProfile, selectDesktopProfile } from './desktop-profile.js';

const roots: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(applicationId = 'com.kloda.desktop.dev') {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'kloda-profile-')));
  roots.push(root);
  if (process.platform === 'win32') vi.stubEnv('LOCALAPPDATA', root);
  const packagePath = join(root, 'package');
  mkdirSync(packagePath);
  writeFileSync(join(packagePath, 'package.json'), JSON.stringify({
    klodaDesktop: { profile: 'development', applicationId },
  }));
  const setPath = vi.fn();
  const app = {
    isPackaged: false,
    getAppPath: () => packagePath,
    getPath: () => root,
    setPath,
    setName: vi.fn(),
    setAppUserModelId: vi.fn(),
  };
  return { root, app, setPath };
}

describe('desktop profile isolation', () => {
  it('requires explicit matching metadata and a built package for production', () => {
    expect(() => selectDesktopProfile(undefined, false)).toThrow();
    expect(() => selectDesktopProfile({ profile: 'development', applicationId: 'com.kloda.desktop' }, true)).toThrow();
    expect(() => selectDesktopProfile({ profile: 'production', applicationId: 'com.kloda.desktop.dev' }, true)).toThrow();
    const production = { profile: 'production', applicationId: 'com.kloda.desktop' };
    expect(() => selectDesktopProfile(production, false)).toThrow();
    expect(selectDesktopProfile(production, true).applicationId).toBe('com.kloda.desktop');
  });

  it('opens only the development namespace without adopting old or production data', () => {
    const { root, app } = fixture();
    for (const name of ['@kloda', 'com.kloda.desktop']) {
      mkdirSync(join(root, name));
      writeFileSync(join(root, name, 'sync.sqlite'), 'retained');
    }
    initializeDesktopProfile(app);
    const development = join(root, 'com.kloda.desktop.dev');
    expect(existsSync(development)).toBe(true);
    expect(existsSync(join(development, 'sync.sqlite'))).toBe(false);
    expect(readFileSync(join(root, 'com.kloda.desktop', 'sync.sqlite'), 'utf8')).toBe('retained');
    expect(readFileSync(join(root, '@kloda', 'sync.sqlite'), 'utf8')).toBe('retained');
  });

  it('rejects package mismatch before opening a data namespace', () => {
    const { root, app } = fixture('com.kloda.desktop');
    expect(() => initializeDesktopProfile(app)).toThrow();
    expect(existsSync(join(root, 'com.kloda.desktop.dev'))).toBe(false);
    expect(existsSync(join(root, 'com.kloda.desktop'))).toBe(false);
  });

  it('rejects a profile directory redirected to production', () => {
    const { root, app } = fixture();
    const production = join(root, 'com.kloda.desktop');
    mkdirSync(production);
    symlinkSync(production, join(root, 'com.kloda.desktop.dev'), 'junction');
    expect(() => initializeDesktopProfile(app)).toThrow();
    expect(realpathSync(join(root, 'com.kloda.desktop.dev'))).toBe(realpathSync(production));
  });

});
