import type { App } from 'electron';
import { constants, closeSync, fstatSync, ftruncateSync, mkdirSync, openSync, readFileSync, writeSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';

export const backgroundLaunchArgument = '--kloda-background';
export interface AutoStartStatus { enabled: boolean; supported: boolean; reason?: 'unpackaged' | 'unsupported' | 'os_blocked' | 'unavailable' | 'external_entry' | 'desktop_policy' }
type AutostartStatus = AutoStartStatus;

interface AutostartOptions {
  app: Pick<App, 'isPackaged' | 'getLoginItemSettings' | 'setLoginItemSettings'>;
  platform?: NodeJS.Platform;
  executablePath?: string;
  configDirectory?: string;
  environment?: NodeJS.ProcessEnv;
  registrationId?: string;
}

export class DesktopAutostart {
  private readonly platform: NodeJS.Platform;
  private readonly executable: string;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly file: string;

  constructor(private readonly options: AutostartOptions) {
    this.platform = options.platform ?? process.platform;
    this.executable = options.executablePath ?? process.execPath;
    this.environment = options.environment ?? process.env;
    const configured = options.configDirectory ?? this.environment.XDG_CONFIG_HOME;
    const directory = configured && isAbsolute(configured) ? configured : join(homedir(), '.config');
    const registrationId = options.registrationId ?? 'com.kloda.desktop';
    if (!/^com\.kloda\.desktop(?:\.dev)?$/u.test(registrationId)) throw new Error('Invalid autostart registration ID');
    this.file = join(directory, 'autostart', `${registrationId}.autostart.desktop`);
  }

  status(): AutostartStatus {
    const unsupported = this.unsupported();
    if (unsupported) return { enabled: false, supported: false, reason: unsupported };
    try {
      if (this.platform === 'linux') return this.linuxStatus();
      const settings = this.options.app.getLoginItemSettings(this.loginOptions());
      if (this.platform === 'darwin') {
        const enabled = settings.openAtLogin && settings.status === 'enabled';
        return { supported: true, enabled, ...(!enabled && (settings.openAtLogin || settings.status === 'requires-approval' || settings.status === 'not-found')
          ? { reason: 'os_blocked' } : {}) };
      }
      const enabled = settings.openAtLogin && settings.launchItems.some((item) => item.enabled
        && item.path === this.executable && item.args.length === 1 && item.args[0] === backgroundLaunchArgument);
      return { supported: true, enabled, ...(!enabled && settings.openAtLogin
        ? { reason: 'os_blocked' } : {}) };
    } catch {
      return { enabled: false, supported: false, reason: 'unavailable' };
    }
  }

  setEnabled(enabled: boolean): AutostartStatus {
    const unsupported = this.unsupported();
    if (unsupported) return { enabled: false, supported: false, reason: unsupported };
    try {
      if (this.platform === 'linux') {
        mkdirSync(join(this.file, '..'), { recursive: true });
        // Keep a disabled user entry so a system-wide entry cannot silently take over.
        let created = true;
        let fd: number;
        try { fd = openSync(this.file, constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600); }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
          created = false;
          fd = openSync(this.file, constants.O_RDWR | constants.O_NOFOLLOW);
        }
        try {
          if (!fstatSync(fd).isFile()) throw new Error('Not a regular file');
          if (!created && !readFileSync(fd, 'utf8').includes('\nX-Kloda-Autostart=true\n')) {
            return { enabled: false, supported: false, reason: 'external_entry' };
          }
          writeSync(fd, this.linuxEntry(enabled), 0, 'utf8');
          // Entries only vary in Hidden length; truncate the previous tail safely on this descriptor.
          ftruncateSync(fd, Buffer.byteLength(this.linuxEntry(enabled)));
        } finally { closeSync(fd); }
      } else this.options.app.setLoginItemSettings({ ...this.loginOptions(), openAtLogin: enabled });
      return this.status();
    } catch {
      return { ...this.status(), reason: 'os_blocked' };
    }
  }

  private unsupported(): AutoStartStatus['reason'] {
    if (!this.options.app.isPackaged) return 'unpackaged';
    if (!['win32', 'darwin', 'linux'].includes(this.platform)) return 'unsupported';
    if (!isAbsolute(this.executable) || /[\r\n\t=]/u.test(this.executable)) return 'unsupported';
    if (this.platform === 'linux' && !this.environment.XDG_CURRENT_DESKTOP) return 'unsupported';
    if (this.platform === 'linux' && (this.environment.APPIMAGE || this.executable.includes('/.mount_'))) return 'unsupported';
    return undefined;
  }

  private loginOptions() {
    return this.platform === 'win32' ? { path: this.executable, args: [backgroundLaunchArgument] } : {};
  }

  private linuxEntry(enabled: boolean): string {
    const quoted = this.executable.replace(/%/gu, '%%').replace(/[\\"`$]/gu, (character) => `\\${character}`).replace(/\\/gu, '\\\\');
    return `[Desktop Entry]\nType=Application\nName=Kloda\nExec="${quoted}" ${backgroundLaunchArgument}\nTerminal=false\nHidden=${!enabled}\nX-Kloda-Autostart=true\n`;
  }

  private readLinuxEntry(): string | null {
    let fd: number;
    try { fd = openSync(this.file, constants.O_RDONLY | constants.O_NOFOLLOW); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
    try {
      if (!fstatSync(fd).isFile()) throw new Error('Not a regular file');
      return readFileSync(fd, 'utf8');
    } finally { closeSync(fd); }
  }

  private linuxStatus(): AutostartStatus {
    const entry = this.readLinuxEntry();
    if (entry === null) return { enabled: false, supported: true };
    if (!entry.includes('\nX-Kloda-Autostart=true\n')) {
      return { enabled: false, supported: false, reason: 'external_entry' };
    }
    const values = new Map<string, string>();
    let section = '';
    for (const raw of entry.split('\n')) {
      const line = raw.trim();
      if (line.startsWith('[')) { section = line; continue; }
      if (section !== '[Desktop Entry]' || line.startsWith('#') || !line.includes('=')) continue;
      const separator = line.indexOf('=');
      const key = line.slice(0, separator);
      if (values.has(key)) throw new Error('Duplicate desktop entry key');
      values.set(key, line.slice(separator + 1));
    }
    const expectedExec = this.linuxEntry(true).split('\n').find((line) => line.startsWith('Exec='))!.slice(5);
    const desktops = (this.environment.XDG_CURRENT_DESKTOP ?? '').split(':');
    const only = values.get('OnlyShowIn')?.split(';');
    const excluded = values.get('NotShowIn')?.split(';');
    const enabled = values.get('Hidden') !== 'true' && values.get('X-GNOME-Autostart-enabled') !== 'false'
      && values.get('Type') === 'Application' && values.get('Exec') === expectedExec && !values.has('TryExec')
      && values.get('DBusActivatable') !== 'true'
      && (!only || only.some((desktop) => desktops.includes(desktop)))
      && (!excluded || !excluded.some((desktop) => desktops.includes(desktop)));
    return { enabled, supported: true, reason: enabled
      ? 'desktop_policy'
      : 'os_blocked' };
  }
}
