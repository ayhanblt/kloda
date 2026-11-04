import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../../../shared/ui/text';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { useFtpsItems } from '../../../features/file-transfer/model/use-ftps-items';

export function FtpsItemsPanel({ issues = false }: { issues?: boolean }) {
  const { t } = useTranslation(), m = useFtpsItems(issues);
  if (!m.available) return null;
  return <View className="gap-3 rounded-2xl border border-border-subtle bg-surface-1 p-5">
    <Text accessibilityRole="header" className="text-lg font-inter-semibold text-primary-text">{t(issues ? 'destinations.ftps.reviewTitle' : 'destinations.ftps.backupsTitle')}</Text>
    <Text className="font-sans text-sm text-secondary-text">{t(issues ? 'destinations.ftps.reviewHint' : 'destinations.ftps.restoreHint')}</Text>
    <PairingButton variant="secondary" disabled={m.working} label={t('destinations.review.refresh')} onPress={() => { void m.load(); }} />
    {m.error && <Text accessibilityRole="alert" className="font-sans text-sm text-danger-text">{t(`destinations.ftps.errors.${m.error}`,{ defaultValue:t(`destinations.errors.${m.error}`,{ defaultValue:t('transfer.errors.outcome_unknown') }) })}</Text>}
    {m.page?.items.length === 0 && !m.page.hasMore && <Text className="font-sans text-sm text-secondary-text">{t(issues ? 'destinations.review.empty' : 'transfer.backups.empty')}</Text>}
    {m.page?.items.map(item => <View key={item.id} className="gap-2 border-t border-border-subtle py-4">
      <Text className="font-sans text-base font-semibold text-primary-text">{item.name}</Text>
      <Text selectable className="font-sans text-sm text-secondary-text">{item.path}</Text>
      <Text className="font-sans text-sm text-secondary-text">{t('transfer.backups.size',{ size:item.size })}</Text>
      {issues && <Text className="font-sans text-sm text-danger-text">{t(`destinations.ftps.errors.${item.errorCode}`,{ defaultValue:t(`destinations.errors.${item.errorCode}`,{ defaultValue:t('transfer.errors.review_required') }) })}</Text>}
      {(!issues || item.kind === 'file') && <PairingButton variant="secondary" disabled={m.working} label={t(issues ? 'destinations.review.keepBoth' : item.kind === 'file' ? 'transfer.backups.restore' : 'transfer.photos.restore',{ name:item.name })} onPress={() => { void m.act(item); }} />}
    </View>)}
    {m.page?.hasMore && <PairingButton variant="secondary" disabled={m.working} label={t('transfer.backups.more')} onPress={() => { void m.load(true); }} />}
    {m.working && <PairingButton variant="secondary" label={t('transfer.backups.cancel')} onPress={m.cancel} />}
    {m.notice && <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-secondary-text">{t(issues ? 'destinations.ftps.copied' : 'transfer.backups.restored',{ name:m.notice })}</Text>}
  </View>;
}
