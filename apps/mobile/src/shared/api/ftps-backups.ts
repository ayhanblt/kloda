import { decimal, hasControl, object, ftpsNative, text } from './ftps';
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const hash = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
export interface FtpsItem { id: string; name: string; path: string; kind: 'file' | 'photo_manifest' | 'photo_resource'; sha256: string; size: string; errorCode?: string }
export interface FtpsPage { targetId: string; items: FtpsItem[]; hasMore: boolean; next?: string; canRestoreFiles: boolean; canRestorePhotos: boolean }
export function ftpsPageFromNative(raw: unknown): FtpsPage {
  const page = object(raw,['targetId','items','hasMore','next','canRestoreFiles','canRestorePhotos']);
  if (!Array.isArray(page.items) || page.items.length > 100 || [page.hasMore,page.canRestoreFiles,page.canRestorePhotos].some(v => typeof v !== 'boolean') || page.hasMore !== (page.next !== undefined)) throw new Error('outcome_unknown');
  const items = page.items.map((raw): FtpsItem => {
    const row = object(raw,['id','name','path','kind','sha256','size','errorCode']);
    if (!['file','photo_manifest','photo_resource'].includes(row.kind as string) || typeof row.name !== 'string' || !row.name || row.name === '.' || row.name === '..' || row.name.length > 255 || (hasControl(row.name) || /[/\\]/.test(row.name)) || typeof row.path !== 'string' || !row.path || row.path.length > 4096 || hasControl(row.path)) throw new Error('outcome_unknown');
    return { id: text(row.id,uuid), name: row.name, path: row.path, kind: row.kind as FtpsItem['kind'], sha256: text(row.sha256,hash), size: decimal(row.size), errorCode: row.errorCode === undefined ? undefined : text(row.errorCode,/^[a-z][a-z0-9_]{0,127}$/) };
  });
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('outcome_unknown');
  return { targetId:text(page.targetId,hash), items, hasMore: page.hasMore as boolean, next: page.next === undefined ? undefined : text(page.next,uuid), canRestoreFiles: page.canRestoreFiles as boolean, canRestorePhotos: page.canRestorePhotos as boolean };
}
export const ftpsBackups = {
  async list(after = '', issues = false) { if (after) text(after,uuid); return ftpsPageFromNative(await (issues ? ftpsNative().ftpsIssues(after) : ftpsNative().ftpsBackups(after))); },
  async restore(item: FtpsItem, request: string) {
    text(item.id,uuid); text(request,uuid); const native = ftpsNative();
    const result = object(await (item.kind === 'file' ? native.restoreFtpsFile(item.id,request) : native.restoreFtpsPhotos(item.id,request)), ['id','state','name']);
    if (result.id !== item.id || result.state !== 'completed' || typeof result.name !== 'string') throw new Error('outcome_unknown'); return result.name;
  },
  async copy(id: string, request: string) {
    text(id,uuid); text(request,uuid); const result = object(await ftpsNative().reviewFtps(id,request), ['id','state','path']);
    text(result.id,uuid); if (result.state !== 'completed' || typeof result.path !== 'string') throw new Error('outcome_unknown'); return result.path;
  },
  async cancel(request: string, review = false) { text(request,uuid); const native = ftpsNative(); await (review ? native.cancelFtpsReview(request) : native.cancelFtpsRestore(request)); },
};
