import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { emptySftpForm, sftp, sftpErrorCode, type SftpForm, type SftpStatus } from '../../../shared/api/sftp';

export function useSftpBackup() {
  const [status,setStatus] = useState<SftpStatus | null>(null), [form,setForm] = useState<SftpForm>(emptySftpForm);
  const [working,setWorking] = useState(false), [error,setError] = useState<string | null>(null);
  const alive = useRef(false), busy = useRef(false);
  useEffect(() => {
    alive.current = true;
    const load = async (initial = false) => {
      if (busy.current || AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
      try { const value = await sftp.status(); if (alive.current) { setStatus(value); if (initial && value.config) setForm({ ...value.config,password: '' }); } }
      catch (cause) { if (alive.current) setError(sftpErrorCode(cause)); }
    };
    void load(true); const timer = setInterval(() => { void load(); },2000);
    return () => { alive.current = false; clearInterval(timer); };
  },[]);
  const action = async (name: 'save' | 'enable' | 'disable' | 'run' | 'pause') => {
    if (busy.current || AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
    busy.current = true; setWorking(true); setError(null);
    try { const value = await (name === 'save' ? sftp.configure(form) : sftp.action(name)); if (alive.current) { setStatus(value); if (name === 'save') setForm({ ...form,password: '' }); } }
    catch (cause) { if (alive.current) setError(sftpErrorCode(cause)); }
    finally { busy.current = false; if (alive.current) setWorking(false); }
  };
  return { status,form,working,error,action,edit: (key: keyof SftpForm,value: string) => setForm(previous => ({ ...previous,[key]: value })) };
}
