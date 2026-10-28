import { destinationProviders, type DestinationProviderId } from '@kloda/sync-core';
import { useTranslation } from 'react-i18next';
import { Cloud, FolderPlus, HardDrive, Monitor, Plus } from 'lucide-react-native';
import { Text } from '../../../shared/ui/text';
import type { NavigateMobile } from '../../../shared/model/mobile-navigation';
import type { MobileStorageForm } from '../../../shared/api/webdav';
import { MobilePanel, MobileSurface } from '../../../widgets/mobile-surface/ui';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { colors } from '../../../shared/ui/tokens';

export function ConnectionsPage({ adding, navigate, openProvider, saved }: { adding: boolean; navigate: NavigateMobile; openProvider: (id: DestinationProviderId) => void; saved: Omit<MobileStorageForm,'password'> | null }) {
  const { t } = useTranslation();
  return <MobileSurface title={t(adding ? 'ui.conn.add' : 'ui.conn.title')} description={t('ui.conn.subtitle')} onBack={() => navigate(adding ? 'connections' : 'home')}>
    <MobilePanel>
      <Monitor size={24} color={colors.ink} />
      <Text className="text-lg font-inter-semibold text-ink">{t('ui.conn.computers')}</Text>
      <Text className="font-sans text-sm leading-5 text-muted">{t('ui.pcInspect')}</Text>
      <PairingButton label={t('computer.title')} onPress={() => navigate('computer')} />
    </MobilePanel>
    {!adding && <>
      {saved && <MobilePanel><HardDrive size={24} color={colors.muted} /><Text className="text-base font-inter-semibold text-ink">{t('ui.providers.webdav')}</Text>
        <Text className="font-sans text-sm text-muted">{t('ui.savedTarget')}</Text><Text selectable className="font-sans text-sm text-ink">{saved.endpoint}</Text>
        <Text selectable className="font-sans text-sm text-muted">{saved.targetPath}</Text>
        <PairingButton secondary label={t('ui.common.manage')} onPress={() => navigate('storage')} />
      </MobilePanel>}
      {!saved && <MobilePanel><FolderPlus size={24} color={colors.muted} /><Text className="font-sans text-sm leading-5 text-muted">{t('ui.noSavedCloud')}</Text></MobilePanel>}
      <PairingButton secondary icon={<Plus size={20} color={colors.ink} />} label={t('ui.conn.add')} onPress={() => navigate('add-connection')} />
    </>}
    {adding && (['protocol','cloud'] as const).map((kind) => <MobilePanel key={kind}>
      {kind === 'cloud' ? <Cloud size={24} color={colors.ink} /> : <HardDrive size={24} color={colors.ink} />}
      <Text accessibilityRole="header" className="text-lg font-inter-semibold text-ink">{t(kind === 'cloud' ? 'ui.conn.clouds' : 'ui.conn.protocols')}</Text>
      {destinationProviders.filter((p) => p.kind === kind).map((p) => <PairingButton key={p.id} secondary label={t(`ui.providers.${p.id}`)} onPress={() => openProvider(p.id)} />)}
    </MobilePanel>)}
  </MobileSurface>;
}
