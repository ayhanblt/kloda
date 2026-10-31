import { ArrowLeft, Info, ScanQrCode, ShieldCheck } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, BackHandler, ScrollView, View } from 'react-native';
import { Text } from '../../../shared/ui/text';
import { NativeSafeArea } from '../../../shared/ui/native-safe-area';
import { toast } from 'sonner-native';

import { usePairing } from '../../../features/pairing/model/use-pairing';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { PairingModal } from '../../../features/pairing/ui/pairing-modal';
import { PairingQuickPanel } from '../../../features/pairing/ui/pairing-quick-panel';
import { QrScanner } from '../../../features/pairing/ui/qr-scanner';
import { useThemeColors } from '../../../shared/theme/theme-provider';

export function PairingPage({ onBack, onContinue }: { onBack: () => void; onContinue?: () => void }) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const { snapshot, foreground, armScan, scan, stopScanning, cancel, resume, refresh, decide, removePairing } = usePairing();
  const [scanning, setScanning] = useState(false);
  const [help, setHelp] = useState(false);
  const completed = useRef<string | null>(null);
  const { status, error, action, uncertain, scanLocked } = snapshot;
  const protectedDecision = !!action || (uncertain && error !== 'native_unsupported') || !!status && ['connecting', 'reserved', 'pending', 'consumed_pending_ack'].includes(status.phase);
  const cameraVisible = scanning && !scanLocked;
  const canScan = !!status && !status.repairRequired && !protectedDecision && ['idle', 'invalid', 'revoked'].includes(status.phase);

  useEffect(() => {
    if (error) toast.error(t(`pairing.errors.${error}`));
  }, [error, t]);

  useEffect(() => {
    if (status?.phase !== 'complete') return;
    const record = status.recordId ?? status.operationId ?? 'observed-complete';
    if (completed.current !== record) {
      completed.current = record;
      toast.success(t('pairing.phases.complete.title'));
    }
  }, [status, t]);

  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (protectedDecision || cameraVisible || help) return true;
      onBack();
      return true;
    });
    return () => listener.remove();
  }, [protectedDecision, cameraVisible, help, onBack]);

  const beginScan = () => {
    if (armScan()) setScanning(true);
  };
  const stop = () => {
    stopScanning();
    setScanning(false);
  };
  const confirmRemoval = () => {
    const recordId = status?.recordId;
    if (!recordId || status.phase !== 'complete' || protectedDecision) return;
    Alert.alert(t('pairing.unpair.title'), t('pairing.unpair.description'), [
      { text: t('pairing.unpair.cancel'), style: 'cancel' },
      { text: t('pairing.unpair.online'), onPress: () => { void removePairing(recordId, true); } },
      { text: t('pairing.unpair.offline'), style: 'destructive', onPress: () => { void removePairing(recordId, false); } },
    ], { cancelable: true });
  };

  return (
    <NativeSafeArea className="flex-1 bg-background">
      <View className="flex-1" importantForAccessibility={protectedDecision || help ? 'no-hide-descendants' : 'auto'}>
        <View className="flex-row items-center gap-4 border-b border-border-subtle px-4 py-4">
          <PairingButton label={t('pairing.back')} variant="secondary" disabled={protectedDecision || cameraVisible || help} icon={<ArrowLeft color={colors['text-primary']} size={20} />} onPress={onBack} />
          <Text className="shrink text-sm font-inter-semibold text-primary-text">{t('pairing.brand')}</Text>
        </View>
        <ScrollView contentContainerClassName="gap-6 px-4 pt-5 pb-8">
          <Text accessibilityRole="header" className="text-[28px] font-inter-semibold leading-9 text-primary-text">{t('pairing.title')}</Text>
          <Text className="font-sans text-sm leading-5 text-secondary-text">{t('pairing.description')}</Text>
          {cameraVisible ? (
            <QrScanner foreground={foreground} onScan={(qr) => { void scan(qr); }} onStop={stop} />
          ) : (
            <View className="gap-4 rounded-2xl border border-border-subtle bg-surface-1 p-5">
              {status?.phase === 'complete' && <ShieldCheck color={colors['brand-base']} size={32} />}
              {!status && !error && <ActivityIndicator color={colors['text-primary']} accessibilityLabel={t('pairing.loading')} />}
              {status && <Text className="text-lg font-inter-semibold leading-6 text-primary-text">{t(`pairing.phases.${status.phase}.title`)}</Text>}
              {status && <Text className="font-sans text-sm leading-5 text-secondary-text">{t(`pairing.phases.${status.phase}.description`)}</Text>}
              {status?.repairRequired && <Text accessibilityRole="alert" className="font-sans text-sm leading-5 text-secondary-text">{t('pairing.repairDescription')}</Text>}
              {status?.peerFingerprint && (
                <View className="gap-2">
                  <Text className="font-sans text-sm leading-5 text-secondary-text">{t('pairing.peerFingerprint')}</Text>
                  <Text selectable className="font-sans font-mono text-xs leading-5 text-primary-text">{status.peerFingerprint}</Text>
                </View>
              )}
              {error && <Text accessibilityRole="alert" className="font-sans text-sm leading-5 text-danger-text">{t(`pairing.errors.${error}`)}</Text>}
              {status?.unpairResult && <Text accessibilityRole="alert" className="font-sans text-sm leading-5 text-secondary-text">{t(`pairing.unpair.${status.unpairResult.state}`)}</Text>}
              {status?.phase === 'complete' && status.recordId && <PairingButton label={t('pairing.unpair.button')} variant="destructive" disabled={protectedDecision || cameraVisible} onPress={confirmRemoval} />}
              {canScan && <PairingButton variant="primary" label={t('pairing.startScan')} icon={<ScanQrCode color={colors['surface-1']} size={20} />} onPress={beginScan} />}
              {!protectedDecision && <PairingButton label={t('pairing.refresh')} variant="secondary" onPress={() => { void refresh(); }} />}
            </View>
          )}
          <Text className="font-sans text-sm leading-5 text-secondary-text">{t('pairing.noFileGrant')}</Text>
          {onContinue && foreground && !protectedDecision && !cameraVisible && !error && !uncertain
            && status?.phase === 'complete' && status.recordId && status.peerFingerprint && !status.repairRequired
            && <PairingButton label={t('computer.continue')} onPress={onContinue} />}
          <PairingButton label={t('pairing.helpTitle')} variant="secondary" icon={<Info color={colors['text-primary']} size={20} />} disabled={protectedDecision || cameraVisible} onPress={() => setHelp(true)} />
        </ScrollView>
      </View>
      {help && !protectedDecision && <PairingQuickPanel onClose={() => setHelp(false)} />}
      {protectedDecision && (
        <PairingModal
          snapshot={snapshot}
          onCancel={() => { void cancel(); }}
          onResume={() => { void resume(); }}
          onRefresh={() => { void refresh(); }}
          onLeave={onBack}
          onDecide={(decision, operationId, generation) => { void decide(decision, operationId, generation); }}
        />
      )}
    </NativeSafeArea>
  );
}
