import { ShieldAlert } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { colors } from '../../../shared/ui/tokens';
import type { PairingSnapshot } from '../model/pairing-controller';
import { PairingButton } from './pairing-button';

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
    <Animated.View entering={FadeIn.duration(180)} style={styles.overlay} accessibilityViewIsModal importantForAccessibility="yes">
      <View style={styles.backdrop} onStartShouldSetResponder={() => true} />
      <View style={styles.card}>
        <ScrollView contentContainerStyle={styles.content}>
          <ShieldAlert color={colors.processing} size={32} />
          <Text accessibilityRole="header" style={styles.title}>{t(repair ? 'pairing.repairTitle' : uncertain ? 'pairing.unknownTitle' : `pairing.phases.${phase}.title`)}</Text>
          <Text style={styles.body}>{t(repair ? 'pairing.repairDescription' : uncertain ? 'pairing.unknownDescription' : `pairing.phases.${phase}.description`)}</Text>
          {status?.peerFingerprint && (
            <View style={styles.fingerprint}>
              <Text style={styles.label}>{t('pairing.peerFingerprint')}</Text>
              <Text selectable style={styles.fingerprintText}>{status.peerFingerprint}</Text>
            </View>
          )}
          {repair && <Text style={styles.body}>{t('pairing.repairConsequences')}</Text>}
          <Text style={styles.body}>{t('pairing.noFileGrant')}</Text>
          {error && <Text accessibilityRole="alert" style={styles.error}>{t(`pairing.errors.${error}`)}</Text>}
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
          <Text style={styles.body}>{t('pairing.cancelConsequences')}</Text>
          <PairingButton label={t('pairing.cancel')} secondary disabled={!operationId || action === 'cancel'} onPress={onCancel} />
          {!operationId && !action && (
            <>
              <Text style={styles.body}>{t('pairing.leaveConsequences')}</Text>
              <PairingButton label={t('pairing.leave')} secondary onPress={onLeave} />
            </>
          )}
        </ScrollView>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 20, justifyContent: 'center', padding: 24 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(28,25,23,0.94)' },
  card: { maxHeight: '95%', borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surface },
  content: { padding: 24, gap: 16 },
  title: { color: colors.ink, fontSize: 22, lineHeight: 28, fontWeight: '600' },
  body: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '500' },
  error: { color: colors.error, fontSize: 14, lineHeight: 20 },
  fingerprint: { padding: 12, gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
  fingerprintText: { color: colors.ink, fontFamily: 'monospace', fontSize: 13, lineHeight: 18 },
});
