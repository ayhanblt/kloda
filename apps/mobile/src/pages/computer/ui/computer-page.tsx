import { usePcDestination } from '../../../features/backup-setup/model/use-pc-destination';
import { CheckCircle2, FolderSync, Laptop, Monitor, ScanQrCode, ShieldCheck } from 'lucide-react-native';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, BackHandler, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import { Text } from '../../../shared/ui/text';
import { NativeSafeArea } from '../../../shared/ui/native-safe-area';
import { BackLink, IconTile, RichCard } from '../../../shared/ui/rich';
import { usePairing } from '../../../features/pairing/model/use-pairing';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { PairingModal } from '../../../features/pairing/ui/pairing-modal';
import { QrScanner } from '../../../features/pairing/ui/qr-scanner';
import { pairing, type PcScopeStatus } from '../../../shared/api/pairing';
import { useThemeColors } from '../../../shared/theme/theme-provider';
import { PcSecurityDetails } from './pc-security-details';

export function ComputerPage({ onBack, onActivity, embedded = false }: {
  onBack: () => void; onActivity: () => void; embedded?: boolean;
}) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const insets = useContext(SafeAreaInsetsContext);
  const Surface = embedded ? View : NativeSafeArea;
  const { snapshot, foreground, armScan, scan, stopScanning, cancel, resume, refresh, decide, unpair } = usePairing();
  const [scanning, setScanning] = useState(false);
  const [pcScope, setPcScope] = useState<PcScopeStatus | null>(null);
  const completed = useRef<string | null>(null);
  const scopeEpoch = useRef(0);
  const { status, error, action, uncertain, scanLocked } = snapshot;

  const protectedDecision = !!action
    || (uncertain && error !== 'native_unsupported')
    || (!!status && ['connecting', 'reserved', 'pending', 'consumed_pending_ack'].includes(status.phase));
  const cameraVisible = scanning && !scanLocked;
  const canScan = !!status && !status.repairRequired && !protectedDecision && ['idle', 'invalid', 'revoked'].includes(status.phase);
  const incompleteEvidence = foreground && !uncertain && status?.phase === 'complete' && !status.repairRequired && (!status.recordId || !status.peerFingerprint);
  const paired = foreground && !uncertain && error !== 'native_unsupported' && status?.phase === 'complete' && !status.repairRequired && !!status.recordId && !!status.peerFingerprint;
  const visibleError = error ?? (incompleteEvidence ? 'outcome_unknown' : null);
  const destination = usePcDestination(paired ? status?.recordId : undefined);
  const pcName = status?.peerName || pcScope?.peerName || t('computer.unnamedPc');

  const readScope = useCallback(async () => {
    const version = ++scopeEpoch.current;
    if (!paired || !foreground || typeof pairing.pcScopeStatus !== 'function') {
      setPcScope(null);
      return null;
    }
    try {
      const next = await pairing.pcScopeStatus();
      if (version === scopeEpoch.current) setPcScope(next);
      return next;
    } catch {
      return null;
    }
  }, [paired, foreground]);

  useEffect(() => {
    if (!paired || !foreground) {
      scopeEpoch.current += 1;
      setPcScope(null);
      return;
    }
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      const next = await readScope();
      if (alive && next?.state === 'not_approved') {
        timer = setTimeout(() => { void poll(); }, 2500);
      }
    };
    void poll();
    return () => { alive = false; scopeEpoch.current += 1; clearTimeout(timer); };
  }, [paired, foreground, status?.recordId, readScope]);

  useEffect(() => {
    if (!paired || !status?.recordId) return;
    if (completed.current !== status.recordId) {
      completed.current = status.recordId;
      toast.success(t('pairing.phases.complete.title'));
    }
  }, [paired, status?.recordId, t]);

  const beginScan = () => { if (armScan()) setScanning(true); };
  const stop = useCallback(() => { stopScanning(); setScanning(false); }, [stopScanning]);

  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (protectedDecision) return true;
      if (cameraVisible) { stop(); return true; }
      onBack();
      return true;
    });
    return () => listener.remove();
  }, [protectedDecision, cameraVisible, stop, onBack]);

  const handleRefresh = () => {
    void refresh();
    void readScope();
  };

  const confirmRemoval = () => {
    const recordId = status?.recordId;
    if (!recordId || !paired || protectedDecision) return;
    Alert.alert(t('pairing.unpair.title'), t('pairing.unpair.confirmBody'), [
      { text: t('pairing.unpair.cancel'), style: 'cancel' },
      { text: t('pairing.unpair.button'), style: 'destructive', onPress: () => { void unpair(recordId); } },
    ], { cancelable: true });
  };

  return (
    <Surface className="flex-1 bg-background">
      <View className="flex-1" importantForAccessibility={protectedDecision ? 'no-hide-descendants' : 'auto'}>
        <ScrollView
          contentContainerClassName="gap-4 px-4 pt-3"
          contentContainerStyle={{ paddingBottom: embedded ? Math.max((insets?.bottom ?? 0) + 104, 128) : 32 }}
        >
          <BackLink label={t('onboarding.back')} disabled={protectedDecision || cameraVisible} onPress={onBack} />
          <Text accessibilityRole="header" className="text-[28px] font-inter-semibold leading-9 text-primary-text">{t('computer.title')}</Text>
          <Text className="font-sans text-sm leading-5 text-secondary-text">{t('computer.description')}</Text>

          {cameraVisible ? (
            <QrScanner foreground={foreground} onScan={(qr) => { void scan(qr); }} onStop={stop} />
          ) : (
            <RichCard className="gap-3.5 p-5">
              {paired ? (
                <>
                  <View className="flex-row items-center gap-3">
                    <IconTile tone="brand"><ShieldCheck color={colors['brand-text']} size={22} /></IconTile>
                    <View className="min-w-0 flex-1 gap-0.5">
                      <Text accessibilityRole="header" className="text-lg font-inter-semibold text-primary-text">{pcName}</Text>
                      <Text className="font-sans text-xs text-secondary-text">{t('computer.paired')}</Text>
                    </View>
                  </View>

                  {pcScope?.state === 'not_approved' ? (
                    <View className="gap-2 rounded-2xl border border-brand/30 bg-surface-2 p-4">
                      <View className="flex-row items-center gap-2.5">
                        <Laptop size={18} color={colors['brand-text']} />
                        <Text className="min-w-0 flex-1 text-sm font-inter-semibold text-primary-text">{t('computer.scopePendingTitle')}</Text>
                      </View>
                      <Text className="font-sans text-xs leading-5 text-secondary-text">{t('computer.scopePendingBody', { name: pcName })}</Text>
                      <Pressable onPress={handleRefresh} accessibilityRole="button" className="self-start pt-1 active:opacity-75">
                        <Text className="text-xs font-inter-semibold text-brand-text">{t('pairing.refresh')}</Text>
                      </Pressable>
                    </View>
                  ) : pcScope?.state === 'approved' ? (
                    <View className="flex-row items-center gap-2 rounded-xl bg-surface-2 px-3 py-2.5">
                      <CheckCircle2 size={16} color={colors['brand-text']} />
                      <Text className="min-w-0 flex-1 font-sans text-xs font-inter-medium text-primary-text">{t('computer.scopeApproved')}</Text>
                    </View>
                  ) : pcScope?.state === 'revoked' ? (
                    <Text accessibilityRole="alert" className="font-sans text-sm leading-5 text-danger-text">{t('computer.scopeRevoked')}</Text>
                  ) : (
                    <View className="gap-1.5">
                      <Text className="font-sans text-sm leading-5 text-secondary-text">{t('computer.availability')}</Text>
                      <Pressable onPress={handleRefresh} accessibilityRole="button" className="self-start active:opacity-75">
                        <Text className="text-xs font-inter-semibold text-brand-text">{t('pairing.refresh')}</Text>
                      </Pressable>
                    </View>
                  )}

                  {destination.enabled !== null && (
                    <Text accessibilityLiveRegion="polite" className="font-sans text-xs text-secondary-text">
                      {t(destination.enabled ? 'destinations.enabled' : 'destinations.disabled')}
                    </Text>
                  )}
                  {destination.error && (
                    <Text accessibilityRole="alert" className="font-sans text-sm text-danger-text">
                      {t(`transfer.errors.${destination.error}`, { defaultValue: t('transfer.errors.outcome_unknown') })}
                    </Text>
                  )}

                  <PairingButton variant="primary" label={t('transfer.title')} icon={<FolderSync size={19} />} onPress={onActivity} />
                  <PairingButton
                    variant="secondary"
                    label={t(destination.enabled ? 'destinations.disablePc' : 'destinations.enablePc')}
                    disabled={destination.working || destination.enabled === null}
                    onPress={() => { void destination.toggle(); }}
                  />
                  <PairingButton
                    variant="destructive"
                    label={t('pairing.unpair.button')}
                    disabled={protectedDecision}
                    onPress={confirmRemoval}
                  />
                </>
              ) : (
                <>
                  <IconTile tone="neutral"><Monitor color={colors['text-primary']} size={22} /></IconTile>
                  <Text accessibilityRole="header" className="text-lg font-inter-semibold text-primary-text">
                    {!foreground ? t('computer.inactive') : status ? t('computer.pairTitle') : t('pairing.loading')}
                  </Text>
                  <Text className="font-sans text-sm leading-5 text-secondary-text">{t('computer.pairDescription')}</Text>
                  {!status && !visibleError && foreground && <ActivityIndicator color={colors['text-primary']} accessibilityLabel={t('pairing.loading')} />}
                  {status && !visibleError && <Text className="font-sans text-sm leading-5 text-secondary-text">{t(`pairing.phases.${status.phase}.description`)}</Text>}
                  {status?.repairRequired && <Text accessibilityRole="alert" className="font-sans text-sm leading-5 text-danger-text">{t('pairing.repairDescription')}</Text>}
                  {status?.unpairResult && <Text accessibilityRole="alert" className="font-sans text-sm leading-5 text-secondary-text">{t(`pairing.unpair.${status.unpairResult.state}`)}</Text>}
                  {visibleError && <Text accessibilityRole="alert" className="font-sans text-sm leading-5 text-danger-text">{t(`pairing.errors.${visibleError}`)}</Text>}
                  {canScan && (
                    <PairingButton variant="primary" label={t('pairing.startScan')} disabled={!foreground} icon={<ScanQrCode size={20} />} onPress={beginScan} />
                  )}
                  <PairingButton variant="secondary" label={t('pairing.refresh')} disabled={!foreground} onPress={handleRefresh} />
                </>
              )}
            </RichCard>
          )}

          <PcSecurityDetails peerFingerprint={status?.peerFingerprint} />
        </ScrollView>
      </View>

      {protectedDecision && (
        <PairingModal
          snapshot={snapshot}
          onCancel={() => { void cancel(); }}
          onResume={() => { void resume(); }}
          onRefresh={handleRefresh}
          onLeave={onBack}
          onDecide={(decision, operationId, generation) => { void decide(decision, operationId, generation); }}
        />
      )}
    </Surface>
  );
}
