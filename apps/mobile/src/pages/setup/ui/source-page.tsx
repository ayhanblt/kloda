import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Check, Folder, FolderPlus, Images, Lock, ShieldCheck, Trash2 } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Text } from '../../../shared/ui/text';
import type { BackupSetupModel } from '../../../features/backup-setup/model/use-backup-setup';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { HeroEmptyVisual } from '../../../shared/ui/hero-empty-visual';
import { IconTile, NoticeBox, PillSegmented, RichCard, SectionLabel, StepsBar } from '../../../shared/ui/rich';
import { MobileSurface } from '../../../widgets/mobile-surface/ui';
import { useThemeColors } from '../../../shared/theme/theme-provider';

export function SourcePage({ model: m, onBack, onNext }: { model: BackupSetupModel; onBack: () => void; onNext: () => void }) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const [tab, setTab] = useState<'photos' | 'files'>('photos');
  const photoSources = m.sources.filter((source) => source.kind === 'photos');
  const directorySources = m.sources.filter((source) => source.kind === 'directory');

  return (
    <MobileSurface
      headerTop={<StepsBar current={1} />}
      title={t('ui.sources.title')}
      description={t('ui.sources.subtitle')}
      onBack={onBack}
    >
      <PillSegmented
        accessibilityLabel={t('ui.sources.title')}
        value={tab}
        onChange={setTab}
        options={[
          { id: 'photos', label: t('ui.sources.photos') },
          { id: 'files', label: t('ui.sources.files') },
        ]}
      />

      {tab === 'photos' ? (
        <View className="gap-3">
          {photoSources.length === 0 ? (
            <RichCard className="gap-4 p-4">
              <HeroEmptyVisual visual={{ kind: 'reason', reason: 'lock' }} className="aspect-[2] w-full rounded-2xl" />
              <View className="items-center gap-1 px-2">
                <Text className="text-center text-base font-inter-semibold text-primary-text">
                  {t('ui.sources.permissionTitle')}
                </Text>
                <Text className="max-w-[300px] text-center font-sans text-sm leading-5 text-secondary-text">
                  {t('ui.sources.permissionBody')}
                </Text>
              </View>
              <View className="gap-2.5">
                {m.supportsPhotos && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('onboarding.choosePhotoLibrary')}
                    onPress={() => m.sourceAction(m.selectPhotoLibrary)}
                    className="min-h-[64px] w-full flex-row items-center gap-3 rounded-2xl bg-action px-4 py-3 active:opacity-85"
                  >
                    <View className="h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-on-action/15">
                      <Images size={20} color={colors['on-action']} />
                    </View>
                    <Text className="min-w-0 flex-1 text-sm font-inter-semibold text-on-action">
                      {t('onboarding.choosePhotoLibrary')}
                    </Text>
                    <ArrowRight size={18} color={colors['on-action']} />
                  </Pressable>
                )}
                {m.supportsAlbums && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('onboarding.choosePhotoAlbum')}
                    onPress={() => m.sourceAction(m.loadPhotoAlbums)}
                    className="min-h-[64px] w-full flex-row items-center gap-3 rounded-2xl border border-border-subtle bg-surface-2 px-4 py-3 active:opacity-80"
                  >
                    <View className="h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-1">
                      <Lock size={19} color={colors['text-secondary']} />
                    </View>
                    <Text className="min-w-0 flex-1 text-sm font-inter-medium text-primary-text">
                      {t('onboarding.choosePhotoAlbum')}
                    </Text>
                  </Pressable>
                )}
              </View>
            </RichCard>
          ) : (
            <View className="gap-2.5">
              <NoticeBox tone="ok" icon={<ShieldCheck size={18} color={colors['brand-text']} />}>
                <Text className="font-sans text-sm leading-5 text-primary-text">{t('onboarding.sourcesSelected')}</Text>
              </NoticeBox>
              {photoSources.map((source) => (
                <RichCard key={source.id} className="p-3.5">
                  <View className="flex-row items-center gap-3">
                    <IconTile tone="brand">
                      <Images size={20} color={colors['brand-text']} />
                    </IconTile>
                    <View className="min-w-0 flex-1 gap-0.5">
                      <Text className="text-base font-inter-semibold text-primary-text">{source.displayName}</Text>
                      <Text className="font-sans text-xs text-secondary-text">{t('onboarding.folderSelected')}</Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('onboarding.removeSource', { name: source.displayName })}
                      onPress={() => m.sourceAction(() => m.removeSource(source))}
                      className="h-10 w-10 items-center justify-center rounded-full bg-surface-2 active:opacity-75"
                    >
                      <Trash2 size={18} color={colors['danger-text']} />
                    </Pressable>
                  </View>
                </RichCard>
              ))}
              <View className="flex-row flex-wrap gap-2">
                {m.supportsPhotos && (
                  <View className="min-w-[140px] flex-1">
                    <PairingButton
                      variant="secondary"
                      icon={<Images size={18} color={colors['text-primary']} />}
                      onPress={() => m.sourceAction(m.selectPhotoLibrary)}
                      label={t('onboarding.choosePhotoLibrary')}
                    />
                  </View>
                )}
                {m.supportsAlbums && (
                  <View className="min-w-[140px] flex-1">
                    <PairingButton
                      variant="secondary"
                      onPress={() => m.sourceAction(m.loadPhotoAlbums)}
                      label={t('onboarding.choosePhotoAlbum')}
                    />
                  </View>
                )}
              </View>
            </View>
          )}

          {m.photoAlbums.length > 0 && (
            <View className="gap-2">
              {m.photoAlbums.map((album) => {
                const alreadyPicked = m.sources.some((s) => s.displayName === album.displayName);
                return (
                  <Pressable
                    key={album.id}
                    accessibilityRole="button"
                    accessibilityLabel={album.displayName}
                    onPress={() => m.sourceAction(() => m.selectPhotoAlbum(album))}
                    className="min-h-[64px] flex-row items-center gap-3 rounded-3xl border border-border-subtle bg-surface-1 p-3.5 active:opacity-80"
                  >
                    <IconTile tone={alreadyPicked ? 'brand' : 'neutral'}>
                      {alreadyPicked
                        ? <Check size={19} color={colors['brand-text']} />
                        : <Images size={19} color={colors['text-secondary']} />}
                    </IconTile>
                    <Text className="min-w-0 flex-1 text-base font-inter-semibold text-primary-text">{album.displayName}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      ) : (
        <View className="gap-3">
          <RichCard className="gap-3 p-4">
            {directorySources.length === 0 && (
              <HeroEmptyVisual visual={{ kind: 'reason', reason: 'folder' }} className="aspect-[2.2] w-full rounded-2xl" />
            )}
            <PairingButton
              variant="secondary"
              icon={<FolderPlus size={20} color={colors['text-primary']} />}
              onPress={() => m.sourceAction(m.selectDirectory)}
              label={t('onboarding.chooseFolder')}
            />
          </RichCard>
        </View>
      )}

      {directorySources.length > 0 && (
        <View className="gap-2.5">
          {tab === 'photos' && <SectionLabel title={t('ui.sources.files')} count={directorySources.length} />}
          {directorySources.map((source) => (
            <RichCard key={source.id} className="p-3.5">
              <View className="flex-row items-center gap-3">
                <IconTile tone="brand">
                  <Folder size={20} color={colors['brand-text']} />
                </IconTile>
                <View className="min-w-0 flex-1 gap-0.5">
                  <Text className="text-base font-inter-semibold text-primary-text">{source.displayName}</Text>
                  {m.sourceAccess[source.id] === false && (
                    <Text accessibilityRole="alert" className="font-sans text-sm text-danger-text">
                      {t('onboarding.sourceUnavailable')}
                    </Text>
                  )}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('onboarding.removeSource', { name: source.displayName })}
                  onPress={() => m.sourceAction(() => m.removeSource(source))}
                  className="h-10 w-10 items-center justify-center rounded-full bg-surface-2 active:opacity-75"
                >
                  <Trash2 size={18} color={colors['danger-text']} />
                </Pressable>
              </View>
            </RichCard>
          ))}
        </View>
      )}

      {m.message ? (
        <NoticeBox tone="danger">
          <Text accessibilityRole="alert" className="font-sans text-sm text-danger-text">{m.message}</Text>
        </NoticeBox>
      ) : null}

      <NoticeBox icon={<ShieldCheck size={18} color={colors['brand-text']} />}>
        <Text className="font-sans text-xs leading-5 text-secondary-text">{t('ui.sources.privacyNote')}</Text>
      </NoticeBox>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('ui.common.next')}
        onPress={onNext}
        className="min-h-[64px] w-full flex-row items-center gap-3 rounded-2xl bg-button-brand px-5 py-3 active:opacity-85"
      >
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="text-base font-inter-semibold text-on-brand">{t('ui.common.next')}</Text>
          <Text className="font-sans text-xs text-on-brand opacity-80">
            {t('ui.sources.selectedCount', { count: m.sources.length })}
          </Text>
        </View>
        <View className="h-9 w-9 items-center justify-center rounded-full bg-on-action/15">
          <ArrowRight size={18} color={colors['on-brand']} />
        </View>
      </Pressable>
    </MobileSurface>
  );
}
