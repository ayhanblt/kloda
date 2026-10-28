import { ArrowLeft, FolderSync, Monitor, ScanQrCode } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, BackHandler, Platform, ScrollView, View } from 'react-native';
import { Text } from '../../../shared/ui/text';
import { NativeSafeArea } from '../../../shared/ui/native-safe-area';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { pairing, pairingErrorCode, type PairingErrorCode, type PairingStatus } from '../../../shared/api/pairing';
import { colors } from '../../../shared/ui/tokens';

export function ComputerPage({ onBack, onPair, onActivity, onAdvanced, embedded = false }: {
  onBack: () => void; onPair: () => void; onActivity: () => void; onAdvanced: () => void; embedded?: boolean;
}) {
  const { t } = useTranslation();
  const Surface = embedded ? View : NativeSafeArea;
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
    <Surface className="flex-1 bg-surface">
      <ScrollView contentContainerClassName="gap-4 px-4 pt-5 pb-8">
        <PairingButton label={t('onboarding.back')} secondary icon={<ArrowLeft color={colors.ink} size={20} />} onPress={onBack} />
        {!embedded && <Text className="shrink text-lg font-inter-semibold text-ink">{t('pairing.brand')}</Text>}
        <Text accessibilityRole="header" className="text-[28px] font-inter-semibold leading-9 text-ink">{t('computer.title')}</Text>
        <Text className="font-sans text-sm leading-5 text-muted">{t('computer.description')}</Text>
        <View className="gap-3 rounded-3xl border border-border bg-white p-5">
          <Monitor color={colors.ink} size={28} />
          <Text accessibilityRole="header" className="text-lg font-inter-semibold text-ink">{t(paired ? 'computer.paired' : 'computer.pairTitle')}</Text>
          <Text className="font-sans text-sm leading-5 text-muted">{t('computer.pairDescription')}</Text>
          {!status && !error && <Text accessibilityLiveRegion="polite" className="font-sans text-sm leading-5 text-muted">{t(active ? 'pairing.loading' : 'computer.inactive')}</Text>}
          {status && !paired && <Text className="font-sans text-sm leading-5 text-muted">{t(`pairing.phases.${status.phase}.description`)}</Text>}
          {status?.repairRequired && <Text accessibilityRole="alert" className="font-sans text-sm leading-5 text-error">{t('pairing.repairDescription')}</Text>}
          {status?.peerFingerprint && <Text selectable className="font-sans text-xs leading-5 text-muted">{t('transfer.peer', { fingerprint: status.peerFingerprint })}</Text>}
          {error && <Text accessibilityRole="alert" className="font-sans text-sm leading-5 text-error">{t(`pairing.errors.${error}`)}</Text>}
          <PairingButton label={t(paired ? 'computer.managePairing' : 'pairing.open')} disabled={!active}
            icon={<ScanQrCode color={colors.elevated} size={20} />} onPress={onPair} />
          <PairingButton label={t('pairing.refresh')} secondary disabled={!active} onPress={() => refresh.current()} />
        </View>
        <View className="gap-3 rounded-3xl border border-border bg-white p-5">
          <Text accessibilityRole="header" className="text-lg font-inter-semibold text-ink">{t('computer.grantTitle')}</Text>
          <Text className="font-sans text-sm leading-5 text-muted">{t('computer.grantDescription')}</Text>
          <Text className="font-sans text-sm leading-5 text-muted">{t('pairing.noFileGrant')}</Text>
        </View>
        <View className="gap-3 rounded-3xl border border-border bg-white p-5">
          <Text accessibilityRole="header" className="text-lg font-inter-semibold text-ink">{t('computer.transferTitle')}</Text>
          <Text className="font-sans text-sm leading-5 text-muted">{t('computer.availability')}</Text>
          <PairingButton label={t('transfer.title')} secondary icon={<FolderSync color={colors.ink} size={20} />} onPress={onActivity} />
        </View>
        <Text className="font-sans text-sm leading-5 text-muted">{t(Platform.OS === 'android' ? 'computer.androidBackground' : Platform.OS === 'ios' ? 'computer.iosBackground' : 'computer.foregroundOnly')}</Text>
        <PairingButton label={t('computer.advanced')} secondary onPress={onAdvanced} />
      </ScrollView>
    </Surface>
  );
}
