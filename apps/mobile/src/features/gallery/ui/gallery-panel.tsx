import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Image, Pressable, View } from 'react-native';
import { Heart, Images, Video } from 'lucide-react-native';
import { Text } from '../../../shared/ui/text';
import { useThemeColors } from '../../../shared/theme/theme-provider';
import { PairingButton } from '../../pairing/ui/pairing-button';
import type { useGallery } from '../model/use-gallery';

export function GalleryPanel({ model }: { model: ReturnType<typeof useGallery> }) {
  const colors = useThemeColors();
  const { t, i18n } = useTranslation();
  useEffect(() => {
    if (!model.selected) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { model.close(); return true; });
    return () => listener.remove();
  }, [model.selected, model.close]);
  const photo = model.selected;
  return <View className="gap-4">
    <Text className="font-sans text-sm leading-5 text-secondary-text">{t('gallery.readOnly')}</Text>
    {model.error && <Text accessibilityRole="alert" className="font-sans text-base text-danger-text">{t('gallery.error')}</Text>}
    {model.loading && <Text accessibilityLiveRegion="polite" className="font-sans text-base text-secondary-text">{t('ui.states.loading')}</Text>}
    {!model.loading && !model.error && model.sources.length === 0 && <Text className="font-sans text-base text-secondary-text">{t('ui.gallery.noSource')}</Text>}
    {model.page?.permission === 'limited' && <Text accessibilityRole="alert" className="font-sans text-base text-attention-text">{t('gallery.limited')}</Text>}
    {model.page?.scopeUnavailable && <Text accessibilityRole="alert" className="font-sans text-base text-attention-text">{t('gallery.scopeUnavailable')}</Text>}
    {model.page?.permission === 'denied' && <Text accessibilityRole="alert" className="font-sans text-base text-danger-text">{t('ui.gallery.noPhotoPermission')}</Text>}
    {!photo && <>
      <View className="flex-row flex-wrap gap-2">{model.sources.map((row) => <Pressable key={row.id}
        accessibilityRole="button" accessibilityLabel={row.displayName} accessibilityState={{ selected: row.id === model.source }}
        onPress={() => { void model.choose(row.id); }} className={`min-h-12 rounded-full border px-4 py-3 ${row.id === model.source ? 'border-action bg-action' : 'border-border-subtle bg-surface-1'}`}>
        <Text className={`font-inter-medium text-sm ${row.id === model.source ? 'text-on-action' : 'text-primary-text'}`}>{row.displayName}</Text>
      </Pressable>)}</View>
      {!model.page?.scopeUnavailable && model.page?.permission !== 'denied' && model.page?.items.length === 0 && <Text className="font-sans text-base text-secondary-text">{t('gallery.empty')}</Text>}
      <View className="flex-row flex-wrap gap-1">{model.page?.items.map((asset) => <Pressable key={asset.id}
        accessibilityRole="button" accessibilityLabel={t('gallery.open', { name: asset.name })}
        onPress={() => { void model.open(asset); }} className="aspect-square w-[32%] overflow-hidden rounded-lg bg-surface-2">
        {model.previews[asset.id] ? <Image source={{ uri: model.previews[asset.id]! }} accessibilityIgnoresInvertColors
          className="h-full w-full" resizeMode="cover" /> : <View className="flex-1 items-center justify-center p-2"><Images color={colors['text-secondary']} size={24} /><Text className="font-sans text-xs text-secondary-text">{asset.name}</Text></View>}
        <View className="absolute bottom-1 left-1 flex-row gap-1 rounded-full bg-surface-1 p-1">
          {asset.video ? <Video color={colors['text-primary']} size={16} /> : <Images color={colors['text-primary']} size={16} />}
          {asset.favorite && <Heart color={colors['attention-base']} size={16} />}
        </View>
      </Pressable>)}</View>
      <View className="flex-row flex-wrap gap-2">
        {model.offset > 0 && <PairingButton variant="secondary" label={t('gallery.previous')} onPress={() => { void model.previous(); }} />}
        {model.page?.hasMore && <PairingButton variant="secondary" label={t('ui.common.next')} onPress={() => { void model.next(); }} />}
      </View>
    </>}
    {photo && <>
      <PairingButton variant="secondary" label={t('ui.common.back')} onPress={model.close} />
      {model.detail ? <Image source={{ uri: model.detail }} accessibilityLabel={photo.name} accessibilityIgnoresInvertColors
        className="aspect-[4/5] w-full rounded-2xl bg-primary-text" resizeMode="contain" />
        : !model.loading && <Text className="font-sans text-base text-secondary-text">{t('gallery.previewUnavailable')}</Text>}
      <Text accessibilityRole="header" className="text-lg font-inter-semibold text-primary-text">{photo.name}</Text>
      <View className="gap-3 rounded-2xl border border-border-subtle bg-surface-1 p-4">
        <Text className="font-sans text-base text-primary-text">{t('gallery.dimensions', { width: photo.width, height: photo.height })}</Text>
        {photo.created && <Text className="font-sans text-base text-primary-text">{new Date(Number(photo.created)).toLocaleString(i18n.language)}</Text>}
        {photo.video && <Text className="font-sans text-sm text-secondary-text">{t('gallery.videoPoster')}</Text>}
        {photo.favorite && <Text className="font-sans text-sm text-secondary-text">{t('ui.photo.favorite')}</Text>}
      </View>
      <Text accessibilityRole="header" className="font-inter-semibold text-base text-primary-text">{t('ui.photo.destStatus')}</Text>
      <Text className="font-sans text-sm leading-5 text-secondary-text">{t('gallery.historyNote')}</Text>
      {model.history?.length === 0 && <Text className="font-sans text-base text-secondary-text">{t('gallery.noHistory')}</Text>}
      {model.history?.map((row, index) => <View key={index} className="gap-2 rounded-2xl border border-border-subtle bg-surface-1 p-4">
        <Text className="font-sans text-sm text-secondary-text">{t(`gallery.${row.kind}`)}</Text>
        <Text selectable className="font-sans text-sm text-primary-text">{row.recordId}</Text>
        <Text className="font-inter-semibold text-base text-primary-text">{t(`transfer.states.${row.state}`)}</Text>
      </View>)}
    </>}
    <PairingButton variant="secondary" label={t('gallery.refresh')} onPress={() => { void model.refresh(); }} />
  </View>;
}
