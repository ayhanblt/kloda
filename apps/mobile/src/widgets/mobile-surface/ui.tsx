import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { Text } from '../../shared/ui/text';
import { BackLink } from '../../shared/ui/rich';

export function MobileSurface({
  title,
  description,
  onBack,
  backLabel,
  headerTop,
  children,
}: {
  title: string;
  description?: string;
  onBack?: () => void;
  backLabel?: string;
  headerTop?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" className="flex-1 bg-background">
      <View className="mx-auto w-full max-w-[440px] gap-4 px-4 pb-28 pt-3">
        {onBack && <BackLink label={backLabel ?? t('onboarding.back')} onPress={onBack} />}
        {headerTop}
        <View className="gap-1.5">
          <Text accessibilityRole="header" className="text-[28px] font-inter-semibold leading-8 tracking-tight text-primary-text">
            {title}
          </Text>
          {description && <Text className="font-sans text-sm leading-5 text-secondary-text">{description}</Text>}
        </View>
        {children}
      </View>
    </ScrollView>
  );
}

export function MobilePanel({ children, className }: { children: ReactNode; className?: string }) {
  return <View className={`gap-3 rounded-2xl border border-border-subtle bg-surface-1 p-4 ${className ?? ''}`}>{children}</View>;
}
