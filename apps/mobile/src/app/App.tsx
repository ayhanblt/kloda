import { requireOptionalNativeModule } from 'expo';
import { ScanQrCode } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ScrollView, Text, TextInput, View } from 'react-native';
import type { NativeDirectorySource, NativePhotoAlbum, NativePhotoSource, NativeSourceAccess, NativeStorageConfig } from '../../modules/my-module/src/KlodaSyncRuntimeModule';
import '../shared/i18n';
import { saveWebDavCredentials, testWebDavWriteAccess } from '../shared/api/webdav';
import type { MobileStorageForm } from '../shared/api/webdav';
import { PairingButton } from '../features/pairing/ui/pairing-button';
import { PairingPage } from '../pages/pairing/ui/pairing-page';
import { ActivityPage } from '../pages/activity/ui/activity-page';
import { colors } from '../shared/ui/tokens';

interface NativeScheduleRuntime {
  loadDirectorySources(): Promise<NativeDirectorySource[]>;
  loadPhotoSources(): Promise<NativePhotoSource[]>;
  loadSchedule(): Promise<{ intervalHours: 12 | 24; localTime: string }>;
  loadStorageConfig(): Promise<NativeStorageConfig | null>;
  pickDirectory(request: string): Promise<NativeDirectorySource | null>;
  loadPhotoAlbums(): Promise<NativePhotoAlbum[]>;
  removeDirectorySource(id: string): Promise<void>;
  removePhotoSource(id: string): Promise<void>;
  selectPhotoAlbum(id: string): Promise<NativePhotoSource | null>;
  selectPhotoLibrary(): Promise<NativePhotoSource | null>;
  validateDirectorySources(): Promise<NativeSourceAccess[]>;
  saveSchedule(intervalHours: 12 | 24, localTime: string): Promise<void>;
  saveStorageConfig(endpoint: string, targetPath: string, username: string): Promise<void>;
}

const runtime = requireOptionalNativeModule<NativeScheduleRuntime>('KlodaSyncRuntime');

