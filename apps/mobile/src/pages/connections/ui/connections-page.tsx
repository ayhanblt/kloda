import { destinationProviders, type DestinationProviderId } from '@kloda/sync-core';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Cloud, FolderPlus, HardDrive, Monitor, Plus } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Text } from '../../../shared/ui/text';
import type { NavigateMobile } from '../../../shared/model/mobile-navigation';
import type { MobileStorageForm } from '../../../shared/api/webdav';
import { IconTile, ListRow, RichCard, SectionLabel } from '../../../shared/ui/rich';
import { MobileSurface } from '../../../widgets/mobile-surface/ui';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { useSmbBackup } from '../../../features/backup-setup/model/use-smb-backup';
import { useSftpBackup } from '../../../features/backup-setup/model/use-sftp-backup';
import { useS3Backup } from '../../../features/backup-setup/model/use-s3-backup';
import { useFtpsBackup } from '../../../features/backup-setup/model/use-ftps-backup';
import { useThemeColors } from '../../../shared/theme/theme-provider';
import { useCloudDestinations } from '../../../features/cloud-destination/model/use-cloud-destinations';
import { hiddenProviders, type CloudProvider } from '../../../shared/api/cloud-destinations';
import { CloudDestinationList, addedDestinations } from './cloud-destination-list';

const hiddenIds: ReadonlySet<string> = new Set(hiddenProviders);

