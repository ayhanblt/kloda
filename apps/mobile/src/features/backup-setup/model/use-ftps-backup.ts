import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { emptyFtpsForm, ftps, ftpsErrorCode, type FtpsForm, type FtpsStatus } from '../../../shared/api/ftps';

export function useFtpsBackup() {
  const [status,setStatus] = useState<FtpsStatus | null>(null), [form,setForm] = useState<FtpsForm>(emptyFtpsForm);
  const [working,setWorking] = useState(false), [error,setError] = useState<string | null>(null);
  const alive = useRef(false), busy = useRef(false);
  useEffect(() => {
    alive.current = true;
    const load = async (initial = false) => {
      if (busy.current || AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
      try { const value = await ftps.status(); if (alive.current) { setStatus(value); if (initial && value.config) setForm({ ...value.config,password: '' }); } }
      catch (cause) { if (alive.current) setError(ftpsErrorCode(cause)); }
    };
    void load(true); const timer = setInterval(() => { void load(); },2000);
    return () => { alive.current = false; clearInterval(timer); };
  },[]);
  const action = async (name: 'save' | 'enable' | 'disable' | 'run' | 'pause') => {
    if (busy.current || AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
    busy.current = true; setWorking(true); setError(null);
    try { const value = await (name === 'save' ? ftps.configure(form) : ftps.action(name)); if (alive.current) { setStatus(value); if (name === 'save') setForm({ ...form,password: '' }); } }
    catch (cause) { if (alive.current) setError(ftpsErrorCode(cause)); }
    finally { busy.current = false; if (alive.current) setWorking(false); }
  };
  return { status,form,working,error,action,edit: (key: keyof FtpsForm,value: string) => setForm(previous => ({ ...previous,[key]: value })) };
}
