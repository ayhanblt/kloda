import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { emptyS3Form, s3, s3ErrorCode, type S3Form, type S3Provider, type S3Status, type S3TestResult } from '../../../shared/api/s3';
const clearSecrets = (form: S3Form): S3Form => ({ ...form,accessKey:'',secret:'',token:'' });
export function useS3Backup(provider: S3Provider) {
  const [status,setStatus] = useState<S3Status | null>(null), [form,setForm] = useState<S3Form>({ ...emptyS3Form });
  const [working,setWorking] = useState(false), [error,setError] = useState<string | null>(null);
  const [dirty,setDirty] = useState(false), [testResult,setTestResult] = useState<S3TestResult | null>(null);
  const revision = useRef(0);
  const request = useRef<string | null>(null);
  const cancelTest = () => { const ticket = request.current; request.current = null; if (ticket) void s3.cancelTest(ticket).catch(() => undefined); };
  const alive = useRef(false), busy = useRef(false), generation = useRef(0);
  useEffect(() => {
    alive.current = true; generation.current += 1; const captured = generation.current;
    setDirty(false); setTestResult(null); setStatus(null); setError(null); setForm({ ...emptyS3Form });
    const load = async (initial = false) => {
      if (busy.current || AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
      const version = revision.current;
      try { const value = await s3.status(provider); if (alive.current && captured === generation.current && version === revision.current) {
        setStatus(value); if (initial && value.profile) setForm({ ...value.profile,accessKey:'',secret:'',token:'' });
      } } catch (cause) { if (alive.current && captured === generation.current) setError(s3ErrorCode(cause)); }
    };
    void load(true);
    const subscription = AppState.addEventListener('change',state => { if (state !== 'active') { cancelTest(); setForm(clearSecrets); } else { void load(); } });
    return () => { alive.current = false; cancelTest(); generation.current += 1; subscription.remove(); };
  },[provider]);
  useEffect(() => {
    if (!status?.running) return;
    let pending = false, disposed = false;
    const timer = setInterval(() => {
      if (pending || busy.current || AppState.currentState !== 'active') return;
      pending = true; const version = revision.current;
      void s3.status(provider).then(value => { if (!disposed && version === revision.current) setStatus(value); }).catch(cause => { if (!disposed) setError(s3ErrorCode(cause)); }).finally(() => { pending = false; });
    },1500);
    return () => { disposed = true; clearInterval(timer); };
  },[provider,status?.running]);
  const action = async (kind: 'enableS3' | 'disableS3' | 'runS3' | 'pauseS3' | 'automaticS3') => {
    if (busy.current || dirty || AppState.currentState !== 'active') return;
    if (kind === 'automaticS3' && !status?.canAutomatic) return;
    if (kind === 'enableS3' && !status?.canEnable || kind === 'runS3' && !status?.canRun) return;
    const captured = generation.current; revision.current += 1; busy.current = true; setWorking(true); setError(null); cancelTest();
    try { const value = kind === 'automaticS3' ? await s3.automatic(provider,!status?.automaticEnabled) : await s3.action(provider,kind); if (alive.current && captured === generation.current) setStatus(value); }
    catch (cause) { if (alive.current && captured === generation.current) setError(s3ErrorCode(cause)); }
    finally { busy.current = false; if (alive.current && captured === generation.current) setWorking(false); }
  };
  const save = async () => {
    if (busy.current || AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
    const captured = generation.current; revision.current += 1; setTestResult(null); busy.current = true; setWorking(true); setError(null);
    try { const value = await s3.configure(provider,form); if (alive.current && generation.current === captured) { setStatus(value); setDirty(false); } }
    catch (cause) { if (alive.current && generation.current === captured) setError(s3ErrorCode(cause)); }
    finally { busy.current = false; if (alive.current && generation.current === captured) { setWorking(false); setForm(clearSecrets); } }
  };
  const test = async () => {
    if (busy.current || status?.running || dirty || !status?.canTest || AppState.currentState !== 'active') return;
    const captured = generation.current; let ticket: string | null = null;
    busy.current = true; setWorking(true); setError(null); setTestResult(null);
    try { ticket = s3.newRequest(); request.current = ticket; const value = await s3.test(provider,ticket); if (alive.current && captured === generation.current && request.current === ticket) setTestResult(value); }
    catch (cause) { if (alive.current && captured === generation.current && (ticket === null || request.current === ticket)) setError(s3ErrorCode(cause)); }
    finally { if (request.current === ticket) request.current = null; busy.current = false; if (alive.current && captured === generation.current) setWorking(false); }
  };
  return { status,form,working,error,save,test,action,testResult,dirty,edit: <K extends keyof S3Form>(key: K,value: S3Form[K]) => { setDirty(true); setTestResult(null); setForm(previous => ({ ...previous,[key]:value })); } };
}
