import { usePcDestination } from '../../../features/backup-setup/model/use-pc-destination';
import { ArrowLeft, FolderSync, Monitor, ScanQrCode } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, BackHandler, Platform, ScrollView, View } from 'react-native';
import { Text } from '../../../shared/ui/text';
import { NativeSafeArea } from '../../../shared/ui/native-safe-area';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { pairing, pairingErrorCode, type PairingErrorCode, type PairingStatus } from '../../../shared/api/pairing';
import { useThemeColors } from '../../../shared/theme/theme-provider';

export function ComputerPage({ onBack, onPair, onActivity, onAdvanced, embedded = false }: {
  onBack: () => void; onPair: () => void; onActivity: () => void; onAdvanced: () => void; embedded?: boolean;
}) {
  const colors = useThemeColors();
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
  const destination = usePcDestination(paired ? status.recordId : undefined);
  return (
    <Surface className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-4 px-4 pt-5 pb-8">
        <PairingButton label={t('onboarding.back')} variant="secondary" icon={<ArrowLeft color={colors['text-primary']} size={20} />} onPress={onBack} />
        {!embedded && <Text className="shrink text-lg font-inter-semibold text-primary-text">{t('pairing.brand')}</Text>}
        <Text accessibilityRole="header" className="text-[28px] font-inter-semibold leading-9 text-primary-text">{t('computer.title')}</Text>
        <Text className="font-sans text-sm leading-5 text-secondary-text">{t('computer.description')}</Text>
        <View className="gap-3 rounded-2xl border border-border-subtle bg-surface-1 p-5">
          <Monitor color={colors['text-primary']} size={28} />
          <Text accessibilityRole="header" className="text-lg font-inter-semibold text-primary-text">{t(paired ? 'computer.paired' : 'computer.pairTitle')}</Text>
          <Text className="font-sans text-sm leading-5 text-secondary-text">{t('computer.pairDescription')}</Text>
          {paired && <>
            <Text className="font-sans text-sm leading-5 text-secondary-text">{t('destinations.pcOptInHint')}</Text>
            {destination.enabled !== null && <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-secondary-text">{t(destination.enabled ? 'destinations.enabled' : 'destinations.disabled')}</Text>}
            <PairingButton variant="secondary" label={t(destination.enabled ? 'destinations.disablePc' : 'destinations.enablePc')}
              disabled={destination.working || destination.enabled === null} onPress={() => { void destination.toggle(); }} />
            {destination.error && <Text accessibilityRole="alert" className="font-sans text-sm text-danger-text">{t(`transfer.errors.${destination.error}`, { defaultValue: t('transfer.errors.outcome_unknown') })}</Text>}
          </>}
          {!status && !error && <Text accessibilityLiveRegion="polite" className="font-sans text-sm leading-5 text-secondary-text">{t(active ? 'pairing.loading' : 'computer.inactive')}</Text>}
          {status && !paired && <Text className="font-sans text-sm leading-5 text-secondary-text">{t(`pairing.phases.${status.phase}.description`)}</Text>}
          {status?.repairRequired && <Text accessibilityRole="alert" className="font-sans text-sm leading-5 text-danger-text">{t('pairing.repairDescription')}</Text>}
          {status?.peerFingerprint && <Text selectable className="font-sans text-xs leading-5 text-secondary-text">{t('transfer.peer', { fingerprint: status.peerFingerprint })}</Text>}
          {error && <Text accessibilityRole="alert" className="font-sans text-sm leading-5 text-danger-text">{t(`pairing.errors.${error}`)}</Text>}
          <PairingButton label={t(paired ? 'computer.managePairing' : 'pairing.open')} disabled={!active}
            icon={<ScanQrCode color={colors['surface-1']} size={20} />} onPress={onPair} />
          <PairingButton label={t('pairing.refresh')} variant="secondary" disabled={!active} onPress={() => refresh.current()} />
        </View>
        <View className="gap-3 rounded-2xl border border-border-subtle bg-surface-1 p-5">
          <Text accessibilityRole="header" className="text-lg font-inter-semibold text-primary-text">{t('computer.grantTitle')}</Text>
          <Text className="font-sans text-sm leading-5 text-secondary-text">{t('computer.grantDescription')}</Text>
          <Text className="font-sans text-sm leading-5 text-secondary-text">{t('pairing.noFileGrant')}</Text>
        </View>
        <View className="gap-3 rounded-2xl border border-border-subtle bg-surface-1 p-5">
          <Text accessibilityRole="header" className="text-lg font-inter-semibold text-primary-text">{t('computer.transferTitle')}</Text>
          <Text className="font-sans text-sm leading-5 text-secondary-text">{t('computer.availability')}</Text>
          <PairingButton label={t('transfer.title')} variant="secondary" icon={<FolderSync color={colors['text-primary']} size={20} />} onPress={onActivity} />
        </View>
        <Text className="font-sans text-sm leading-5 text-secondary-text">{t(Platform.OS === 'android' ? 'computer.androidBackground' : Platform.OS === 'ios' ? 'computer.iosBackground' : 'computer.foregroundOnly')}</Text>
        <PairingButton label={t('computer.advanced')} variant="secondary" onPress={onAdvanced} />
      </ScrollView>
    </Surface>
  );
}
