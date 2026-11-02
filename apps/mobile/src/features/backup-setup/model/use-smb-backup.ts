import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { emptySmbForm, smb, type SmbForm, type SmbStatus } from '../../../shared/api/smb';

export function useSmbBackup() {
  const [status,setStatus] = useState<SmbStatus | null>(null), [form,setForm] = useState<SmbForm>(emptySmbForm);
  const [working,setWorking] = useState(false), [error,setError] = useState<string | null>(null);
  const alive = useRef(false), busy = useRef(false);
  useEffect(() => {
    alive.current = true;
    const load = async (initial = false) => {
      if (busy.current || AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
      try { const value = await smb.status(); if (alive.current) { setStatus(value); if (initial && value.config) setForm({ ...value.config,password: '' }); } }
      catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : 'outcome_unknown'); }
    };
    void load(true); const timer = setInterval(() => { void load(); },2000);
    return () => { alive.current = false; clearInterval(timer); };
  },[]);
  const action = async (name: 'save' | 'enable' | 'disable' | 'run' | 'pause') => {
    if (busy.current || AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
    busy.current = true; setWorking(true); setError(null);
    try { const value = await (name === 'save' ? smb.configure(form) : smb.action(name)); if (alive.current) { setStatus(value); if (name === 'save') setForm({ ...form,password: '' }); } }
    catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : 'outcome_unknown'); }
    finally { busy.current = false; if (alive.current) setWorking(false); }
  };
  return { status,form,working,error,action,edit: (key: keyof SmbForm,value: string) => setForm(previous => ({ ...previous,[key]: value })) };
}
