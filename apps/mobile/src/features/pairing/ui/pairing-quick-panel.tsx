import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { Monitor, ShieldCheck, Wifi } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { useCallback, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Text } from '../../../shared/ui/text';
import { NativeSafeArea } from '../../../shared/ui/native-safe-area';

import { colors } from '../../../shared/ui/tokens';
import { PairingButton } from './pairing-button';

cssInterop(BottomSheet, { className: 'style', backgroundClassName: 'backgroundStyle' });
// BottomSheet's animated generic props lose the inferred class keys in cssInterop.
function HelpSheet(props: ComponentProps<typeof BottomSheet> & { className?: string; backgroundClassName?: string }) {
  return <BottomSheet {...props} />;
}
const HelpScroll = cssInterop(BottomSheetScrollView, { contentContainerClassName: 'contentContainerStyle' });

export function PairingQuickPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const backdrop = useCallback((props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="none" />
  ), []);

  return (
    <HelpSheet
      index={0}
      snapPoints={['75%']}
      enableDynamicSizing={false}
      enablePanDownToClose={false}
      enableContentPanningGesture={false}
      enableHandlePanningGesture={false}
      handleComponent={null}
      backdropComponent={backdrop}
      backgroundClassName="rounded-3xl bg-surface"
      accessibilityViewIsModal
      className="z-10"
    >
      <HelpScroll contentContainerClassName="px-6 pt-6">
        <NativeSafeArea edges={['bottom']} className="gap-6 pb-6">
        <Text accessibilityRole="header" className="text-[22px] font-inter-semibold leading-7 text-ink">{t('pairing.helpTitle')}</Text>
        <View className="flex-row items-start gap-4"><Monitor color={colors.ink} size={24} /><Text className="font-sans shrink text-sm leading-5 text-muted">{t('pairing.helpComputer')}</Text></View>
        <View className="flex-row items-start gap-4"><Wifi color={colors.ink} size={24} /><Text className="font-sans shrink text-sm leading-5 text-muted">{t('pairing.helpLan')}</Text></View>
        <View className="flex-row items-start gap-4"><ShieldCheck color={colors.ink} size={24} /><Text className="font-sans shrink text-sm leading-5 text-muted">{t('pairing.noFileGrant')}</Text></View>
        <Text className="font-sans shrink text-sm leading-5 text-muted">{t('pairing.helpRecovery')}</Text>
        <PairingButton label={t('pairing.closeHelp')} onPress={onClose} />
      </NativeSafeArea>
      </HelpScroll>
    </HelpSheet>
  );
}
