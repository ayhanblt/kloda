import { useTranslation } from 'react-i18next';
import { FolderPlus, Monitor, Plus, ShieldOff, Images } from 'lucide-react-native';
import { View } from 'react-native';
import { Text } from '../../../shared/ui/text';
import type { NavigateMobile } from '../../../shared/model/mobile-navigation';
import { MobilePanel, MobileSurface } from '../../../widgets/mobile-surface/ui';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { colors } from '../../../shared/ui/tokens';

export function HomePage({ sourceCount, navigate }: { sourceCount: number; navigate: NavigateMobile }) {
  const { t } = useTranslation();
  return <MobileSurface title={t('ui.gallery.title')}>
    <MobilePanel>
      <Text className="text-base font-inter-semibold text-ink">{t('ui.gallery.summary')}</Text>
      <Text className="font-sans text-sm text-muted">{t('ui.actualStatusHint')}</Text>
      <Text className="font-sans text-sm text-muted">{t('ui.sourceCount', { count: sourceCount })}</Text>
      <Text className="text-xs font-inter-semibold uppercase text-muted">{t('ui.setupRemaining')}</Text>
      <PairingButton secondary icon={<FolderPlus size={21} color={colors.ink} />} label={t('ui.gallery.noSourceCta')} onPress={() => navigate('sources')} />
      <PairingButton secondary icon={<Monitor size={21} color={colors.ink} />} label={t('computer.title')} onPress={() => navigate('computer')} />
      <PairingButton secondary icon={<Plus size={21} color={colors.ink} />} label={t('ui.gallery.noConnCta')} onPress={() => navigate('add-connection')} />
    </MobilePanel>
    <View className="flex-row gap-3 rounded-2xl bg-soft p-4"><ShieldOff size={20} color={colors.muted} /><Text className="font-sans flex-1 text-sm leading-5 text-muted">{t('ui.galleryNextStep')}</Text></View>
    <MobilePanel><Images size={24} color={colors.muted} /><Text className="text-base font-inter-semibold text-ink">{t('ui.gallery.emptyTitle')}</Text>
      <Text className="font-sans text-sm leading-5 text-muted">{t('ui.galleryNotLoaded')}</Text>
      <PairingButton secondary label={t('transfer.title')} onPress={() => navigate('activity')} />
    </MobilePanel>
  </MobileSurface>;
}
