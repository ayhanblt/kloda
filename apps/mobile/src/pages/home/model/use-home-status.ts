import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { backupDestinations } from '../../../shared/api/backup-destinations';
import { pairing, type PcScopeStatus } from '../../../shared/api/pairing';
import { useFileTransfer } from '../../../features/file-transfer/model/use-file-transfer';
import { useWebDavBackup } from '../../../features/backup-setup/model/use-webdav-backup';
import { homeStatus } from './home-status';
import { useOtherTargets } from './use-other-targets';

export function useHomeStatus(sourceCount: number) {
  const transfer = useFileTransfer();
  const webdav = useWebDavBackup();
  const others = useOtherTargets();
  const [pcSelected, setPcSelected] = useState<boolean | null>(null);
  const [pcScope, setPcScope] = useState<PcScopeStatus | null>(null);
  const [pcName, setPcName] = useState<string | null>(null);
  const epoch = useRef(0);
  useEffect(() => {
    let mounted = true;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    const readScopeAndName = async (version: number) => {
      const [scopeRes, pairingRes] = await Promise.allSettled([
        pairing.pcScopeStatus?.() ?? Promise.resolve(null),
        pairing.status?.() ?? Promise.resolve(null),
      ]);
      if (!mounted || version !== epoch.current || AppState.currentState !== 'active') return;
      const scope = scopeRes.status === 'fulfilled' ? scopeRes.value : null;
      const statusName = pairingRes.status === 'fulfilled' ? pairingRes.value?.peerName : undefined;
      setPcScope(scope);
      setPcName(scope?.peerName || statusName || null);
      if (scope?.state === 'not_approved') {
        pollTimer = setTimeout(() => { void readScopeAndName(version); }, 3000);
      }
    };
    const read = async () => {
      clearTimeout(pollTimer);
      const version = ++epoch.current; setPcSelected(null); setPcScope(null);
      if (AppState.currentState !== 'active') return;
      try {
        const selected = await backupDestinations.pcSelected();
        if (!mounted || version !== epoch.current) return;
        setPcSelected(selected);
        if (selected) {
          void readScopeAndName(version);
        } else {
          setPcName(null);
        }
      } catch {
        if (mounted && version === epoch.current) { setPcSelected(null); setPcScope(null); }
      }
    };
    void read();
    const listener = AppState.addEventListener('change', () => { void read(); });
    return () => { mounted = false; epoch.current += 1; clearTimeout(pollTimer); listener.remove(); };
  }, []);
  const status = homeStatus({ sourceCount, pcSelected, pcScopeState: pcScope?.state ?? null, queue: transfer.queue,
    webdav: webdav.status, pcError: transfer.error, webdavError: webdav.error ?? transfer.webdavActionError, others });
  return { ...status, transfer, webdav, pcSelected, pcScope, pcName, others };
}
