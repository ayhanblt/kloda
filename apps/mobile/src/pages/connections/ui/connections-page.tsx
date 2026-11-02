import { destinationProviders, type DestinationProviderId } from '@kloda/sync-core';
import { useTranslation } from 'react-i18next';
import { Cloud, FolderPlus, HardDrive, Monitor, Plus } from 'lucide-react-native';
import { Text } from '../../../shared/ui/text';
import type { NavigateMobile } from '../../../shared/model/mobile-navigation';
import type { MobileStorageForm } from '../../../shared/api/webdav';
import { MobilePanel, MobileSurface } from '../../../widgets/mobile-surface/ui';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { useSmbBackup } from '../../../features/backup-setup/model/use-smb-backup';
import { useSftpBackup } from '../../../features/backup-setup/model/use-sftp-backup';
import { useThemeColors } from '../../../shared/theme/theme-provider';

export function ConnectionsPage({ adding, navigate, openProvider, saved }: { adding: boolean; navigate: NavigateMobile; openProvider: (id: DestinationProviderId) => void; saved: Omit<MobileStorageForm,'password'> | null }) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const smb = useSmbBackup().status;
  const sftp = useSftpBackup().status;
  return <MobileSurface title={t(adding ? 'ui.conn.add' : 'ui.conn.title')} description={t('ui.conn.subtitle')} onBack={() => navigate(adding ? 'connections' : 'home')}>
    <MobilePanel>
      <Monitor size={24} color={colors['text-primary']} />
      <Text className="text-lg font-inter-semibold text-primary-text">{t('ui.conn.computers')}</Text>
      <Text className="font-sans text-sm leading-5 text-secondary-text">{t('ui.pcInspect')}</Text>
      <PairingButton label={t('computer.title')} onPress={() => navigate('computer')} />
    </MobilePanel>
    {!adding && <>
      {saved && <MobilePanel><HardDrive size={24} color={colors['text-secondary']} /><Text className="text-base font-inter-semibold text-primary-text">{t('ui.providers.webdav')}</Text>
        <Text className="font-sans text-sm text-secondary-text">{t('ui.savedTarget')}</Text><Text selectable className="font-sans text-sm text-primary-text">{saved.endpoint}</Text>
        <Text selectable className="font-sans text-sm text-secondary-text">{saved.targetPath}</Text>
        <PairingButton variant="secondary" label={t('ui.common.manage')} onPress={() => navigate('storage')} />
      </MobilePanel>}
      {smb?.configured && <MobilePanel>
        <HardDrive size={24} color={colors['text-secondary']} /><Text className="text-base font-inter-semibold text-primary-text">{t('ui.providers.smb')}</Text>
        <Text className="font-sans text-sm text-secondary-text">{t(smb.enabled ? 'destinations.enabled' : 'destinations.disabled')}</Text>
        <Text selectable className="font-sans text-sm text-primary-text">{smb.config?.address}/{smb.config?.share}</Text>
        <Text selectable className="font-sans text-sm text-secondary-text">{smb.config?.root}</Text>
        <PairingButton variant="secondary" label={t('ui.common.manage')} onPress={() => openProvider('smb')} />
      </MobilePanel>}
      {sftp?.configured && <MobilePanel>
        <HardDrive size={24} color={colors['text-secondary']} /><Text className="text-base font-inter-semibold text-primary-text">{t('ui.providers.sftp')}</Text>
        <Text className="font-sans text-sm text-secondary-text">{t(sftp.enabled ? 'destinations.enabled' : 'destinations.disabled')}</Text>
        <Text selectable className="font-sans text-sm text-primary-text">{sftp.config?.address}:{sftp.config?.port}</Text>
        <Text selectable className="font-sans text-sm text-secondary-text">{sftp.config?.root}</Text>
        <Text selectable className="font-sans text-sm text-secondary-text">{sftp.config?.fingerprint}</Text>
        <PairingButton variant="secondary" label={t('ui.common.manage')} onPress={() => openProvider('sftp')} />
      </MobilePanel>}
      {!saved && !smb?.configured && !sftp?.configured && <MobilePanel><FolderPlus size={24} color={colors['text-secondary']} /><Text className="font-sans text-sm leading-5 text-secondary-text">{t('ui.noSavedCloud')}</Text></MobilePanel>}
      <PairingButton variant="secondary" icon={<Plus size={20} color={colors['text-primary']} />} label={t('ui.conn.add')} onPress={() => navigate('add-connection')} />
    </>}
    {adding && (['protocol','cloud'] as const).map((kind) => <MobilePanel key={kind}>
      {kind === 'cloud' ? <Cloud size={24} color={colors['text-primary']} /> : <HardDrive size={24} color={colors['text-primary']} />}
      <Text accessibilityRole="header" className="text-lg font-inter-semibold text-primary-text">{t(kind === 'cloud' ? 'ui.conn.clouds' : 'ui.conn.protocols')}</Text>
      {destinationProviders.filter((p) => p.kind === kind).map((p) => <PairingButton key={p.id} variant="secondary" label={t(`ui.providers.${p.id}`)} onPress={() => openProvider(p.id)} />)}
    </MobilePanel>)}
  </MobileSurface>;
}
