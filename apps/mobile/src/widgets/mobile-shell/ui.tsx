import { useContext, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Images, Waypoints, Settings } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { Text } from '../../shared/ui/text';
import { RingIcon } from '../../shared/ui/logo';
import type { MobilePage, NavigateMobile } from '../../shared/model/mobile-navigation';
import { NativeSafeArea } from '../../shared/ui/native-safe-area';
import { useThemeColors } from '../../shared/theme/theme-provider';

const styles = StyleSheet.create({
  floatingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    zIndex: 30,
  },
  pillShadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 8,
  },
});

export function MobileShell({ page, navigate, section, children }: { page: MobilePage; navigate: NavigateMobile; section?: 'connections'; children: ReactNode }) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const insets = useContext(SafeAreaInsetsContext);
  const active = section ?? (page === 'photos' ? 'photos' : ['home', 'activity', 'backups'].includes(page) ? 'home' : ['connections', 'add-connection', 'provider', 'computer', 'storage', 'pairing'].includes(page) ? 'connections' : 'settings');
  const tabs = [
    { page: 'photos', label: 'statusUi.photos', kind: 'photos' },
    { page: 'home', label: 'statusUi.title', kind: 'home' },
    { page: 'connections', label: 'statusUi.targets', kind: 'connections' },
    { page: 'settings', label: 'statusUi.settings', kind: 'settings' },
  ] as const;
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale > 1.5;
  const navigation = tabs.map(({ page: destination, label, kind }) => {
    const isActive = active === destination;
    const iconColor = isActive ? c['brand-text'] : c['text-tertiary'];
    const icon = kind === 'home'
      ? <RingIcon size={22} color={iconColor} />
      : kind === 'photos'
        ? <Images size={22} color={iconColor} />
        : kind === 'connections'
          ? <Waypoints size={22} color={iconColor} />
          : <Settings size={22} color={iconColor} />;
    return (
      <Pressable
        key={destination}
        accessibilityRole="tab"
        accessibilityLabel={t(label)}
        accessibilityState={{ selected: isActive }}
        aria-selected={isActive}
        onPress={() => navigate(destination)}
        className={isActive
          ? `${largeText ? 'shrink-0 px-4' : 'flex-[2.2] px-4'} h-[42px] min-w-0 flex-row items-center justify-center gap-2 rounded-full bg-surface-2`
          : `${largeText ? 'shrink-0 px-4' : 'flex-1'} h-[42px] min-w-0 items-center justify-center rounded-full`}
      >
        {icon}
        {isActive && (
          <Text numberOfLines={1} className="font-inter-medium text-sm text-brand-text">
            {t(label)}
          </Text>
        )}
      </Pressable>
    );
  });
  return (
    <NativeSafeArea edges={['top', 'left', 'right']} className="flex-1 bg-background">
      <View className="flex-1">{children}</View>
      <View
        pointerEvents="box-none"
        style={[styles.floatingOverlay, { paddingBottom: Math.max(insets?.bottom ?? 0, 12) }]}
      >
        <View
          key={`tabs-${fontScale}`}
          accessibilityRole="tablist"
          style={styles.pillShadow}
          className="mx-auto h-14 w-full max-w-[408px] flex-row items-center justify-between gap-1 rounded-full border border-border-subtle bg-surface-1/95 p-[7px]"
        >
          {largeText ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', gap: 4 }}>
              {navigation}
            </ScrollView>
          ) : (
            navigation
          )}
        </View>
      </View>
    </NativeSafeArea>
  );
}
