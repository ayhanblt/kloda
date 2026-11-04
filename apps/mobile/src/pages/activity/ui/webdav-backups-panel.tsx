import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useWebDavRestore } from '../../../features/file-transfer/model/use-webdav-restore';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { Text } from '../../../shared/ui/text';

// `name` (a destination's own view): the page title already names it, so the panel drops its WebDAV header and
// uses the destination's name in its own texts.
export function WebDavBackupsPanel({ target, name }: { target?: string; name?: string }) {
  const { t } = useTranslation(), model = useWebDavRestore(target);
  return <View className="gap-3 rounded-2xl border border-border-subtle bg-surface-1 p-5">
    {!name && <Text accessibilityRole="header" className="text-lg font-inter-semibold text-primary-text">{t('destinations.restore.title')}</Text>}
    <Text className="font-sans text-sm text-secondary-text">{t('destinations.restore.hint')}</Text>
    <PairingButton variant="secondary" disabled={model.working} label={name ? t('destinations.restore.targetLoad', { name }) : t('destinations.restore.load')} onPress={() => { void model.load(); }} />
    {model.error && <Text accessibilityRole="alert" className="font-sans text-sm text-danger-text">{t(`transfer.errors.${model.error}`, { defaultValue: t('transfer.errors.outcome_unknown') })}</Text>}
    {model.page?.items.length === 0 && !model.page.hasMore && <Text className="font-sans text-sm text-secondary-text">{name ? t('destinations.restore.targetEmpty', { name }) : t('transfer.backups.empty')}</Text>}
    {model.page?.items.map((item) => <View key={item.id} className="gap-2 border-t border-border-subtle py-4">
      <Text className="font-sans text-base font-semibold text-primary-text">{item.name}</Text>
      <Text className="font-sans text-sm text-secondary-text">{name ? t('destinations.restore.targetCompleted', { name }) : t('transfer.backups.completed')}</Text>
      <Text className="font-sans text-sm text-secondary-text">{t('transfer.backups.size', { size: item.size })}</Text>
      <Text selectable className="font-sans text-xs text-secondary-text">{t('transfer.backups.hash', { hash: item.sha256 })}</Text>
      {(item.kind === 'file' ? model.page?.canRestoreFiles : model.page?.canRestorePhotos)
        ? <PairingButton variant="secondary" disabled={model.working} label={t(item.kind === 'file' ? 'transfer.backups.restore' : 'transfer.photos.restore', { name: item.name })} onPress={() => { void model.restore(item); }} />
        : <Text className="font-sans text-sm text-secondary-text">{t('destinations.restore.unavailable')}</Text>}
    </View>)}
    {model.page?.hasMore && <PairingButton variant="secondary" disabled={model.working} label={t('transfer.backups.more')} onPress={() => { void model.load(true); }} />}
    {model.working && <PairingButton variant="secondary" label={t('transfer.backups.cancel')} onPress={model.cancel} />}
    {model.restored && <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-secondary-text">{t('transfer.backups.restored', { name: model.restored })}</Text>}
  </View>;
}
