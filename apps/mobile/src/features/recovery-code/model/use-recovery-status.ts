import { useEffect, useState } from 'react';
import { recoveryCode, type RecoveryState } from '../../../shared/api/recovery-code';

// Read-only state for the "Protected by the recovery code" line and the Settings entry; `refresh` re-reads it when the
// caller's data changes (an enable after confirmation). A failed read shows nothing rather than a guess.
export function useRecoveryStatus(refresh?: unknown): RecoveryState | null {
  const [state, setState] = useState<RecoveryState | null>(null);
  useEffect(() => {
    let live = true;
    void recoveryCode.status().then((value) => { if (live) setState(value); }, () => { if (live) setState(null); });
    return () => { live = false; };
  }, [refresh]);
  return state;
}
