import { requireOptionalNativeModule } from 'expo';
import { normalizeLanIp } from '@kloda/sync-core';

export interface SmbForm { address: string; port: string; share: string; root: string; username: string; domain: string; password: string }
export const emptySmbForm: SmbForm = { address: '', port: '445', share: '', root: '', username: '', domain: '', password: '' };
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const hash = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
export function hasControl(value: string): boolean { return Array.from(value).some(c => c.charCodeAt(0) < 32 || (c.charCodeAt(0) >= 127 && c.charCodeAt(0) <= 159)); }
function invalid(): never { throw new Error('outcome_unknown'); }
export function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) return invalid();
  return value as Record<string, unknown>;
}
export function text(value: unknown, pattern: RegExp): string { return typeof value === 'string' && pattern.test(value) ? value : invalid(); }
export function decimal(value: unknown): string {
  const result = text(value, /^(0|[1-9]\d{0,18})$/); if (BigInt(result) > 9223372036854775807n) return invalid(); return result;
}
export function validateSmbForm(form: SmbForm): SmbForm {
  try {
    const address = normalizeLanIp(form.address);
    if (!/^[1-9][0-9]{0,4}$/.test(form.port) || Number(form.port) > 65535 || !form.share.trim() || !form.username.trim()
      || !form.password || Object.values(form).some(value => typeof value !== 'string' || value.length > 4096 || hasControl(value))
      || /[\\/]/.test(form.share) || form.root.includes('\\') || (form.root && form.root.split('/').some(p => !p || p === '.' || p === '..'))) throw new Error();
    return { ...form, address };
  } catch { throw new Error('smb_fields'); }
}
const phases = ['running','waiting','paused','finished','needs_attention','exhausted'] as const;
const countNames = ['operations','completedOperations','files','completedFiles','photos','completedPhotos'] as const;
export interface SmbRun { id: string; state: typeof phases[number]; automatic: boolean; attempts: number; osAttempts: number; counts: Record<typeof countNames[number], string>; errorCode?: string; retryAt?: string }
export interface SmbStatus { supported: boolean; configured: boolean; enabled: boolean; running: boolean; targetId?: string; config?: Omit<SmbForm, 'password'>; run?: SmbRun; errorCode?: string; automaticError?: string }
function code(value: unknown) { return value === undefined ? undefined : text(value, /^[a-z][a-z0-9_]{0,127}$/); }
export function smbStatusFromNative(value: unknown): SmbStatus {
  const row = object(value, ['supported','configured','enabled','running','targetId','config','run','errorCode','automaticError']);
  if ([row.supported,row.configured,row.enabled,row.running].some(v => typeof v !== 'boolean')) return invalid();
  const result: SmbStatus = { supported: row.supported as boolean, configured: row.configured as boolean, enabled: row.enabled as boolean, running: row.running as boolean, errorCode: code(row.errorCode), automaticError: code(row.automaticError) };
  if (!result.configured) {
    if (result.enabled || result.running || row.config !== undefined || row.targetId !== undefined || row.run !== undefined) return invalid(); return result;
  }
  if (!result.supported) return invalid();
  result.targetId = text(row.targetId, hash);
  const config = object(row.config, ['address','port','share','root','username','domain']);
  if (typeof config.port !== 'number' || !Number.isInteger(config.port) || Object.entries(config).some(([k,v]) => k !== 'port' && typeof v !== 'string')) return invalid();
  const form = validateSmbForm({ ...config, port: String(config.port), password: 'native-metadata' } as SmbForm);
  result.config = { address:form.address,port:form.port,share:form.share,root:form.root,username:form.username,domain:form.domain };
  if (row.run !== undefined) {
    const run = object(row.run, ['id','targetId','automatic','state','attempts','osAttempts','counts','errorCode','retryAt']);
    if (run.targetId !== result.targetId || typeof run.automatic !== 'boolean' || !phases.includes(run.state as SmbRun['state']) || [run.attempts,run.osAttempts].some(v => typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 5)) return invalid();
    const countsRow = object(run.counts, [...countNames]); const counts = Object.fromEntries(countNames.map(k => [k, decimal(countsRow[k])])) as SmbRun['counts'];
    for (const [total,done] of [['operations','completedOperations'],['files','completedFiles'],['photos','completedPhotos']] as const) if (BigInt(counts[done]) > BigInt(counts[total])) return invalid();
    if (BigInt(counts.files) + BigInt(counts.photos) > BigInt(counts.operations) || (run.state === 'finished' && counts.operations !== counts.completedOperations)) return invalid();
    const retryAt = run.retryAt === undefined ? undefined : decimal(run.retryAt);
    if ((run.state === 'waiting') !== (retryAt !== undefined)) return invalid();
    result.run = { id: text(run.id,uuid), state: run.state as SmbRun['state'], automatic: run.automatic, attempts: run.attempts as number, osAttempts: run.osAttempts as number, counts, errorCode: code(run.errorCode), retryAt };
  }
  if (result.running !== (result.run?.state === 'running')) return invalid(); return result;
}
interface NativeSmb {
  smbStatus(): Promise<unknown>; configureSmb(address: string, port: number, share: string, root: string, username: string, domain: string, password: string): Promise<unknown>;
  enableSmb(): Promise<unknown>; disableSmb(): Promise<unknown>; runSmb(): Promise<unknown>; pauseSmb(): Promise<unknown>;
  smbBackups(after: string): Promise<unknown>; smbIssues(after: string): Promise<unknown>;
  reviewSmb(id: string, request: string): Promise<unknown>; cancelSmbReview(request: string): Promise<void>;
  restoreSmbFile(id: string, request: string): Promise<unknown>; restoreSmbPhotos(id: string, request: string): Promise<unknown>; cancelSmbRestore(request: string): Promise<void>;
}
export function smbNative(): NativeSmb { const value = requireOptionalNativeModule<NativeSmb>('KlodaSmb'); if (!value) throw new Error('native_unsupported'); return value; }
export const smb = {
  async status() { const native = requireOptionalNativeModule<NativeSmb>('KlodaSmb'); return typeof native?.smbStatus === 'function' ? smbStatusFromNative(await native.smbStatus()) : { supported: false, configured: false, enabled: false, running: false }; },
  async configure(raw: SmbForm) { const f = validateSmbForm(raw); return smbStatusFromNative({ ...object(await smbNative().configureSmb(f.address,Number(f.port),f.share,f.root,f.username,f.domain,f.password), ['supported','configured','enabled','running','targetId','config','run','errorCode','automaticError']), supported: true }); },
  async action(action: 'enable' | 'disable' | 'run' | 'pause') {
    const native = smbNative(); const result = await ({ enable: () => native.enableSmb(), disable: () => native.disableSmb(), run: () => native.runSmb(), pause: () => native.pauseSmb() })[action]();
    return smbStatusFromNative({ ...object(result,['supported','configured','enabled','running','targetId','config','run','errorCode','automaticError']), supported: true });
  },
};
