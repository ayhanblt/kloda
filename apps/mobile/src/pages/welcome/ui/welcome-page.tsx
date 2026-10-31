import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { Text } from '../../../shared/ui/text';
import { NativeSafeArea } from '../../../shared/ui/native-safe-area';
import { StatusHero } from '../../../shared/ui/status-hero';
import { KlodaLogo } from '../../../shared/ui/logo';
import { useThemeColors } from '../../../shared/theme/theme-provider';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';

export function WelcomePage({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  return <NativeSafeArea className="flex-1 bg-background"><ScrollView className="flex-1">
    <View className="mx-auto w-full max-w-[440px] gap-5 px-4 py-8">
      <View className="items-center gap-4 rounded-[32px] bg-background p-8">
        <StatusHero state="setup" destinations={['pc']} />
        <KlodaLogo large />
      </View>
      <Text accessibilityRole="header" className="text-center text-[30px] font-inter-semibold leading-tight text-primary-text">{t('ui.setup.m1Title')}</Text>
      <Text className="font-sans text-center text-base leading-6 text-secondary-text">{t('ui.setup.m1Body')}</Text>
      {[0,1,2].map((index) => <View key={index} className="flex-row items-center gap-3 rounded-2xl border border-border-subtle bg-surface-1 p-3">
        <View className="h-8 w-8 items-center justify-center rounded-xl bg-brand-subtle"><Text className="text-sm font-inter-semibold text-brand">{index + 1}</Text></View>
        <Text className="font-sans flex-1 text-sm leading-5 text-primary-text">{t(`ui.setup.m1Points.${index}`)}</Text><Check size={18} color={colors['brand-base']} />
      </View>)}
      <PairingButton variant="primary" label={t('ui.setup.start')} onPress={onStart} />
      <PairingButton variant="tertiary" label={t('ui.common.skip')} onPress={onSkip} />
    </View>
  </ScrollView></NativeSafeArea>;
}
