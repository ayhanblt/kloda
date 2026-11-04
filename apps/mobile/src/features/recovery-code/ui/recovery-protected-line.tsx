import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { Text } from '../../../shared/ui/text';
import { useThemeColors } from '../../../shared/theme/theme-provider';

// ADR0029 decision 6: the short line on each cloud card (Lovable connections checksum strip); it opens the Settings entry.
export function RecoveryProtectedLine({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  return <Pressable accessibilityRole="link" accessibilityLabel={t('recovery.protected')} accessibilityHint={t('recovery.protectedHint')} onPress={onPress}
    className="min-h-12 flex-row items-center gap-2 rounded-xl border border-border-subtle bg-surface-1 px-3 py-2">
    <ShieldCheck size={16} color={colors['brand-base']} />
    <Text className="shrink grow font-sans text-xs text-secondary-text">{t('recovery.protected')}</Text>
    <Text className="font-sans text-xs font-semibold text-primary-text underline">{t('statusUi.settings')}</Text>
  </Pressable>;
}
