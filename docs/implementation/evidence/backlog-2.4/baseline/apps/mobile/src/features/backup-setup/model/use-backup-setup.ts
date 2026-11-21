import { requireOptionalNativeModule } from 'expo';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState } from 'react-native';
import type { NativeDirectorySource, NativePhotoAlbum, NativePhotoSource, NativeSchedule, NativeSourceAccess, NativeStorageConfig } from '../../../../modules/my-module/src/KlodaSyncRuntimeModule';
import { loadWebDavSettings, testAndSaveWebDavSettings } from '../../../shared/api/webdav-settings';
import type { MobileStorageForm } from '../../../shared/api/webdav';

interface NativeScheduleRuntime {
  loadDirectorySources(): Promise<NativeDirectorySource[]>;
  loadPhotoSources(): Promise<NativePhotoSource[]>;
  loadSchedule(): Promise<NativeSchedule>;
  loadStorageConfig(): Promise<NativeStorageConfig | null>;
  pickDirectory(request: string): Promise<NativeDirectorySource | null>;
  loadPhotoAlbums(): Promise<NativePhotoAlbum[]>;
  removeDirectorySource(id: string): Promise<void>;
  removePhotoSource(id: string): Promise<void>;
  selectPhotoAlbum(id: string): Promise<NativePhotoSource | null>;
  selectPhotoLibrary(): Promise<NativePhotoSource | null>;
  validateDirectorySources(): Promise<NativeSourceAccess[]>;
  saveSchedule(intervalHours: 12 | 24, localTime: string): Promise<void>;
  saveLiveSchedule?(): Promise<void>;
  saveStorageConfig(endpoint: string, targetPath: string, username: string): Promise<void>;
}

const runtime = requireOptionalNativeModule<NativeScheduleRuntime>('KlodaSyncRuntime');

