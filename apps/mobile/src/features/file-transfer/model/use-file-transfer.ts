import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { fileTransfer, photoManifestPrefix, type CompletedBackup, type CompletedBackups, type FileQueue, type PhotosImportStatus } from '../../../shared/api/file-transfer';
import { pairing } from '../../../shared/api/pairing';

export function useFileTransfer() {
  const [queue, setQueue] = useState<FileQueue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [peer, setPeer] = useState<string | null>(null);
  const [backups, setBackups] = useState<CompletedBackups | null>(null);
  const [backupRecord, setBackupRecord] = useState<string | null>(null);
  const [restored, setRestored] = useState<CompletedBackup | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [photos, setPhotos] = useState<PhotosImportStatus | null>(null);
  const restoreActive = useRef(false);
  const epoch = useRef(0);
  const foreground = useRef(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const action = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    let timer: NodeJS.Timeout | undefined;
    let reading = false;
    const read = async () => {
      if (!mounted.current || !foreground.current || reading) return;
      if (action.current) { timer = setTimeout(() => void read(), 1000); return; }
      reading = true;
      const version = epoch.current;
      try {
        const observed = await fileTransfer.status();
        if (mounted.current && foreground.current && version === epoch.current) { setQueue(observed); setError(observed.errorCode ?? null); }
        const imports = await fileTransfer.photoStatus();
        if (mounted.current && foreground.current && version === epoch.current) setPhotos(imports);
      } catch (cause) {
        if (mounted.current && foreground.current && version === epoch.current) setError(cause instanceof Error ? cause.message : 'outcome_unknown');
      } finally {
        reading = false;
        if (mounted.current && foreground.current) timer = setTimeout(() => void read(), 1000);
      }
    };
    const subscription = AppState.addEventListener('change', (state) => {
      foreground.current = state === 'active';
      if (!restoreActive.current) epoch.current += 1;
      clearTimeout(timer);
      if (foreground.current) void read();
      else if (!restoreActive.current) void fileTransfer.pause().catch(() => undefined);
    });
    void read();
    return () => {
      mounted.current = false;
      epoch.current += 1;
      clearTimeout(timer);
      subscription.remove();
      void fileTransfer.cancelRestore().catch(() => undefined);
      void fileTransfer.pause().catch(() => undefined);
    };
  }, []);

  const run = useCallback(async () => {
    if (action.current || !foreground.current) return;
    action.current = true;
    const version = ++epoch.current;
    setWorking(true);
    setActionError(null);
    try {
      const target = await pairing.status();
      if (!mounted.current || !foreground.current || version !== epoch.current) return;
      if (target.phase !== 'complete' || !target.recordId || !target.peerFingerprint) throw new Error('pairing_required');
      setPeer(target.peerFingerprint);
      const observed = await fileTransfer.run(target.recordId);
      if (mounted.current && foreground.current && version === epoch.current) { setQueue(observed); setError(observed.errorCode ?? null); }
    } catch (cause) {
      if (mounted.current && version === epoch.current) setActionError(cause instanceof Error ? cause.message : 'outcome_unknown');
    } finally {
      action.current = false;
      if (mounted.current) setWorking(false);
    }
  }, []);
  const pause = useCallback(async () => {
    if (action.current) return;
    action.current = true;
    const version = ++epoch.current;
    setWorking(true);
    setActionError(null);
    try {
      const observed = await fileTransfer.pause();
      if (mounted.current && version === epoch.current) { setQueue(observed); setError(observed.errorCode ?? null); }
    } catch (cause) {
      if (mounted.current && version === epoch.current) setActionError(cause instanceof Error ? cause.message : 'outcome_unknown');
    } finally {
      action.current = false;
      if (mounted.current) setWorking(false);
    }
  }, []);
  const ownBackup = useCallback(async (backup?: CompletedBackup, more = false, allPhotos = false) => {
    if (action.current || !foreground.current) return;
    action.current = true;
    restoreActive.current = backup !== undefined || allPhotos;
    const version = ++epoch.current;
    setWorking(true);
    setRestoring(backup !== undefined || allPhotos);
    setRestored(null);
    setActionError(null);
    try {
      const target = await pairing.status();
      if (!mounted.current || !foreground.current || version !== epoch.current) return;
      if (target.phase !== 'complete' || !target.recordId || !target.peerFingerprint || target.repairRequired) throw new Error('pairing_required');
      if ((backup || more || allPhotos) && target.recordId !== backupRecord) {
        setBackups(null); setBackupRecord(null);
        throw new Error('pairing_required');
      }
      setPeer(target.peerFingerprint);
      if (allPhotos) {
        const observed = await fileTransfer.restorePhotos(target.recordId);
        if (mounted.current && foreground.current && version === epoch.current) setPhotos(observed);
      } else if (backup) {
        if (backup.name.startsWith(photoManifestPrefix)) {
          const observed = await fileTransfer.restorePhotos(target.recordId, backup);
          if (mounted.current && foreground.current && version === epoch.current) setPhotos(observed);
        } else {
          const observed = await fileTransfer.restore(target.recordId, backup);
          if (mounted.current && foreground.current && version === epoch.current) setRestored(observed);
        }
      } else {
        const after = more && backups ? backups.items[backups.items.length - 1]?.id : undefined;
        const observed = await fileTransfer.list(target.recordId, after);
        if (mounted.current && foreground.current && version === epoch.current) {
          setBackups({ items: more ? [...(backups?.items ?? []), ...observed.items] : observed.items, hasMore: observed.hasMore });
          setBackupRecord(target.recordId);
        }
      }
    } catch (cause) {
      if (mounted.current && version === epoch.current) setActionError(cause instanceof Error ? cause.message : 'outcome_unknown');
    } finally {
      restoreActive.current = false;
      action.current = false;
      if (mounted.current) { setWorking(false); setRestoring(false); }
    }
  }, [backups, backupRecord]);
  const cancelRestore = useCallback(async () => {
    epoch.current += 1;
    setRestored(null);
    setActionError('cancelled');
    try { await fileTransfer.cancelRestore(); }
    catch (cause) { if (mounted.current) setActionError(cause instanceof Error ? cause.message : 'outcome_unknown'); }
  }, []);
  return { queue, error: error ?? actionError, working, peer, run, pause, backups, restored, restoring, ownBackup, cancelRestore, photos };
}
