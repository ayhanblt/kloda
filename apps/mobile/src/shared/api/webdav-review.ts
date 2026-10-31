import { requireOptionalNativeModule } from 'expo';

export interface WebDavIssue {
  id: string; targetId: string; sourceId: string; name: string; relativePath: string; publishedPath?: string;
  kind: 'file' | 'photo_resource' | 'photo_manifest' | 'unknown'; phase: 'prepared' | 'uploaded' | 'moving' | 'moved' | 'conflict';
  requiresAuthorization?: boolean; skipped: boolean; errorCode: string; canRecheck: boolean; canKeepBoth: boolean;
}
export interface WebDavIssues { items: WebDavIssue[]; hasMore: boolean; nextCursor?: string; errorCode?: string }
interface NativeReview {
  webDavIssues(after: string): Promise<unknown>;
  reviewWebDav(id: string, action: string, request: string): Promise<unknown>;
  cancelWebDavReview(request: string): Promise<void>;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const target = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
const code = /^[a-z][a-z0-9_]{0,127}$/;
function invalid(): never { throw new Error('outcome_unknown'); }
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((key) => !keys.includes(key))) return invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown, pattern: RegExp): string { return typeof value === 'string' && pattern.test(value) ? value : invalid(); }
function controls(value: string): boolean { return Array.from(value).some((char) => { const n = char.charCodeAt(0); return n < 32 || (n >= 127 && n <= 159); }); }
function path(value: unknown): string {
  if (typeof value !== 'string' || value.length > 8192 || (value.includes('\\') || controls(value))) return invalid();
  const parts = value.split('/');
  if (!uuid.test(parts[0]) || parts.length < 2 || parts.some((item) => !item || item === '.' || item === '..')) return invalid();
  return value;
}
function native(): NativeReview {
  const module = requireOptionalNativeModule<NativeReview>('KlodaBackup');
  if (!module?.webDavIssues || !module.reviewWebDav || !module.cancelWebDavReview) throw new Error('native_unsupported');
  return module;
}
export function webDavIssuesFromNative(value: unknown): WebDavIssues {
  const row = object(value, ['items', 'hasMore', 'nextCursor', 'errorCode']);
  if (!Array.isArray(row.items) || row.items.length > 100 || typeof row.hasMore !== 'boolean') return invalid();
  const items = row.items.map((item): WebDavIssue => {
    const raw = object(item, ['id', 'targetId', 'sourceId', 'name', 'relativePath', 'publishedPath', 'kind', 'phase', 'skipped', 'errorCode', 'canRecheck', 'canKeepBoth', 'requiresAuthorization']);
    if ((raw.requiresAuthorization !== undefined && typeof raw.requiresAuthorization !== 'boolean') || !['file', 'photo_resource', 'photo_manifest', 'unknown'].includes(raw.kind as string)
      || !['prepared', 'uploaded', 'moving', 'moved', 'conflict'].includes(raw.phase as string)
      || [raw.skipped, raw.canRecheck, raw.canKeepBoth].some((flag) => typeof flag !== 'boolean')
      || typeof raw.name !== 'string' || !raw.name.length || raw.name.length > 255 || (raw.name.includes('/') || raw.name.includes('\\') || controls(raw.name))) return invalid();
    const sourceId = text(raw.sourceId, uuid), relativePath = path(raw.relativePath);
    const publishedPath = raw.publishedPath === undefined ? undefined : path(raw.publishedPath);
    if (!relativePath.startsWith(`${sourceId}/`) || (publishedPath && publishedPath.split('/').slice(0, -1).join('/') !== relativePath.split('/').slice(0, -1).join('/'))
      || (raw.requiresAuthorization && !raw.canRecheck)
      || (raw.skipped && (raw.canRecheck || raw.canKeepBoth))
      || (raw.canKeepBoth && (!raw.canRecheck || raw.errorCode !== 'conflict' || !['uploaded', 'moving'].includes(raw.phase as string)))) return invalid();
    return { id: text(raw.id, uuid), targetId: text(raw.targetId, target), sourceId, name: raw.name, relativePath, publishedPath,
      requiresAuthorization: raw.requiresAuthorization === true, kind: raw.kind as WebDavIssue['kind'], phase: raw.phase as WebDavIssue['phase'], skipped: raw.skipped as boolean,
      canRecheck: raw.canRecheck as boolean, canKeepBoth: raw.canKeepBoth as boolean, errorCode: text(raw.errorCode, code) };
  });
  if (new Set(items.map(({ id }) => id)).size !== items.length || row.hasMore !== (row.nextCursor !== undefined)
    || (row.hasMore && (items.length !== 100 || row.nextCursor !== items[99].id))) return invalid();
  return { items, hasMore: row.hasMore, nextCursor: row.nextCursor === undefined ? undefined : text(row.nextCursor, uuid),
    errorCode: row.errorCode === undefined ? undefined : text(row.errorCode, code) };
}
export const webDavReview = {
  async items(after = ''): Promise<WebDavIssues> {
    if (after) text(after, uuid);
    return webDavIssuesFromNative(await native().webDavIssues(after));
  },
  async act(id: string, action: 'recheck' | 'keep_both' | 'skip' | 'authorize_recheck' | 'authorize_keep_both', request: string): Promise<'completed' | 'skipped'> {
    text(id, uuid); text(request, uuid);
    const value = object(await native().reviewWebDav(id, action, request), ['state']);
    if (value.state !== 'completed' && value.state !== 'skipped') return invalid();
    if ((action === 'skip') !== (value.state === 'skipped')) return invalid();
    return value.state;
  },
  async cancel(request: string): Promise<void> { text(request, uuid); await native().cancelWebDavReview(request); },
};
