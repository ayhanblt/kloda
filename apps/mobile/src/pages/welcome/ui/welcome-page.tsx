import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { Text } from '../../../shared/ui/text';
import { NativeSafeArea } from '../../../shared/ui/native-safe-area';
import { HeroEmptyVisual } from '../../../shared/ui/hero-empty-visual';
import { RichCard } from '../../../shared/ui/rich';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';

export function WelcomePage({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  const { t } = useTranslation();
  return (
    <NativeSafeArea className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
        <View className="mx-auto w-full max-w-[440px] flex-1 gap-4 px-4 pb-5 pt-3">
          <View className="items-center">
            <HeroEmptyVisual
              visual={{ kind: 'path' }}
              state="syncing"
              destinations={['pc', 'nas', 'cloud']}
              className="aspect-[1.75] w-full max-w-[358px] rounded-3xl border border-border-subtle"
            />
          </View>
          <View className="gap-2 px-1">
            <Text accessibilityRole="header" className="text-center text-[28px] font-inter-semibold leading-[33px] text-primary-text">
              {t('ui.setup.m1Title')}
            </Text>
            <Text className="font-sans text-center text-sm leading-5 text-secondary-text">
              {t('ui.setup.m1Body')}
            </Text>
          </View>
          <RichCard className="rounded-2xl">
            {[0, 1, 2].map((index) => (
              <View key={index} className={`flex-row items-center gap-3 px-4 py-3 ${index > 0 ? 'border-t border-border-subtle' : ''}`}>
                <View className="h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-subtle">
                  <Text className="text-xs font-inter-semibold text-brand-text">{index + 1}</Text>
                </View>
                <Text className="font-sans flex-1 text-sm leading-5 text-primary-text">{t(`ui.setup.m1Points.${index}`)}</Text>
              </View>
            ))}
          </RichCard>
          <View className="mt-auto gap-1.5 pt-2">
            <PairingButton variant="primary" size="lg" label={t('ui.setup.start')} onPress={onStart} />
            <PairingButton variant="tertiary" size="sm" label={t('ui.common.skip')} onPress={onSkip} />
          </View>
        </View>
      </ScrollView>
    </NativeSafeArea>
  );
}
