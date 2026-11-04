import { requireOptionalNativeModule } from 'expo';
import { object, text } from './ftps';
import { ftpsPageFromNative, type FtpsItem } from './ftps-backups';
import type { S3Provider } from './s3';
export type S3Item = FtpsItem;
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
interface NativeItems {
  reviewS3(provider: S3Provider, id: string, request: string): Promise<unknown>;
  cancelS3Test(request: string): Promise<void>;
  s3Backups(provider: S3Provider, after: string, issues: boolean): Promise<unknown>;
  restoreS3File(provider: S3Provider, id: string, request: string): Promise<unknown>;
  restoreS3Photos(provider: S3Provider, id: string, request: string): Promise<unknown>;
  cancelS3Restore(request: string): Promise<void>;
}
function native() { const value = requireOptionalNativeModule<NativeItems>('KlodaS3'); if (!value?.s3Backups) throw new Error('native_unavailable'); return value; }
export const s3Backups = {
  async list(provider: S3Provider, after = '', issues = false) {
    if (after) text(after,uuid);
    const result = object(await native().s3Backups(provider,after,issues),['provider','page']);
    if (result.provider !== provider) throw new Error('outcome_unknown');
    return ftpsPageFromNative(result.page);
  },
  async restore(provider: S3Provider, item: S3Item, request: string) {
    text(item.id,uuid); text(request,uuid);
    if (!['file','photo_manifest'].includes(item.kind)) throw new Error('invalid_request');
    const value = object(await (item.kind === 'file' ? native().restoreS3File(provider,item.id,request) : native().restoreS3Photos(provider,item.id,request)),['id','state','name']);
    if (value.id !== item.id || value.state !== 'completed' || typeof value.name !== 'string' || !value.name) throw new Error('outcome_unknown');
    return value.name;
  },
  async copy(provider: S3Provider, id: string, request: string) {
    text(id,uuid); text(request,uuid);
    if (provider !== 'amazon-s3') throw new Error('provider_verification_required');
    const value = object(await native().reviewS3(provider,id,request),['id','state','path']);
    text(value.id,uuid);
    if (value.id === id || value.state !== 'completed' || typeof value.path !== 'string' || !value.path) throw new Error('outcome_unknown');
    return value.path;
  },
  async cancel(request: string, review = false) { text(request,uuid); await (review ? native().cancelS3Test(request) : native().cancelS3Restore(request)); },
};
