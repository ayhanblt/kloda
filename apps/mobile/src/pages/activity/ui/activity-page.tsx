import { ArrowLeft, Download, FolderSync, Pause, ShieldCheck } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, BackHandler, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFileTransfer } from '../../../features/file-transfer/model/use-file-transfer';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { photoManifestPrefix } from '../../../shared/api/file-transfer';
import { colors } from '../../../shared/ui/tokens';

export function ActivityPage({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { queue, error, working, peer, run, pause, resumeAutomatic, backups, restored, restoring, ownBackup, cancelRestore, photos } = useFileTransfer();
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true; });
    return () => subscription.remove();
  }, [onBack]);
  const { fontScale, height } = useWindowDimensions();
  const scrollChrome = fontScale > 1.3 || height < 600;
  const header = (
    <View style={[styles.header, scrollChrome && styles.stackedHeader]}>
        <PairingButton label={t('pairing.back')} secondary icon={<ArrowLeft color={colors.ink} size={20} />} onPress={onBack} />
        <Text style={[styles.brand, scrollChrome && styles.stackedBrand]}>{t('pairing.brand')}</Text>
      </View>
  );
  const controls = (
    <View style={[styles.controls, scrollChrome && styles.scrollingControls]}>
        {restoring && <PairingButton label={t('transfer.backups.cancel')} secondary onPress={() => { void cancelRestore(); }} />}
        {queue?.automaticPaused === true
          ? <PairingButton label={t('transfer.continueAutomatic')} secondary disabled={working} onPress={() => { void resumeAutomatic(); }} />
          : <PairingButton label={t('transfer.pause')} secondary disabled={working || !(queue?.running || queue?.automaticPaused === false)} icon={<Pause color={colors.ink} size={18} />} onPress={() => { void pause(); }} />}
        {queue?.automaticPaused !== undefined && <Text style={styles.description}>{t('transfer.pauseExplanation')}</Text>}
        <PairingButton label={t('transfer.syncNow')} disabled={working || !!queue?.running} icon={<FolderSync color={colors.elevated} size={18} />} onPress={() => { void run(); }} />
      </View>
  );
  return (
    <SafeAreaView style={styles.root}>
      {!scrollChrome && header}
      <ScrollView contentContainerStyle={styles.body}>
        {scrollChrome && header}
        <Text accessibilityRole="header" style={styles.title}>{t('transfer.title')}</Text>
        <Text style={styles.description}>{t('transfer.description')}</Text>
        <View style={styles.card}>
          <FolderSync color={colors.secure} size={28} />
          <Text style={styles.heading}>{t(queue?.run?.state === 'retry_wait' ? 'transfer.retryWaiting' : queue?.running ? 'transfer.running' : 'transfer.waiting')}</Text>
          {peer && <Text selectable style={styles.description}>{t('transfer.peer', { fingerprint: peer })}</Text>}
          {queue?.run && <View accessibilityLiveRegion="polite">
            <Text style={styles.description}>{t('transfer.runAttempt', { attempt: queue.run.attempts })}</Text>
            <Text style={styles.description}>{t(`transfer.runStates.${queue.run.state}`)}</Text>
            {queue.run.retryAt && <Text style={styles.description}>{t('transfer.retryAt', { time: new Date(Number(queue.run.retryAt)).toLocaleString() })}</Text>}
            {queue.run.errorCode && <Text accessibilityRole="alert" style={styles.error}>
              {t(`transfer.errors.${queue.run.errorCode}`, { defaultValue: t('transfer.errors.outcome_unknown') })}
            </Text>}
          </View>}
          {queue?.automaticRun && <View accessibilityLiveRegion="polite">
            <Text style={styles.description}>{t('transfer.osAttempt', { attempt: queue.automaticRun.attempts })}</Text>
            {(queue.automaticRun.accessAttempts ?? 0) > 0 && <Text style={styles.description}>{t('transfer.runAttempt', { attempt: queue.automaticRun.accessAttempts })}</Text>}
            <Text style={styles.description}>{t(queue.automaticRun.accessAttempts !== undefined && queue.automaticRun.state === 'exhausted'
              ? 'transfer.runStates.needs_attention'
              : queue.automaticRun.accessAttempts !== undefined && queue.automaticRun.state === 'waiting' && queue.automaticRun.errorCode !== 'os_interrupted'
                ? 'transfer.retryWaiting' : `transfer.osStates.${queue.automaticRun.state}`)}</Text>
            {queue.automaticRun.retryAt && <Text style={styles.description}>{t('transfer.retryAt', { time: new Date(Number(queue.automaticRun.retryAt)).toLocaleString() })}</Text>}
            {queue.automaticRun.errorCode && <Text accessibilityRole="alert" style={styles.error}>{t(`transfer.errors.${queue.automaticRun.errorCode}`, { defaultValue: t('transfer.errors.outcome_unknown') })}</Text>}
          </View>}
          {queue?.notificationsEnabled === false && <Text accessibilityLiveRegion="polite" style={styles.description}>{t('transfer.notificationsDisabled')}</Text>}
          {queue?.automaticPaused === true && <Text accessibilityLiveRegion="polite" style={styles.description}>{t('transfer.automaticPaused')}</Text>}
          {queue?.automaticError && <Text accessibilityRole="alert" style={styles.error}>{t(`transfer.errors.${queue.automaticError}`, { defaultValue: t('transfer.errors.outcome_unknown') })}</Text>}
          {queue && <Text style={styles.description}>{t('transfer.count', { count: queue.totalJobs })}</Text>}
          {!queue && !error && <Text style={styles.description}>{t('pairing.loading')}</Text>}
          {error && <Text accessibilityRole="alert" style={styles.error}>{t(`transfer.errors.${error}`, { defaultValue: t('transfer.errors.outcome_unknown') })}</Text>}
        </View>
        {queue?.jobs.map((job) => {
          const percent = job.totalBytes !== undefined && BigInt(job.totalBytes) > 0n
            ? Number(BigInt(job.acknowledgedBytes) * 100n / BigInt(job.totalBytes)) : 0;
          return (
            <View key={job.id} style={styles.card}>
              <Text style={styles.heading}>{job.name}</Text>
              <Text style={styles.description}>{t(`transfer.states.${job.state}`)}</Text>
              <Text style={styles.description}>{t('transfer.bytes', { acknowledged: job.acknowledgedBytes, total: job.totalBytes ?? '—' })}</Text>
              {job.totalBytes !== undefined && BigInt(job.totalBytes) > 0n && (
                <View accessible accessibilityRole="progressbar" accessibilityLabel={job.name} accessibilityValue={{ min: 0, max: 100, now: percent }} style={styles.track}>
                  <View style={[styles.progress, { width: `${percent}%` }]} />
                </View>
              )}
              {job.state === 'owner_deleted' && <PairingButton label={t('transfer.rebackup')} secondary disabled={working || !!queue?.running}
                onPress={() => Alert.alert(t('transfer.rebackup'), t('transfer.rebackupConfirm'), [
                  { text: t('pairing.cancel'), style: 'cancel' },
                  { text: t('transfer.rebackup'), onPress: () => { void run(job); } },
                ], { cancelable: true })} />}
              {job.errorCode && <Text accessibilityRole="alert" style={styles.error}>{t(`transfer.errors.${job.errorCode}`, { defaultValue: t('transfer.errors.outcome_unknown') })}</Text>}
            </View>
          );
        })}
        {queue?.hasMore && <Text style={styles.description}>{t('transfer.more', { count: queue.totalJobs })}</Text>}
        <View style={styles.card}>
          <ShieldCheck color={colors.secure} size={28} />
          <Text accessibilityRole="header" style={styles.heading}>{t('transfer.backups.title')}</Text>
          <Text style={styles.description}>{t('transfer.backups.description')}</Text>
          <Text style={styles.description}>{t('transfer.backups.photosOpen')}</Text>
          {photos && <Text accessibilityLiveRegion="polite" style={photos.review !== '0' ? styles.error : styles.description}>
            {t(`transfer.photos.${photos.state}`, { total: photos.total, completed: photos.completed, review: photos.review })}
          </Text>}
          <PairingButton label={t('transfer.backups.load')} secondary disabled={working} onPress={() => { void ownBackup(); }} />
          {backups && <PairingButton label={t('transfer.photos.restoreAll')} secondary disabled={working}
            onPress={() => { void ownBackup(undefined, false, true); }} />}
          {backups?.items.length === 0 && <Text style={styles.description}>{t('transfer.backups.empty')}</Text>}
        </View>
        {backups?.items.map((backup) => (
          <View key={backup.id} style={styles.card}>
            <Text style={styles.heading}>{backup.name}</Text>
            <Text style={styles.verified}>{t('transfer.backups.completed')}</Text>
            <Text style={styles.description}>{t('transfer.backups.size', { size: backup.size })}</Text>
            <Text selectable style={styles.hash}>{t('transfer.backups.hash', { hash: backup.sha256 })}</Text>
            {peer && <Text selectable style={styles.description}>{t('transfer.peer', { fingerprint: peer })}</Text>}
            <PairingButton label={t(backup.name.startsWith(photoManifestPrefix) ? 'transfer.photos.restore' : 'transfer.backups.restore', { name: backup.name })} secondary disabled={working}
              icon={<Download color={colors.ink} size={18} />} onPress={() => { void ownBackup(backup); }} />
          </View>
        ))}
        {backups?.hasMore && <PairingButton label={t('transfer.backups.more')} secondary disabled={working} onPress={() => { void ownBackup(undefined, true); }} />}
        {restoring && <Text accessibilityLiveRegion="polite" style={styles.description}>{t('transfer.backups.restoring')}</Text>}
        {restored && <Text accessibilityLiveRegion="polite" style={styles.verified}>{t('transfer.backups.restored', { name: restored.name })}</Text>}
        {scrollChrome && controls}
      </ScrollView>
      {!scrollChrome && controls}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { padding: 20, gap: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stackedHeader: { padding: 0, flexDirection: 'column', alignItems: 'stretch' },
  stackedBrand: { textAlign: 'left' },
  scrollingControls: { padding: 0, paddingTop: 20 },
  brand: { color: colors.ink, fontSize: 18, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  body: { padding: 24, gap: 16, paddingBottom: 32 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '700' },
  heading: { color: colors.ink, fontSize: 17, fontWeight: '600' },
  description: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  card: { padding: 20, borderRadius: 20, gap: 10, backgroundColor: colors.elevated, borderColor: colors.border, borderWidth: 1 },
  error: { color: colors.error, fontSize: 14, lineHeight: 21 },
  verified: { color: colors.ink, fontSize: 14, fontWeight: '600', lineHeight: 21 },
  hash: { color: colors.muted, fontSize: 12, fontFamily: 'monospace', lineHeight: 18 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.border },
  progress: { height: 8, backgroundColor: colors.secure, borderRadius: 4 },
  controls: { padding: 20, gap: 12, borderTopWidth: 1, borderColor: colors.border },
});
