import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { fileTransfer, photoManifestPrefix, type CompletedBackup, type CompletedBackups, type FileQueue, type PhotosImportStatus } from '../../../shared/api/file-transfer';
import { backupDestinations } from '../../../shared/api/backup-destinations';
import { pairing } from '../../../shared/api/pairing';

export function useFileTransfer() {
  const [queue, setQueue] = useState<FileQueue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [webdavActionError, setWebdavActionError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [peer, setPeer] = useState<string | null>(null);
  const [backups, setBackups] = useState<CompletedBackups | null>(null);
  const [backupRecord, setBackupRecord] = useState<string | null>(null);
  const [restored, setRestored] = useState<CompletedBackup | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [photos, setPhotos] = useState<PhotosImportStatus | null>(null);
  const restoreActive = useRef(false);
  const permissionActive = useRef(false);
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
        try {
          const imports = await fileTransfer.photoStatus();
          if (mounted.current && foreground.current && version === epoch.current) setPhotos(imports);
        } catch (cause) {
          if (mounted.current && foreground.current && version === epoch.current) {
            setPhotos(null); setError(cause instanceof Error ? cause.message : 'outcome_unknown');
          }
        }
      } catch (cause) {
        if (mounted.current && foreground.current && version === epoch.current) { setQueue(null); setError(cause instanceof Error ? cause.message : 'outcome_unknown'); }
      } finally {
        reading = false;
        if (mounted.current && foreground.current) timer = setTimeout(() => void read(), 1000);
      }
    };
    const subscription = AppState.addEventListener('change', (state) => {
      foreground.current = state === 'active';
      if (!restoreActive.current && !permissionActive.current) epoch.current += 1;
      clearTimeout(timer);
      if (foreground.current) void read();
    });
    void read();
    return () => {
      mounted.current = false;
      epoch.current += 1;
      clearTimeout(timer);
      subscription.remove();
      void fileTransfer.cancelRestore().catch(() => undefined);
    };
  }, []);

  const requestNotifications = useCallback(async () => {
    permissionActive.current = true;
    try { await fileTransfer.requestNotifications(); }
    finally { permissionActive.current = false; }
  }, []);
  const run = useCallback(async (job?: { id: string; recordId: string }) => {
    if (action.current || !foreground.current) return;
    action.current = true;
    const version = ++epoch.current;
    setWorking(true);
    setActionError(null);
    try {
      await requestNotifications();
      if (!mounted.current || !foreground.current || version !== epoch.current) return;
      const current = () => mounted.current && foreground.current && version === epoch.current;
      let selected = false, pcFailed = false, davFailed = false;
      setWebdavActionError(null);
      await Promise.allSettled([
        (async () => {
          try {
            if (!job && !await backupDestinations.pcSelected()) return;
            if (!current()) return;
            const target = await pairing.status();
            if (!current()) return;
            if (target.phase !== 'complete' || !target.recordId || !target.peerFingerprint) throw new Error('pairing_required');
            if (!job && !await backupDestinations.pcEnabled(target.recordId)) return;
            if (!current()) return;
            selected = true; setPeer(target.peerFingerprint);
            const observed = job ? await fileTransfer.rebackup(target.recordId, job.id) : await fileTransfer.run(target.recordId);
            if (current()) { setQueue(observed); setError(observed.errorCode ?? null); }
          } catch (cause) {
            pcFailed = true;
            if (current()) setActionError(cause instanceof Error ? cause.message : 'outcome_unknown');
          }
        })(),
        ...(job ? [] : [(async () => {
          try {
            const target = await backupDestinations.status();
            if (!current() || !target.enabled) return;
            selected = true;
            if (!target.running) await backupDestinations.run();
          } catch (cause) {
            davFailed = true;
            if (current()) setWebdavActionError(cause instanceof Error ? cause.message : 'outcome_unknown');
          }
        })()]),
      ]);
      if (current() && !selected && !pcFailed && !davFailed) setActionError('destination_required');
    } catch (cause) {
      if (mounted.current && version === epoch.current) setActionError(cause instanceof Error ? cause.message : 'outcome_unknown');
    } finally {
      action.current = false;
      if (mounted.current) setWorking(false);
    }
  }, [requestNotifications]);
  const automatic = useCallback(async (resume: boolean) => {
    if (action.current || !foreground.current) return;
    action.current = true;
    const version = ++epoch.current;
    setWorking(true);
    setActionError(null);
    try {
      if (resume) {
        await requestNotifications();
        if (!mounted.current || !foreground.current || version !== epoch.current) return;
      }
      const observed = resume ? await fileTransfer.resumeAutomatic() : await fileTransfer.pause();
      if (mounted.current && foreground.current && version === epoch.current) { setQueue(observed); setError(observed.errorCode ?? null); }
    } catch (cause) {
      if (mounted.current && version === epoch.current) setActionError(cause instanceof Error ? cause.message : 'outcome_unknown');
    } finally {
      action.current = false;
      if (mounted.current) setWorking(false);
    }
  }, [requestNotifications]);
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
  return { queue, error: error ?? actionError, webdavActionError, working, peer, run, pause: () => automatic(false), resumeAutomatic: () => automatic(true), backups, restored, restoring, ownBackup, cancelRestore, photos };
}
