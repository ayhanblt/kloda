import { execFileSync } from 'node:child_process';
import { hostname } from 'node:os';

export function resolveDesktopDeviceName(): string {
  if (process.platform === 'darwin') {
    try {
      const macName = execFileSync('scutil', ['--get', 'ComputerName'], {
        encoding: 'utf8',
        timeout: 1000,
      }).trim();
      if (macName.length > 0) return macName;
    } catch {
      // Fallback to OS hostname when ComputerName lookup is unavailable.
    }
  }
  const host = hostname().replace(/\.local$/i, '').trim();
  return host.length > 0 ? host : 'Computer';
}
