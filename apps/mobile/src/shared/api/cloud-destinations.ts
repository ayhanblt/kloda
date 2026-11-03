import { requireOptionalNativeModule } from 'expo';

// Step18A/4 (ADR0027) and 18B/1 (ADR0028): saved DAV and OAuth destinations. Saving is not enabling (ADR0023); an enabled
// DAV destination gets its own queue plan (18A/3). OAuth destinations cannot be enabled until their upload adapters exist.
// For an OAuth destination `username` carries the provider's account ID and `endpoint` the fixed API origin.
export const cloudProviders = ['webdav', 'nextcloud', 'cloudme', 'kolab-now', 'dropbox', 'onedrive', 'yandex', 'google-drive'] as const;
export const oauthProviders = ['dropbox', 'onedrive', 'yandex', 'google-drive'] as const;
export type OAuthProvider = typeof oauthProviders[number];
export type CloudProvider = typeof cloudProviders[number];
export const runStates = ['running', 'waiting', 'paused', 'finished', 'needs_attention', 'exhausted'] as const;
export interface DestinationRun { state: typeof runStates[number]; errorCode?: string }
// `run` is the latest queue run of an added DAV destination (18A/4c); the original WebDAV run stays in KlodaBackup.
export interface CloudDestination { targetId: string; provider: CloudProvider; endpoint: string; targetPath: string; username: string; enabled: boolean; run?: DestinationRun }
interface NativeCloud {
  destinations(): Promise<unknown>;
  signInNextcloud(server: string, folder: string): Promise<unknown>;
  signInOAuth(provider: OAuthProvider, folder: string): Promise<unknown>;
  cancelSignIn(): Promise<void>;
  addKolabNow(username: string, password: string, folder: string): Promise<unknown>;
  removeDestination(targetId: string): Promise<unknown>;
  setDestinationEnabled(targetId: string, enabled: boolean): Promise<unknown>;
  runDestination(targetId: string): Promise<unknown>;
  pauseDestination(targetId: string): Promise<unknown>;
}
export const destinationLimit = 8;
// ADR0027 §6: CloudMe answers only with Digest (probed 2026-11-01); no auth downgrade, so it has no add path.
export const blockedProviders: readonly CloudProvider[] = ['cloudme'];
// User decision 2026-11-03: Kolab Now is out of V1 and not offered; its native add path stays, unreachable.
export const hiddenProviders = ['kolab-now'] as const;
const targetPattern = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
const keys = ['targetId', 'provider', 'endpoint', 'targetPath', 'username', 'enabled'];
// The providers the queue uploads to: DAV, and Dropbox since 18B/5 (user decision 2026-11-03). The original WebDAV
// entry is enabled from its own screen.
export const enableableProviders: readonly CloudProvider[] = ['nextcloud', 'kolab-now', 'dropbox'];
function invalid(): never { throw new Error('outcome_unknown'); }
function native(): NativeCloud {
  const value = requireOptionalNativeModule<NativeCloud>('KlodaCloud');
  if (!value) throw new Error('native_unsupported');
  return value;
}
function text(value: unknown, max = 8192): string {
  return typeof value === 'string' && value.length > 0 && value.length <= max && !value.includes('\u0000') ? value : invalid();
}
export function cloudDestinationFromNative(value: unknown): CloudDestination {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== keys.length + ('run' in row ? 1 : 0) || keys.some((key) => !(key in row))) return invalid();
  const provider = row.provider as CloudProvider;
  if (!cloudProviders.includes(provider)) return invalid();
  const endpoint = text(row.endpoint);
  if (!endpoint.startsWith('https://')) return invalid();
  const targetId = text(row.targetId, 43);
  if (!targetPattern.test(targetId)) return invalid();
  if (typeof row.enabled !== 'boolean' || (row.enabled && !enableableProviders.includes(provider))) return invalid();
  const result: CloudDestination = { targetId, provider, endpoint, targetPath: text(row.targetPath), username: text(row.username), enabled: row.enabled };
  if ('run' in row) result.run = runFromNative(row.run, provider);
  return result;
}
function runFromNative(value: unknown, provider: CloudProvider): DestinationRun {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !enableableProviders.includes(provider)) return invalid();
  const { state, errorCode } = value as Record<string, unknown>;
  if (!runStates.includes(state as DestinationRun['state'])) return invalid();
  return errorCode === undefined ? { state: state as DestinationRun['state'] } : { state: state as DestinationRun['state'], errorCode: text(errorCode, 64) };
}
function list(value: unknown): CloudDestination[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== 1 || !Array.isArray(row.destinations) || row.destinations.length > destinationLimit) return invalid();
  const result = row.destinations.map(cloudDestinationFromNative);
  if (new Set(result.map((item) => item.targetId)).size !== result.length) return invalid();
  return result;
}
// Same HTTPS shape the native side accepts; native validation stays authoritative.
export function validateNextcloudServer(server: string): string {
  const value = server.trim();
  if (!/^https:\/\/[^/?#@\s]+(\/[^?#\s]*)?$/i.test(value) || /(^|\/)\.\.?(\/|$)/.test(value.slice(8))) throw new Error('webdav_fields');
  return value;
}
export function validateFolder(folder: string): string {
  const parts = folder.split('/').filter(Boolean);
  if (parts.length === 0 || folder.includes('\\') || parts.some((part) => part === '.' || part === '..')) throw new Error('webdav_fields');
  return parts.join('/');
}
export function validateCredentials(username: string, password: string): [string, string] {
  const name = username.trim();
  if (!name || name.includes(':') || !password || [name, password].some((value) => value.includes('\u0000'))) throw new Error('webdav_fields');
  return [name, password];
}
export const cloudDestinations = {
  async list(): Promise<CloudDestination[]> { return list(await native().destinations()); },
  async signInNextcloud(server: string, folder: string): Promise<CloudDestination> {
    return cloudDestinationFromNative(await native().signInNextcloud(validateNextcloudServer(server), validateFolder(folder)));
  },
  async signInOAuth(provider: OAuthProvider, folder: string): Promise<CloudDestination> {
    if (!oauthProviders.includes(provider)) throw new Error('invalid_request');
    const value = cloudDestinationFromNative(await native().signInOAuth(provider, validateFolder(folder)));
    return value.provider === provider ? value : invalid();
  },
  async cancelSignIn(): Promise<void> { await native().cancelSignIn(); },
  async addKolabNow(username: string, password: string, folder: string): Promise<CloudDestination> {
    const [name, secret] = validateCredentials(username, password);
    return cloudDestinationFromNative(await native().addKolabNow(name, secret, validateFolder(folder)));
  },
  async remove(targetId: string): Promise<CloudDestination[]> {
    if (!targetPattern.test(targetId)) throw new Error('invalid_request');
    return list(await native().removeDestination(targetId));
  },
  async setEnabled(targetId: string, enabled: boolean): Promise<CloudDestination[]> {
    if (!targetPattern.test(targetId) || typeof enabled !== 'boolean') throw new Error('invalid_request');
    const value = list(await native().setDestinationEnabled(targetId, enabled));
    return value.find((item) => item.targetId === targetId)?.enabled === enabled ? value : invalid();
  },
  async runNow(targetId: string): Promise<CloudDestination[]> {
    if (!targetPattern.test(targetId)) throw new Error('invalid_request');
    return list(await native().runDestination(targetId));
  },
  async pause(targetId: string): Promise<CloudDestination[]> {
    if (!targetPattern.test(targetId)) throw new Error('invalid_request');
    return list(await native().pauseDestination(targetId));
  },
};
