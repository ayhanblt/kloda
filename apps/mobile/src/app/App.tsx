import { requireOptionalNativeModule } from 'expo';
import { ScanQrCode } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeDirectorySource, NativePhotoAlbum, NativePhotoSource, NativeSchedule, NativeSourceAccess, NativeStorageConfig } from '../../modules/my-module/src/KlodaSyncRuntimeModule';
import '../shared/i18n';
import { loadWebDavSettings, testAndSaveWebDavSettings } from '../shared/api/webdav-settings';
import type { MobileStorageForm } from '../shared/api/webdav';
import { PairingButton } from '../features/pairing/ui/pairing-button';
import { PairingPage } from '../pages/pairing/ui/pairing-page';
import { ComputerPage } from '../pages/computer/ui/computer-page';
import { ActivityPage } from '../pages/activity/ui/activity-page';
import { colors } from '../shared/ui/tokens';

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

export function App() {
  const { t } = useTranslation();
  const [backupMode, setBackupMode] = useState<'live' | 'scheduled'>('scheduled');
  const [intervalHours, setIntervalHours] = useState<12 | 24>(12);
  const [localTime, setLocalTime] = useState('12:00');
  const [sources, setSources] = useState<(NativeDirectorySource | NativePhotoSource)[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [storage, setStorage] = useState<MobileStorageForm>({ endpoint: '', password: '', targetPath: 'Kloda', username: '' });
  const [photoAlbums, setPhotoAlbums] = useState<NativePhotoAlbum[]>([]);
  const [sourceAccess, setSourceAccess] = useState<Record<string, boolean>>({});
  const [storageTested, setStorageTested] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const storageVersion = useRef(0);
  const testingStorage = useRef(false);
  const [storageTesting, setStorageTesting] = useState(false);
  const storageAbort = useRef<AbortController | null>(null);
  const [step, setStep] = useState<'sources' | 'computer' | 'storage'>('sources');
  const [page, setPage] = useState<'setup' | 'pairing' | 'activity'>('setup');

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
      setStep('computer');
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
      await testAndSaveWebDavSettings(storage, () => version === storageVersion.current, controller.signal);
      if (version !== storageVersion.current) return;
      setStorageTested(true);
    } catch (error) {
      const uncertain = error instanceof Error && ['webdav_cancelled_probe', 'webdav_probe_incomplete'].includes(error.message);
      if (uncertain) setStorageWarning(true);
      if (version === storageVersion.current) {
        setStorageTested(false);
        setMessage(uncertain ? null : t(`onboarding.webdavErrors.${error instanceof Error ? error.message : 'webdav_connection'}`, { defaultValue: t('onboarding.testError') }));
      }
    } finally { testingStorage.current = false; setStorageTesting(false); if (storageAbort.current === controller) storageAbort.current = null; }
  };

  if (page === 'pairing') return <PairingPage onBack={() => setPage('setup')} onContinue={() => setPage('activity')} />;
  if (page === 'activity') return <ActivityPage onBack={() => setPage('setup')} />;

  if (step === 'computer') return <ComputerPage onBack={() => setStep('sources')} onPair={() => setPage('pairing')}
    onActivity={() => setPage('activity')} onAdvanced={() => setStep('storage')} />;

  if (step === 'storage') {
    const leaveStorage = () => { storageVersion.current += 1; storageAbort.current?.abort(); setStorageTested(false); };
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ flexGrow: 1, gap: 16, padding: 24, width: '100%', maxWidth: 680, alignSelf: 'center' }}>
        <PairingButton secondary onPress={() => { leaveStorage(); setStep('computer'); }} label={t('onboarding.back')} />
        <PairingButton label={t('pairing.open')} secondary icon={<ScanQrCode color={colors.ink} size={20} />} onPress={() => { leaveStorage(); setPage('pairing'); }} />
        <PairingButton label={t('transfer.title')} secondary onPress={() => { leaveStorage(); setPage('activity'); }} />
        <Text accessibilityRole="header" className="text-3xl font-bold text-ink">{t('onboarding.storageTitle')}</Text>
        <Text className="text-base text-muted">{t('onboarding.storageDescription')}</Text>
        <Text className="text-sm text-muted">{t('onboarding.webdavScope')}</Text>
        <View className="gap-2">
          <Text className="text-sm font-semibold text-ink">{t('onboarding.endpoint')}</Text>
          <TextInput accessibilityLabel={t('onboarding.endpoint')} autoCapitalize="none" className="rounded-lg border border-border bg-white p-3 text-ink" onChangeText={(value) => editStorage('endpoint', value)} value={storage.endpoint} />
        </View>
        <View className="gap-2">
          <Text className="text-sm font-semibold text-ink">{t('onboarding.targetPath')}</Text>
          <TextInput accessibilityLabel={t('onboarding.targetPath')} autoCapitalize="none" className="rounded-lg border border-border bg-white p-3 text-ink" onChangeText={(value) => editStorage('targetPath', value)} value={storage.targetPath} />
        </View>
        <View className="gap-2">
          <Text className="text-sm font-semibold text-ink">{t('onboarding.username')}</Text>
          <TextInput accessibilityLabel={t('onboarding.username')} autoCapitalize="none" className="rounded-lg border border-border bg-white p-3 text-ink" onChangeText={(value) => editStorage('username', value)} value={storage.username} />
        </View>
        <View className="gap-2">
          <Text className="text-sm font-semibold text-ink">{t('onboarding.password')}</Text>
          <TextInput accessibilityLabel={t('onboarding.password')} autoCapitalize="none" className="rounded-lg border border-border bg-white p-3 text-ink" onChangeText={(value) => editStorage('password', value)} secureTextEntry value={storage.password} />
        </View>
        <PairingButton secondary disabled={storageTesting} onPress={() => void testStorage()} label={t(storageTesting ? 'onboarding.testingConnection' : 'onboarding.testConnection')} />
        {storageWarning && <Text accessibilityRole="alert" className="text-sm text-muted">{t('onboarding.webdavErrors.webdav_probe_incomplete')}</Text>}
        {storageTested && <Text className="text-sm text-muted">{t('onboarding.storageTested')}</Text>}
        {message && <Text accessibilityRole="alert" className="text-sm text-muted">{message}</Text>}
      </ScrollView>
      </SafeAreaView>
    );
  }


  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
    <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ flexGrow: 1, gap: 16, padding: 24, width: '100%', maxWidth: 680, alignSelf: 'center' }}>
      <PairingButton label={t('pairing.open')} secondary icon={<ScanQrCode color={colors.ink} size={20} />} onPress={() => setPage('pairing')} />
      <PairingButton label={t('transfer.title')} secondary onPress={() => setPage('activity')} />
      <Text className="text-lg font-bold text-ink">{t('pairing.brand')}</Text>
      <Text className="text-xs font-semibold uppercase text-muted">{t('onboarding.step', { current: 1, total: 2 })}</Text>
      <Text accessibilityRole="header" className="text-3xl font-bold text-ink">{t('onboarding.title')}</Text>
      <Text className="text-base text-muted">{t('onboarding.description')}</Text>
      <PairingButton secondary onPress={() => sourceAction(selectDirectory)} label={t('onboarding.chooseFolder')} />
      {runtime?.selectPhotoLibrary && <PairingButton secondary onPress={() => sourceAction(selectPhotoLibrary)} label={t('onboarding.choosePhotoLibrary')} />}
      {runtime?.loadPhotoAlbums && <PairingButton secondary onPress={() => sourceAction(loadPhotoAlbums)} label={t('onboarding.choosePhotoAlbum')} />}
      {photoAlbums.map((album) => <PairingButton secondary key={album.id} onPress={() => sourceAction(() => selectPhotoAlbum(album))} label={album.displayName} />)}
      {sources.map((source) => <View className="flex-row items-center justify-between" key={source.id}><View style={{ flex: 1 }}><Text className="text-sm text-muted">{source.displayName}</Text>{source.kind === 'directory' && sourceAccess[source.id] === false && <Text accessibilityRole="alert" className="text-sm text-red-600">{t('onboarding.sourceUnavailable')}</Text>}</View><PairingButton secondary onPress={() => sourceAction(() => removeSource(source))} label={t('onboarding.removeSource', { name: source.displayName })} /></View>)}
      {sources.length > 0 && <Text className="text-sm text-muted">{t('onboarding.sourcesSelected')}</Text>}
      <Text className="text-sm text-muted">{t(runtime?.saveLiveSchedule ? (Platform.OS === 'ios' ? 'computer.iosSchedulePreference' : 'computer.androidSchedulePreference') : 'computer.schedulePreference')}</Text>
      <View className="gap-2">
        {runtime?.saveLiveSchedule && <PairingButton secondary onPress={() => setBackupMode('live')} label={t(backupMode === 'live' ? 'onboarding.liveSelected' : 'onboarding.live')} />}
        <PairingButton secondary onPress={() => { setBackupMode('scheduled'); setIntervalHours(12); }} label={backupMode === 'scheduled' && intervalHours === 12 ? t('onboarding.everyHoursSelected', { hours: 12 }) : t('onboarding.everyHours', { hours: 12 })} />
        <PairingButton secondary onPress={() => { setBackupMode('scheduled'); setIntervalHours(24); }} label={backupMode === 'scheduled' && intervalHours === 24 ? t('onboarding.everyHoursSelected', { hours: 24 }) : t('onboarding.everyHours', { hours: 24 })} />
      </View>
      {backupMode === 'live' ? <Text style={{ color: colors.muted }}>{t('onboarding.liveDescription')}</Text>
        : <TextInput accessibilityLabel={t('onboarding.localStartTime')} className="rounded-lg border border-border bg-white p-3 text-ink" onChangeText={setLocalTime} value={localTime} />}
      <PairingButton onPress={() => void saveSchedule()} label={t('onboarding.saveSchedule')} />
      {message && <Text accessibilityRole="alert" className="text-sm text-muted">{message}</Text>}
    </ScrollView>
    </SafeAreaView>
  );
}

