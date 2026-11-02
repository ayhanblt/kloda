import { requireOptionalNativeModule } from 'expo';
import { normalizeLanIp } from '@kloda/sync-core';

export interface SftpForm { address: string; port: string; root: string; username: string; fingerprint: string; password: string }
export const emptySftpForm: SftpForm = { address:'',port:'22',root:'',username:'',fingerprint:'',password:'' };
export function sftpErrorCode(cause: unknown): string {
  const code = typeof cause === 'object' && cause !== null && 'code' in cause ? cause.code : undefined;
  if (typeof code === 'string' && /^[a-z][a-z0-9_]{0,127}$/.test(code)) return code;
  return cause instanceof Error && /^[a-z][a-z0-9_]{0,127}$/.test(cause.message) ? cause.message : 'outcome_unknown';
}
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
export function validateSftpForm(form: SftpForm): SftpForm {
  try {
    const address = normalizeLanIp(form.address);
    const root = form.root === '/' || form.root.startsWith('/') && form.root.slice(1).split('/').every(p => p && p !== '.' && p !== '..');
    if (!/^[1-9][0-9]{0,4}$/.test(form.port) || Number(form.port) > 65535 || !root || form.root.includes('\\') || !form.username.trim() || !form.password
      || !/^SHA256:[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]$/.test(form.fingerprint)
      || Object.values(form).some(v => typeof v !== 'string' || v.length > 4096 || hasControl(v))) throw new Error();
    return { ...form,address };
  } catch { throw new Error('sftp_fields'); }
}
const phases = ['running','waiting','paused','finished','needs_attention','exhausted'] as const;
const countNames = ['operations','completedOperations','files','completedFiles','photos','completedPhotos'] as const;
export interface SftpRun { id: string; state: typeof phases[number]; automatic: boolean; attempts: number; osAttempts: number; counts: Record<typeof countNames[number], string>; errorCode?: string; retryAt?: string }
export interface SftpStatus { supported: boolean; configured: boolean; enabled: boolean; running: boolean; targetId?: string; config?: Omit<SftpForm, 'password'>; run?: SftpRun; errorCode?: string; automaticError?: string }
function code(value: unknown) { return value === undefined ? undefined : text(value, /^[a-z][a-z0-9_]{0,127}$/); }
export function sftpStatusFromNative(value: unknown): SftpStatus {
  const row = object(value, ['supported','configured','enabled','running','targetId','config','run','errorCode','automaticError']);
  if ([row.supported,row.configured,row.enabled,row.running].some(v => typeof v !== 'boolean')) return invalid();
  const result: SftpStatus = { supported: row.supported as boolean, configured: row.configured as boolean, enabled: row.enabled as boolean, running: row.running as boolean, errorCode: code(row.errorCode), automaticError: code(row.automaticError) };
  if (!result.configured) {
    if (result.enabled || result.running || row.config !== undefined || row.targetId !== undefined || row.run !== undefined) return invalid(); return result;
  }
  if (!result.supported) return invalid();
  result.targetId = text(row.targetId, hash);
  const config = object(row.config, ['address','port','root','username','fingerprint']);
  if (typeof config.port !== 'number' || !Number.isInteger(config.port) || Object.entries(config).some(([k,v]) => k !== 'port' && typeof v !== 'string')) return invalid();
  const form = validateSftpForm({ ...config, port: String(config.port), password: 'native-metadata' } as SftpForm);
  result.config = { address:form.address,port:form.port,root:form.root,username:form.username,fingerprint:form.fingerprint };
  if (row.run !== undefined) {
    const run = object(row.run, ['id','targetId','automatic','state','attempts','osAttempts','counts','errorCode','retryAt']);
    if (run.targetId !== result.targetId || typeof run.automatic !== 'boolean' || !phases.includes(run.state as SftpRun['state']) || [run.attempts,run.osAttempts].some(v => typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 5)) return invalid();
    const countsRow = object(run.counts, [...countNames]); const counts = Object.fromEntries(countNames.map(k => [k, decimal(countsRow[k])])) as SftpRun['counts'];
    for (const [total,done] of [['operations','completedOperations'],['files','completedFiles'],['photos','completedPhotos']] as const) if (BigInt(counts[done]) > BigInt(counts[total])) return invalid();
    if (BigInt(counts.files) + BigInt(counts.photos) > BigInt(counts.operations) || (run.state === 'finished' && counts.operations !== counts.completedOperations)) return invalid();
    const retryAt = run.retryAt === undefined ? undefined : decimal(run.retryAt);
    if ((run.state === 'waiting') !== (retryAt !== undefined)) return invalid();
    result.run = { id: text(run.id,uuid), state: run.state as SftpRun['state'], automatic: run.automatic, attempts: run.attempts as number, osAttempts: run.osAttempts as number, counts, errorCode: code(run.errorCode), retryAt };
  }
  if (result.running !== (result.run?.state === 'running')) return invalid(); return result;
}
interface NativeSftp {
  sftpStatus(): Promise<unknown>; configureSftp(address: string, port: number, fingerprint: string, root: string, username: string, password: string): Promise<unknown>;
  enableSftp(): Promise<unknown>; disableSftp(): Promise<unknown>; runSftp(): Promise<unknown>; pauseSftp(): Promise<unknown>;
  sftpBackups(after: string): Promise<unknown>; sftpIssues(after: string): Promise<unknown>;
  reviewSftp(id: string, request: string): Promise<unknown>; cancelSftpReview(request: string): Promise<void>;
  restoreSftpFile(id: string, request: string): Promise<unknown>; restoreSftpPhotos(id: string, request: string): Promise<unknown>; cancelSftpRestore(request: string): Promise<void>;
}
export function sftpNative(): NativeSftp { const value = requireOptionalNativeModule<NativeSftp>('KlodaSftp'); if (!value) throw new Error('native_unsupported'); return value; }
export const sftp = {
  async status() { const native = requireOptionalNativeModule<NativeSftp>('KlodaSftp'); return typeof native?.sftpStatus === 'function' ? sftpStatusFromNative(await native.sftpStatus()) : { supported: false, configured: false, enabled: false, running: false }; },
  async configure(raw: SftpForm) { const f = validateSftpForm(raw); return sftpStatusFromNative({ ...object(await sftpNative().configureSftp(f.address,Number(f.port),f.fingerprint,f.root,f.username,f.password), ['supported','configured','enabled','running','targetId','config','run','errorCode','automaticError']), supported: true }); },
  async action(action: 'enable' | 'disable' | 'run' | 'pause') {
    const native = sftpNative(); const result = await ({ enable: () => native.enableSftp(), disable: () => native.disableSftp(), run: () => native.runSftp(), pause: () => native.pauseSftp() })[action]();
    return sftpStatusFromNative({ ...object(result,['supported','configured','enabled','running','targetId','config','run','errorCode','automaticError']), supported: true });
  },
};
