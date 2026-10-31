import { requireOptionalNativeModule } from 'expo';
import type { FileJobState } from './file-transfer';

export interface GallerySource { id: string; displayName: string }
export interface GalleryAsset {
  id: string; name: string; width: number; height: number; video: boolean; favorite?: boolean; created?: string;
}
export interface GalleryPage { permission: 'granted' | 'limited' | 'denied'; items: GalleryAsset[]; hasMore: boolean; scopeUnavailable?: boolean }
export interface GalleryHistory { recordId: string; state: FileJobState; kind: 'media' | 'manifest' }
interface NativeGallery {
  loadPhotoSources(): Promise<unknown>;
  galleryPage(source: string, offset: number): Promise<unknown>;
  galleryPreview(source: string, asset: string, detail: boolean): Promise<unknown>;
  galleryHistory(source: string, asset: string): Promise<unknown>;
}
const states = ['queued', 'preparing', 'uploading', 'finalizing', 'completed', 'paused', 'blocked', 'owner_deleted'];
function invalid(): never { throw new Error('gallery_invalid'); }
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.length || value.length > 4096 || Array.from(value).some((char) => char.charCodeAt(0) < 32)) return invalid();
  return value;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function native(): NativeGallery {
  const module = requireOptionalNativeModule<NativeGallery>('KlodaSyncRuntime');
  if (!module?.galleryPage || !module.galleryPreview || !module.galleryHistory) throw new Error('gallery_unavailable');
  return module;
}
export function galleryPageFromNative(value: unknown): GalleryPage {
  const row = object(value);
  if (typeof row.permission !== 'string' || !['granted', 'limited', 'denied'].includes(row.permission) || typeof row.hasMore !== 'boolean'
    || !Array.isArray(row.items) || row.items.length > 24) return invalid();
  if (row.scopeUnavailable !== undefined && typeof row.scopeUnavailable !== 'boolean') return invalid();
  if (row.scopeUnavailable && (row.permission !== 'limited' || row.items.length || row.hasMore)) return invalid();
  if (row.permission === 'denied' && (row.items.length || row.hasMore)) return invalid();
  const items = row.items.map((item): GalleryAsset => {
    const asset = object(item);
    if (![asset.width, asset.height].every((n) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0)
      || typeof asset.video !== 'boolean' || (asset.favorite !== undefined && typeof asset.favorite !== 'boolean')) return invalid();
    if (asset.created !== undefined && (typeof asset.created !== 'string' || !/^-?(0|[1-9]\d{0,15})$/.test(asset.created)
      || Math.abs(Number(asset.created)) > 8640000000000000)) return invalid();
    return { id: text(asset.id), name: text(asset.name), width: asset.width as number, height: asset.height as number,
      video: asset.video, favorite: asset.favorite as boolean | undefined, created: asset.created as string | undefined };
  });
  if (new Set(items.map(({ id }) => id)).size !== items.length || (row.hasMore && items.length !== 24)) return invalid();
  return { permission: row.permission as GalleryPage['permission'], items, hasMore: row.hasMore, scopeUnavailable: row.scopeUnavailable as boolean | undefined };
}
export function galleryHistoryFromNative(value: unknown): GalleryHistory[] {
  if (!Array.isArray(value) || value.length > 16) return invalid();
  return value.map((entry) => {
    const row = object(entry);
    if (typeof row.state !== 'string' || !states.includes(row.state) || typeof row.kind !== 'string' || !['media', 'manifest'].includes(row.kind)) return invalid();
    return { recordId: text(row.recordId), state: row.state as FileJobState, kind: row.kind as GalleryHistory['kind'] };
  });
}
export const gallery = {
  async sources(): Promise<GallerySource[]> {
    const value = await native().loadPhotoSources();
    if (!Array.isArray(value)) return invalid();
    const rows = value.map((item) => { const row = object(item); if (row.kind !== 'photos') return invalid();
      return { id: text(row.id), displayName: text(row.displayName) }; });
    if (new Set(rows.map(({ id }) => id)).size !== rows.length) return invalid();
    return rows;
  },
  async page(source: string, offset: number): Promise<GalleryPage> {
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 2147483623) return invalid();
    return galleryPageFromNative(await native().galleryPage(text(source), offset));
  },
  async preview(source: string, asset: string, detail = false): Promise<string | null> {
    const value = await native().galleryPreview(text(source), text(asset), detail);
    if (value === null) return null;
    if (typeof value !== 'string' || value.length > 1398128 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return invalid();
    return value;
  },
  async history(source: string, asset: string): Promise<GalleryHistory[]> {
    return galleryHistoryFromNative(await native().galleryHistory(text(source), text(asset)));
  },
};
