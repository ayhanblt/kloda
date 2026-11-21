import { WebDavBackupPanel } from './webdav-backup-panel';
import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';
import { Text } from '../../../shared/ui/text';
import type { BackupSetupModel } from '../../../features/backup-setup/model/use-backup-setup';
import type { WebDavDiagnostic } from '../../../shared/api/webdav-diagnostics';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { MobilePanel, MobileSurface } from '../../../widgets/mobile-surface/ui';

const hinted = { endpoint: 'onboarding.webdavHints.endpoint', targetPath: 'onboarding.webdavHints.targetPath' } as const;

function reasonKey(diagnostic: WebDavDiagnostic): string {
  if (diagnostic.kind !== 'http') return `onboarding.webdavDiagnostic.reasons.${diagnostic.kind}`;
  const status = diagnostic.status;
  return `onboarding.webdavDiagnostic.reasons.${status === 401 || status === 403 ? 'access_denied' : status === 404 ? 'not_found' : status === 405 ? 'method_rejected' : 'http_other'}`;
}

export function WebDavPage({ model: m, onBack }: { model: BackupSetupModel; onBack: () => void }) {
  const { t } = useTranslation();
  const diagnostic = m.storageDiagnostic;
  return <MobileSurface title={t('onboarding.storageTitle')} description={t('onboarding.webdavScope')} onBack={onBack}>
    <MobilePanel>
      {(['endpoint','targetPath','username','password'] as const).map((field) => <View className="gap-2" key={field}>
        <Text className="text-sm font-inter-semibold text-primary-text">{t(`onboarding.${field}`)}</Text>
        <TextInput accessibilityLabel={t(`onboarding.${field}`)} accessibilityHint={field in hinted ? t(hinted[field as keyof typeof hinted]) : undefined} autoCapitalize="none" secureTextEntry={field === 'password'} className="font-sans min-h-[48px] rounded-xl border border-border-subtle bg-surface-1 p-3 text-base text-primary-text" value={m.storage[field]} onChangeText={(value) => m.editStorage(field,value)} />
        {field in hinted && <Text className="font-sans text-xs leading-5 text-secondary-text">{t(hinted[field as keyof typeof hinted])}</Text>}
      </View>)}
      <Text className="font-sans text-xs leading-5 text-secondary-text">{t('onboarding.webdavHints.security')}</Text>
      <PairingButton disabled={m.storageTesting} label={t(m.storageTesting ? 'onboarding.testingConnection' : 'onboarding.testConnection')} onPress={() => { void m.testStorage(); }} />
    </MobilePanel>
    <WebDavBackupPanel tested={m.storageTested} testing={m.storageTesting} />
    {m.storageTested && <Text accessibilityRole="alert" className="font-sans text-sm text-secondary-text">{t('onboarding.storageTested')}</Text>}
    {m.storageWarning && <Text accessibilityRole="alert" className="font-sans text-sm text-danger-text">{t('onboarding.webdavErrors.webdav_probe_incomplete')}</Text>}
    {m.message && <Text accessibilityRole="alert" className="font-sans text-sm text-danger-text">{m.message}</Text>}
    {diagnostic && <Text accessibilityRole="alert" className="font-sans text-sm text-danger-text">{t('onboarding.webdavDiagnostic.summary', {
      stage: t(`onboarding.webdavDiagnostic.stages.${diagnostic.stage}`),
      reason: t(reasonKey(diagnostic), diagnostic.kind === 'http' ? { status: diagnostic.status } : undefined),
    })}</Text>}
  </MobileSurface>;
}
