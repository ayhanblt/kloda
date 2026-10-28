import { useTranslation } from 'react-i18next';
import { Clock3, Folder, HardDrive, ShieldCheck } from 'lucide-react-native';
import { Platform } from 'react-native';
import { Text } from '../../../shared/ui/text';
import type { NavigateMobile } from '../../../shared/model/mobile-navigation';
import { MobilePanel, MobileSurface } from '../../../widgets/mobile-surface/ui';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { colors } from '../../../shared/ui/tokens';

export function SettingsPage({ navigate }: { navigate: NavigateMobile }) {
  const { t } = useTranslation();
  return <MobileSurface title={t('ui.settings.title')} onBack={() => navigate('home')}>
    <MobilePanel><Text className="text-lg font-inter-semibold text-ink">{t('ui.settings.backup')}</Text>
      <PairingButton secondary icon={<Folder size={20} color={colors.ink} />} label={t('ui.sources.title')} onPress={() => navigate('sources')} />
      <PairingButton secondary icon={<Clock3 size={20} color={colors.ink} />} label={t('ui.schedule.title')} onPress={() => navigate('schedule')} />
      <PairingButton secondary icon={<HardDrive size={20} color={colors.ink} />} label={t('ui.nav.backups')} onPress={() => navigate('backups')} />
    </MobilePanel>
    <MobilePanel><ShieldCheck size={23} color={colors.secure} /><Text className="text-lg font-inter-semibold text-ink">{t('ui.settings.background')}</Text>
      <Text className="font-sans text-sm leading-5 text-muted">{t(Platform.OS === 'ios' ? 'computer.iosBackground' : 'computer.androidBackground')}</Text>
      <PairingButton secondary label={t('transfer.title')} onPress={() => navigate('activity')} />
    </MobilePanel>
    <PairingButton secondary label={t('ui.settings.rerunSetup')} onPress={() => navigate('welcome')} />
  </MobileSurface>;
}
