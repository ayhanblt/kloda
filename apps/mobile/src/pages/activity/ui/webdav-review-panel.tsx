import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useWebDavReview } from '../../../features/file-transfer/model/use-webdav-review';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { Text } from '../../../shared/ui/text';

export function WebDavReviewPanel() {
  const { t } = useTranslation();
  const model = useWebDavReview();
  if (!model.page && (!model.error || model.error === 'native_unsupported')) return null;
  return <View className="gap-3 rounded-2xl border border-border-subtle bg-surface-1 p-5">
    <Text accessibilityRole="header" className="text-lg font-inter-semibold text-primary-text">{t('destinations.review.title')}</Text>
    <Text className="font-sans text-sm text-secondary-text">{t('destinations.review.hint')}</Text>
    {!model.verified && <Text accessibilityRole="alert" className="font-sans text-sm text-danger-text">{t('destinations.review.stale')}</Text>}
    {model.error && <Text accessibilityRole="alert" className="font-sans text-sm text-danger-text">{t(`transfer.errors.${model.error}`, { defaultValue: t('transfer.errors.outcome_unknown') })}</Text>}
    {model.notice && <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-secondary-text">{t(`destinations.review.results.${model.notice}`)}</Text>}
    <PairingButton variant="secondary" disabled={model.working} label={t('destinations.review.refresh')} onPress={() => { void model.refresh(); }} />
    {model.verified && model.page?.items.length === 0 && <Text className="font-sans text-sm text-secondary-text">{t('destinations.review.empty')}</Text>}
    {model.page?.items.map((item) => <View className="gap-2 border-t border-border-subtle py-4" key={item.id}>
      <Text className="font-sans text-base font-semibold text-primary-text">{item.name}</Text>
      <Text className="font-sans text-sm text-secondary-text">{t(`destinations.review.kinds.${item.kind}`)}</Text>
      <Text selectable className="font-sans text-sm text-secondary-text">{item.relativePath}</Text>
      <Text className="font-sans text-sm text-secondary-text">{t('destinations.review.target', { target: item.targetId.slice(0, 12) })}</Text>
      {item.publishedPath && <Text selectable className="font-sans text-sm text-secondary-text">{t('destinations.review.copyPath', { path: item.publishedPath })}</Text>}
      <Text className="font-sans text-sm text-secondary-text">{t(`transfer.errors.${item.errorCode}`, { defaultValue: t('transfer.errors.outcome_unknown') })}</Text>
      {item.skipped ? <Text className="font-sans text-sm text-secondary-text">{t('destinations.review.results.skipped')}</Text> : <>
        {item.requiresAuthorization && <Text className="font-sans text-sm text-secondary-text">{t('destinations.review.authorizationHint')}</Text>}
        {!item.canRecheck && <Text className="font-sans text-sm text-secondary-text">{t('destinations.review.oldContext')}</Text>}
        <PairingButton variant="secondary" disabled={model.working || !model.verified || !item.canRecheck} label={t(item.requiresAuthorization ? 'destinations.review.authorizeRecheck' : 'destinations.review.recheck')} onPress={() => { void model.act(item, 'recheck'); }} />
        <PairingButton variant="secondary" disabled={model.working || !model.verified || !item.canKeepBoth} label={t(item.requiresAuthorization ? 'destinations.review.authorizeKeepBoth' : 'destinations.review.keepBoth')} onPress={() => { void model.act(item, 'keep_both'); }} />
        <PairingButton variant="secondary" disabled={model.working || !model.verified} label={t('destinations.review.skip')} onPress={() => { void model.act(item, 'skip'); }} />
      </>}
    </View>)}
    {model.page?.hasMore && <PairingButton variant="secondary" disabled={model.working || !model.verified} label={t('destinations.review.more')} onPress={() => { void model.more(); }} />}
  </View>;
}
