import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FolderPlus } from 'lucide-react-native';
import { GalleryPanel } from '../../../features/gallery/ui/gallery-panel';
import { useGallery } from '../../../features/gallery/model/use-gallery';
import type { NavigateMobile } from '../../../shared/model/mobile-navigation';
import { MobileSurface } from '../../../widgets/mobile-surface/ui';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { useThemeColors } from '../../../shared/theme/theme-provider';

export function PhotosPage({ navigate }: { navigate: NavigateMobile }) {
  const { t } = useTranslation();
  const gallery = useGallery();
  const c = useThemeColors();
  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (gallery.selected) gallery.close(); else navigate('home');
      return true;
    });
    return () => back.remove();
  }, [gallery.selected, gallery.close, navigate]);
  return <MobileSurface key={gallery.selected?.id ?? `${gallery.source}:${gallery.offset}`} title={t(gallery.selected ? 'ui.photo.title' : 'ui.gallery.title')}>
    {!gallery.selected && <PairingButton variant="secondary" icon={<FolderPlus size={21} color={c['text-primary']} />} label={t('ui.sources.title')} onPress={() => navigate('sources')} />}
    <GalleryPanel model={gallery} />
  </MobileSurface>;
}
