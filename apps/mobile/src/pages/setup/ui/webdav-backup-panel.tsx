import { useTranslation } from 'react-i18next';
import { Text } from '../../../shared/ui/text';
import { MobilePanel } from '../../../widgets/mobile-surface/ui';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { useWebDavBackup } from '../../../features/backup-setup/model/use-webdav-backup';

export function WebDavBackupPanel({ tested, testing }: { tested: boolean; testing: boolean }) {
  const { t } = useTranslation();
  const model = useWebDavBackup();
  const { status, working } = model;
  return <MobilePanel>
    <Text className="text-base font-inter-semibold text-primary-text">{t('destinations.webdav')}</Text>
    <Text className="font-sans text-sm text-secondary-text">{t('destinations.optInHint')}</Text>
    {status && <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-secondary-text">{t(status.enabled ? 'destinations.enabled' : 'destinations.disabled')}</Text>}
    <PairingButton label={t(status?.enabled ? 'destinations.disable' : 'destinations.enableSaved')}
      disabled={working || testing || !status || (!status.enabled && !tested)} variant="secondary"
      onPress={() => { void model.action(status?.enabled ? 'disable' : 'enable'); }} />
    {status?.enabled && <PairingButton label={t(status.running ? 'destinations.pauseRun' : 'destinations.runWebdav')}
      disabled={working || testing} variant="secondary" onPress={() => { void model.action(status.running ? 'pause' : 'run'); }} />}
    {status?.run && <>
      <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-secondary-text">{t(`destinations.states.${status.run.state}`)}</Text>
      <Text className="font-sans text-sm text-secondary-text">{t('destinations.itemCounts', { files: status.run.counts.completedFiles, totalFiles: status.run.counts.files, photos: status.run.counts.completedPhotos, totalPhotos: status.run.counts.photos })}</Text>
      <Text className="font-sans text-sm text-secondary-text">{t('destinations.attempts', { access: status.run.attempts, os: status.run.osAttempts })}</Text>
      {status.run.retryAt && Number(status.run.retryAt) <= 8640000000000000 && <Text className="font-sans text-sm text-secondary-text">{t('transfer.retryAt', { time: new Date(Number(status.run.retryAt)).toLocaleString() })}</Text>}
    </>}
    {(model.error || status?.errorCode || status?.run?.errorCode || status?.automaticError) && <Text accessibilityRole="alert" className="font-sans text-sm text-danger-text">
      {t(`transfer.errors.${model.error ?? status?.errorCode ?? status?.run?.errorCode ?? status?.automaticError}`, { defaultValue: t('transfer.errors.outcome_unknown') })}
    </Text>}
  </MobilePanel>;
}
