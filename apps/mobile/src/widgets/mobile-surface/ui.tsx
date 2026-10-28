import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { Text } from '../../shared/ui/text';
import { ArrowLeft } from 'lucide-react-native';
import { PairingButton } from '../../features/pairing/ui/pairing-button';
import { colors } from '../../shared/ui/tokens';

export function MobileSurface({ title, description, onBack, children }: { title: string; description?: string; onBack?: () => void; children: ReactNode }) {
  const { t } = useTranslation();
  return <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" className="flex-1 bg-surface">
    <View className="mx-auto w-full max-w-[680px] gap-5 p-4 pb-8">
      {onBack && <PairingButton secondary label={t('onboarding.back')} icon={<ArrowLeft color={colors.ink} size={18} />} onPress={onBack} />}
      <View className="gap-2"><Text accessibilityRole="header" className="text-3xl font-inter-semibold tracking-tight text-ink">{title}</Text>
        {description && <Text className="font-sans text-base leading-6 text-muted">{description}</Text>}</View>
      {children}
    </View>
  </ScrollView>;
}

export function MobilePanel({ children }: { children: ReactNode }) {
  return <View className="gap-3 rounded-[24px] border border-border bg-elevated p-5">{children}</View>;
}
