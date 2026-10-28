import { useTranslation } from 'react-i18next';
import { FolderPlus, Images, Trash2 } from 'lucide-react-native';
import { View } from 'react-native';
import { Text } from '../../../shared/ui/text';
import type { BackupSetupModel } from '../../../features/backup-setup/model/use-backup-setup';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { MobilePanel, MobileSurface } from '../../../widgets/mobile-surface/ui';
import { colors } from '../../../shared/ui/tokens';

export function SourcePage({ model: m, onBack, onNext }: { model: BackupSetupModel; onBack: () => void; onNext: () => void }) {
  const { t } = useTranslation();
  return <MobileSurface title={t('ui.sources.title')} description={t('onboarding.description')} onBack={onBack}>
    <MobilePanel>
      <PairingButton secondary icon={<FolderPlus size={21} color={colors.ink} />} onPress={() => m.sourceAction(m.selectDirectory)} label={t('onboarding.chooseFolder')} />
      {m.supportsPhotos && <PairingButton secondary icon={<Images size={21} color={colors.ink} />} onPress={() => m.sourceAction(m.selectPhotoLibrary)} label={t('onboarding.choosePhotoLibrary')} />}
      {m.supportsAlbums && <PairingButton secondary onPress={() => m.sourceAction(m.loadPhotoAlbums)} label={t('onboarding.choosePhotoAlbum')} />}
      {m.photoAlbums.map((album) => <PairingButton secondary key={album.id} onPress={() => m.sourceAction(() => m.selectPhotoAlbum(album))} label={album.displayName} />)}
    </MobilePanel>
    {m.sources.map((source) => <MobilePanel key={source.id}>
      <Text className="text-base font-inter-semibold text-ink">{source.displayName}</Text>
      {source.kind === 'directory' && m.sourceAccess[source.id] === false && <Text accessibilityRole="alert" className="font-sans text-sm text-error">{t('onboarding.sourceUnavailable')}</Text>}
      <PairingButton secondary icon={<Trash2 size={18} color={colors.muted} />} onPress={() => m.sourceAction(() => m.removeSource(source))} label={t('onboarding.removeSource', { name: source.displayName })} />
    </MobilePanel>)}
    <View>{m.message && <Text accessibilityRole="alert" className="font-sans text-sm text-error">{m.message}</Text>}</View>
    <PairingButton label={t('ui.common.next')} onPress={onNext} />
  </MobileSurface>;
}
