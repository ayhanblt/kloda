import { useEffect, useRef, useState } from 'react';
import { recoveryCode, type RecoveryImport } from '../../../shared/api/recovery-code';

function code(cause: unknown): string {
  const value = typeof cause === 'object' && cause !== null && 'code' in cause ? cause.code : undefined;
  if (typeof value === 'string' && /^[a-z][a-z0-9_]{0,127}$/.test(value)) return value;
  return cause instanceof Error && /^[a-z][a-z0-9_]{0,127}$/.test(cause.message) ? cause.message : 'outcome_unknown';
}

// ADR0029 29/3: the old phone's code typed on this phone. It lives only in this hook's state and is cleared after a
// successful import; a wrong code stays in the field so a typo can be fixed.
export function useRecoveryImport(targetId: string) {
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<RecoveryImport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const running = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const submit = async () => {
    if (running.current || !typed.trim()) return;
    running.current = true; setWorking(true); setError(null); setResult(null);
    try {
      const value = await recoveryCode.importCatalog(targetId, typed);
      if (mounted.current) { setResult(value); setTyped(''); }
    } catch (cause) { if (mounted.current) setError(code(cause)); }
    finally { running.current = false; if (mounted.current) setWorking(false); }
  };
  return { typed, setTyped, result, error, working, submit };
}
