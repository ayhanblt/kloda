import { useContext } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import introPhotos from '../../../../assets/intro-photos.jpg';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { useThemeColors } from '../../../shared/theme/theme-provider';
import { KlodaLogo } from '../../../shared/ui/logo';
import { Text } from '../../../shared/ui/text';

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  foreground: { flex: 1, justifyContent: 'flex-end', zIndex: 2 },
});

export function IntroPage({ onStart }: { onStart: () => void }) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const insets = useContext(SafeAreaInsetsContext);
  return (
    <View className="flex-1 bg-background">
      <Image source={introPhotos} resizeMode="cover" style={styles.fill} accessible={false} />
      <View pointerEvents="none" style={styles.fill}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" accessible={false}>
          <Defs>
            <LinearGradient id="introScrim" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.3" stopColor={c.bg} stopOpacity={0} />
              <Stop offset="0.58" stopColor={c.bg} stopOpacity={0.7} />
              <Stop offset="0.82" stopColor={c.bg} stopOpacity={1} />
              <Stop offset="1" stopColor={c.bg} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill="url(#introScrim)" />
        </Svg>
      </View>
      <View
        style={[
          styles.foreground,
          { paddingTop: (insets?.top ?? 0) + 16, paddingBottom: Math.max(insets?.bottom ?? 0, 16) + 24 },
        ]}
        className="px-6"
      >
        <View className="items-center">
          <KlodaLogo wordmark={false} large />
        </View>
        <Text
          accessibilityRole="header"
          className="mt-6 text-center text-[32px] font-inter-semibold leading-[38px] text-primary-text"
        >
          {t('ui.setup.introTitle')}
        </Text>
        <Text className="mt-3 max-w-[320px] self-center text-center font-sans text-sm leading-5 text-secondary-text">
          {t('ui.setup.introBody')}
        </Text>
        <View className="mt-8 w-full">
          <PairingButton
            variant="primary"
            size="lg"
            label={t('ui.setup.introStart')}
            onPress={onStart}
          />
        </View>
      </View>
    </View>
  );
}
