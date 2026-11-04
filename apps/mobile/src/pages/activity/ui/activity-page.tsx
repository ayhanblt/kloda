import { ArrowLeft, FolderSync, Pause } from 'lucide-react-native';
import { useEffect } from 'react';
import { SmbItemsPanel } from './smb-items-panel';
import { SftpItemsPanel } from './sftp-items-panel';
import { FtpsItemsPanel } from './ftps-items-panel';
import { WebDavBackupsPanel } from './webdav-backups-panel';
import { WebDavReviewPanel } from './webdav-review-panel';
import { useWebDavBackup } from '../../../features/backup-setup/model/use-webdav-backup';
import { useTranslation } from 'react-i18next';
import { Alert, BackHandler, ScrollView, View, useWindowDimensions } from 'react-native';
import { Text } from '../../../shared/ui/text';
import { NativeSafeArea } from '../../../shared/ui/native-safe-area';
import { useFileTransfer } from '../../../features/file-transfer/model/use-file-transfer';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { ByteProgress } from '../../../shared/ui/byte-progress';
import { OwnBackups } from '../../../widgets/own-backups/own-backups';
import { useThemeColors } from '../../../shared/theme/theme-provider';

// `target`: the Backups view opened from one destination card shows only that destination's backups (18B/5r), titled
// with `targetLabel` (the provider's translation key) and returning to the Destinations tab.
export function ActivityPage({ onBack, view = 'activity', embedded = false, target, targetLabel }: { onBack: () => void; view?: 'activity' | 'backups'; embedded?: boolean; target?: string; targetLabel?: string }) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const transfer = useFileTransfer();
  const webdav = useWebDavBackup();
  const { queue, error, working, peer, run, pause, resumeAutomatic, restoring, cancelRestore } = transfer;
  const Surface = embedded ? View : NativeSafeArea;
  const targetName = target && targetLabel ? t(targetLabel) : undefined;
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true; });
    return () => subscription.remove();
  }, [onBack]);
  const { fontScale, height } = useWindowDimensions();
  const scrollChrome = fontScale > 1.3 || height < 600;
  const header = (
    <View className={scrollChrome ? 'gap-4' : 'flex-row items-center justify-between gap-4 p-5'}>
        <PairingButton label={t(targetName ? 'ui.conn.backToTargets' : 'pairing.back')} variant="secondary" icon={<ArrowLeft color={colors['text-primary']} size={20} />} onPress={onBack} />
        {!embedded && <Text className={scrollChrome ? 'shrink text-lg font-semibold text-primary-text' : 'shrink text-right text-lg font-semibold text-primary-text'}>{t('pairing.brand')}</Text>}
      </View>
  );
  const controls = view === 'activity' || restoring ? (
    <View className={scrollChrome ? 'gap-3 pt-5' : 'gap-3 border-t border-border-subtle bg-background p-5'}>
        {restoring && <PairingButton label={t('transfer.backups.cancel')} variant="secondary" onPress={() => { void cancelRestore(); }} />}
        {view === 'activity' && <>{queue?.automaticPaused === true
          ? <PairingButton label={t('transfer.continueAutomatic')} variant="secondary" disabled={working} onPress={() => { void resumeAutomatic(); }} />
          : <PairingButton label={t('transfer.pause')} variant="secondary" disabled={working || !(queue?.running || queue?.automaticPaused === false)} icon={<Pause color={colors['text-primary']} size={18} />} onPress={() => { void pause(); }} />}
        {queue?.automaticPaused !== undefined && <Text className="font-sans text-sm leading-5 text-secondary-text">{t('transfer.pauseExplanation')}</Text>}
        <PairingButton label={t('transfer.syncNow')} disabled={working} icon={<FolderSync color={colors['surface-1']} size={18} />} onPress={() => { void run(); }} /></>}
      </View>
  ) : null;
  return (
    <Surface className="flex-1 bg-background">
      {!scrollChrome && header}
      <ScrollView contentContainerClassName="gap-4 px-4 pt-5 pb-8">
        {scrollChrome && header}
        <Text accessibilityRole="header" className="text-[28px] font-inter-semibold leading-9 text-primary-text">{targetName ? t('destinations.restore.targetTitle', { name: targetName }) : t(view === 'backups' ? 'transfer.backups.title' : 'transfer.title')}</Text>
        {view === 'activity' && (webdav.status?.configured || transfer.webdavActionError || (webdav.error && webdav.error !== 'native_unsupported')) && <View className="gap-3 rounded-2xl border border-border-subtle bg-surface-1 p-5">
          <Text accessibilityRole="header" className="text-lg font-inter-semibold text-primary-text">{t('destinations.webdav')}</Text>
          {webdav.status && <Text className="font-sans text-sm text-secondary-text">{t(webdav.status.enabled ? 'destinations.enabled' : 'destinations.disabled')}</Text>}
          {webdav.status?.run && <>
            <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-secondary-text">{t(`destinations.states.${webdav.status.run.state}`)}</Text>
            <Text className="font-sans text-sm text-secondary-text">{t('destinations.itemCounts', { files: webdav.status.run.counts.completedFiles, totalFiles: webdav.status.run.counts.files, photos: webdav.status.run.counts.completedPhotos, totalPhotos: webdav.status.run.counts.photos })}</Text>
            <Text className="font-sans text-sm text-secondary-text">{t('destinations.attempts', { access: webdav.status.run.attempts, os: webdav.status.run.osAttempts })}</Text>
          </>}
          {(transfer.webdavActionError || webdav.error || webdav.status?.run?.errorCode || webdav.status?.automaticError) && <Text accessibilityRole="alert" className="font-sans text-sm text-danger-text">{t(`transfer.errors.${transfer.webdavActionError ?? webdav.error ?? webdav.status?.run?.errorCode ?? webdav.status?.automaticError}`, { defaultValue: t('transfer.errors.outcome_unknown') })}</Text>}
        </View>}
        {view === 'activity' && <><WebDavReviewPanel /><SmbItemsPanel issues /><SftpItemsPanel issues /><FtpsItemsPanel issues /></>}
        {view === 'activity' && <Text accessibilityRole="header" className="text-lg font-inter-semibold text-primary-text">{t('destinations.pc')}</Text>}
        {!targetName && <Text className="font-sans text-sm leading-5 text-secondary-text">{t(view === 'backups' ? 'transfer.backups.description' : 'transfer.description')}</Text>}
        {view === 'activity' && <>
        <View className="gap-3 rounded-2xl border border-border-subtle bg-surface-1 p-5">
          <FolderSync color={colors['brand-base']} size={28} />
          <Text className="text-lg font-inter-semibold text-primary-text">{t(queue?.run?.state === 'retry_wait' ? 'transfer.retryWaiting' : queue?.running ? 'transfer.running' : 'transfer.waiting')}</Text>
          {peer && <Text selectable className="font-sans text-sm leading-5 text-secondary-text">{t('transfer.peer', { fingerprint: peer })}</Text>}
          {queue?.run && <View accessibilityLiveRegion="polite">
            <Text className="font-sans text-sm leading-5 text-secondary-text">{t('transfer.runAttempt', { attempt: queue.run.attempts })}</Text>
            <Text className="font-sans text-sm leading-5 text-secondary-text">{t(`transfer.runStates.${queue.run.state}`)}</Text>
            {queue.run.retryAt && <Text className="font-sans text-sm leading-5 text-secondary-text">{t('transfer.retryAt', { time: new Date(Number(queue.run.retryAt)).toLocaleString() })}</Text>}
            {queue.run.errorCode && <Text accessibilityRole="alert" className="font-sans text-sm leading-5 text-danger-text">
              {t(`transfer.errors.${queue.run.errorCode}`, { defaultValue: t('transfer.errors.outcome_unknown') })}
            </Text>}
          </View>}
          {queue?.automaticRun && <View accessibilityLiveRegion="polite">
            <Text className="font-sans text-sm leading-5 text-secondary-text">{t('transfer.osAttempt', { attempt: queue.automaticRun.attempts })}</Text>
            {(queue.automaticRun.accessAttempts ?? 0) > 0 && <Text className="font-sans text-sm leading-5 text-secondary-text">{t('transfer.runAttempt', { attempt: queue.automaticRun.accessAttempts })}</Text>}
            <Text className="font-sans text-sm leading-5 text-secondary-text">{t(queue.automaticRun.accessAttempts !== undefined && queue.automaticRun.state === 'exhausted'
              ? 'transfer.runStates.needs_attention'
              : queue.automaticRun.accessAttempts !== undefined && queue.automaticRun.state === 'waiting' && queue.automaticRun.errorCode !== 'os_interrupted'
                ? 'transfer.retryWaiting' : `transfer.osStates.${queue.automaticRun.state}`)}</Text>
            {queue.automaticRun.retryAt && <Text className="font-sans text-sm leading-5 text-secondary-text">{t('transfer.retryAt', { time: new Date(Number(queue.automaticRun.retryAt)).toLocaleString() })}</Text>}
            {queue.automaticRun.errorCode && <Text accessibilityRole="alert" className="font-sans text-sm leading-5 text-danger-text">{t(`transfer.errors.${queue.automaticRun.errorCode}`, { defaultValue: t('transfer.errors.outcome_unknown') })}</Text>}
          </View>}
          {queue?.notificationsEnabled === false && <Text accessibilityLiveRegion="polite" className="font-sans text-sm leading-5 text-secondary-text">{t('transfer.notificationsDisabled')}</Text>}
          {queue?.automaticPaused === true && <Text accessibilityLiveRegion="polite" className="font-sans text-sm leading-5 text-secondary-text">{t('transfer.automaticPaused')}</Text>}
          {queue?.automaticError && <Text accessibilityRole="alert" className="font-sans text-sm leading-5 text-danger-text">{t(`transfer.errors.${queue.automaticError}`, { defaultValue: t('transfer.errors.outcome_unknown') })}</Text>}
          {queue && <Text className="font-sans text-sm leading-5 text-secondary-text">{t('transfer.count', { count: queue.totalJobs })}</Text>}
          {!queue && !error && <Text className="font-sans text-sm leading-5 text-secondary-text">{t('pairing.loading')}</Text>}
          {error && <Text accessibilityRole="alert" className="font-sans text-sm leading-5 text-danger-text">{t(`transfer.errors.${error}`, { defaultValue: t('transfer.errors.outcome_unknown') })}</Text>}
        </View>
        {queue?.jobs.map((job) => {
          const percent = job.totalBytes !== undefined && BigInt(job.totalBytes) > 0n
            ? Number(BigInt(job.acknowledgedBytes) * 100n / BigInt(job.totalBytes)) : 0;
          return (
            <View key={job.id} className="gap-3 rounded-2xl border border-border-subtle bg-surface-1 p-5">
              <Text className="text-lg font-inter-semibold text-primary-text">{job.name}</Text>
              <Text className="font-sans text-sm leading-5 text-secondary-text">{t(`transfer.states.${job.state}`)}</Text>
              <Text className="font-sans text-sm leading-5 text-secondary-text">{t('transfer.bytes', { acknowledged: job.acknowledgedBytes, total: job.totalBytes ?? t('transfer.unknownBytes') })}</Text>
              {job.totalBytes !== undefined && BigInt(job.totalBytes) > 0n && (
                <ByteProgress label={job.name} percent={percent} />
              )}
              {job.state === 'owner_deleted' && <PairingButton label={t('transfer.rebackup')} variant="secondary" disabled={working || !!queue?.running}
                onPress={() => Alert.alert(t('transfer.rebackup'), t('transfer.rebackupConfirm'), [
                  { text: t('pairing.cancel'), style: 'cancel' },
                  { text: t('transfer.rebackup'), onPress: () => { void run(job); } },
                ], { cancelable: true })} />}
              {job.errorCode && <Text accessibilityRole="alert" className="font-sans text-sm leading-5 text-danger-text">{t(`transfer.errors.${job.errorCode}`, { defaultValue: t('transfer.errors.outcome_unknown') })}</Text>}
            </View>
          );
        })}
        {queue?.hasMore && <Text className="font-sans text-sm leading-5 text-secondary-text">{t('transfer.more', { count: queue.totalJobs })}</Text>}
        </>}
        {view === 'backups' && error && <Text accessibilityRole="alert" className="font-sans text-sm leading-5 text-danger-text">{t(`transfer.errors.${error}`, { defaultValue: t('transfer.errors.outcome_unknown') })}</Text>}
        {view === 'backups' && (target ? <WebDavBackupsPanel target={target} name={targetName} /> : <><WebDavBackupsPanel /><SmbItemsPanel /><SftpItemsPanel /><FtpsItemsPanel /></>)}
        {((view === 'backups' && !target) || !embedded) && <OwnBackups transfer={transfer} />}
        {scrollChrome && controls}
      </ScrollView>
      {!scrollChrome && controls}
    </Surface>
  );
}
