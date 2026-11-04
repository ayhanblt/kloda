import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleDot, Images, Waypoints, Settings } from 'lucide-react-native';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Text } from '../../shared/ui/text';
import type { MobilePage, NavigateMobile } from '../../shared/model/mobile-navigation';
import { NativeSafeArea } from '../../shared/ui/native-safe-area';
import { useThemeColors } from '../../shared/theme/theme-provider';

export function MobileShell({ page, navigate, section, children }: { page: MobilePage; navigate: NavigateMobile; section?: 'connections'; children: ReactNode }) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const active = section ?? (page === 'photos' ? 'photos' : ['home', 'activity', 'backups'].includes(page) ? 'home' : ['connections', 'add-connection', 'provider', 'computer', 'storage', 'pairing'].includes(page) ? 'connections' : 'settings');
  const tabs = [{ page: 'home', label: 'statusUi.title', Icon: CircleDot }, { page: 'photos', label: 'statusUi.photos', Icon: Images },
    { page: 'connections', label: 'statusUi.targets', Icon: Waypoints }, { page: 'settings', label: 'statusUi.settings', Icon: Settings }] as const;
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale > 1.5;
  const navigation = tabs.map(({ page: destination, label, Icon }) => <Pressable key={destination} accessibilityRole="tab" accessibilityLabel={t(label)} accessibilityState={{ selected: active === destination }} aria-selected={active === destination} onPress={() => navigate(destination)}
    className={`${largeText ? 'shrink-0 px-4' : 'flex-1 px-1'} min-h-16 items-center justify-center gap-1 py-2`}>
    <Icon size={22} color={active === destination ? c['brand-base'] : c['text-tertiary']} />
    <Text numberOfLines={largeText ? 1 : undefined} className={`font-sans self-stretch text-center text-xs ${active === destination ? 'text-brand-text' : 'text-tertiary-text'}`}>{t(label)}</Text>
  </Pressable>);
  return <NativeSafeArea className="flex-1 bg-background">
    <View className="flex-1">{children}</View>
    <View key={`tabs-${fontScale}`} accessibilityRole="tablist" className="shrink-0 border-t border-border-subtle bg-background px-2 py-1">
      {largeText ? <ScrollView horizontal className="grow-0 shrink-0">{navigation}</ScrollView> : <View className="flex-row">{navigation}</View>}
    </View>
  </NativeSafeArea>;
}
