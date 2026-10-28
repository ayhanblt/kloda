import { ArrowLeft, FolderSync, Monitor, ScanQrCode } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, BackHandler, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { pairing, pairingErrorCode, type PairingErrorCode, type PairingStatus } from '../../../shared/api/pairing';
import { colors } from '../../../shared/ui/tokens';

export function ComputerPage({ onBack, onPair, onActivity, onAdvanced }: {
  onBack: () => void; onPair: () => void; onActivity: () => void; onAdvanced: () => void;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<PairingStatus | null>(null);
  const [error, setError] = useState<PairingErrorCode | null>(null);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const refresh = useRef<() => void>(() => undefined);
  useEffect(() => {
    let revision = 0;
    let mounted = true;
    const read = async () => {
      const version = ++revision;
      setStatus(null); setError(null);
      if (AppState.currentState !== 'active') return;
      try {
        const observed = await pairing.status();
        if (!mounted || version !== revision) return;
        if (observed.errorCode) { setError(observed.errorCode); return; }
        if (observed.phase === 'complete' && (!observed.recordId || !observed.peerFingerprint)) {
          setError('outcome_unknown'); return;
        }
        setStatus(observed);
      } catch (cause) {
        if (mounted && version === revision) setError(pairingErrorCode(cause));
      }
    };
    refresh.current = () => { void read(); };
    const changes = AppState.addEventListener('change', (state) => {
      setActive(state === 'active');
      void read();
    });
    void read();
    return () => { mounted = false; revision++; changes.remove(); refresh.current = () => undefined; };
  }, []);
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true; });
    return () => listener.remove();
  }, [onBack]);
  const paired = active && status?.phase === 'complete' && !status.repairRequired;
  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.body}>
        <PairingButton label={t('onboarding.back')} secondary icon={<ArrowLeft color={colors.ink} size={20} />} onPress={onBack} />
        <Text style={styles.brand}>{t('pairing.brand')}</Text>
        <Text accessibilityRole="header" style={styles.title}>{t('computer.title')}</Text>
        <Text style={styles.description}>{t('computer.description')}</Text>
        <View style={styles.card}>
          <Monitor color={colors.ink} size={28} />
          <Text accessibilityRole="header" style={styles.heading}>{t(paired ? 'computer.paired' : 'computer.pairTitle')}</Text>
          <Text style={styles.description}>{t('computer.pairDescription')}</Text>
          {!status && !error && <Text accessibilityLiveRegion="polite" style={styles.description}>{t(active ? 'pairing.loading' : 'computer.inactive')}</Text>}
          {status && !paired && <Text style={styles.description}>{t(`pairing.phases.${status.phase}.description`)}</Text>}
          {status?.repairRequired && <Text accessibilityRole="alert" style={styles.error}>{t('pairing.repairDescription')}</Text>}
          {status?.peerFingerprint && <Text selectable style={styles.fingerprint}>{t('transfer.peer', { fingerprint: status.peerFingerprint })}</Text>}
          {error && <Text accessibilityRole="alert" style={styles.error}>{t(`pairing.errors.${error}`)}</Text>}
          <PairingButton label={t(paired ? 'computer.managePairing' : 'pairing.open')} disabled={!active}
            icon={<ScanQrCode color={colors.elevated} size={20} />} onPress={onPair} />
          <PairingButton label={t('pairing.refresh')} secondary disabled={!active} onPress={() => refresh.current()} />
        </View>
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.heading}>{t('computer.grantTitle')}</Text>
          <Text style={styles.description}>{t('computer.grantDescription')}</Text>
          <Text style={styles.description}>{t('pairing.noFileGrant')}</Text>
        </View>
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.heading}>{t('computer.transferTitle')}</Text>
          <Text style={styles.description}>{t('computer.availability')}</Text>
          <PairingButton label={t('transfer.title')} secondary icon={<FolderSync color={colors.ink} size={20} />} onPress={onActivity} />
        </View>
        <Text style={styles.description}>{t(Platform.OS === 'android' ? 'computer.androidBackground' : Platform.OS === 'ios' ? 'computer.iosBackground' : 'computer.foregroundOnly')}</Text>
        <PairingButton label={t('computer.advanced')} secondary onPress={onAdvanced} />
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  body: { padding: 24, gap: 16, maxWidth: 680, width: '100%', alignSelf: 'center' },
  brand: { fontSize: 18, fontWeight: '700', color: colors.ink, flexShrink: 1 },
  title: { fontSize: 30, fontWeight: '700', color: colors.ink },
  heading: { fontSize: 18, fontWeight: '600', color: colors.ink },
  description: { fontSize: 14, lineHeight: 21, color: colors.muted },
  card: { borderRadius: 20, padding: 20, gap: 12, backgroundColor: colors.elevated, borderColor: colors.border, borderWidth: 1 },
  fingerprint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  error: { color: colors.error, fontSize: 14, lineHeight: 21 },
});
