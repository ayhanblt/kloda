import { useTranslation } from 'react-i18next';
import { Platform, TextInput, View } from 'react-native';
import { Text } from '../../../shared/ui/text';
import type { BackupSetupModel } from '../../../features/backup-setup/model/use-backup-setup';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { MobilePanel, MobileSurface } from '../../../widgets/mobile-surface/ui';

export function SchedulePage({ model: m, onBack, onSaved }: { model: BackupSetupModel; onBack: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const save = async () => { if (await m.saveSchedule()) onSaved(); };
  return <MobileSurface title={t('ui.schedule.title')} onBack={onBack}>
    <MobilePanel>
      <Text className="font-sans text-sm leading-5 text-secondary-text">{t(m.supportsLive ? (Platform.OS === 'ios' ? 'computer.iosSchedulePreference' : 'computer.androidSchedulePreference') : 'computer.schedulePreference')}</Text>
      {m.supportsLive && <PairingButton variant="secondary" onPress={() => m.setBackupMode('live')} label={t(m.backupMode === 'live' ? 'onboarding.liveSelected' : 'onboarding.live')} />}
      {[12,24].map((hours) => <PairingButton key={hours} variant="secondary" onPress={() => { m.setBackupMode('scheduled'); m.setIntervalHours(hours as 12 | 24); }} label={t(m.backupMode === 'scheduled' && m.intervalHours === hours ? 'onboarding.everyHoursSelected' : 'onboarding.everyHours', { hours })} />)}
      {m.backupMode === 'live' ? <Text className="font-sans text-sm text-secondary-text">{t('onboarding.liveDescription')}</Text> : <View className="gap-2">
        <Text className="text-sm font-inter-medium text-primary-text">{t('onboarding.localStartTime')}</Text>
        <TextInput accessibilityLabel={t('onboarding.localStartTime')} className="font-sans min-h-[48px] rounded-xl border border-border-subtle bg-surface-1 px-3 text-base text-primary-text" onChangeText={m.setLocalTime} value={m.localTime} />
      </View>}
    </MobilePanel>
    {m.message && <Text accessibilityRole="alert" className="font-sans text-sm text-danger-text">{m.message}</Text>}
    <PairingButton variant="primary" label={t('onboarding.saveSchedule')} onPress={() => { void save(); }} />
  </MobileSurface>;
}
