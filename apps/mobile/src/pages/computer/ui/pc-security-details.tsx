import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Shield } from 'lucide-react-native';
import { Platform, Pressable, View } from 'react-native';
import { Text } from '../../../shared/ui/text';
import { RichCard } from '../../../shared/ui/rich';
import { useThemeColors } from '../../../shared/theme/theme-provider';

export function PcSecurityDetails({ peerFingerprint }: { peerFingerprint?: string }) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const bgKey = Platform.OS === 'android'
    ? 'computer.androidBackground'
    : Platform.OS === 'ios'
      ? 'computer.iosBackground'
      : 'computer.foregroundOnly';

  return (
    <RichCard className="p-4">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((prev) => !prev)}
        className="min-h-10 flex-row items-center justify-between gap-3 active:opacity-80"
      >
        <View className="flex-row items-center gap-2.5">
          <Shield size={18} color={colors['text-secondary']} />
          <Text className="text-sm font-inter-semibold text-primary-text">
            {t(open ? 'computer.hideSecurityDetails' : 'computer.securityDetails')}
          </Text>
        </View>
        {open
          ? <ChevronUp size={18} color={colors['text-tertiary']} />
          : <ChevronDown size={18} color={colors['text-tertiary']} />}
      </Pressable>
      {open && (
        <View className="mt-3 gap-2.5 border-t border-border-subtle pt-3">
          {peerFingerprint && (
            <View className="gap-1">
              <Text className="font-sans text-xs text-secondary-text">{t('pairing.peerFingerprint')}</Text>
              <Text selectable className="font-sans font-mono text-xs leading-5 text-primary-text">{peerFingerprint}</Text>
            </View>
          )}
          <Text className="font-sans text-xs leading-5 text-secondary-text">{t('pairing.noFileGrant')}</Text>
          <Text className="font-sans text-xs leading-5 text-secondary-text">{t(bgKey)}</Text>
        </View>
      )}
    </RichCard>
  );
}
