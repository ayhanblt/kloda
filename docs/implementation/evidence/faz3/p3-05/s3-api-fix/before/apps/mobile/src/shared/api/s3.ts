import { requireOptionalNativeModule } from 'expo';
import { hasControl, object, ftpsErrorCode } from './ftps';
export const s3ErrorCode = ftpsErrorCode;
export type S3Provider = 'amazon-s3' | 's3-compatible';
export interface S3Form { endpoint: string; region: string; bucket: string; prefix: string; pathStyle: boolean; accessKey: string; secret: string; token: string }
export const emptyS3Form: S3Form = { endpoint:'',region:'',bucket:'',prefix:'',pathStyle:true,accessKey:'',secret:'',token:'' };
export interface S3Status { provider: S3Provider; supported: boolean; configured: boolean; enabled: boolean; canRun: boolean; automaticEnabled?: boolean; canAutomatic?: boolean; canEnable?: boolean; running?: boolean; run?: S3Run; canTest?: boolean; profile?: Omit<S3Form,'accessKey' | 'secret' | 'token'> }
export interface S3Run { id: string; state: 'running' | 'paused' | 'finished' | 'needs_attention'; counts: { verifiedFiles: string; verifiedBytes: string }; errorCode?: string }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function runFromNative(value: unknown): S3Run {
  const run = object(value,['id','state','counts','errorCode']), counts = object(run.counts,['verifiedFiles','verifiedBytes']);
  if (typeof run.id !== 'string' || !uuid.test(run.id) || !['running','paused','finished','needs_attention'].includes(run.state as string) ||
    Object.keys(counts).length !== 2 || Object.values(counts).some(v => typeof v !== 'string' || !/^(0|[1-9][0-9]{0,18})$/.test(v) || BigInt(v) > 9223372036854775807n) ||
    (run.errorCode !== undefined && (typeof run.errorCode !== 'string' || !/^[a-z][a-z0-9_]{0,79}$/.test(run.errorCode)))) return invalid();
  return run as unknown as S3Run;
}
function invalid(): never { throw new Error('s3_fields'); }
export function validateS3Form(provider: S3Provider, form: S3Form): S3Form {
  if (!['amazon-s3','s3-compatible'].includes(provider) || !/^[a-z0-9-]{1,63}$/.test(form.region) ||
    !/^[a-z0-9](?:[a-z0-9.-]{1,61})[a-z0-9]$/.test(form.bucket) || /^\d+\.\d+\.\d+\.\d+$/.test(form.bucket) ||
    form.bucket.split('.').some(label => !label || label.startsWith('-') || label.endsWith('-')) ||
    typeof form.pathStyle !== 'boolean' || !form.accessKey || !form.secret ||
    Object.entries(form).some(([k,v]) => k !== 'pathStyle' && (typeof v !== 'string' || v.length > 4096 || hasControl(v))) ||
    (form.prefix && (/[\\%?#]/.test(form.prefix) || form.prefix.split('/').some(p => !p || p === '.' || p === '..')))) return invalid();
  const endpoint = provider === 'amazon-s3' ? `https://s3.${form.region}.amazonaws.com` : form.endpoint;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return invalid();
    return { ...form,endpoint:url.origin,pathStyle:provider === 'amazon-s3' ? form.bucket.includes('.') : form.pathStyle };
  } catch { return invalid(); }
}
export function s3StatusFromNative(value: unknown, provider: S3Provider): S3Status {
  const row = object(value,['provider','supported','configured','enabled','canRun','profile','canTest','canEnable','running','run','automaticEnabled','canAutomatic']);
  if (row.provider !== provider || typeof row.supported !== 'boolean' || typeof row.configured !== 'boolean' || typeof row.enabled !== 'boolean' || typeof row.canRun !== 'boolean') return invalid();
  if (row.canTest !== undefined && (typeof row.canTest !== 'boolean' || (row.canTest && (!row.supported || !row.configured)))) return invalid();
  for (const key of ['canEnable','running','automaticEnabled','canAutomatic'] as const) if (row[key] !== undefined && typeof row[key] !== 'boolean') return invalid();
  const personal = provider === 'amazon-s3' && row.supported && row.configured && row.canEnable === true;
  if ((row.enabled || row.canRun || row.running || row.canEnable) && !personal) return invalid();
  if ((row.automaticEnabled || row.canAutomatic) && (!personal || !row.enabled)) return invalid();
  if ((row.canRun && (!row.enabled || row.running)) || (row.running && !row.enabled)) return invalid();
  const result: S3Status = { provider,supported:row.supported,configured:row.configured,enabled:row.enabled,canRun:row.canRun };
  if (row.automaticEnabled !== undefined) result.automaticEnabled = row.automaticEnabled as boolean;
  if (row.canAutomatic !== undefined) result.canAutomatic = row.canAutomatic as boolean;
  if (row.canEnable !== undefined) result.canEnable = row.canEnable as boolean;
  if (row.running !== undefined) result.running = row.running as boolean;
  if (row.run !== undefined) {
    if (!row.configured || !row.supported || provider !== 'amazon-s3') return invalid();
    result.run = runFromNative(row.run);
    if ((result.run.state === 'running') !== (row.running === true)) return invalid();
  } else if (row.running) return invalid();
  if (row.canTest !== undefined) result.canTest = row.canTest as boolean;
  if (!row.configured) { if (row.profile !== undefined) return invalid(); return result; }
  if (!row.supported) return invalid();
  const profile = object(row.profile,['endpoint','region','bucket','prefix','pathStyle']);
  const checked = validateS3Form(provider,{ ...profile,accessKey:'native-metadata',secret:'native-metadata',token:'' } as S3Form);
  if (checked.endpoint !== profile.endpoint && `${checked.endpoint}/` !== profile.endpoint) return invalid();
  result.profile = { endpoint:checked.endpoint,region:checked.region,bucket:checked.bucket,prefix:checked.prefix,pathStyle:profile.pathStyle as boolean }; return result;
}
export interface S3TestResult { provider: S3Provider; state: 'completed'; id: string; size: 4097; sha256: string }
export function s3TestFromNative(value: unknown, provider: S3Provider): S3TestResult {
  const row = object(value,['provider','state','id','size','sha256']);
  if (row.provider !== provider || row.state !== 'completed' || row.size !== 4097 || typeof row.id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(row.id) || typeof row.sha256 !== 'string' ||
    !/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(row.sha256)) return invalid();
  return row as unknown as S3TestResult;
}
type S3Action = 'enableS3' | 'disableS3' | 'runS3' | 'pauseS3';
interface NativeS3 extends Partial<Record<S3Action,(provider: S3Provider) => Promise<unknown>>> { automaticS3?(provider: S3Provider, enabled: boolean): Promise<unknown>; s3TestRequest?(): unknown; testS3?(provider: S3Provider, request: string): Promise<unknown>; cancelS3Test?(request: string): Promise<void>; s3Status(provider: S3Provider): Promise<unknown>; configureS3(provider: S3Provider, fields: Omit<S3Form,'token'> & { token: string | null }): Promise<unknown> }
export const s3 = {
  async automatic(provider: S3Provider, enabled: boolean): Promise<S3Status> {
    const native = requireOptionalNativeModule<NativeS3>('KlodaS3'); if (!native?.automaticS3) throw new Error('native_unavailable');
    return s3StatusFromNative(await native.automaticS3(provider,enabled),provider);
  },
  async action(provider: S3Provider, action: S3Action): Promise<S3Status> {
    const native = requireOptionalNativeModule<NativeS3>('KlodaS3');
    if (!native?.[action]) throw new Error('native_unavailable');
    return s3StatusFromNative(await native[action](provider),provider);
  },
  newRequest(): string {
    const native = requireOptionalNativeModule<NativeS3>('KlodaS3'); if (!native?.s3TestRequest) throw new Error('native_unavailable');
    const value = native.s3TestRequest();
    if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) return invalid();
    return value;
  },
  async test(provider: S3Provider, request: string): Promise<S3TestResult> {
    const native = requireOptionalNativeModule<NativeS3>('KlodaS3'); if (!native?.testS3) throw new Error('native_unavailable');
    return s3TestFromNative(await native.testS3(provider,request),provider);
  },
  async cancelTest(request: string): Promise<void> {
    await requireOptionalNativeModule<NativeS3>('KlodaS3')?.cancelS3Test?.(request);
  },
  async status(provider: S3Provider): Promise<S3Status> {
    const native = requireOptionalNativeModule<NativeS3>('KlodaS3');
    return native ? s3StatusFromNative(await native.s3Status(provider),provider) : { provider,supported:false,configured:false,enabled:false,canRun:false };
  },
  async configure(provider: S3Provider, form: S3Form): Promise<S3Status> {
    const native = requireOptionalNativeModule<NativeS3>('KlodaS3'); if (!native) throw new Error('native_unavailable');
    const fields = validateS3Form(provider,form);
    return s3StatusFromNative(await native.configureS3(provider,{ ...fields,token:fields.token || null }),provider);
  },
};
