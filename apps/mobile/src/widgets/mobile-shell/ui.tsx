import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Images, Activity, Waypoints, Settings, Languages } from 'lucide-react-native';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Text } from '../../shared/ui/text';
import type { MobilePage, NavigateMobile } from '../../shared/model/mobile-navigation';
import { NativeSafeArea } from '../../shared/ui/native-safe-area';
import { KlodaLogo } from '../../shared/ui/logo';
import { colors } from '../../shared/ui/tokens';

export function MobileShell({ page, navigate, children }: { page: MobilePage; navigate: NavigateMobile; children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const active = page === 'home' ? 'home' : ['activity','backups'].includes(page) ? 'activity' : ['connections','add-connection','provider','computer','storage'].includes(page) ? 'connections' : 'settings';
  const tabs = [{ page: 'home', label: 'ui.nav.gallery', Icon: Images }, { page: 'activity', label: 'ui.nav.activity', Icon: Activity },
    { page: 'connections', label: 'ui.nav.connections', Icon: Waypoints }, { page: 'settings', label: 'ui.nav.settings', Icon: Settings }] as const;
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale > 1.5;
  const language = i18n.resolvedLanguage?.split('-')[0] ?? 'tr';
  const languageControl = <Pressable className="min-h-[48px] min-w-[48px] items-center justify-center" accessibilityRole="button" accessibilityLabel={t('ui.language')} onPress={() => { void i18n.changeLanguage(language === 'tr' ? 'en' : language === 'en' ? 'de' : 'tr'); }}>
    <Languages color={colors.muted} size={19} /><Text className="font-sans text-xs uppercase text-muted">{language}</Text>
  </Pressable>;
  const statusControl = <Pressable className={`${largeText ? '' : 'min-w-0 flex-1'} min-h-[48px] justify-center rounded-full border border-border px-3 py-2`} accessibilityRole="button" accessibilityLabel={t('ui.openConnections')} onPress={() => navigate('connections')}>
    <Text className="font-inter-medium text-center text-xs text-muted">{t('ui.observedUnknown')}</Text>
  </Pressable>;
  const navigation = tabs.map(({ page: destination, label, Icon }) => <Pressable key={destination} accessibilityRole="tab" accessibilityLabel={t(label)} accessibilityState={{ selected: active === destination }} onPress={() => navigate(destination)}
    className={`${largeText ? 'shrink-0 px-4' : 'flex-1 px-1'} min-h-[56px] items-center justify-center gap-1 rounded-[24px] py-2 ${active === destination ? 'bg-primary' : 'bg-surface'}`}>
    <Icon size={21} color={active === destination ? colors.elevated : colors.muted} />
    <Text numberOfLines={largeText ? 1 : undefined} className={`font-sans self-stretch text-center text-xs ${active === destination ? 'text-elevated' : 'text-muted'}`}>{t(label)}</Text>
  </Pressable>);
  return <NativeSafeArea className="flex-1 bg-surface">
    {/* Remeasure chrome after an OS font change without remounting receiver pages. */}
    <View key={`header-${fontScale}`} className="shrink-0 gap-2 border-b border-border px-4 py-2">
      <View className="shrink-0 flex-row items-center justify-between gap-2">
        <KlodaLogo />{!largeText && statusControl}{languageControl}
      </View>
      {largeText && statusControl}
    </View>
    <View className="flex-1">{children}</View>
    <View key={`tabs-${fontScale}`} accessibilityRole="tablist" className="shrink-0 border-t border-border bg-surface px-2 py-2">
      {largeText ? <ScrollView horizontal className="grow-0 shrink-0">{navigation}</ScrollView> : <View className="flex-row">{navigation}</View>}
    </View>
  </NativeSafeArea>;
}
