import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { Monitor, ShieldCheck, Wifi } from 'lucide-react-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../../shared/ui/tokens';
import { PairingButton } from './pairing-button';

export function PairingQuickPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const backdrop = useCallback((props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="none" />
  ), []);

  return (
    <BottomSheet
      index={0}
      snapPoints={['75%']}
      enableDynamicSizing={false}
      enablePanDownToClose={false}
      enableContentPanningGesture={false}
      enableHandlePanningGesture={false}
      handleComponent={null}
      backdropComponent={backdrop}
      backgroundStyle={styles.background}
      accessibilityViewIsModal
      style={styles.sheet}
    >
      <BottomSheetScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <Text accessibilityRole="header" style={styles.title}>{t('pairing.helpTitle')}</Text>
        <View style={styles.item}><Monitor color={colors.ink} size={24} /><Text style={styles.body}>{t('pairing.helpComputer')}</Text></View>
        <View style={styles.item}><Wifi color={colors.ink} size={24} /><Text style={styles.body}>{t('pairing.helpLan')}</Text></View>
        <View style={styles.item}><ShieldCheck color={colors.ink} size={24} /><Text style={styles.body}>{t('pairing.noFileGrant')}</Text></View>
        <Text style={styles.body}>{t('pairing.helpRecovery')}</Text>
        <PairingButton label={t('pairing.closeHelp')} onPress={onClose} />
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { zIndex: 10 },
  background: { backgroundColor: colors.surface, borderRadius: 24 },
  content: { padding: 24, gap: 24 },
  title: { color: colors.ink, fontSize: 22, lineHeight: 28, fontWeight: '600' },
  item: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  body: { flexShrink: 1, color: colors.muted, fontSize: 14, lineHeight: 20 },
});
