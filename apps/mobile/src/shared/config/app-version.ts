import appConfig from '../../../app.json';

/** Returns the configured version only when it is a non-empty string. */
export function parseConfiguredVersion(raw: unknown): string | null {
  return typeof raw === 'string' && raw.trim() !== '' ? raw : null;
}

/** Read-only app.json `expo.version`; not an installed/build/release version. */
export function configuredAppVersion(): string | null {
  return parseConfiguredVersion((appConfig as { expo?: { version?: unknown } }).expo?.version);
}
