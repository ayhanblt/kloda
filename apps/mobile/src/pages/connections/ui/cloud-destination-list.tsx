import { Fragment, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Cloud, HardDrive, KeyRound } from 'lucide-react-native';
import { Text } from '../../../shared/ui/text';
import type { NavigateMobile } from '../../../shared/model/mobile-navigation';
import type { MobileStorageForm } from '../../../shared/api/webdav';
import { destinationAccount, enableableProviders, providerLabel, type CloudDestination } from '../../../shared/api/cloud-destinations';
import type { useCloudDestinations } from '../../../features/cloud-destination/model/use-cloud-destinations';
import { MobilePanel } from '../../../widgets/mobile-surface/ui';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { useThemeColors } from '../../../shared/theme/theme-provider';
import { RecoveryCodePanel } from '../../../features/recovery-code/ui/recovery-code-panel';
import { RecoveryProtectedLine } from '../../../features/recovery-code/ui/recovery-protected-line';
import { RecoveryLegacyPanel } from '../../../features/recovery-code/ui/recovery-legacy-panel';
import { RecoveryImportPanel } from '../../../features/recovery-code/ui/recovery-import-panel';
import { useRecoveryStatus } from '../../../features/recovery-code/model/use-recovery-status';

type CloudModel = ReturnType<typeof useCloudDestinations>;
export { providerLabel };
export const errorLabel = (code: string) => `transfer.errors.${code}`;
// Native lists the original WebDAV entry first; it is shown by its own card and cannot be removed here.
export const addedDestinations = (items: CloudDestination[] | null) => (items ?? []).filter((item) => item.provider !== 'webdav');

type CardActions = { onToggle: () => void; onRemove: () => void; onRun: () => void; onPause: () => void; onBackups: () => void; onRecovery?: () => void; onImport: () => void };
function DestinationCard({ destination, busy, onToggle, onRemove, onRun, onPause, onBackups, onRecovery, onImport }: { destination: CloudDestination; busy: boolean } & CardActions) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const enableable = enableableProviders.includes(destination.provider);
  const run = destination.run;
  const running = run?.state === 'running';
  const account = destinationAccount(destination);
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
    {account ? <Text selectable accessibilityLabel={t('ui.conn.account', { account })} className="font-sans text-sm text-primary-text">{account}</Text>
      : <Text className="font-sans text-sm text-secondary-text">{t('ui.conn.accountPending')}</Text>}
    <Text selectable className="font-sans text-sm text-secondary-text">{destination.targetPath}</Text>
    {onRecovery && <RecoveryProtectedLine onPress={onRecovery} />}
    {run && <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-secondary-text">{t(`destinations.states.${run.state}`)}</Text>}
    {run?.errorCode && <Text className="font-sans text-sm text-danger-text">{t(errorLabel(run.errorCode), { defaultValue: t(errorLabel('outcome_unknown')) })}</Text>}
    {enableable && destination.enabled && <PairingButton disabled={busy} label={t(running ? 'statusUi.pause' : 'statusUi.backupNow')} onPress={running ? onPause : onRun} />}
    {enableable && destination.enabled && <PairingButton variant="secondary" disabled={busy} label={t('ui.conn.viewBackups')} onPress={onBackups} />}
    {enableable && <PairingButton variant="secondary" disabled={busy} label={t(destination.enabled ? 'destinations.disable' : 'destinations.enableSaved')} onPress={onToggle} />}
    {enableable && <PairingButton variant="secondary" disabled={busy} icon={<KeyRound size={18} />} label={t('recovery.importEntry')} onPress={onImport} />}
    <PairingButton variant="destructive" disabled={busy} label={t('ui.conn.remove')} onPress={confirm} />
  </MobilePanel>;
}

// Saved destinations in one list: the original WebDAV entry keeps its own screen; added DAV/OAuth destinations
// are switched, run, paused and removed here (ADR0023 explicit opt-in, ADR0027, 18A/4c).
export function CloudDestinationList({ cloud, navigate, openBackups, saved }: { cloud: CloudModel; navigate: NavigateMobile; openBackups: (targetId: string, provider: CloudDestination['provider']) => void; saved: Omit<MobileStorageForm, 'password'> | null }) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const busy = cloud.action !== 'idle';
  // Shown once the code is confirmed: it then covers every cloud destination of this installation (ADR0029 decision 6).
  // Keyed on targets and opt-ins only: the 2 s run refresh must not re-read native state each time.
  const [refresh, setRefresh] = useState(0);
  const [importFor, setImportFor] = useState<string | null>(null);
  const recoveryKey = (cloud.destinations ?? []).map((item) => `${item.targetId}:${item.enabled}`).join() + `#${refresh}`;
  const status = useRecoveryStatus(recoveryKey);
  const recovery = status === 'confirmed' ? () => navigate('recovery') : undefined;
  // Enabled before 29/1: backing up without a code. Hidden while an enable asks for the code in its own panel.
  const legacy = status !== null && status !== 'confirmed' && !cloud.recoveryFor && (cloud.destinations ?? []).some((item) => item.enabled);
  return <>
    {legacy && <RecoveryLegacyPanel onConfirmed={() => setRefresh((value) => value + 1)} />}
    {saved && <MobilePanel><HardDrive size={24} color={colors['text-secondary']} /><Text className="text-base font-inter-semibold text-primary-text">{t('ui.providers.webdav')}</Text>
      <Text className="font-sans text-sm text-secondary-text">{t('ui.savedTarget')}</Text><Text selectable className="font-sans text-sm text-primary-text">{saved.endpoint}</Text>
      <Text selectable className="font-sans text-sm text-secondary-text">{saved.targetPath}</Text>
      {recovery && <RecoveryProtectedLine onPress={recovery} />}
      <PairingButton variant="secondary" label={t('ui.common.manage')} onPress={() => navigate('storage')} />
    </MobilePanel>}
    {addedDestinations(cloud.destinations).map((item) => <Fragment key={item.targetId}>
      <DestinationCard destination={item} busy={busy}
        onToggle={() => { void cloud.setEnabled(item.targetId, !item.enabled); }} onRemove={() => { void cloud.remove(item.targetId); }}
        onRun={() => { void cloud.runNow(item.targetId); }} onPause={() => { void cloud.pause(item.targetId); }} onBackups={() => openBackups(item.targetId, item.provider)} onRecovery={recovery}
        onImport={() => setImportFor(item.targetId)} />
      {importFor === item.targetId && <RecoveryImportPanel targetId={item.targetId} onCancel={() => setImportFor(null)} onBackups={() => openBackups(item.targetId, item.provider)} />}
      {cloud.recoveryFor === item.targetId && <RecoveryCodePanel onCancel={cloud.closeRecovery} onConfirmed={() => { void cloud.setEnabled(item.targetId, true); }} />}
    </Fragment>)}
    {cloud.error && <Text accessibilityRole="alert" className="font-sans text-sm text-danger-text">{t(errorLabel(cloud.error), { defaultValue: t(errorLabel('outcome_unknown')) })}</Text>}
  </>;
}
