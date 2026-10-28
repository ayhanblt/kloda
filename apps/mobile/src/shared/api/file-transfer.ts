import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

export type FileJobState = 'queued' | 'preparing' | 'uploading' | 'finalizing' | 'completed' | 'paused' | 'blocked' | 'owner_deleted';
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
export interface FileRun {
  id: string;
  recordId: string;
  attempts: number;
  state: 'running' | 'paused' | 'retry_wait' | 'finished' | 'needs_attention' | 'failed';
  retryAt?: string;
  errorCode?: string;
}
export interface AutomaticRun {
  accessAttempts?: number;
  attempts: number;
  updated: 0 | 1;
  state: 'running' | 'waiting' | 'finished' | 'exhausted' | 'paused';
  retryAt?: string;
  errorCode?: string;
}
export interface FileQueue {
  automaticRun?: AutomaticRun;
  automaticPaused?: boolean;
  notificationsEnabled?: boolean;
  automaticError?: string;
  run?: FileRun;
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
  rebackupFile(record: string, job: string): Promise<unknown>;
  runFiles(record: string): Promise<unknown>;
  queueStatus(): Promise<unknown>;
  pauseFiles(): Promise<unknown>;
  resumeAutomatic(): Promise<unknown>;
  requestBackupNotifications?(): Promise<boolean>;
  listBackups(record: string, after: string | null): Promise<unknown>;
  restoreBackup(record: string, operation: string, sha256: string, size: string, name: string): Promise<unknown>;
  cancelRestore(): Promise<unknown>;
  photoImportStatus(): Promise<unknown>;
  restorePhotos(record: string, operation: string | null, sha256: string | null, size: string | null, name: string | null): Promise<unknown>;
}
const states: Record<FileJobState, true> = {
  queued: true, preparing: true, uploading: true, finalizing: true, completed: true, paused: true, blocked: true, owner_deleted: true,
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
  if ('automaticPaused' in value && typeof value.automaticPaused !== 'boolean') throw new Error('outcome_unknown');
  if ('notificationsEnabled' in value && typeof value.notificationsEnabled !== 'boolean') throw new Error('outcome_unknown');
  const notificationsEnabled = 'notificationsEnabled' in value ? value.notificationsEnabled as boolean : undefined;
  const automaticPaused = 'automaticPaused' in value ? value.automaticPaused as boolean : undefined;
  const automaticError = 'automaticError' in value && value.automaticError != null ? text(value.automaticError) : undefined;
  const totalJobs = decimal(value.totalJobs);
  if (BigInt(totalJobs) < BigInt(jobs.length) || value.hasMore !== (BigInt(totalJobs) > BigInt(jobs.length))
    || new Set(jobs.map(({ id }) => id)).size !== jobs.length) throw new Error('outcome_unknown');
  const run = 'run' in value && value.run != null ? fileRunFromNative(value.run, value.running) : undefined;
  const automaticRun = 'automaticRun' in value && value.automaticRun != null ? automaticRunFromNative(value.automaticRun) : undefined;
  return { automaticRun, running: value.running, jobs, totalJobs, hasMore: value.hasMore, run, automaticPaused, automaticError, notificationsEnabled,
    errorCode: 'errorCode' in value && value.errorCode != null ? text(value.errorCode) : undefined };
}
function automaticRunFromNative(value: unknown): AutomaticRun {
  if (typeof value !== 'object' || value === null || !('attempts' in value) || typeof value.attempts !== 'number'
    || !Number.isInteger(value.attempts) || value.attempts < 1 || value.attempts > 5
    || !('updated' in value) || (value.updated !== 0 && value.updated !== 1)
    || !('state' in value) || typeof value.state !== 'string'
    || !['running', 'waiting', 'finished', 'exhausted', 'paused'].includes(value.state)
    || (value.updated === 1 && value.state !== 'finished')) throw new Error('outcome_unknown');
  const accessAttempts = 'accessAttempts' in value ? value.accessAttempts : undefined;
  if (accessAttempts !== undefined && (typeof accessAttempts !== 'number' || !Number.isInteger(accessAttempts) || accessAttempts < 0 || accessAttempts > 5)) throw new Error('outcome_unknown');
  const errorCode = 'errorCode' in value && value.errorCode != null ? text(value.errorCode) : undefined;
  const accessRetry = accessAttempts !== undefined && ['lan_unavailable', 'connection_closed'].includes(errorCode ?? '');
  const retryAt = 'retryAt' in value && value.retryAt != null ? decimal(value.retryAt) : undefined;
  if ((value.state === 'finished' && (value.updated !== 1 || errorCode !== undefined))
    || (value.state === 'waiting' && accessAttempts !== undefined && !accessRetry && errorCode !== 'os_interrupted')
    || (value.state === 'waiting' && accessRetry && (accessAttempts === 0 || accessAttempts === 5))
    || (value.state === 'waiting') !== (retryAt !== undefined) || (value.state === 'waiting' && !accessRetry && value.attempts === 5)
    || (retryAt !== undefined && (!Number.isSafeInteger(Number(retryAt)) || Number(retryAt) > 8640000000000000))) throw new Error('outcome_unknown');
  return { attempts: value.attempts, accessAttempts: accessAttempts as number | undefined, updated: value.updated, state: value.state as AutomaticRun['state'], retryAt, errorCode };
}
function fileRunFromNative(value: unknown, running: boolean): FileRun {
  if (typeof value !== 'object' || value === null || !('attempts' in value) || typeof value.attempts !== 'number'
    || !Number.isInteger(value.attempts) || value.attempts < 1 || value.attempts > 5
    || !('state' in value) || typeof value.state !== 'string'
    || !['running', 'paused', 'retry_wait', 'finished', 'needs_attention', 'failed'].includes(value.state)) throw new Error('outcome_unknown');
  const id = text('id' in value ? value.id : undefined);
  const recordId = text('recordId' in value ? value.recordId : undefined);
  if (!/^[A-Za-z0-9_-]{22}$/.test(recordId) || (['running', 'retry_wait'].includes(value.state) && !running)) throw new Error('outcome_unknown');
  const retryAt = 'retryAt' in value && value.retryAt != null ? decimal(value.retryAt) : undefined;
  if ((retryAt !== undefined && (!Number.isSafeInteger(Number(retryAt)) || Number(retryAt) > 8640000000000000 || value.attempts === 5))
    || (value.state === 'retry_wait' && retryAt === undefined)
    || (retryAt !== undefined && !['paused', 'retry_wait'].includes(value.state))) throw new Error('outcome_unknown');
  return { id, recordId, attempts: value.attempts, state: value.state as FileRun['state'], retryAt,
    errorCode: 'errorCode' in value && value.errorCode != null ? text(value.errorCode) : undefined };
}
async function nativeCall(action: (native: NativeFiles) => Promise<unknown>): Promise<unknown> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') throw new Error('native_unsupported');
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
async function requestNotifications(): Promise<boolean> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return false;
  const native = requireOptionalNativeModule<NativeFiles>('KlodaPairing');
  if (!native?.requestBackupNotifications) return false;
  const enabled = await native.requestBackupNotifications();
  if (typeof enabled !== 'boolean') throw new Error('outcome_unknown');
  return enabled;
}
export const fileTransfer = {
  requestNotifications,
  status: () => invoke((native) => native.queueStatus()),
  run: (recordId: string) => invoke((native) => native.runFiles(recordId)),
  rebackup: (record: string, job: string) => invoke((native) => native.rebackupFile(record, job)),
  pause: () => invoke((native) => native.pauseFiles()),
  resumeAutomatic: () => invoke((native) => native.resumeAutomatic()),
  list: async (recordId: string, after?: string) => completedBackupsFromNative(
    await nativeCall((native) => native.listBackups(recordId, after ?? null)), after),
  restore: async (recordId: string, backup: CompletedBackup) => restoredBackupFromNative(
    await nativeCall((native) => native.restoreBackup(recordId, backup.id, backup.sha256, backup.size, backup.name)), backup),
  cancelRestore: () => nativeCall((native) => native.cancelRestore()),
  photoStatus: async () => {
    return photosImportStatusFromNative(await nativeCall((native) => native.photoImportStatus()));
  },
  restorePhotos: async (recordId: string, backup?: CompletedBackup) => {
    return photosImportStatusFromNative(await nativeCall((native) => native.restorePhotos(recordId,
      backup?.id ?? null, backup?.sha256 ?? null, backup?.size ?? null, backup?.name ?? null)));
  },
};
