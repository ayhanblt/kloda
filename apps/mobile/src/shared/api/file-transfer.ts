import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

export type FileJobState = 'queued' | 'preparing' | 'uploading' | 'finalizing' | 'completed' | 'paused' | 'blocked';
export interface FileJob {
  id: string;
  sourceId: string;
  name: string;
  recordId: string;
  state: FileJobState;
  acknowledgedBytes: string;
  totalBytes?: string;
  errorCode?: string;
}
export interface FileQueue {
  running: boolean;
  jobs: FileJob[];
  totalJobs: string;
  hasMore: boolean;
  errorCode?: string;
}
export interface CompletedBackup {
  id: string;
  name: string;
  sha256: string;
  size: string;
}
export interface CompletedBackups {
  items: CompletedBackup[];
  hasMore: boolean;
}
export interface PhotosImportStatus {
  state: 'idle' | 'pending' | 'completed' | 'review_required' | 'organization_review';
  total: string;
  completed: string;
  review: string;
}
export const photoManifestPrefix = 'kloda-photo-v1-';
interface NativeFiles {
  runFiles(record: string): Promise<unknown>;
  queueStatus(): Promise<unknown>;
  pauseFiles(): Promise<unknown>;
  listBackups(record: string, after: string | null): Promise<unknown>;
  restoreBackup(record: string, operation: string, sha256: string, size: string, name: string): Promise<unknown>;
  cancelRestore(): Promise<unknown>;
  photoImportStatus(): Promise<unknown>;
  restorePhotos(record: string, operation: string | null, sha256: string | null, size: string | null, name: string | null): Promise<unknown>;
}
const states: Record<FileJobState, true> = {
  queued: true, preparing: true, uploading: true, finalizing: true, completed: true, paused: true, blocked: true,
};
function decimal(value: unknown): string {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,18})$/.test(value)) throw new Error('outcome_unknown');
  return value;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 1024) throw new Error('outcome_unknown');
  return value;
}
// This boundary rejects contradictory native evidence instead of rendering invented completion.
export function fileQueueFromNative(value: unknown): FileQueue {
  if (typeof value !== 'object' || value === null || !('running' in value) || typeof value.running !== 'boolean'
    || !('jobs' in value) || !Array.isArray(value.jobs) || value.jobs.length > 100
    || !('totalJobs' in value) || !('hasMore' in value) || typeof value.hasMore !== 'boolean') throw new Error('outcome_unknown');
  const jobs: FileJob[] = value.jobs.map((job: unknown) => {
    if (typeof job !== 'object' || job === null || !('state' in job) || typeof job.state !== 'string'
      || !Object.prototype.hasOwnProperty.call(states, job.state)) throw new Error('outcome_unknown');
    const acknowledgedBytes = decimal('acknowledgedBytes' in job ? job.acknowledgedBytes : undefined);
    const totalBytes = 'totalBytes' in job && job.totalBytes != null ? decimal(job.totalBytes) : undefined;
    if ((totalBytes !== undefined && BigInt(acknowledgedBytes) > BigInt(totalBytes))
      || (job.state === 'completed' && (totalBytes === undefined || acknowledgedBytes !== totalBytes))) throw new Error('outcome_unknown');
    const recordId = text('recordId' in job ? job.recordId : undefined);
    if (!/^[A-Za-z0-9_-]{22}$/.test(recordId)) throw new Error('outcome_unknown');
    return {
      id: text('id' in job ? job.id : undefined), sourceId: text('sourceId' in job ? job.sourceId : undefined),
      name: text('name' in job ? job.name : undefined), recordId, state: job.state as FileJobState,
      acknowledgedBytes, totalBytes,
      errorCode: 'errorCode' in job && job.errorCode != null ? text(job.errorCode) : undefined,
    };
  });
  const totalJobs = decimal(value.totalJobs);
  if (BigInt(totalJobs) < BigInt(jobs.length) || value.hasMore !== (BigInt(totalJobs) > BigInt(jobs.length))
    || new Set(jobs.map(({ id }) => id)).size !== jobs.length) throw new Error('outcome_unknown');
  return { running: value.running, jobs, totalJobs, hasMore: value.hasMore,
    errorCode: 'errorCode' in value && value.errorCode != null ? text(value.errorCode) : undefined };
}
async function nativeCall(action: (native: NativeFiles) => Promise<unknown>): Promise<unknown> {
  if (Platform.OS !== 'android') throw new Error('native_unsupported');
  const native = requireOptionalNativeModule<NativeFiles>('KlodaPairing');
  if (!native) throw new Error('native_unsupported');
  return action(native);
}
function completedBackup(value: unknown): CompletedBackup {
  if (typeof value !== 'object' || value === null || !('id' in value) || !('name' in value)
    || !('sha256' in value) || !('size' in value)) throw new Error('outcome_unknown');
  const id = text(value.id);
  const name = text(value.name);
  const sha256 = text(value.sha256);
  const size = decimal(value.size);
  if (!/^[A-Za-z0-9_-]{21}[AQgw]$/.test(id) || !/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(sha256)
    || BigInt(size) > 9223372036854775807n || name.length > 255 || name === '.' || name === '..'
    || /[/\\]/.test(name)) throw new Error('outcome_unknown');
  for (const character of name) {
    const code = character.charCodeAt(0);
    if (code < 32 || code === 127) throw new Error('outcome_unknown');
  }
  return { id, name, sha256, size };
}
export function completedBackupsFromNative(value: unknown, after?: string): CompletedBackups {
  if (typeof value !== 'object' || value === null || !('items' in value) || !Array.isArray(value.items)
    || value.items.length > 32 || !('hasMore' in value) || value.hasMore !== (value.items.length === 32)) throw new Error('outcome_unknown');
  const items = value.items.map(completedBackup);
  let previous = after;
  for (const item of items) {
    if (previous !== undefined && previous >= item.id) throw new Error('outcome_unknown');
    previous = item.id;
  }
  return { items, hasMore: value.hasMore };
}
export function restoredBackupFromNative(value: unknown, expected: CompletedBackup): CompletedBackup {
  const restored = completedBackup(value);
  if (typeof value !== 'object' || value === null || !('state' in value) || value.state !== 'completed'
    || restored.id !== expected.id || restored.name !== expected.name || restored.sha256 !== expected.sha256
    || restored.size !== expected.size) throw new Error('outcome_unknown');
  return restored;
}
export function photosImportStatusFromNative(value: unknown): PhotosImportStatus {
  if (typeof value !== 'object' || value === null || !('state' in value) || typeof value.state !== 'string'
    || !['idle', 'pending', 'completed', 'review_required', 'organization_review'].includes(value.state)
    || !('total' in value) || !('completed' in value) || !('review' in value)) throw new Error('outcome_unknown');
  const total = decimal(value.total);
  const completed = decimal(value.completed);
  const review = decimal(value.review);
  if (BigInt(total) > 9223372036854775807n || BigInt(completed) + BigInt(review) > BigInt(total)
    || (value.state === 'idle' && total !== '0')
    || (value.state === 'completed' && (total === '0' || completed !== total || review !== '0'))
    || ((value.state === 'review_required' || value.state === 'organization_review') && review === '0')) throw new Error('outcome_unknown');
  return { state: value.state as PhotosImportStatus['state'], total, completed, review };
}
async function invoke(action: (native: NativeFiles) => Promise<unknown>): Promise<FileQueue> {
  return fileQueueFromNative(await nativeCall(action));
}
export const fileTransfer = {
  status: () => invoke((native) => native.queueStatus()),
  run: (recordId: string) => invoke((native) => native.runFiles(recordId)),
  pause: () => invoke((native) => native.pauseFiles()),
  list: async (recordId: string, after?: string) => completedBackupsFromNative(
    await nativeCall((native) => native.listBackups(recordId, after ?? null)), after),
  restore: async (recordId: string, backup: CompletedBackup) => restoredBackupFromNative(
    await nativeCall((native) => native.restoreBackup(recordId, backup.id, backup.sha256, backup.size, backup.name)), backup),
  cancelRestore: () => nativeCall((native) => native.cancelRestore()),
  photoStatus: async () => photosImportStatusFromNative(await nativeCall((native) => native.photoImportStatus())),
  restorePhotos: async (recordId: string, backup?: CompletedBackup) => photosImportStatusFromNative(
    await nativeCall((native) => native.restorePhotos(recordId, backup?.id ?? null, backup?.sha256 ?? null, backup?.size ?? null, backup?.name ?? null))),
};
