import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TriangleAlert } from 'lucide-react-native';
import { Text } from '../../../shared/ui/text';
import { MobilePanel } from '../../../widgets/mobile-surface/ui';
import { PairingButton } from '../../pairing/ui/pairing-button';
import { useThemeColors } from '../../../shared/theme/theme-provider';
import { RecoveryCodePanel } from './recovery-code-panel';

// ADR0029 29/2: destinations enabled before 29/1 keep backing up without a code, but nothing is catalogued until one is
// confirmed. The caller shows this while no code is confirmed and a cloud destination is enabled.
export function RecoveryLegacyPanel({ onConfirmed }: { onConfirmed: () => void }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  if (open) return <RecoveryCodePanel mode="confirm" onCancel={() => setOpen(false)} onConfirmed={() => { setOpen(false); onConfirmed(); }} />;
  return <MobilePanel>
    <TriangleAlert size={24} color={colors['text-secondary']} />
    <Text accessibilityRole="header" className="text-base font-inter-semibold text-primary-text">{t('recovery.legacyTitle')}</Text>
    <Text className="font-sans text-sm text-secondary-text">{t('recovery.legacyBody')}</Text>
    <PairingButton label={t('recovery.legacyAction')} onPress={() => setOpen(true)} />
  </MobilePanel>;
}
