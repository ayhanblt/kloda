import { useTranslation } from 'react-i18next';
import { Bell, Clock3, Folder, HardDrive, Image as ImageIcon, Info, KeyRound, ShieldCheck, Signal } from 'lucide-react-native';
import { Platform, Pressable, View } from 'react-native';
import { Text } from '../../../shared/ui/text';
import type { NavigateMobile } from '../../../shared/model/mobile-navigation';
import { MobilePanel, MobileSurface } from '../../../widgets/mobile-surface/ui';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { configuredAppVersion } from '../../../shared/config/app-version';
import { useTheme, type ThemePreference } from '../../../shared/theme/theme-provider';
import { useThemeColors } from '../../../shared/theme/theme-provider';

export function SettingsPage({ navigate }: { navigate: NavigateMobile }) {
  const colors = useThemeColors();
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  return <MobileSurface title={t('ui.settings.title')} onBack={() => navigate('home')}>
    <MobilePanel><Text className="text-lg font-inter-semibold text-primary-text">{t('ui.settings.backup')}</Text>
      <PairingButton variant="secondary" icon={<Folder size={20} color={colors['text-primary']} />} label={t('ui.sources.title')} onPress={() => navigate('sources')} />
      <PairingButton variant="secondary" icon={<Clock3 size={20} color={colors['text-primary']} />} label={t('ui.schedule.title')} onPress={() => navigate('schedule')} />
      <PairingButton variant="secondary" icon={<HardDrive size={20} color={colors['text-primary']} />} label={t('ui.nav.backups')} onPress={() => navigate('backups')} />
      <PairingButton variant="secondary" icon={<KeyRound size={20} color={colors['text-primary']} />} label={t('recovery.settingsEntry')} onPress={() => navigate('recovery')} />
      <View accessibilityRole="switch" accessibilityLabel={t('ui.settings.cellular')} accessibilityState={{ checked: false, disabled: true }} aria-checked={false} aria-disabled accessible className="min-h-14 flex-row items-center gap-3 py-2">
        <Signal size={20} color={colors['text-primary']} />
        <View className="flex-1"><Text className="font-sans text-base text-primary-text">{t('ui.settings.cellular')}</Text><Text className="font-sans text-sm leading-5 text-secondary-text">{t('ui.settings.cellularDesc')}</Text></View>
        <View className="h-6 w-10 justify-center rounded-full border border-border-strong bg-surface-1 opacity-60"><View className="ml-0.5 h-4 w-4 rounded-full bg-border-strong" /></View>
      </View>
    </MobilePanel>
    <MobilePanel><Text className="text-lg font-inter-semibold text-primary-text">{t('ui.settings.privacy')}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('ui.settings.photoAccess')} accessibilityHint={t('ui.settings.photoAccessDesc')} onPress={() => navigate('sources')} className="min-h-14 flex-row items-center gap-3 py-2">
        <ImageIcon size={20} color={colors['text-primary']} />
        <View className="flex-1"><Text className="font-sans text-base text-primary-text">{t('ui.settings.photoAccess')}</Text><Text className="font-sans text-sm leading-5 text-secondary-text">{t('ui.settings.photoAccessDesc')}</Text></View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('ui.settings.notifications')} accessibilityHint={t('ui.settings.notificationsDesc')} onPress={() => navigate('activity')} className="min-h-14 flex-row items-center gap-3 py-2">
        <Bell size={20} color={colors['text-primary']} />
        <View className="flex-1"><Text className="font-sans text-base text-primary-text">{t('ui.settings.notifications')}</Text><Text className="font-sans text-sm leading-5 text-secondary-text">{t('ui.settings.notificationsDesc')}</Text></View>
      </Pressable>
    </MobilePanel>
    <View className="gap-3 rounded-2xl border border-border-subtle bg-surface-1 p-4">
      <Text accessibilityRole="header" className="text-base font-inter-semibold text-primary-text">{t('statusUi.appearance')}</Text>
      {(['system', 'dark', 'light'] as ThemePreference[]).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: theme.preference === value }} aria-checked={theme.preference === value} onPress={() => theme.setPreference(value)} className="min-h-12 flex-row items-center justify-between border-t border-border-subtle py-3">
        <Text className="font-sans text-base text-primary-text">{t(`statusUi.${value}`)}</Text><View className={`h-4 w-4 rounded-full border border-border-strong ${theme.preference === value ? 'bg-brand' : 'bg-surface-1'}`} />
      </Pressable>)}
      <Text accessibilityRole="header" className="text-base font-inter-semibold text-primary-text">{t('ui.language')}</Text>
      {['tr', 'en', 'de'].map(language => <Pressable key={language} accessibilityRole="radio" accessibilityState={{ checked: i18n.resolvedLanguage?.split('-')[0] === language }} aria-checked={i18n.resolvedLanguage?.split('-')[0] === language} onPress={() => { void i18n.changeLanguage(language); }} className="min-h-12 justify-center border-t border-border-subtle py-3"><Text className="font-sans text-base text-primary-text">{t(`statusUi.languageNames.${language}`)}</Text></Pressable>)}
    </View>
    <MobilePanel><ShieldCheck size={23} color={colors['brand-base']} /><Text className="text-lg font-inter-semibold text-primary-text">{t('ui.settings.background')}</Text>
      <Text className="font-sans text-sm leading-5 text-secondary-text">{t(Platform.OS === 'ios' ? 'computer.iosBackground' : 'computer.androidBackground')}</Text>
      <PairingButton variant="secondary" label={t('transfer.title')} onPress={() => navigate('activity')} />
    </MobilePanel>
    <PairingButton variant="secondary" label={t('ui.settings.rerunSetup')} onPress={() => navigate('welcome')} />
    <MobilePanel><Text className="text-lg font-inter-semibold text-primary-text">{t('ui.settings.about')}</Text>
      <View accessible accessibilityLabel={`${t('ui.settings.configVersion')}: ${configuredAppVersion() ?? t('ui.settings.versionUnknown')}`} className="min-h-12 flex-row items-center gap-3">
        <Info size={20} color={colors['text-primary']} />
        <Text className="flex-1 font-sans text-base text-primary-text">{t('ui.settings.configVersion')}</Text>
        <Text className="font-sans text-sm text-secondary-text">{configuredAppVersion() ?? t('ui.settings.versionUnknown')}</Text>
      </View>
    </MobilePanel>
  </MobileSurface>;
}
