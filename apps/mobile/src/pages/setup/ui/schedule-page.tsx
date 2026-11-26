import { useTranslation } from 'react-i18next';
import { CalendarClock, Zap } from 'lucide-react-native';
import { Platform, Pressable, TextInput, View } from 'react-native';
import { Text } from '../../../shared/ui/text';
import type { BackupSetupModel } from '../../../features/backup-setup/model/use-backup-setup';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { NoticeBox, RichCard, StepsBar } from '../../../shared/ui/rich';
import { MobileSurface } from '../../../widgets/mobile-surface/ui';
import { useThemeColors } from '../../../shared/theme/theme-provider';

export function SchedulePage({ model: m, onBack, onSaved }: { model: BackupSetupModel; onBack: () => void; onSaved: () => void }) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const save = async () => { if (await m.saveSchedule()) onSaved(); };
  const options = [
    ...(m.supportsLive
      ? [{
          id: 'live',
          selected: m.backupMode === 'live',
          icon: Zap,
          label: t(m.backupMode === 'live' ? 'onboarding.liveSelected' : 'onboarding.live'),
          onPress: () => m.setBackupMode('live'),
        }]
      : []),
    ...([12, 24] as const).map((hours) => {
      const selected = m.backupMode === 'scheduled' && m.intervalHours === hours;
      return {
        id: `every-${hours}`,
        selected,
        icon: CalendarClock,
        label: t(selected ? 'onboarding.everyHoursSelected' : 'onboarding.everyHours', { hours }),
        onPress: () => { m.setBackupMode('scheduled'); m.setIntervalHours(hours); },
      };
    }),
  ];

  return (
    <MobileSurface headerTop={<StepsBar current={2} />} title={t('ui.schedule.title')} onBack={onBack}>
      <Text className="font-sans text-sm leading-5 text-secondary-text">
        {t(m.supportsLive ? (Platform.OS === 'ios' ? 'computer.iosSchedulePreference' : 'computer.androidSchedulePreference') : 'computer.schedulePreference')}
      </Text>
      <View className="gap-2.5">
        {options.map((option) => {
          const OptionIcon = option.icon;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: option.selected, checked: option.selected }}
              onPress={option.onPress}
              className={`min-h-[60px] flex-row items-center gap-3 rounded-2xl border bg-surface-1 p-4 active:opacity-80 ${option.selected ? 'border-action' : 'border-border-subtle'}`}
            >
              <OptionIcon size={20} color={option.selected ? colors['brand-text'] : colors['text-secondary']} />
              <Text className="min-w-0 flex-1 text-sm font-inter-semibold text-primary-text">{option.label}</Text>
              <View className={`h-5 w-5 rounded-full border-4 ${option.selected ? 'border-action bg-background' : 'border-border-strong bg-surface-2'}`} />
            </Pressable>
          );
        })}
      </View>

      {m.backupMode === 'live' ? (
        <NoticeBox>
          <Text className="font-sans text-sm leading-5 text-secondary-text">{t('onboarding.liveDescription')}</Text>
        </NoticeBox>
      ) : (
        <RichCard className="gap-2 p-4">
          <Text className="text-sm font-inter-medium text-primary-text">{t('onboarding.localStartTime')}</Text>
          <TextInput
            accessibilityLabel={t('onboarding.localStartTime')}
            className="font-sans min-h-[48px] rounded-xl border border-border-strong bg-background px-3.5 text-base text-primary-text"
            onChangeText={m.setLocalTime}
            value={m.localTime}
          />
        </RichCard>
      )}

      {m.message && (
        <NoticeBox tone="danger">
          <Text accessibilityRole="alert" className="font-sans text-sm text-danger-text">{m.message}</Text>
        </NoticeBox>
      )}
      <PairingButton variant="primary" size="lg" label={t('onboarding.saveSchedule')} onPress={() => { void save(); }} />
    </MobileSurface>
  );
}
