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
      <Text className="font-sans text-sm leading-5 text-muted">{t(m.supportsLive ? (Platform.OS === 'ios' ? 'computer.iosSchedulePreference' : 'computer.androidSchedulePreference') : 'computer.schedulePreference')}</Text>
      {m.supportsLive && <PairingButton secondary={m.backupMode !== 'live'} onPress={() => m.setBackupMode('live')} label={t(m.backupMode === 'live' ? 'onboarding.liveSelected' : 'onboarding.live')} />}
      {[12,24].map((hours) => <PairingButton key={hours} secondary={!(m.backupMode === 'scheduled' && m.intervalHours === hours)} onPress={() => { m.setBackupMode('scheduled'); m.setIntervalHours(hours as 12 | 24); }} label={t(m.backupMode === 'scheduled' && m.intervalHours === hours ? 'onboarding.everyHoursSelected' : 'onboarding.everyHours', { hours })} />)}
      {m.backupMode === 'live' ? <Text className="font-sans text-sm text-muted">{t('onboarding.liveDescription')}</Text> : <View className="gap-2">
        <Text className="text-sm font-inter-medium text-ink">{t('onboarding.localStartTime')}</Text>
        <TextInput accessibilityLabel={t('onboarding.localStartTime')} className="font-sans min-h-[48px] rounded-xl border border-border bg-elevated px-3 text-base text-ink" onChangeText={m.setLocalTime} value={m.localTime} />
      </View>}
    </MobilePanel>
    {m.message && <Text accessibilityRole="alert" className="font-sans text-sm text-error">{m.message}</Text>}
    <PairingButton label={t('onboarding.saveSchedule')} onPress={() => { void save(); }} />
  </MobileSurface>;
}
