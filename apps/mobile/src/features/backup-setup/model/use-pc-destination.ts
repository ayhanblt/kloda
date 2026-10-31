import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { backupDestinations } from '../../../shared/api/backup-destinations';

export function usePcDestination(record?: string) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const epoch = useRef(0);
  const busy = useRef(false);
  useEffect(() => {
    const version = ++epoch.current;
    setEnabled(null); setError(null); setWorking(false);
    if (record) void backupDestinations.pcEnabled(record).then((value) => {
      if (version === epoch.current) setEnabled(value);
    }).catch((cause) => { if (version === epoch.current) setError(cause instanceof Error ? cause.message : 'outcome_unknown'); });
    return () => { epoch.current += 1; };
  }, [record]);
  const toggle = async () => {
    if (!record || enabled === null || busy.current || AppState.currentState !== 'active') return;
    busy.current = true; setWorking(true); setError(null);
    const version = epoch.current;
    try {
      const value = await backupDestinations.setPcEnabled(record, !enabled);
      if (version === epoch.current) setEnabled(value);
    } catch (cause) { if (version === epoch.current) setError(cause instanceof Error ? cause.message : 'outcome_unknown'); }
    finally { busy.current = false; if (version === epoch.current) setWorking(false); }
  };
  return { enabled, error, working, toggle };
}
