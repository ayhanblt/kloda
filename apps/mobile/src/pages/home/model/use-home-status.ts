import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { backupDestinations } from '../../../shared/api/backup-destinations';
import { useFileTransfer } from '../../../features/file-transfer/model/use-file-transfer';
import { useWebDavBackup } from '../../../features/backup-setup/model/use-webdav-backup';
import { homeStatus } from './home-status';
import { useOtherTargets } from './use-other-targets';

export function useHomeStatus(sourceCount: number) {
  const transfer = useFileTransfer();
  const webdav = useWebDavBackup();
  const others = useOtherTargets();
  const [pcSelected, setPcSelected] = useState<boolean | null>(null);
  const epoch = useRef(0);
  useEffect(() => {
    let mounted = true;
    const read = async () => {
      const version = ++epoch.current; setPcSelected(null);
      if (AppState.currentState !== 'active') return;
      try { const selected = await backupDestinations.pcSelected(); if (mounted && version === epoch.current) setPcSelected(selected); }
      catch { if (mounted && version === epoch.current) setPcSelected(null); }
    };
    void read();
    const listener = AppState.addEventListener('change', () => { void read(); });
    return () => { mounted = false; epoch.current += 1; listener.remove(); };
  }, []);
  const status = homeStatus({ sourceCount, pcSelected, queue: transfer.queue, webdav: webdav.status,
    pcError: transfer.error, webdavError: webdav.error ?? transfer.webdavActionError, others });
  return { ...status, transfer, webdav, pcSelected, others };
}
