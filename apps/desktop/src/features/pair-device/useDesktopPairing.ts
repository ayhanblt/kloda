import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
  getPairingBridge, pairingErrorCode, type DesktopPairingBridge,
  type PairingErrorCode, type PairingPhase, type PairingStatus,
} from '../../shared/api/pairing';

export type PairingAction = 'create' | 'approve' | 'deny' | 'cancel' | 'resume' | 'approve-backup' | 'revoke-backup' | 'refresh';

export interface DesktopPairingController {
  status: PairingStatus | null;
  busy: PairingAction | null;
  error: PairingErrorCode | null;
  uncertain: boolean;
  available: boolean;
  create(): Promise<void>;
  approve(operationId: string, generation: string): Promise<void>;
  deny(operationId: string, generation: string): Promise<void>;
  cancel(operationId: string): Promise<void>;
  resume(recordId: string): Promise<void>;
  approveBackup(recordId: string): Promise<void>;
  revokeBackup(recordId: string): Promise<void>;
  refresh(): Promise<void>;
}
interface Runtime {
  alive: boolean;
  bridge: DesktopPairingBridge | null;
  status: PairingStatus | null;
  timer?: number;
  flight: Promise<void> | null;
  commanding: boolean;
  uncertain: boolean;
  lastError?: PairingErrorCode;
}

const activePhases: Partial<Record<PairingPhase, true>> = {
  open: true, reserved: true, consumed_pending_ack: true, pending: true, connecting: true,
};

export function useDesktopPairing(): DesktopPairingController {
  const { t } = useTranslation();
  const translate = useRef(t);
  translate.current = t;
  const runtime = useRef<Runtime | null>(null);
  const [status, setStatus] = useState<PairingStatus | null>(null);
  const [busy, setBusy] = useState<PairingAction | null>(null);
  const [error, setError] = useState<PairingErrorCode | null>(null);
  const [uncertain, setUncertain] = useState(true);
  const [available, setAvailable] = useState(false);

  function report(current: Runtime, reason: unknown, uncertain = true) {
    if (!current.alive) return;
    const code = pairingErrorCode(reason);
    setError(code);
    current.uncertain = uncertain;
    setUncertain(uncertain);
    if (current.lastError !== code) toast.error(translate.current(`pairing.errors.${code}`));
    current.lastError = code;
  }

  function accept(current: Runtime, next: PairingStatus) {
    if (!current.alive) return;
    const previous = current.status;
    current.status = next;
    setStatus(next);
    current.uncertain = false;
    setUncertain(false);
    if (next.errorCode !== undefined) report(current, { code: next.errorCode }, false);
    else {
      current.lastError = undefined;
      setError(null);
    }
    if (previous && previous.phase !== next.phase) {
      if (next.phase === 'complete') toast.success(translate.current('pairing.completedNotice'));
      if (next.phase === 'consumed_pending_ack') toast.info(translate.current('pairing.pendingNotice'));
    }
  }

  function stopTimer(current: Runtime) {
    window.clearTimeout(current.timer);
    current.timer = undefined;
  }

  function schedule(current: Runtime) {
    stopTimer(current);
    if (!current.alive || current.commanding || !current.status || !activePhases[current.status.phase]) return;
    current.timer = window.setTimeout(() => { void readStatus(current); }, 1500);
  }

  function readStatus(current: Runtime): Promise<void> {
    if (current.flight) return current.flight;
    if (!current.bridge || !current.alive) return Promise.resolve();
    current.flight = (async () => {
      try { accept(current, await current.bridge!.status()); }
      catch (reason) { report(current, reason); }
    })().finally(() => {
      current.flight = null;
      schedule(current);
    });
    return current.flight;
  }

  useEffect(() => {
    const current: Runtime = {
      alive: true, bridge: null, status: null, flight: null, commanding: false, uncertain: true,
    };
    runtime.current = current;
    try {
      current.bridge = getPairingBridge();
      setAvailable(true);
      void readStatus(current);
    } catch (reason) { report(current, reason); }
    return () => {
      current.alive = false;
      stopTimer(current);
      // React StrictMode replays effects; only a real departure closes the native UI session.
      queueMicrotask(() => {
        if (runtime.current === current) void current.bridge?.close().catch(() => undefined);
      });
    };
  }, []);

  async function execute(
    action: PairingAction,
    operation: (bridge: DesktopPairingBridge) => Promise<PairingStatus>,
    guard?: (current: Runtime) => boolean,
  ) {
    const current = runtime.current;
    if (!current?.alive || !current.bridge || current.commanding) return;
    current.commanding = true;
    stopTimer(current);
    setBusy(action);
    try {
      await current.flight;
      if (!current.alive || (guard && !guard(current))) return;
      accept(current, await operation(current.bridge));
    } catch (reason) {
      report(current, reason);
      // Resolve uncertain durable outcomes from native storage, never optimistic renderer state.
      if (current.alive) await readStatus(current);
    } finally {
      current.commanding = false;
      if (current.alive) setBusy(null);
      schedule(current);
    }
  }

  function manageBackup(action: 'approve-backup' | 'revoke-backup', recordId: string) {
    return execute(action, (bridge) => action === 'approve-backup'
      ? bridge.approveBackup(recordId) : bridge.revokeBackup(recordId),
    (current) => !current.uncertain && Boolean(recordId) && current.status?.phase === 'complete' &&
      current.status.recordId === recordId &&
      (action !== 'revoke-backup' || current.status.backupScope?.state === 'approved' ||
        current.status.backupScope?.state === 'unavailable'));
  }

  return {
    status, busy, error, uncertain, available,
    create: () => execute('create', (bridge) => bridge.createInvitation()),
    approve: (operationId: string, generation: string) => execute('approve', (bridge) => bridge.approve(operationId, generation)),
    deny: (operationId: string, generation: string) => execute('deny', (bridge) => bridge.deny(operationId, generation)),
    cancel: (operationId: string) => execute('cancel', (bridge) => bridge.cancel(operationId)),
    resume: (recordId: string) => execute('resume', (bridge) => bridge.resume(recordId)),
    approveBackup: (recordId: string) => manageBackup('approve-backup', recordId),
    revokeBackup: (recordId: string) => manageBackup('revoke-backup', recordId),
    refresh: () => execute('refresh', (bridge) => bridge.status()),
  };
}
