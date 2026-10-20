// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, openSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { App } from 'electron';
import { backgroundLaunchArgument, DesktopAutostart } from './autostart.js';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, openSync: vi.fn(actual.openSync) };
});

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

function fixture(platform: NodeJS.Platform = 'linux', isPackaged = true, executablePath = '/opt/Kloda/kloda') {
  const directory = mkdtempSync(join(tmpdir(), 'kloda-autostart-'));
  directories.push(directory);
  const settings = { openAtLogin: false, status: 'not-registered', launchItems: [] };
  const app = {
    isPackaged,
    getLoginItemSettings: vi.fn(() => settings),
    setLoginItemSettings: vi.fn(),
  };
  const service = new DesktopAutostart({
    app: app as unknown as Pick<App, 'isPackaged' | 'getLoginItemSettings' | 'setLoginItemSettings'>,
    platform, executablePath, configDirectory: directory, environment: { XDG_CURRENT_DESKTOP: 'GNOME' },
  });
  return { service, app, settings, file: join(directory, 'autostart/com.kloda.desktop.autostart.desktop'), directory };
}

describe('DesktopAutostart', () => {
  it('never registers the development Electron executable', () => {
    const { service, app } = fixture('darwin', false);
    expect(service.setEnabled(true)).toEqual({ enabled: false, supported: false, reason: 'unpackaged' });
    expect(app.getLoginItemSettings).not.toHaveBeenCalled();
    expect(app.setLoginItemSettings).not.toHaveBeenCalled();
  });

  it('registers Windows background arguments and observes exact OS-approved launch entry', () => {
    const { service, app } = fixture('win32');
    app.getLoginItemSettings.mockReturnValue({ openAtLogin: true, status: '', launchItems: [
      { path: '/opt/Kloda/kloda', args: [backgroundLaunchArgument], enabled: true },
    ] } as never);
    expect(service.setEnabled(true).enabled).toBe(true);
    expect(app.setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: true, path: '/opt/Kloda/kloda', args: [backgroundLaunchArgument] });
    expect(app.getLoginItemSettings).toHaveBeenCalledWith({ path: '/opt/Kloda/kloda', args: [backgroundLaunchArgument] });
    app.getLoginItemSettings.mockReturnValue({ openAtLogin: true, launchItems: [
      { path: '/opt/Kloda/kloda', args: ['different'], enabled: true },
    ] } as never);
    expect(service.status()).toEqual({ enabled: false, supported: true, reason: 'os_blocked' });
  });

  it('reports macOS requires-approval instead of claiming enabled', () => {
    const { service, app, settings } = fixture('darwin');
    Object.assign(settings, { openAtLogin: true, status: 'requires-approval' });
    expect(service.setEnabled(true)).toEqual({ supported: true, enabled: false, reason: 'os_blocked' });
    expect(app.setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: true });
    settings.openAtLogin = false;
    expect(service.status().reason).toBe('os_blocked');
    settings.openAtLogin = true;
    settings.status = 'enabled';
    expect(service.status().enabled).toBe(true);
  });

  it('contains OS write failures and reads actual state again', () => {
    const { service, app } = fixture('darwin');
    app.setLoginItemSettings.mockImplementation(() => { throw new Error('denied'); });
    expect(service.setEnabled(true)).toEqual({ supported: true, enabled: false, reason: 'os_blocked' });
    app.getLoginItemSettings.mockImplementation(() => { throw new Error('denied'); });
    expect(service.status()).toEqual({ supported: false, enabled: false, reason: 'unavailable' });
  });

  it('writes only opt-in XDG entry, and leaves a disabled override when turned off', () => {
    const { service, file } = fixture();
    expect(service.status()).toEqual({ enabled: false, supported: true });
    expect(service.setEnabled(true)).toEqual({ enabled: true, supported: true, reason: 'desktop_policy' });
    expect(readFileSync(file, 'utf8')).toContain('Exec="/opt/Kloda/kloda" --kloda-background\n');
    expect(service.setEnabled(false).enabled).toBe(false);
    expect(readFileSync(file, 'utf8')).toContain('Hidden=true\n');
    expect(service.setEnabled(true).enabled).toBe(true);
  });

  it('observes GNOME, Hidden and desktop-environment overrides', () => {
    const { service, file } = fixture();
    service.setEnabled(true);
    const original = readFileSync(file, 'utf8');
    for (const override of ['X-GNOME-Autostart-enabled=false', 'OnlyShowIn=KDE;', 'NotShowIn=GNOME;', 'TryExec=/missing', 'DBusActivatable=true']) {
      writeFileSync(file, `${original}${override}\n`);
      expect(service.status().enabled).toBe(false);
    }
    writeFileSync(file, `${original}OnlyShowIn=GNOME;KDE;\n`);
    expect(service.status().enabled).toBe(true);
    writeFileSync(file, original.replace('Hidden=false', 'Hidden=true'));
    expect(service.status().enabled).toBe(false);
  });

  it('refuses external entries and symlinks without changing their contents', () => {
    const { service, file, directory } = fixture();
    service.setEnabled(true);
    writeFileSync(file, '[Desktop Entry]\nExec=/external\n');
    expect(service.setEnabled(false)).toEqual({ enabled: false, supported: false, reason: 'external_entry' });
    expect(readFileSync(file, 'utf8')).toBe('[Desktop Entry]\nExec=/external\n');
    rmSync(file);
    const target = join(directory, 'external');
    writeFileSync(target, 'preserved');
    symlinkSync(target, file);
    expect(service.setEnabled(true).enabled).toBe(false);
    expect(readFileSync(target, 'utf8')).toBe('preserved');
  });

  it('escapes desktop executable paths without command or field-code injection', () => {
    const { service, file } = fixture('linux', true, '/opt/Kloda $`"\\% /kloda');
    expect(service.setEnabled(true).enabled).toBe(true);
    expect(readFileSync(file, 'utf8')).toContain('Exec="/opt/Kloda \\\\$\\\\`\\\\"\\\\\\\\%% /kloda" --kloda-background');
    const invalid = fixture('linux', true, '/opt/Kloda\nExec=malicious');
    expect(invalid.service.setEnabled(true)).toEqual({ enabled: false, supported: false, reason: 'unsupported' });
  });

  it('isolates packaged development and production registrations', () => {
    const { service, directory, app, file } = fixture();
    expect(service.setEnabled(true).enabled).toBe(true);
    const development = new DesktopAutostart({ app: app as never, platform: 'linux',
      executablePath: '/opt/Kloda Dev/kloda', configDirectory: directory,
      environment: { XDG_CURRENT_DESKTOP: 'GNOME' }, registrationId: 'com.kloda.desktop.dev' });
    expect(development.status().enabled).toBe(false);
    development.setEnabled(false);
    expect(service.status().enabled).toBe(true);
    expect(readFileSync(file, 'utf8')).toContain('Hidden=false');
    expect(readFileSync(join(directory, 'autostart/com.kloda.desktop.dev.autostart.desktop'), 'utf8')).toContain('Hidden=true');
    expect(() => new DesktopAutostart({ app: app as never, registrationId: '../../external' })).toThrow('Invalid');
  });

  it('checks ownership on the opened file if another entry replaces the path', async () => {
    const { service, file } = fixture();
    service.setEnabled(true);
    const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
    let attempts = 0;
    vi.mocked(openSync).mockImplementation((...args: Parameters<typeof openSync>) => {
      if (args[0] === file && ++attempts === 2) {
        rmSync(file);
        writeFileSync(file, '[Desktop Entry]\nExec=/external-concurrent\n');
      }
      return actual.openSync(...args);
    });
    try {
      expect(service.setEnabled(false)).toEqual({ enabled: false, supported: false, reason: 'external_entry' });
      expect(readFileSync(file, 'utf8')).toBe('[Desktop Entry]\nExec=/external-concurrent\n');
    } finally { vi.mocked(openSync).mockImplementation(actual.openSync); }
  });

  it('rejects transient AppImage executables until a stable launcher is selected', () => {
    expect(fixture('linux', true, '/tmp/.mount_Kloda123/usr/kloda').service.setEnabled(true))
      .toEqual({ enabled: false, supported: false, reason: 'unsupported' });
    const { app } = fixture();
    const service = new DesktopAutostart({ app: app as never, platform: 'linux',
      executablePath: '/stable/looking/kloda', environment: { APPIMAGE: '/opt/Kloda.AppImage', XDG_CURRENT_DESKTOP: 'KDE' } });
    expect(service.status()).toEqual({ enabled: false, supported: false, reason: 'unsupported' });
  });
});
