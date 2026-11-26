import { useTranslation } from 'react-i18next';
import { Bell, Clock3, Folder, HardDrive, Image as ImageIcon, Info, KeyRound, Languages, RotateCcw, ShieldCheck, Signal } from 'lucide-react-native';
import { Platform, View } from 'react-native';
import { Text } from '../../../shared/ui/text';
import type { NavigateMobile } from '../../../shared/model/mobile-navigation';
import { IconTile, ListRow, PillSegmented, RichCard, SectionLabel } from '../../../shared/ui/rich';
import { MobileSurface } from '../../../widgets/mobile-surface/ui';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { configuredAppVersion } from '../../../shared/config/app-version';
import { useTheme, type ThemePreference, useThemeColors } from '../../../shared/theme/theme-provider';

export function SettingsPage({ navigate }: { navigate: NavigateMobile }) {
  const colors = useThemeColors();
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const activeLanguage = i18n.resolvedLanguage?.split('-')[0] ?? 'tr';
  return (
    <MobileSurface title={t('ui.settings.title')} onBack={() => navigate('home')}>
      <SectionLabel title={t('ui.settings.backup')} />
      <RichCard className="p-1">
        <ListRow icon={<Folder size={19} color={colors['text-primary']} />} title={t('ui.sources.title')} onPress={() => navigate('sources')} />
        <ListRow divider icon={<Clock3 size={19} color={colors['text-primary']} />} title={t('ui.schedule.title')} onPress={() => navigate('schedule')} />
        <ListRow divider icon={<HardDrive size={19} color={colors['text-primary']} />} title={t('ui.nav.backups')} onPress={() => navigate('backups')} />
        <ListRow divider icon={<KeyRound size={19} color={colors['text-primary']} />} title={t('recovery.settingsEntry')} onPress={() => navigate('recovery')} />
        <View
          accessibilityRole="switch"
          accessibilityLabel={t('ui.settings.cellular')}
          accessibilityState={{ checked: false, disabled: true }}
          aria-checked={false}
          aria-disabled
          accessible
          className="min-h-14 flex-row items-center gap-3 border-t border-border-subtle px-2.5 py-2.5"
        >
          <IconTile><Signal size={19} color={colors['text-primary']} /></IconTile>
          <View className="flex-1">
            <Text className="font-inter-medium text-base text-primary-text">{t('ui.settings.cellular')}</Text>
            <Text className="font-sans text-sm leading-5 text-secondary-text">{t('ui.settings.cellularDesc')}</Text>
          </View>
          <View className="h-6 w-10 justify-center rounded-full border border-border-strong bg-surface-2 opacity-60">
            <View className="ml-0.5 h-4 w-4 rounded-full bg-border-strong" />
          </View>
        </View>
      </RichCard>

      <SectionLabel title={t('ui.settings.privacy')} />
      <RichCard className="p-1">
        <ListRow
          icon={<ImageIcon size={19} color={colors['text-primary']} />}
          title={t('ui.settings.photoAccess')}
          subtitle={t('ui.settings.photoAccessDesc')}
          accessibilityLabel={t('ui.settings.photoAccess')}
          accessibilityHint={t('ui.settings.photoAccessDesc')}
          onPress={() => navigate('sources')}
        />
        <ListRow
          divider
          icon={<Bell size={19} color={colors['text-primary']} />}
          title={t('ui.settings.notifications')}
          subtitle={t('ui.settings.notificationsDesc')}
          accessibilityLabel={t('ui.settings.notifications')}
          accessibilityHint={t('ui.settings.notificationsDesc')}
          onPress={() => navigate('activity')}
        />
      </RichCard>

      <RichCard className="gap-3 p-4">
        <Text accessibilityRole="header" className="text-base font-inter-semibold text-primary-text">{t('statusUi.appearance')}</Text>
        <PillSegmented
          accessibilityLabel={t('statusUi.appearance')}
          value={theme.preference}
          onChange={theme.setPreference}
          options={(['system', 'dark', 'light'] as ThemePreference[]).map((value) => ({
            id: value,
            label: t(`statusUi.${value}`),
          }))}
        />
        <View className="mt-2 flex-row items-center gap-2">
          <Languages size={17} color={colors['text-secondary']} />
          <Text accessibilityRole="header" className="text-base font-inter-semibold text-primary-text">{t('ui.language')}</Text>
        </View>
        <PillSegmented
          accessibilityLabel={t('ui.language')}
          value={activeLanguage}
          onChange={(language) => { void i18n.changeLanguage(language); }}
          options={['tr', 'en', 'de'].map((language) => ({
            id: language,
            label: t(`statusUi.languageNames.${language}`),
          }))}
        />
      </RichCard>

      <SectionLabel title={t('ui.settings.background')} />
      <RichCard className="gap-3 p-4">
        <IconTile tone="brand"><ShieldCheck size={20} color={colors['brand-text']} /></IconTile>
        <Text className="font-sans text-sm leading-5 text-secondary-text">{t(Platform.OS === 'ios' ? 'computer.iosBackground' : 'computer.androidBackground')}</Text>
        <PairingButton variant="secondary" label={t('transfer.title')} onPress={() => navigate('activity')} />
      </RichCard>

      <PairingButton
        variant="secondary"
        icon={<RotateCcw size={18} color={colors['text-primary']} />}
        label={t('ui.settings.rerunSetup')}
        onPress={() => navigate('welcome')}
      />

      <SectionLabel title={t('ui.settings.about')} />
      <RichCard className="p-3">
        <View
          accessible
          accessibilityLabel={`${t('ui.settings.configVersion')}: ${configuredAppVersion() ?? t('ui.settings.versionUnknown')}`}
          className="min-h-12 flex-row items-center gap-3"
        >
          <IconTile><Info size={19} color={colors['text-primary']} /></IconTile>
          <Text className="flex-1 font-inter-medium text-base text-primary-text">{t('ui.settings.configVersion')}</Text>
          <Text className="font-sans text-sm text-secondary-text">{configuredAppVersion() ?? t('ui.settings.versionUnknown')}</Text>
        </View>
      </RichCard>
    </MobileSurface>
  );
}
