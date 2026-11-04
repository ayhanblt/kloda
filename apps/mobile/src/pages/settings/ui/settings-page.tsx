import { useTranslation } from 'react-i18next';
import { Clock3, Folder, HardDrive, KeyRound, ShieldCheck } from 'lucide-react-native';
import { Platform, Pressable, View } from 'react-native';
import { Text } from '../../../shared/ui/text';
import type { NavigateMobile } from '../../../shared/model/mobile-navigation';
import { MobilePanel, MobileSurface } from '../../../widgets/mobile-surface/ui';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { useTheme, type ThemePreference } from '../../../shared/theme/theme-provider';
import { useThemeColors } from '../../../shared/theme/theme-provider';

export function SettingsPage({ navigate }: { navigate: NavigateMobile }) {
  const colors = useThemeColors();
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  return <MobileSurface title={t('ui.settings.title')} onBack={() => navigate('home')}>
    <View className="gap-3 rounded-2xl border border-border-subtle bg-surface-1 p-4">
      <Text accessibilityRole="header" className="text-base font-inter-semibold text-primary-text">{t('statusUi.appearance')}</Text>
      {(['system', 'dark', 'light'] as ThemePreference[]).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: theme.preference === value }} aria-checked={theme.preference === value} onPress={() => theme.setPreference(value)} className="min-h-12 flex-row items-center justify-between border-t border-border-subtle py-3">
        <Text className="font-sans text-base text-primary-text">{t(`statusUi.${value}`)}</Text><View className={`h-4 w-4 rounded-full border border-border-strong ${theme.preference === value ? 'bg-brand' : 'bg-surface-1'}`} />
      </Pressable>)}
      <Text accessibilityRole="header" className="text-base font-inter-semibold text-primary-text">{t('ui.language')}</Text>
      {['tr', 'en', 'de'].map(language => <Pressable key={language} accessibilityRole="radio" accessibilityState={{ checked: i18n.resolvedLanguage?.split('-')[0] === language }} aria-checked={i18n.resolvedLanguage?.split('-')[0] === language} onPress={() => { void i18n.changeLanguage(language); }} className="min-h-12 justify-center border-t border-border-subtle py-3"><Text className="font-sans text-base text-primary-text">{t(`statusUi.languageNames.${language}`)}</Text></Pressable>)}
    </View>
    <MobilePanel><Text className="text-lg font-inter-semibold text-primary-text">{t('ui.settings.backup')}</Text>
      <PairingButton variant="secondary" icon={<Folder size={20} color={colors['text-primary']} />} label={t('ui.sources.title')} onPress={() => navigate('sources')} />
      <PairingButton variant="secondary" icon={<Clock3 size={20} color={colors['text-primary']} />} label={t('ui.schedule.title')} onPress={() => navigate('schedule')} />
      <PairingButton variant="secondary" icon={<HardDrive size={20} color={colors['text-primary']} />} label={t('ui.nav.backups')} onPress={() => navigate('backups')} />
      <PairingButton variant="secondary" icon={<KeyRound size={20} color={colors['text-primary']} />} label={t('recovery.settingsEntry')} onPress={() => navigate('recovery')} />
    </MobilePanel>
    <MobilePanel><ShieldCheck size={23} color={colors['brand-base']} /><Text className="text-lg font-inter-semibold text-primary-text">{t('ui.settings.background')}</Text>
      <Text className="font-sans text-sm leading-5 text-secondary-text">{t(Platform.OS === 'ios' ? 'computer.iosBackground' : 'computer.androidBackground')}</Text>
      <PairingButton variant="secondary" label={t('transfer.title')} onPress={() => navigate('activity')} />
    </MobilePanel>
    <PairingButton variant="secondary" label={t('ui.settings.rerunSetup')} onPress={() => navigate('welcome')} />
  </MobileSurface>;
}
