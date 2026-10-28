import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Text } from './text';
import Svg, { Circle } from 'react-native-svg';

export function KlodaLogo({ wordmark = true, large = false }: { wordmark?: boolean; large?: boolean }) {
  const { t } = useTranslation();
  return <View className="shrink-0 flex-row items-center gap-2.5" accessibilityLabel={t('ui.logoName')}>
    <View className={`${large ? 'h-16 w-16 rounded-2xl motion-safe:animate-logo-reveal' : 'h-10 w-10 rounded-xl'} items-center justify-center bg-primary`}>
      <Svg width={large ? 56 : 34} height={large ? 56 : 34} viewBox="0 0 120 120" fill="none" accessible={false}>
        <Circle cx="60" cy="60" r="26" stroke="#f5f2ef" strokeWidth="10" strokeLinecap="round" strokeDasharray="122 41" transform="rotate(-90 60 60)" />
        <Circle cx="60" cy="60" r="7" fill="#10b981" />
      </Svg>
    </View>
    {wordmark && <Text className={`${large ? 'text-2xl' : 'text-lg'} font-inter-semibold text-ink`}>{t('ui.logoName')}</Text>}
  </View>;
}
