import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { backupDestinations, type WebDavBackupStatus } from '../../../shared/api/backup-destinations';
import { enableSavedWebDavBackup } from '../../../shared/api/webdav-settings';

export function useWebDavBackup() {
  const [status, setStatus] = useState<WebDavBackupStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const current = useRef(true);
  const mounted = useRef(true);
  const busy = useRef(false);
  const epoch = useRef(0);
  const refresh = async () => {
    const version = epoch.current;
    try {
      const value = await backupDestinations.status();
      if (current.current && version === epoch.current) { setStatus(value); setError(null); }
    } catch (cause) {
      if (current.current && version === epoch.current) { setStatus(null); setError(cause instanceof Error ? cause.message : 'outcome_unknown'); }
    }
  };
  useEffect(() => {
    mounted.current = true;
    current.current = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    const listener = AppState.addEventListener('change', (value) => {
      current.current = value === 'active'; epoch.current += 1;
      if (current.current) void refresh();
    });
    let reading = false;
    const poll = async () => {
      if (!current.current || busy.current || reading) return;
      reading = true; try { await refresh(); } finally { reading = false; }
    };
    void poll(); const timer = setInterval(() => void poll(), 1500);
    return () => { mounted.current = false; current.current = false; epoch.current += 1; clearInterval(timer); listener.remove(); };
  }, []);
  const action = async (kind: 'enable' | 'disable' | 'run' | 'pause') => {
    if (busy.current || !current.current) return;
    busy.current = true; setWorking(true); setError(null);
    const version = ++epoch.current;
    try {
      const value = kind === 'enable' ? await enableSavedWebDavBackup(() => current.current && version === epoch.current) : await backupDestinations[kind]();
      if (current.current && version === epoch.current) setStatus(value);
    } catch (cause) {
      if (current.current && version === epoch.current) setError(cause instanceof Error ? cause.message : 'outcome_unknown');
    } finally { busy.current = false; if (mounted.current) setWorking(false); }
  };
  return { status, error, working, action };
}