export function useBackupSetup() {
  const { t } = useTranslation();
  const [backupMode, setBackupMode] = useState<'live' | 'scheduled'>('scheduled');
  const [intervalHours, setIntervalHours] = useState<12 | 24>(12);
  const [localTime, setLocalTime] = useState('12:00');
  const [sources, setSources] = useState<(NativeDirectorySource | NativePhotoSource)[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [storage, setStorage] = useState<MobileStorageForm>({ endpoint: '', password: '', targetPath: 'Kloda', username: '' });
  const [photoAlbums, setPhotoAlbums] = useState<NativePhotoAlbum[]>([]);
  const [sourceAccess, setSourceAccess] = useState<Record<string, boolean>>({});
  const [savedStorage, setSavedStorage] = useState<Omit<MobileStorageForm, 'password'> | null>(null);
  const [storageTested, setStorageTested] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const storageVersion = useRef(0);
  const testingStorage = useRef(false);
  const [storageTesting, setStorageTesting] = useState(false);
  const storageAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    void runtime?.loadSchedule().then((schedule) => {
      setBackupMode(schedule.backupMode === 'live' && runtime?.saveLiveSchedule ? 'live' : 'scheduled');
      setIntervalHours(schedule.intervalHours);
      setLocalTime(schedule.localTime);
    }).catch(() => setMessage(t('onboarding.runtimeUnavailable')));
    void runtime?.loadDirectorySources().then((directorySources) => setSources((currentSources) => [...currentSources, ...directorySources])).catch(() => setMessage(t('onboarding.sourceUnavailable')));
    void runtime?.loadPhotoSources?.().then((photoSources) => setSources((currentSources) => [...currentSources, ...photoSources])).catch(() => setMessage(t('onboarding.sourceUnavailable')));
    const version = storageVersion.current;
    void loadWebDavSettings().then(async (saved) => {
      const config = saved?.config ?? await runtime?.loadStorageConfig();
      if (config && version === storageVersion.current) {
        setStorage({ ...config, password: '' });
        setSavedStorage(config);
        setStorageTested(saved?.testedAt != null);
        setStorageWarning(saved?.probeWarning === true);
      }
    }).catch(() => setMessage(t('onboarding.webdavErrors.webdav_storage')));
    void runtime?.validateDirectorySources().then((access) => setSourceAccess(Object.fromEntries(access.map(({ accessible, id }) => [id, accessible])))).catch(() => setMessage(t('onboarding.sourceUnavailable')));
  }, []);

  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state !== 'active') { storageVersion.current += 1; storageAbort.current?.abort(); setStorageTested(false); }
    });
    return () => { storageVersion.current += 1; storageAbort.current?.abort(); listener.remove(); };
  }, []);

  const saveSchedule = async () => {
    if (sources.length === 0) return setMessage(t('onboarding.sourceRequired'));
    if (backupMode === 'scheduled' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(localTime)) return setMessage(t('onboarding.invalidTime'));
    if (!runtime) return setMessage(t('onboarding.runtimeUnavailable'));
    try {
      if (backupMode === 'live') {
        if (!runtime.saveLiveSchedule) throw new Error('native_unsupported');
        await runtime.saveLiveSchedule();
      } else await runtime.saveSchedule(intervalHours, localTime);
      setMessage(null);
      return true;
    } catch { setMessage(t('onboarding.saveError')); }
  };
  const sourceAction = (action: () => Promise<void>) => {
    setMessage(null);
    void action().catch(() => setMessage(t('onboarding.sourceUnavailable')));
  };
  const selectDirectory = async () => {
    if (!runtime) return setMessage(t('onboarding.runtimeUnavailable'));
    const selected = await runtime.pickDirectory('source');
    if (selected) {
      setSources((currentSources) => currentSources.some(({ id }) => id === selected.id) ? currentSources : [...currentSources, selected]);
      setSourceAccess((currentAccess) => ({ ...currentAccess, [selected.id]: true }));
    }
  };

  const selectPhotoLibrary = async () => {
    if (!runtime) return setMessage(t('onboarding.runtimeUnavailable'));
    const selected = await runtime.selectPhotoLibrary();
    if (selected) setSources((currentSources) => currentSources.some(({ id }) => id === selected.id) ? currentSources : [...currentSources, selected]);
    else setMessage(t('onboarding.sourceUnavailable'));
  };

  const removeSource = async (source: NativeDirectorySource | NativePhotoSource) => {
    if (!runtime) return setMessage(t('onboarding.runtimeUnavailable'));
    if (source.kind === 'directory') await runtime.removeDirectorySource(source.id);
    else await runtime.removePhotoSource(source.id);
    setSources((currentSources) => currentSources.filter(({ id }) => id !== source.id));
    setSourceAccess((currentAccess) => {
      const remainingAccess = { ...currentAccess };
      delete remainingAccess[source.id];
      return remainingAccess;
    });
  };

  const loadPhotoAlbums = async () => {
    if (!runtime) return setMessage(t('onboarding.runtimeUnavailable'));
    setPhotoAlbums(await runtime.loadPhotoAlbums());
  };

  const selectPhotoAlbum = async (album: NativePhotoAlbum) => {
    if (!runtime) return setMessage(t('onboarding.runtimeUnavailable'));
    const selected = await runtime.selectPhotoAlbum(album.id);
    if (selected) setSources((currentSources) => currentSources.some(({ id }) => id === selected.id) ? currentSources : [...currentSources, selected]);
    else setMessage(t('onboarding.sourceUnavailable'));
  };

  const editStorage = (field: keyof MobileStorageForm, value: string) => {
    storageVersion.current += 1;
    storageAbort.current?.abort();
    setStorage((current) => ({ ...current, [field]: value }));
    setStorageTested(false);
    setMessage(null);
  };

  const testStorage = async () => {
    if (!runtime) return setMessage(t('onboarding.runtimeUnavailable'));
    if (testingStorage.current) return;
    testingStorage.current = true; setStorageTesting(true);
    const version = ++storageVersion.current;
    const controller = new AbortController(); storageAbort.current = controller;
    setStorageTested(false);
    setMessage(null);
    try {
      const saved = await testAndSaveWebDavSettings(storage, () => version === storageVersion.current, controller.signal);
      if (version !== storageVersion.current) return;
      setStorageTested(true);
      setSavedStorage(saved.config);
    } catch (error) {
      const uncertain = error instanceof Error && ['webdav_cancelled_probe', 'webdav_probe_incomplete'].includes(error.message);
      if (uncertain) setStorageWarning(true);
      if (version === storageVersion.current) {
        setStorageTested(false);
        setMessage(uncertain ? null : t(`onboarding.webdavErrors.${error instanceof Error ? error.message : 'webdav_connection'}`, { defaultValue: t('onboarding.testError') }));
      }
    } finally { testingStorage.current = false; setStorageTesting(false); if (storageAbort.current === controller) storageAbort.current = null; }
  };

  const leaveStorage = () => { storageVersion.current += 1; storageAbort.current?.abort(); setStorageTested(false); };
  return { backupMode, setBackupMode, intervalHours, setIntervalHours, localTime, setLocalTime,
    sources, message, photoAlbums, sourceAccess, storage, storageTested, storageWarning, storageTesting, savedStorage,
    sourceAction, selectDirectory, selectPhotoLibrary, removeSource, loadPhotoAlbums, selectPhotoAlbum,
    saveSchedule, editStorage, testStorage, leaveStorage,
    supportsLive: !!runtime?.saveLiveSchedule, supportsPhotos: !!runtime?.selectPhotoLibrary,
    supportsAlbums: !!runtime?.loadPhotoAlbums };
}
export type BackupSetupModel = ReturnType<typeof useBackupSetup>;
