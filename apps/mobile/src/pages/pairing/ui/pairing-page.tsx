import { ArrowLeft, Info, ScanQrCode, ShieldCheck } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

import { usePairing } from '../../../features/pairing/model/use-pairing';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { PairingModal } from '../../../features/pairing/ui/pairing-modal';
import { PairingQuickPanel } from '../../../features/pairing/ui/pairing-quick-panel';
import { QrScanner } from '../../../features/pairing/ui/qr-scanner';
import { colors } from '../../../shared/ui/tokens';

export function PairingPage({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { snapshot, foreground, armScan, scan, stopScanning, cancel, resume, refresh, decide } = usePairing();
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

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.content} importantForAccessibility={protectedDecision || help ? 'no-hide-descendants' : 'auto'}>
        <View style={styles.header}>
          <PairingButton label={t('pairing.back')} secondary disabled={protectedDecision || cameraVisible || help} icon={<ArrowLeft color={colors.ink} size={20} />} onPress={onBack} />
          <Text style={styles.brand}>{t('pairing.brand')}</Text>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          <Text accessibilityRole="header" style={styles.title}>{t('pairing.title')}</Text>
          <Text style={styles.description}>{t('pairing.description')}</Text>
          {cameraVisible ? (
            <QrScanner foreground={foreground} onScan={(qr) => { void scan(qr); }} onStop={stop} />
          ) : (
            <View style={styles.card}>
              {status?.phase === 'complete' && <ShieldCheck color={colors.secure} size={32} />}
              {!status && !error && <ActivityIndicator color={colors.ink} accessibilityLabel={t('pairing.loading')} />}
              {status && <Text style={styles.statusTitle}>{t(`pairing.phases.${status.phase}.title`)}</Text>}
              {status && <Text style={styles.description}>{t(`pairing.phases.${status.phase}.description`)}</Text>}
              {status?.repairRequired && <Text accessibilityRole="alert" style={styles.description}>{t('pairing.repairDescription')}</Text>}
              {status?.peerFingerprint && (
                <View style={styles.fingerprint}>
                  <Text style={styles.description}>{t('pairing.peerFingerprint')}</Text>
                  <Text selectable style={styles.fingerprintText}>{status.peerFingerprint}</Text>
                </View>
              )}
              {error && <Text accessibilityRole="alert" style={styles.error}>{t(`pairing.errors.${error}`)}</Text>}
              {canScan && <PairingButton label={t('pairing.startScan')} icon={<ScanQrCode color={colors.elevated} size={20} />} onPress={beginScan} />}
              {!protectedDecision && <PairingButton label={t('pairing.refresh')} secondary onPress={() => { void refresh(); }} />}
            </View>
          )}
          <Text style={styles.description}>{t('pairing.noFileGrant')}</Text>
          <PairingButton label={t('pairing.helpTitle')} secondary icon={<Info color={colors.ink} size={20} />} disabled={protectedDecision || cameraVisible} onPress={() => setHelp(true)} />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { flex: 1 },
  header: { flexDirection: 'row', gap: 16, alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  brand: { flexShrink: 1, color: colors.ink, fontSize: 13, fontWeight: '600' },
  body: { padding: 24, gap: 24 },
  title: { color: colors.ink, fontSize: 32, lineHeight: 38, fontWeight: '600', letterSpacing: -0.48 },
  statusTitle: { color: colors.ink, fontSize: 18, lineHeight: 24, fontWeight: '600' },
  description: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 16 },
  fingerprint: { gap: 8 },
  fingerprintText: { color: colors.ink, fontSize: 13, lineHeight: 18, fontFamily: 'monospace' },
  error: { color: colors.error, fontSize: 14, lineHeight: 20 },
});
