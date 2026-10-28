import type { DestinationProviderId } from '@kloda/sync-core';
import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react-native';
import { TextInput, View } from 'react-native';
import { Text } from '../../../shared/ui/text';
import { MobilePanel, MobileSurface } from '../../../widgets/mobile-surface/ui';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { colors } from '../../../shared/ui/tokens';

const fields = {
  smb: ['server','share','folder','username','domain'], ftp: ['server','port','username','folder'],
  sftp: ['server','port','username','fingerprint','folder'],
  's3-compatible': ['endpoint','region','bucket','prefix'], 'amazon-s3': ['region','bucket','prefix'],
  'google-cloud-storage': ['project','bucket','prefix'], nextcloud: ['server','folder'], 'kolab-now': ['server','folder'],
} as const;

export function ProviderPage({ provider, onBack }: { provider: DestinationProviderId; onBack: () => void }) {
  const { t } = useTranslation();
  const names: readonly string[] = provider in fields ? fields[provider as keyof typeof fields] : ['folder'];
  return <MobileSurface title={t(`ui.providers.${provider}`)} onBack={onBack}>
    <MobilePanel><ShieldAlert color={colors.processing} size={24} />
      <Text accessibilityRole="alert" className="text-base font-inter-semibold text-ink">{t('ui.integrationUnavailable')}</Text>
      <Text className="font-sans text-sm leading-5 text-muted">{t('ui.integrationUnavailableBody')}</Text>
      {names.map((name) => <View className="gap-2" key={name}>
        <Text className="text-sm font-inter-medium text-ink">{t(`ui.providerFields.${name}`)}</Text>
        <TextInput editable={false} accessibilityLabel={t(`ui.providerFields.${name}`)} accessibilityState={{ disabled: true }} className="font-sans min-h-[48px] rounded-xl border border-border bg-soft p-3 text-muted" value="" />
      </View>)}
      <Text className="font-sans text-sm text-muted">{t('ui.authNotConfigured')}</Text>
      <PairingButton disabled label={t('ui.conn.test')} onPress={() => undefined} />
    </MobilePanel>
  </MobileSurface>;
}
