import { useTranslation } from 'react-i18next';
import { Check, Monitor, Smartphone, ShieldCheck } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { Text } from '../../../shared/ui/text';
import { NativeSafeArea } from '../../../shared/ui/native-safe-area';
import { KlodaLogo } from '../../../shared/ui/logo';
import { colors } from '../../../shared/ui/tokens';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';

export function WelcomePage({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  const { t } = useTranslation();
  return <NativeSafeArea className="flex-1 bg-surface"><ScrollView className="flex-1">
    <View className="mx-auto w-full max-w-[440px] gap-5 px-4 py-8">
      <View className="items-center gap-4 rounded-[32px] bg-outerSurface p-8">
        <View className="flex-row items-center gap-6"><Smartphone size={48} color={colors.muted} /><ShieldCheck size={28} color={colors.secure} /><Monitor size={64} color={colors.ink} /></View>
        <KlodaLogo large />
      </View>
      <Text accessibilityRole="header" className="text-center text-[30px] font-inter-semibold leading-tight text-ink">{t('ui.setup.m1Title')}</Text>
      <Text className="font-sans text-center text-base leading-6 text-muted">{t('ui.setup.m1Body')}</Text>
      {[0,1,2].map((index) => <View key={index} className="flex-row items-center gap-3 rounded-2xl border border-border bg-elevated p-3">
        <View className="h-8 w-8 items-center justify-center rounded-xl bg-secureSoft"><Text className="text-sm font-inter-semibold text-secure">{index + 1}</Text></View>
        <Text className="font-sans flex-1 text-sm leading-5 text-ink">{t(`ui.setup.m1Points.${index}`)}</Text><Check size={18} color={colors.secure} />
      </View>)}
      <PairingButton label={t('ui.setup.start')} onPress={onStart} />
      <PairingButton secondary label={t('ui.common.skip')} onPress={onSkip} />
    </View>
  </ScrollView></NativeSafeArea>;
}
