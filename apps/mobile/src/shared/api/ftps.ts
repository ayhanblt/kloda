import { requireOptionalNativeModule } from 'expo';
import { normalizeLanIp } from '@kloda/sync-core';

export interface FtpsForm { address: string; port: string; root: string; username: string; hostname: string; password: string }
export const emptyFtpsForm: FtpsForm = { address:'',port:'21',root:'',username:'',hostname:'',password:'' };
export function ftpsErrorCode(cause: unknown): string {
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
export function validFtpsHostname(value: string): boolean {
  return value.length > 0 && value.length <= 253 && value.split('.').every(label => label.length > 0 && label.length <= 63 && /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label));
}
export function validateFtpsForm(form: FtpsForm): FtpsForm {
  try {
    const address = normalizeLanIp(form.address);
    const root = form.root === '/' || form.root.startsWith('/') && form.root.slice(1).split('/').every(p => p && p !== '.' && p !== '..');
    if (!/^[1-9][0-9]{0,4}$/.test(form.port) || Number(form.port) > 65535 || !root || form.root.includes('\\') || !form.username.trim() || !form.password
      || !validFtpsHostname(form.hostname)
      || Object.values(form).some(v => typeof v !== 'string' || v.length > 4096 || hasControl(v))) throw new Error();
    return { ...form,address };
  } catch { throw new Error('ftps_fields'); }
}
const phases = ['running','waiting','paused','finished','needs_attention','exhausted'] as const;
const countNames = ['operations','completedOperations','files','completedFiles','photos','completedPhotos'] as const;
export interface FtpsRun { id: string; state: typeof phases[number]; automatic: boolean; attempts: number; osAttempts: number; counts: Record<typeof countNames[number], string>; errorCode?: string; retryAt?: string }
export interface FtpsStatus { supported: boolean; configured: boolean; enabled: boolean; running: boolean; targetId?: string; config?: Omit<FtpsForm, 'password'>; run?: FtpsRun; errorCode?: string; automaticError?: string }
function code(value: unknown) { return value === undefined ? undefined : text(value, /^[a-z][a-z0-9_]{0,127}$/); }
export function ftpsStatusFromNative(value: unknown): FtpsStatus {
  const row = object(value, ['supported','configured','enabled','running','targetId','config','run','errorCode','automaticError']);
  if ([row.supported,row.configured,row.enabled,row.running].some(v => typeof v !== 'boolean')) return invalid();
  const result: FtpsStatus = { supported: row.supported as boolean, configured: row.configured as boolean, enabled: row.enabled as boolean, running: row.running as boolean, errorCode: code(row.errorCode), automaticError: code(row.automaticError) };
  if (!result.configured) {
    if (result.enabled || result.running || row.config !== undefined || row.targetId !== undefined || row.run !== undefined) return invalid(); return result;
  }
  if (!result.supported) return invalid();
  result.targetId = text(row.targetId, hash);
  const config = object(row.config, ['address','port','root','username','hostname']);
  if (typeof config.port !== 'number' || !Number.isInteger(config.port) || Object.entries(config).some(([k,v]) => k !== 'port' && typeof v !== 'string')) return invalid();
  const form = validateFtpsForm({ ...config, port: String(config.port), password: 'native-metadata' } as FtpsForm);
  result.config = { address:form.address,port:form.port,root:form.root,username:form.username,hostname:form.hostname };
  if (row.run !== undefined) {
    const run = object(row.run, ['id','targetId','automatic','state','attempts','osAttempts','counts','errorCode','retryAt']);
    if (run.targetId !== result.targetId || typeof run.automatic !== 'boolean' || !phases.includes(run.state as FtpsRun['state']) || [run.attempts,run.osAttempts].some(v => typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 5)) return invalid();
    const countsRow = object(run.counts, [...countNames]); const counts = Object.fromEntries(countNames.map(k => [k, decimal(countsRow[k])])) as FtpsRun['counts'];
    for (const [total,done] of [['operations','completedOperations'],['files','completedFiles'],['photos','completedPhotos']] as const) if (BigInt(counts[done]) > BigInt(counts[total])) return invalid();
    if (BigInt(counts.files) + BigInt(counts.photos) > BigInt(counts.operations) || (run.state === 'finished' && counts.operations !== counts.completedOperations)) return invalid();
    const retryAt = run.retryAt === undefined ? undefined : decimal(run.retryAt);
    if ((run.state === 'waiting') !== (retryAt !== undefined)) return invalid();
    result.run = { id: text(run.id,uuid), state: run.state as FtpsRun['state'], automatic: run.automatic, attempts: run.attempts as number, osAttempts: run.osAttempts as number, counts, errorCode: code(run.errorCode), retryAt };
  }
  if (result.running !== (result.run?.state === 'running')) return invalid(); return result;
}
interface NativeFtps {
  ftpsStatus(): Promise<unknown>; configureFtps(address: string, port: number, hostname: string, root: string, username: string, password: string): Promise<unknown>;
  enableFtps(): Promise<unknown>; disableFtps(): Promise<unknown>; runFtps(): Promise<unknown>; pauseFtps(): Promise<unknown>;
  ftpsBackups(after: string): Promise<unknown>; ftpsIssues(after: string): Promise<unknown>;
  reviewFtps(id: string, request: string): Promise<unknown>; cancelFtpsReview(request: string): Promise<void>;
  restoreFtpsFile(id: string, request: string): Promise<unknown>; restoreFtpsPhotos(id: string, request: string): Promise<unknown>; cancelFtpsRestore(request: string): Promise<void>;
}
export function ftpsNative(): NativeFtps { const value = requireOptionalNativeModule<NativeFtps>('KlodaFtps'); if (!value) throw new Error('native_unsupported'); return value; }
export const ftps = {
  async status() { const native = requireOptionalNativeModule<NativeFtps>('KlodaFtps'); return typeof native?.ftpsStatus === 'function' ? ftpsStatusFromNative(await native.ftpsStatus()) : { supported: false, configured: false, enabled: false, running: false }; },
  async configure(raw: FtpsForm) { const f = validateFtpsForm(raw); return ftpsStatusFromNative({ ...object(await ftpsNative().configureFtps(f.address,Number(f.port),f.hostname,f.root,f.username,f.password), ['supported','configured','enabled','running','targetId','config','run','errorCode','automaticError']), supported: true }); },
  async action(action: 'enable' | 'disable' | 'run' | 'pause') {
    const native = ftpsNative(); const result = await ({ enable: () => native.enableFtps(), disable: () => native.disableFtps(), run: () => native.runFtps(), pause: () => native.pauseFtps() })[action]();
    return ftpsStatusFromNative({ ...object(result,['supported','configured','enabled','running','targetId','config','run','errorCode','automaticError']), supported: true });
  },
};
