import { useEffect } from 'react';
import { useThemeColors } from '../theme/theme-provider';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Text } from './text';
import Svg, { Circle } from 'react-native-svg';
import Reanimated, {
  Easing,
  cancelAnimation,
  createAnimatedComponent,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const AnimatedView =
  Reanimated?.View ??
  (typeof createAnimatedComponent === 'function' ? createAnimatedComponent(View) : View);

export function RingIcon({ size = 22, color, spinning = false }: { size?: number; color: string; spinning?: boolean }) {
  const reduced = useReducedMotion();
  const rotation = useSharedValue(0);
  const active = spinning && !reduced;

  useEffect(() => {
    if (!active) {
      cancelAnimation(rotation);
      rotation.value = 0;
      return;
    }
    rotation.value = 0;
    rotation.value = withRepeat(withTiming(360, { duration: 1600, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(rotation);
  }, [active, rotation]);

  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  return (
    <View style={{ width: size, height: size }}>
      <AnimatedView collapsable={false} style={active ? spinStyle : undefined}>
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible={false}>
          <Circle cx="12" cy="12" r="8" stroke={color} strokeWidth="2" strokeLinecap="round" strokeDasharray="38 12" transform="rotate(-90 12 12)" />
          <Circle cx="12" cy="12" r="2.5" fill={color} />
        </Svg>
      </AnimatedView>
    </View>
  );
}

export function KlodaLogo({ wordmark = true, large = false }: { wordmark?: boolean; large?: boolean }) {
  const c = useThemeColors();
  const { t } = useTranslation();
  return <View className="shrink-0 flex-row items-center gap-2.5" accessibilityLabel={t('ui.logoName')}>
    <View className={`${large ? 'h-16 w-16 rounded-2xl motion-safe:animate-logo-reveal' : 'h-10 w-10 rounded-xl'} items-center justify-center bg-tile`}>
      <Svg width={large ? 56 : 34} height={large ? 56 : 34} viewBox="0 0 120 120" fill="none" accessible={false}>
        <Circle cx="60" cy="60" r="26" stroke={c['tile-ring']} strokeWidth="10" strokeLinecap="round" strokeDasharray="122 41" transform="rotate(-90 60 60)" />
        <Circle cx="60" cy="60" r="7" fill={c['brand-base']} />
      </Svg>
    </View>
    {wordmark && <Text className={`${large ? 'text-2xl' : 'text-lg'} font-inter-semibold text-primary-text`}>{t('ui.logoName')}</Text>}
  </View>;
}
