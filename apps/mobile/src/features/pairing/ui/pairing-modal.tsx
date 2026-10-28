import { ShieldAlert } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Text } from '../../../shared/ui/text';
import Animated, { FadeIn } from 'react-native-reanimated';

import { colors } from '../../../shared/ui/tokens';
import type { PairingSnapshot } from '../model/pairing-controller';
import { PairingButton } from './pairing-button';

const ModalSurface = cssInterop(Animated.View, { className: 'style' });

interface Props {
  snapshot: PairingSnapshot;
  onCancel: () => void;
  onResume: () => void;
  onRefresh: () => void;
  onLeave: () => void;
  onDecide: (decision: 'approve' | 'deny', operationId: string, generation: string) => void;
}

export function PairingModal({ snapshot, onCancel, onResume, onRefresh, onLeave, onDecide }: Props) {
  const { t } = useTranslation();
  const { status, action, uncertain, error } = snapshot;
  const repair = status?.phase === 'connecting' && status.repairRequired;
  const operationId = status?.operationId;
  const generation = status?.candidateGeneration;
  const canDecide = repair && !!operationId && !!generation && !!status?.peerFingerprint && !action && !uncertain;
  const phase = status?.phase ?? 'connecting';

  return (
    <ModalSurface entering={FadeIn.duration(180)} className="absolute inset-0 z-20 justify-center p-6" accessibilityViewIsModal importantForAccessibility="yes">
      <View className="absolute inset-0 bg-ink/95" onStartShouldSetResponder={() => true} />
      <View className="max-h-[95%] overflow-hidden rounded-3xl bg-surface">
        <ScrollView contentContainerClassName="gap-4 p-6">
          <ShieldAlert color={colors.processing} size={32} />
          <Text accessibilityRole="header" className="text-[22px] font-inter-semibold leading-7 text-ink">{t(action === 'remove' ? 'pairing.unpair.title' : repair ? 'pairing.repairTitle' : uncertain ? 'pairing.unknownTitle' : `pairing.phases.${phase}.title`)}</Text>
          <Text className="font-sans text-sm leading-5 text-muted">{t(action === 'remove' ? 'pairing.unpair.description' : repair ? 'pairing.repairDescription' : uncertain ? 'pairing.unknownDescription' : `pairing.phases.${phase}.description`)}</Text>
          {status?.peerFingerprint && (
            <View className="gap-2 rounded-xl border border-border p-3">
              <Text className="text-xs font-inter-medium text-muted">{t('pairing.peerFingerprint')}</Text>
              <Text selectable className="font-sans font-mono text-xs leading-5 text-ink">{status.peerFingerprint}</Text>
            </View>
          )}
          {repair && <Text className="font-sans text-sm leading-5 text-muted">{t('pairing.repairConsequences')}</Text>}
          <Text className="font-sans text-sm leading-5 text-muted">{t('pairing.noFileGrant')}</Text>
          {error && <Text accessibilityRole="alert" className="font-sans text-sm leading-5 text-error">{t(`pairing.errors.${error}`)}</Text>}
          {action && <ActivityIndicator color={colors.ink} accessibilityLabel={t('pairing.working')} />}
          {repair && (
            <>
              <PairingButton label={t('pairing.pairAgain')} disabled={!canDecide} onPress={() => { if (operationId && generation) onDecide('approve', operationId, generation); }} />
              <PairingButton label={t('pairing.denyRepair')} secondary disabled={!canDecide} onPress={() => { if (operationId && generation) onDecide('deny', operationId, generation); }} />
            </>
          )}
          {!repair && status?.recordId && ['pending', 'consumed_pending_ack'].includes(phase) && (
            <PairingButton label={t('pairing.resume')} disabled={!!action || uncertain} onPress={onResume} />
          )}
          <PairingButton label={t('pairing.refresh')} secondary disabled={action === 'cancel'} onPress={onRefresh} />
          {action !== 'remove' && <>
            <Text className="font-sans text-sm leading-5 text-muted">{t('pairing.cancelConsequences')}</Text>
            <PairingButton label={t('pairing.cancel')} secondary disabled={!operationId || action === 'cancel'} onPress={onCancel} />
          </>}
          {!operationId && !action && (
            <>
              <Text className="font-sans text-sm leading-5 text-muted">{t('pairing.leaveConsequences')}</Text>
              <PairingButton label={t('pairing.leave')} secondary onPress={onLeave} />
            </>
          )}
        </ScrollView>
      </View>
    </ModalSurface>
  );
}
