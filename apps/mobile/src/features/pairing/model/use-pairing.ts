import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner-native';

import { pairing, pairingErrorCode, type PairingErrorCode } from '../../../shared/api/pairing';
import { PairingController, type PairingSnapshot } from './pairing-controller';

export function usePairing() {
  const { t } = useTranslation();
  const translate = useRef(t);
  translate.current = t;
  const controller = useRef<PairingController | null>(null);
  const [snapshot, setSnapshot] = useState<PairingSnapshot>({
    status: null, error: null, action: null, scanLocked: true, uncertain: false,
  });
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const activeSession = useRef(AppState.currentState === 'active');

  useEffect(() => {
    activeSession.current = AppState.currentState === 'active';
    const owned = new PairingController(pairing);
    controller.current = owned;
    setSnapshot(owned.getSnapshot());
    let lastError: PairingErrorCode | null = null;
    const notifyError = (error: PairingErrorCode | null) => {
      if (error && error !== lastError) toast.error(translate.current(`pairing.errors.${error}`));
      lastError = error;
    };
    const unsubscribe = owned.subscribe(() => {
      const next = owned.getSnapshot();
      notifyError(next.error);
      setSnapshot(next);
    });
    void owned.refresh();
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') void owned.refresh();
    }, 1500);
    const subscription = AppState.addEventListener('change', (state) => {
      activeSession.current = state === 'active';
      if (!activeSession.current) owned.stopScanning();
      setForeground(activeSession.current);
      if (activeSession.current) void owned.refresh();
    });
    return () => {
      activeSession.current = false;
      clearInterval(interval);
      subscription.remove();
      unsubscribe();
      controller.current = null;
      // Closing I/O is not an explicit abandonment/revocation or distributed rollback.
      void owned.close().catch((error: unknown) => {
        notifyError(pairingErrorCode(error));
      });
    };
  }, []);

  return {
    snapshot,
    foreground,
    armScan: () => activeSession.current && (controller.current?.armScan() ?? false),
    scan: (qr: string) => activeSession.current ? controller.current?.scan(qr) : undefined,
    stopScanning: () => controller.current?.stopScanning(),
    cancel: () => controller.current?.cancel(),
    resume: () => controller.current?.resume(),
    refresh: () => controller.current?.refresh(),
    removePairing: (recordId: string, online: boolean) =>
      activeSession.current ? controller.current?.removePairing(recordId, online) : undefined,
    decide: (decision: 'approve' | 'deny', operationId: string, generation: string) =>
      controller.current?.decide(decision, operationId, generation),
  };
}
