import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Text, TextInput, View } from 'react-native';
import '../shared/i18n';

interface NativeScheduleRuntime {
  loadSchedule(): Promise<{ intervalHours: 12 | 24; localTime: string }>;
  pickDirectory(request: string): Promise<string | null>;
  saveSchedule(intervalHours: 12 | 24, localTime: string): Promise<void>;
}

const runtime = globalThis.require?.('react-native').NativeModules.KlodaSyncRuntime as NativeScheduleRuntime | undefined;

export function App() {
  const { t } = useTranslation();
  const [intervalHours, setIntervalHours] = useState<12 | 24>(12);
  const [localTime, setLocalTime] = useState('12:00');
  const [sourceUri, setSourceUri] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void runtime?.loadSchedule().then((schedule) => {
      setIntervalHours(schedule.intervalHours);
      setLocalTime(schedule.localTime);
    });
  }, []);

  const saveSchedule = async () => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(localTime)) return setMessage(t('onboarding.invalidTime'));
    if (!runtime) return setMessage(t('onboarding.runtimeUnavailable'));
    await runtime.saveSchedule(intervalHours, localTime);
    setMessage(t('onboarding.scheduleSaved'));
  };
  const selectDirectory = async () => {
    if (!runtime) return setMessage(t('onboarding.runtimeUnavailable'));
    const selected = await runtime.pickDirectory('source');
    if (selected) setSourceUri(selected);
  };


  return (
    <View className="flex-1 justify-center gap-4 bg-surface p-6">
      <Text className="text-xs font-semibold uppercase text-muted">{t('onboarding.step', { current: 1, total: 2 })}</Text>
      <Text className="text-3xl font-bold text-ink">{t('onboarding.title')}</Text>
      <Text className="text-base text-muted">{t('onboarding.description')}</Text>
      <Button onPress={() => void selectDirectory()} title={t('onboarding.chooseFolder')} />
      {sourceUri && <Text className="text-sm text-muted">{t('onboarding.folderSelected')}</Text>}
      <View className="gap-2">
        <Button onPress={() => setIntervalHours(12)} title={`${t('onboarding.everyHours', { hours: 12 })}${intervalHours === 12 ? ' ✓' : ''}`} />
        <Button onPress={() => setIntervalHours(24)} title={`${t('onboarding.everyHours', { hours: 24 })}${intervalHours === 24 ? ' ✓' : ''}`} />
      </View>
      <TextInput accessibilityLabel={t('onboarding.localStartTime')} className="rounded-lg border border-border bg-white p-3 text-ink" onChangeText={setLocalTime} value={localTime} />
      <Button onPress={() => void saveSchedule()} title={t('onboarding.saveSchedule')} />
      {message && <Text accessibilityRole="alert" className="text-sm text-muted">{message}</Text>}
    </View>
  );
}

