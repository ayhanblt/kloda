import { Download, ShieldCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Text } from '../../shared/ui/text';
import type { useFileTransfer } from '../../features/file-transfer/model/use-file-transfer';
import { PairingButton } from '../../features/pairing/ui/pairing-button';
import { photoManifestPrefix } from '../../shared/api/file-transfer';
import { useThemeColors } from '../../shared/theme/theme-provider';

export function OwnBackups({ transfer }: { transfer: ReturnType<typeof useFileTransfer> }) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const { working, peer, backups, restored, restoring, ownBackup, photos } = transfer;
  return <View className="gap-4">
    <View className="gap-3 rounded-2xl border border-border-subtle bg-surface-1 p-5">
      <ShieldCheck color={colors['brand-base']} size={28} />
      <Text accessibilityRole="header" className="text-lg font-inter-semibold text-primary-text">{t('transfer.backups.title')}</Text>
      <Text className="font-sans text-sm leading-5 text-secondary-text">{t('transfer.backups.description')}</Text>
      <Text className="font-sans text-sm leading-5 text-secondary-text">{t('transfer.backups.photosOpen')}</Text>
      {photos && <Text accessibilityLiveRegion="polite" className={photos.review !== '0' ? 'text-sm leading-5 text-danger-text' : 'text-sm leading-5 text-secondary-text'}>
        {t(`transfer.photos.${photos.state}`, { total: photos.total, completed: photos.completed, review: photos.review })}
      </Text>}
      <PairingButton label={t('transfer.backups.load')} variant="secondary" disabled={working} onPress={() => { void ownBackup(); }} />
      {backups && <PairingButton label={t('transfer.photos.restoreAll')} variant="secondary" disabled={working}
        onPress={() => { void ownBackup(undefined, false, true); }} />}
      {backups?.items.length === 0 && <Text className="font-sans text-sm leading-5 text-secondary-text">{t('transfer.backups.empty')}</Text>}
    </View>
    {backups?.items.map((backup) => (
      <View key={backup.id} className="gap-3 rounded-2xl border border-border-subtle bg-surface-1 p-5">
        <Text className="text-lg font-inter-semibold text-primary-text">{backup.name}</Text>
        <Text className="text-sm font-inter-semibold leading-5 text-primary-text">{t('transfer.backups.completed')}</Text>
        <Text className="font-sans text-sm leading-5 text-secondary-text">{t('transfer.backups.size', { size: backup.size })}</Text>
        <Text selectable className="font-sans font-mono text-xs leading-5 text-secondary-text">{t('transfer.backups.hash', { hash: backup.sha256 })}</Text>
        {peer && <Text selectable className="font-sans text-sm leading-5 text-secondary-text">{t('transfer.peer', { fingerprint: peer })}</Text>}
        <PairingButton label={t(backup.name.startsWith(photoManifestPrefix) ? 'transfer.photos.restore' : 'transfer.backups.restore', { name: backup.name })} variant="secondary" disabled={working}
          icon={<Download color={colors['text-primary']} size={18} />} onPress={() => { void ownBackup(backup); }} />
      </View>
    ))}
    {backups?.hasMore && <PairingButton label={t('transfer.backups.more')} variant="secondary" disabled={working} onPress={() => { void ownBackup(undefined, true); }} />}
    {restoring && <Text accessibilityLiveRegion="polite" className="font-sans text-sm leading-5 text-secondary-text">{t('transfer.backups.restoring')}</Text>}
    {restored && <Text accessibilityLiveRegion="polite" className="text-sm font-inter-semibold leading-5 text-primary-text">{t('transfer.backups.restored', { name: restored.name })}</Text>}
  </View>;
}
