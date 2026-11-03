import { requireOptionalNativeModule } from 'expo';

export interface WebDavBackup { id: string; sourceId: string; name: string; kind: 'file' | 'photo_manifest'; sha256: string; size: string }
export interface WebDavBackups { targetId: string; items: WebDavBackup[]; hasMore: boolean; nextCursor?: string; canRestoreFiles: boolean; canRestorePhotos: boolean }
interface NativeBackups {
  webDavBackups(after: string, target: string): Promise<unknown>;
  restoreWebDavPhotos?(id: string, request: string, target: string): Promise<unknown>;
  restoreWebDavFile?(id: string, request: string, target: string): Promise<unknown>;
  cancelWebDavRestore?(request: string): Promise<void>;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hash = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
function invalid(): never { throw new Error('outcome_unknown'); }
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((key) => !keys.includes(key))) return invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown, pattern: RegExp): string { return typeof value === 'string' && pattern.test(value) ? value : invalid(); }
function name(value: unknown): string {
  if (typeof value !== 'string' || !value.length || value.length > 255 || value === '.' || value === '..'
    || Array.from(value).some((char) => char === '/' || char === '\\' || char.charCodeAt(0) < 32 || (char.charCodeAt(0) >= 127 && char.charCodeAt(0) <= 159))) return invalid();
  return value;
}
function native(): NativeBackups {
  const value = requireOptionalNativeModule<NativeBackups>('KlodaBackup');
  if (!value?.webDavBackups) throw new Error('native_unsupported');
  return value;
}
export function webDavBackupsFromNative(value: unknown): WebDavBackups {
  const row = object(value, ['targetId', 'items', 'hasMore', 'nextCursor', 'canRestoreFiles', 'canRestorePhotos']);
  if (!Array.isArray(row.items) || row.items.length > 100 || [row.hasMore, row.canRestoreFiles, row.canRestorePhotos].some((flag) => typeof flag !== 'boolean')
    || row.hasMore !== (row.nextCursor !== undefined)) return invalid();
  const items = row.items.map((value): WebDavBackup => {
    const item = object(value, ['id', 'sourceId', 'name', 'kind', 'sha256', 'size']);
    if (!['file', 'photo_manifest'].includes(item.kind as string)) return invalid();
    const size = text(item.size, /^(0|[1-9][0-9]{0,18})$/);
    if (BigInt(size) > 9223372036854775807n) return invalid();
    return { id: text(item.id, uuid), sourceId: text(item.sourceId, uuid), name: name(item.name), kind: item.kind as WebDavBackup['kind'], sha256: text(item.sha256, hash), size };
  });
  if (new Set(items.map(({ id }) => id)).size !== items.length) return invalid();
  return { targetId: text(row.targetId, hash), items, hasMore: row.hasMore as boolean,
    nextCursor: row.nextCursor === undefined ? undefined : text(row.nextCursor, uuid), canRestoreFiles: row.canRestoreFiles as boolean, canRestorePhotos: row.canRestorePhotos as boolean };
}
// `target` '' is the original WebDAV entry; an added destination's targetId binds the list and restores to it (18B/5r).
export const webDavBackups = {
  async list(after = '', target = '') {
    if (after) text(after, uuid);
    if (target) text(target, hash);
    const value = webDavBackupsFromNative(await native().webDavBackups(after, target));
    return target && value.targetId !== target ? invalid() : value;
  },
  async restoreFile(id: string, request: string, target = ''): Promise<{ name: string }> {
    text(id, uuid); text(request, uuid); if (target) text(target, hash);
    const module = native(); if (!module.restoreWebDavFile) throw new Error('native_unsupported');
    const value = object(await module.restoreWebDavFile(id, request, target), ['id', 'state', 'name']);
    if (value.id !== id || value.state !== 'completed') return invalid();
    return { name: name(value.name) };
  },
  async restorePhotos(id: string, request: string, target = ''): Promise<{ name: string }> {
    text(id, uuid); text(request, uuid); if (target) text(target, hash);
    const module = native(); if (!module.restoreWebDavPhotos) throw new Error('native_unsupported');
    const value = object(await module.restoreWebDavPhotos(id, request, target), ['id', 'state', 'name']);
    if (value.id !== id || value.state !== 'completed') return invalid();
    return { name: name(value.name) };
  },
  async cancel(request: string) { text(request, uuid); await native().cancelWebDavRestore?.(request); },
};
