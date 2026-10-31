import { requireOptionalNativeModule } from 'expo';
import { validateWebDavForm, type MobileStorageForm } from './webdav';

const phases = ['running', 'waiting', 'paused', 'finished', 'needs_attention', 'exhausted'] as const;
const countNames = ['operations', 'completedOperations', 'files', 'completedFiles', 'photos', 'completedPhotos'] as const;
export interface WebDavRun {
  id: string; targetId: string; automatic: boolean; state: typeof phases[number]; attempts: number; osAttempts: number;
  counts: Record<typeof countNames[number], string>; errorCode?: string; retryAt?: string;
}
export interface WebDavBackupStatus {
  configured: boolean; enabled: boolean; running: boolean; targetId?: string;
  config?: Omit<MobileStorageForm, 'password'>; run?: WebDavRun; errorCode?: string; automaticError?: string;
}
interface NativeBackup {
  webDavStatus(): Promise<unknown>;
  configureWebDav(endpoint: string, path: string, username: string, password: string): Promise<unknown>;
  disableWebDav(): Promise<unknown>; runWebDav(): Promise<unknown>; pauseWebDav(): Promise<unknown>;
  pcSelected(): Promise<unknown>;
  pcEnabled(record: string): Promise<unknown>; setPcEnabled(record: string, enabled: boolean): Promise<unknown>;
}
function invalid(): never { throw new Error('outcome_unknown'); }
function native(): NativeBackup {
  const value = requireOptionalNativeModule<NativeBackup>('KlodaBackup');
  if (!value) throw new Error('native_unsupported');
  return value;
}
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((key) => !keys.includes(key))) return invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown, pattern: RegExp): string { return typeof value === 'string' && pattern.test(value) ? value : invalid(); }
function decimal(value: unknown): string {
  const result = text(value, /^(0|[1-9]\d{0,18})$/);
  if (BigInt(result) > 9223372036854775807n) return invalid();
  return result;
}
const targetPattern = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function code(value: unknown): string | undefined { return value === undefined ? undefined : text(value, /^[a-z][a-z0-9_]{0,127}$/); }
export function webDavBackupFromNative(value: unknown): WebDavBackupStatus {
  const row = object(value, ['configured', 'enabled', 'running', 'targetId', 'config', 'run', 'errorCode', 'automaticError']);
  if ([row.configured, row.enabled, row.running].some((item) => typeof item !== 'boolean')) return invalid();
  const result: WebDavBackupStatus = { configured: row.configured as boolean, enabled: row.enabled as boolean, running: row.running as boolean, errorCode: code(row.errorCode), automaticError: code(row.automaticError) };
  if (!result.configured) {
    if (result.enabled || result.running || row.targetId !== undefined || row.config !== undefined || row.run !== undefined) return invalid();
    return result;
  }
  result.targetId = text(row.targetId, targetPattern);
  const config = object(row.config, ['endpoint', 'targetPath', 'username']);
  if ([config.endpoint, config.targetPath, config.username].some((item) => typeof item !== 'string')) return invalid();
  result.config = { endpoint: config.endpoint as string, targetPath: config.targetPath as string, username: config.username as string };
  try { validateWebDavForm({ ...result.config, password: 'metadata-validation' }); } catch { return invalid(); }
  if (row.run !== undefined) {
    const run = object(row.run, ['id', 'targetId', 'automatic', 'state', 'attempts', 'osAttempts', 'counts', 'errorCode', 'retryAt']);
    if (typeof run.automatic !== 'boolean' || !phases.includes(run.state as WebDavRun['state'])
      || [run.attempts, run.osAttempts].some((n) => typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 5)) return invalid();
    const rawCounts = object(run.counts, [...countNames]);
    const counts = Object.fromEntries(countNames.map((key) => [key, decimal(rawCounts[key])])) as WebDavRun['counts'];
    for (const [total, completed] of [['operations', 'completedOperations'], ['files', 'completedFiles'], ['photos', 'completedPhotos']] as const) {
      if (BigInt(counts[completed]) > BigInt(counts[total])) return invalid();
    }
    if (BigInt(counts.files) + BigInt(counts.photos) > BigInt(counts.operations)) return invalid();
    const targetId = text(run.targetId, targetPattern);
    if (targetId !== result.targetId || (run.state === 'finished' && counts.operations !== counts.completedOperations)) return invalid();
    const retryAt = run.retryAt === undefined ? undefined : decimal(run.retryAt);
    if ((run.state === 'waiting') !== (retryAt !== undefined)) return invalid();
    result.run = { id: text(run.id, uuidPattern), targetId, automatic: run.automatic, state: run.state as WebDavRun['state'],
      attempts: run.attempts as number, osAttempts: run.osAttempts as number, counts, errorCode: code(run.errorCode), retryAt };
  }
  if (result.running !== (result.run?.state === 'running')) return invalid();
  return result;
}
function pcFlag(value: unknown): boolean {
  const row = object(value, ['enabled']); if (typeof row.enabled !== 'boolean') return invalid(); return row.enabled;
}
function recordId(value: string): string { return text(value, /^[A-Za-z0-9_-]{21}[AQgw]$/); }
export const backupDestinations = {
  async status(): Promise<WebDavBackupStatus> { return webDavBackupFromNative(await native().webDavStatus()); },
  async enable(storage: MobileStorageForm): Promise<WebDavBackupStatus> {
    validateWebDavForm(storage);
    return webDavBackupFromNative(await native().configureWebDav(storage.endpoint, storage.targetPath, storage.username, storage.password));
  },
  async disable(): Promise<WebDavBackupStatus> { return webDavBackupFromNative(await native().disableWebDav()); },
  async run(): Promise<WebDavBackupStatus> { return webDavBackupFromNative(await native().runWebDav()); },
  async pause(): Promise<WebDavBackupStatus> { return webDavBackupFromNative(await native().pauseWebDav()); },
  async pcSelected(): Promise<boolean> { return pcFlag(await native().pcSelected()); },
  async pcEnabled(record: string): Promise<boolean> { return pcFlag(await native().pcEnabled(recordId(record))); },
  async setPcEnabled(record: string, enabled: boolean): Promise<boolean> { return pcFlag(await native().setPcEnabled(recordId(record), enabled)); },
};
