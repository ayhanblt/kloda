import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Cloud, HardDrive } from 'lucide-react-native';
import { Text } from '../../../shared/ui/text';
import type { NavigateMobile } from '../../../shared/model/mobile-navigation';
import type { MobileStorageForm } from '../../../shared/api/webdav';
import { enableableProviders, type CloudDestination, type CloudProvider } from '../../../shared/api/cloud-destinations';
import type { useCloudDestinations } from '../../../features/cloud-destination/model/use-cloud-destinations';
import { MobilePanel } from '../../../widgets/mobile-surface/ui';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { useThemeColors } from '../../../shared/theme/theme-provider';

type CloudModel = ReturnType<typeof useCloudDestinations>;
export const providerLabel = (provider: CloudProvider) => `ui.providers.${provider === 'yandex' ? 'yandex-disk' : provider}`;
export const errorLabel = (code: string) => `transfer.errors.${code}`;
// Native lists the original WebDAV entry first; it is shown by its own card and cannot be removed here.
export const addedDestinations = (items: CloudDestination[] | null) => (items ?? []).filter((item) => item.provider !== 'webdav');

type CardActions = { onToggle: () => void; onRemove: () => void; onRun: () => void; onPause: () => void };
function DestinationCard({ destination, busy, onToggle, onRemove, onRun, onPause }: { destination: CloudDestination; busy: boolean } & CardActions) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const enableable = enableableProviders.includes(destination.provider);
  const run = destination.run;
  const running = run?.state === 'running';
  const confirm = () => Alert.alert(t('ui.conn.removeTitle'), t('ui.conn.removeBody'), [
    { text: t('ui.conn.cancel'), style: 'cancel' },
    { text: t('ui.conn.remove'), style: 'destructive', onPress: onRemove },
  ], { cancelable: true });
  return <MobilePanel>
    <Cloud size={24} color={colors['text-secondary']} />
    <Text className="text-base font-inter-semibold text-primary-text">{t(providerLabel(destination.provider))}</Text>
    <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-secondary-text">
      {t(enableable ? (destination.enabled ? 'destinations.enabled' : 'destinations.disabled') : errorLabel('destination_unsupported'))}
    </Text>
    <Text selectable className="font-sans text-sm text-primary-text">{destination.username}</Text>
    <Text selectable className="font-sans text-sm text-secondary-text">{destination.targetPath}</Text>
    {run && <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-secondary-text">{t(`destinations.states.${run.state}`)}</Text>}
    {run?.errorCode && <Text className="font-sans text-sm text-danger-text">{t(errorLabel(run.errorCode), { defaultValue: t(errorLabel('outcome_unknown')) })}</Text>}
    {enableable && destination.enabled && <PairingButton disabled={busy} label={t(running ? 'statusUi.pause' : 'statusUi.backupNow')} onPress={running ? onPause : onRun} />}
    {enableable && <PairingButton variant="secondary" disabled={busy} label={t(destination.enabled ? 'destinations.disable' : 'destinations.enableSaved')} onPress={onToggle} />}
    <PairingButton variant="destructive" disabled={busy} label={t('ui.conn.remove')} onPress={confirm} />
  </MobilePanel>;
}

// Saved destinations in one list: the original WebDAV entry keeps its own screen; added DAV/OAuth destinations
// are switched, run, paused and removed here (ADR0023 explicit opt-in, ADR0027, 18A/4c).
export function CloudDestinationList({ cloud, navigate, saved }: { cloud: CloudModel; navigate: NavigateMobile; saved: Omit<MobileStorageForm, 'password'> | null }) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const busy = cloud.action !== 'idle';
  return <>
    {saved && <MobilePanel><HardDrive size={24} color={colors['text-secondary']} /><Text className="text-base font-inter-semibold text-primary-text">{t('ui.providers.webdav')}</Text>
      <Text className="font-sans text-sm text-secondary-text">{t('ui.savedTarget')}</Text><Text selectable className="font-sans text-sm text-primary-text">{saved.endpoint}</Text>
      <Text selectable className="font-sans text-sm text-secondary-text">{saved.targetPath}</Text>
      <PairingButton variant="secondary" label={t('ui.common.manage')} onPress={() => navigate('storage')} />
    </MobilePanel>}
    {addedDestinations(cloud.destinations).map((item) => <DestinationCard key={item.targetId} destination={item} busy={busy}
      onToggle={() => { void cloud.setEnabled(item.targetId, !item.enabled); }} onRemove={() => { void cloud.remove(item.targetId); }}
      onRun={() => { void cloud.runNow(item.targetId); }} onPause={() => { void cloud.pause(item.targetId); }} />)}
    {cloud.error && <Text accessibilityRole="alert" className="font-sans text-sm text-danger-text">{t(errorLabel(cloud.error), { defaultValue: t(errorLabel('outcome_unknown')) })}</Text>}
  </>;
}