export function ConnectionsPage({ adding, navigate, openProvider, openBackups, saved }: { adding: boolean; navigate: NavigateMobile; openProvider: (id: DestinationProviderId) => void; openBackups: (targetId: string, provider: CloudProvider) => void; saved: Omit<MobileStorageForm,'password'> | null }) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const smb = useSmbBackup().status;
  const sftp = useSftpBackup().status;
  const cloud = useCloudDestinations();
  const ftps = useFtpsBackup().status;
  const amazon = useS3Backup('amazon-s3').status, compatible = useS3Backup('s3-compatible').status;
  return <MobileSurface title={t(adding ? 'ui.conn.add' : 'ui.conn.title')} description={t('ui.conn.subtitle')} onBack={() => navigate(adding ? 'connections' : 'home')}>
    <RichCard className="gap-3 p-4">
      <View className="flex-row items-center gap-3">
        <IconTile><Monitor size={20} color={colors['text-primary']} /></IconTile>
        <View className="min-w-0 flex-1">
          <Text className="text-lg font-inter-semibold text-primary-text">{t('ui.conn.computers')}</Text>
        </View>
      </View>
      <Text className="font-sans text-sm leading-5 text-secondary-text">{t('ui.pcInspect')}</Text>
      <PairingButton label={t('computer.title')} onPress={() => navigate('computer')} />
    </RichCard>
    {!adding && <>
      <CloudDestinationList cloud={cloud} navigate={navigate} openBackups={openBackups} saved={saved} />
      {smb?.configured && <RichCard className="gap-3 p-4">
        <View className="flex-row items-center gap-3">
          <IconTile tone={smb.enabled ? 'brand' : 'neutral'}><HardDrive size={20} color={smb.enabled ? colors['brand-text'] : colors['text-secondary']} /></IconTile>
          <View className="min-w-0 flex-1 gap-0.5">
            <Text className="text-base font-inter-semibold text-primary-text">{t('ui.providers.smb')}</Text>
            <View className="flex-row items-center gap-1.5">
              <View className={`h-[7px] w-[7px] rounded-full ${smb.enabled ? 'bg-brand' : 'bg-tertiary-text'}`} />
              <Text className="font-sans text-sm text-secondary-text">{t(smb.enabled ? 'destinations.enabled' : 'destinations.disabled')}</Text>
            </View>
          </View>
        </View>
        <Text selectable className="font-sans text-sm text-primary-text">{smb.config?.address}/{smb.config?.share}</Text>
        <Text selectable className="font-sans text-sm text-secondary-text">{smb.config?.root}</Text>
        <PairingButton variant="secondary" label={t('ui.common.manage')} onPress={() => openProvider('smb')} />
      </RichCard>}
      {sftp?.configured && <RichCard className="gap-3 p-4">
        <View className="flex-row items-center gap-3">
          <IconTile tone={sftp.enabled ? 'brand' : 'neutral'}><HardDrive size={20} color={sftp.enabled ? colors['brand-text'] : colors['text-secondary']} /></IconTile>
          <View className="min-w-0 flex-1 gap-0.5">
            <Text className="text-base font-inter-semibold text-primary-text">{t('ui.providers.sftp')}</Text>
            <View className="flex-row items-center gap-1.5">
              <View className={`h-[7px] w-[7px] rounded-full ${sftp.enabled ? 'bg-brand' : 'bg-tertiary-text'}`} />
              <Text className="font-sans text-sm text-secondary-text">{t(sftp.enabled ? 'destinations.enabled' : 'destinations.disabled')}</Text>
            </View>
          </View>
        </View>
        <Text selectable className="font-sans text-sm text-primary-text">{sftp.config?.address}:{sftp.config?.port}</Text>
        <Text selectable className="font-sans text-sm text-secondary-text">{sftp.config?.root}</Text>
        <Text selectable className="font-sans text-sm text-secondary-text">{sftp.config?.fingerprint}</Text>
        <PairingButton variant="secondary" label={t('ui.common.manage')} onPress={() => openProvider('sftp')} />
      </RichCard>}
      {ftps?.configured && <RichCard className="gap-3 p-4">
        <View className="flex-row items-center gap-3">
          <IconTile tone={ftps.enabled ? 'brand' : 'neutral'}><HardDrive size={20} color={ftps.enabled ? colors['brand-text'] : colors['text-secondary']} /></IconTile>
          <View className="min-w-0 flex-1 gap-0.5">
            <Text className="text-base font-inter-semibold text-primary-text">{t('ui.providers.ftp')}</Text>
            <View className="flex-row items-center gap-1.5">
              <View className={`h-[7px] w-[7px] rounded-full ${ftps.enabled ? 'bg-brand' : 'bg-tertiary-text'}`} />
              <Text className="font-sans text-sm text-secondary-text">{t(ftps.enabled ? 'destinations.enabled' : 'destinations.disabled')}</Text>
            </View>
          </View>
        </View>
        <Text selectable className="font-sans text-sm text-primary-text">{ftps.config?.address}:{ftps.config?.port}</Text>
        <Text selectable className="font-sans text-sm text-secondary-text">{ftps.config?.root}</Text>
        <Text selectable className="font-sans text-sm text-secondary-text">{ftps.config?.hostname}</Text>
        <PairingButton variant="secondary" label={t('ui.common.manage')} onPress={() => openProvider('ftp')} />
      </RichCard>}
      {[amazon,compatible].filter(value => value?.configured).map(value => value && <RichCard key={value.provider} className="gap-3 p-4">
        <View className="flex-row items-center gap-3">
          <IconTile><HardDrive size={20} color={colors['text-secondary']} /></IconTile>
          <View className="min-w-0 flex-1 gap-0.5">
            <Text className="text-base font-inter-semibold text-primary-text">{t(`ui.providers.${value.provider}`)}</Text>
            <Text className="font-sans text-sm text-secondary-text">{t('destinations.s3.saved')}</Text>
          </View>
        </View>
        <Text selectable className="font-sans text-sm text-primary-text">{value.profile?.bucket}</Text>
        <Text selectable className="font-sans text-sm text-secondary-text">{value.profile?.region} / {value.profile?.prefix}</Text>
        <PairingButton variant="secondary" label={t('ui.common.manage')} onPress={() => openProvider(value.provider)} />
      </RichCard>)}
      {!saved && !smb?.configured && !sftp?.configured && !ftps?.configured && !amazon?.configured && !compatible?.configured && !addedDestinations(cloud.destinations).length && <RichCard className="gap-3 p-4">
        <View className="flex-row items-center gap-3">
          <IconTile><FolderPlus size={20} color={colors['text-secondary']} /></IconTile>
          <Text className="flex-1 font-sans text-sm leading-5 text-secondary-text">{t('ui.noSavedCloud')}</Text>
        </View>
      </RichCard>}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('ui.conn.add')}
        onPress={() => navigate('add-connection')}
        className="min-h-[72px] flex-row items-center gap-3 rounded-2xl bg-action p-4 active:opacity-85"
      >
        <View className="h-10 w-10 shrink-0 items-center justify-center rounded-full bg-on-action/15">
          <Plus size={20} color={colors['on-action']} />
        </View>
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="text-sm font-inter-semibold text-on-action">{t('ui.conn.add')}</Text>
          <Text className="font-sans text-xs text-on-action opacity-75">{t('ui.conn.addDestinationBody')}</Text>
        </View>
        <ChevronRight size={18} color={colors['on-action']} />
      </Pressable>
    </>}
    {adding && (['protocol', 'cloud'] as const).map((kind) => (
      <View key={kind}>
        <SectionLabel title={t(kind === 'cloud' ? 'ui.conn.clouds' : 'ui.conn.protocols')} />
        <RichCard className="p-1">
          {destinationProviders
            .filter((p) => p.kind === kind && !hiddenIds.has(p.id))
            .map((p, index) => (
              <ListRow
                key={p.id}
                divider={index > 0}
                icon={kind === 'cloud' ? <Cloud size={19} color={colors['text-primary']} /> : <HardDrive size={19} color={colors['text-primary']} />}
                title={t(`ui.providers.${p.id}`)}
                onPress={() => openProvider(p.id)}
              />
            ))}
        </RichCard>
      </View>
    ))}
  </MobileSurface>;
}
