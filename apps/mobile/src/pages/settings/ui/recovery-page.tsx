import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cloud, RefreshCw } from 'lucide-react-native';
import { Alert, View } from 'react-native';
import { Text } from '../../../shared/ui/text';
import { destinationAccount, providerLabel } from '../../../shared/api/cloud-destinations';
import { useCloudDestinations } from '../../../features/cloud-destination/model/use-cloud-destinations';
import { useRecoveryStatus } from '../../../features/recovery-code/model/use-recovery-status';
import { RecoveryCodePanel } from '../../../features/recovery-code/ui/recovery-code-panel';
import { RecoveryLegacyPanel } from '../../../features/recovery-code/ui/recovery-legacy-panel';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { MobilePanel, MobileSurface } from '../../../widgets/mobile-surface/ui';
import { useThemeColors } from '../../../shared/theme/theme-provider';

// ADR0029 decision 6: the confirmed code stays reachable here, with the cloud destinations it covers (DAV + OAuth).
// Renewal (decision 3) replaces the viewing panel while the new code is shown; the old code stays valid until confirmed.
export function RecoveryPage({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const cloud = useCloudDestinations();
  const [refresh, setRefresh] = useState(0);
  const state = useRecoveryStatus(refresh);
  const [renewing, setRenewing] = useState(false);
  const [renewed, setRenewed] = useState(false);
  const enabled = (cloud.destinations ?? []).some((item) => item.enabled);
  const askRenew = () => Alert.alert(t('recovery.renewTitle'), `${t('recovery.renewBody')}\n\n${t('recovery.renewLimit')}`, [
    { text: t('ui.conn.cancel'), style: 'cancel' },
    { text: t('recovery.renew'), onPress: () => { setRenewed(false); setRenewing(true); } },
  ], { cancelable: true });
  return <MobileSurface title={t('recovery.settingsEntry')} onBack={onBack}>
    {state === 'confirmed' ? <>
      <MobilePanel>
        <Text accessibilityRole="header" className="text-base font-inter-semibold text-primary-text">{t('recovery.covers')}</Text>
        {(cloud.destinations ?? []).map((item) => <View key={item.targetId} className="min-h-12 flex-row items-center gap-3 border-t border-border-subtle py-3">
          <Cloud size={20} color={colors['text-secondary']} />
          <View className="shrink gap-1">
            <Text className="font-sans text-base text-primary-text">{t(providerLabel(item.provider))}</Text>
            {destinationAccount(item) && <Text className="font-sans text-sm text-secondary-text">{destinationAccount(item)}</Text>}
          </View>
        </View>)}
      </MobilePanel>
      {renewing ? <RecoveryCodePanel mode="renew" onCancel={() => setRenewing(false)} onConfirmed={() => { setRenewing(false); setRenewed(true); }} /> : <>
        <RecoveryCodePanel />
        <MobilePanel>
          <PairingButton variant="secondary" icon={<RefreshCw size={18} />} label={t('recovery.renew')} onPress={askRenew} />
          {renewed && <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-secondary-text">{t('recovery.renewDone')}</Text>}
        </MobilePanel>
      </>}
    </> : state && (enabled ? <RecoveryLegacyPanel onConfirmed={() => setRefresh((value) => value + 1)} />
      : <MobilePanel><Text className="font-sans text-sm text-secondary-text">{t('recovery.coversNone')}</Text></MobilePanel>)}
  </MobileSurface>;
}
