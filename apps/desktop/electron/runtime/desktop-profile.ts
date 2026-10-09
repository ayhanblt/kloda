import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';

export const desktopDisplayName = 'Kloda: Secure Photos & Sync';
export const desktopProfiles = {
  development: { applicationId: 'com.kloda.desktop.dev' },
  production: { applicationId: 'com.kloda.desktop' },
} as const;
export type DesktopProfile = typeof desktopProfiles[keyof typeof desktopProfiles];

export function selectDesktopProfile(metadata: unknown, packaged: boolean): DesktopProfile {
  if (!metadata || typeof metadata !== 'object') throw new Error('Missing desktop package metadata.');
  const value = metadata as Record<string, unknown>;
  if (value.profile !== 'development' && value.profile !== 'production') {
    throw new Error('Invalid desktop package profile.');
  }
  const profile = desktopProfiles[value.profile];
  if (value.applicationId !== profile.applicationId) throw new Error('Desktop package identity mismatch.');
  if (!packaged && value.profile !== 'development') {
    throw new Error('Production requires an explicitly built package.');
  }
  return profile;
}

interface DesktopApplication {
  isPackaged: boolean;
  getAppPath(): string;
  getPath(name: 'appData' | 'exe'): string;
  setPath(name: 'userData' | 'sessionData', path: string): void;
  setName(name: string): void;
  setAppUserModelId(id: string): void;
}

export function initializeDesktopProfile(app: DesktopApplication): DesktopProfile {
  const pkg = JSON.parse(readFileSync(join(app.getAppPath(), 'package.json'), 'utf8')) as {
    klodaDesktop?: unknown;
  };
  const profile = selectDesktopProfile(pkg.klodaDesktop, app.isPackaged);
  if (app.isPackaged && process.platform === 'darwin') {
    const info = join(dirname(app.getPath('exe')), '..', 'Info.plist');
    const bundleId = execFileSync('/usr/bin/plutil', ['-extract', 'CFBundleIdentifier', 'raw', '-o', '-', info], {
      encoding: 'utf8',
    }).trim();
    if (bundleId !== profile.applicationId) throw new Error('Mac bundle identity does not match desktop profile.');
  }
  // Never use Electron's package-name-derived directory, or migrate an old one.
  // Resolve the parent, but reject profile-directory redirects into another profile.
  // Windows authority must not live in Electron's default roaming AppData.
  // Native preparation independently checks the real KnownFolder, not this environment value.
  const appData = process.platform === 'win32' ? process.env.LOCALAPPDATA : app.getPath('appData');
  if (!appData || !isAbsolute(appData)) throw new Error('Local desktop application data is unavailable.');
  mkdirSync(appData, { recursive: true });
  const directory = join(realpathSync(appData), profile.applicationId);
  mkdirSync(directory, { recursive: true });
  if (realpathSync(directory) !== directory) throw new Error('Desktop profile directory must not be redirected.');
  app.setName(desktopDisplayName);
  app.setPath('userData', directory);
  app.setPath('sessionData', directory);
  if (process.platform === 'win32') app.setAppUserModelId(profile.applicationId);
  return profile;
}