export function App() {
  const { t } = useTranslation();
  const [intervalHours, setIntervalHours] = useState<12 | 24>(12);
  const [localTime, setLocalTime] = useState('12:00');
  const [sources, setSources] = useState<(NativeDirectorySource | NativePhotoSource)[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [storage, setStorage] = useState<MobileStorageForm>({ endpoint: '', password: '', targetPath: 'Kloda', username: '' });
  const [photoAlbums, setPhotoAlbums] = useState<NativePhotoAlbum[]>([]);
  const [sourceAccess, setSourceAccess] = useState<Record<string, boolean>>({});
  const [storageTested, setStorageTested] = useState(false);
  const storageVersion = useRef(0);
  const testingStorage = useRef(false);
  const [step, setStep] = useState<'sources' | 'storage'>('sources');
  const [page, setPage] = useState<'setup' | 'pairing' | 'activity'>('setup');

  useEffect(() => {
    void runtime?.loadSchedule().then((schedule) => {
      setIntervalHours(schedule.intervalHours);
      setLocalTime(schedule.localTime);
    });
    void runtime?.loadDirectorySources().then((directorySources) => setSources((currentSources) => [...currentSources, ...directorySources]));
    void runtime?.loadPhotoSources?.().then((photoSources) => setSources((currentSources) => [...currentSources, ...photoSources]));
    const version = storageVersion.current;
    void runtime?.loadStorageConfig().then((config) => {
      if (config && version === storageVersion.current) setStorage({ ...config, password: '' });
    });
    void runtime?.validateDirectorySources().then((access) => setSourceAccess(Object.fromEntries(access.map(({ accessible, id }) => [id, accessible]))));
  }, []);

  const saveSchedule = async () => {
    if (sources.length === 0) return setMessage(t('onboarding.sourceRequired'));
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(localTime)) return setMessage(t('onboarding.invalidTime'));
    if (!runtime) return setMessage(t('onboarding.runtimeUnavailable'));
    await runtime.saveSchedule(intervalHours, localTime);
    setStep('storage');
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
    setStorage((current) => ({ ...current, [field]: value }));
    setStorageTested(false);
    setMessage(null);
  };

  const testStorage = async () => {
    if (!runtime) return setMessage(t('onboarding.runtimeUnavailable'));
    if (testingStorage.current) return;
    testingStorage.current = true;
    const version = ++storageVersion.current;
    setStorageTested(false);
    setMessage(null);
    try {
      await testWebDavWriteAccess(storage);
      if (version !== storageVersion.current) return;
      // shortcut: credential/config writes are not atomic, bind them before native transfer adoption.
      await saveWebDavCredentials(storage);
      await runtime.saveStorageConfig(storage.endpoint, storage.targetPath, storage.username);
      if (version !== storageVersion.current) return;
      setStorageTested(true);
    } catch {
      if (version === storageVersion.current) {
        setStorageTested(false);
        setMessage(t('onboarding.testError'));
      }
    } finally { testingStorage.current = false; }
  };

  if (page === 'pairing') return <PairingPage onBack={() => setPage('setup')} />;
  if (page === 'activity') return <ActivityPage onBack={() => setPage('setup')} />;

  if (step === 'storage') {
    return (
      <View className="flex-1 justify-center gap-4 bg-surface p-6">
        <Button onPress={() => setStep('sources')} title={t('onboarding.back')} />
        <PairingButton label={t('pairing.open')} secondary icon={<ScanQrCode color={colors.ink} size={20} />} onPress={() => setPage('pairing')} />
        <PairingButton label={t('transfer.title')} secondary onPress={() => setPage('activity')} />
        <Text className="text-3xl font-bold text-ink">{t('onboarding.storageTitle')}</Text>
        <Text className="text-base text-muted">{t('onboarding.storageDescription')}</Text>
        <TextInput accessibilityLabel={t('onboarding.endpoint')} autoCapitalize="none" className="rounded-lg border border-border bg-white p-3 text-ink" onChangeText={(value) => editStorage('endpoint', value)} value={storage.endpoint} />
        <TextInput accessibilityLabel={t('onboarding.targetPath')} autoCapitalize="none" className="rounded-lg border border-border bg-white p-3 text-ink" onChangeText={(value) => editStorage('targetPath', value)} value={storage.targetPath} />
        <TextInput accessibilityLabel={t('onboarding.username')} autoCapitalize="none" className="rounded-lg border border-border bg-white p-3 text-ink" onChangeText={(value) => editStorage('username', value)} value={storage.username} />
        <TextInput accessibilityLabel={t('onboarding.password')} autoCapitalize="none" className="rounded-lg border border-border bg-white p-3 text-ink" onChangeText={(value) => editStorage('password', value)} secureTextEntry value={storage.password} />
        <Button onPress={() => void testStorage()} title={t('onboarding.testConnection')} />
        {storageTested && <Text className="text-sm text-muted">{t('onboarding.storageTested')}</Text>}
        {message && <Text accessibilityRole="alert" className="text-sm text-muted">{message}</Text>}
      </View>
    );
  }


  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', gap: 16, padding: 24 }}>
      <PairingButton label={t('pairing.open')} secondary icon={<ScanQrCode color={colors.ink} size={20} />} onPress={() => setPage('pairing')} />
      <PairingButton label={t('transfer.title')} secondary onPress={() => setPage('activity')} />
      <Text className="text-xs font-semibold uppercase text-muted">{t('onboarding.step', { current: 1, total: 2 })}</Text>
      <Text className="text-3xl font-bold text-ink">{t('onboarding.title')}</Text>
      <Text className="text-base text-muted">{t('onboarding.description')}</Text>
      <Button onPress={() => void selectDirectory()} title={t('onboarding.chooseFolder')} />
      {runtime?.selectPhotoLibrary && <Button onPress={() => void selectPhotoLibrary()} title={t('onboarding.choosePhotoLibrary')} />}
      {runtime?.loadPhotoAlbums && <Button onPress={() => void loadPhotoAlbums()} title={t('onboarding.choosePhotoAlbum')} />}
      {photoAlbums.map((album) => <Button key={album.id} onPress={() => void selectPhotoAlbum(album)} title={album.displayName} />)}
      {sources.map((source) => <View className="flex-row items-center justify-between" key={source.id}><View><Text className="text-sm text-muted">{source.displayName}</Text>{source.kind === 'directory' && sourceAccess[source.id] === false && <Text accessibilityRole="alert" className="text-sm text-red-600">{t('onboarding.sourceUnavailable')}</Text>}</View><Button onPress={() => void removeSource(source)} title={t('onboarding.removeSource', { name: source.displayName })} /></View>)}
      {sources.length > 0 && <Text className="text-sm text-muted">{t('onboarding.sourcesSelected')}</Text>}
      <View className="gap-2">
        <Button onPress={() => setIntervalHours(12)} title={intervalHours === 12 ? t('onboarding.everyHoursSelected', { hours: 12 }) : t('onboarding.everyHours', { hours: 12 })} />
        <Button onPress={() => setIntervalHours(24)} title={intervalHours === 24 ? t('onboarding.everyHoursSelected', { hours: 24 }) : t('onboarding.everyHours', { hours: 24 })} />
      </View>
      <TextInput accessibilityLabel={t('onboarding.localStartTime')} className="rounded-lg border border-border bg-white p-3 text-ink" onChangeText={setLocalTime} value={localTime} />
      <Button onPress={() => void saveSchedule()} title={t('onboarding.saveSchedule')} />
      {message && <Text accessibilityRole="alert" className="text-sm text-muted">{message}</Text>}
    </ScrollView>
  );
}

