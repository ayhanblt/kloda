import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';
import { Text } from '../../../shared/ui/text';
import type { BackupSetupModel } from '../../../features/backup-setup/model/use-backup-setup';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { MobilePanel, MobileSurface } from '../../../widgets/mobile-surface/ui';

export function WebDavPage({ model: m, onBack }: { model: BackupSetupModel; onBack: () => void }) {
  const { t } = useTranslation();
  return <MobileSurface title={t('onboarding.storageTitle')} description={t('onboarding.webdavScope')} onBack={onBack}>
    <MobilePanel>
      {(['endpoint','targetPath','username','password'] as const).map((field) => <View className="gap-2" key={field}>
        <Text className="text-sm font-inter-semibold text-ink">{t(`onboarding.${field}`)}</Text>
        <TextInput accessibilityLabel={t(`onboarding.${field}`)} autoCapitalize="none" secureTextEntry={field === 'password'} className="font-sans min-h-[48px] rounded-xl border border-border bg-elevated p-3 text-base text-ink" value={m.storage[field]} onChangeText={(value) => m.editStorage(field,value)} />
      </View>)}
      <PairingButton disabled={m.storageTesting} label={t(m.storageTesting ? 'onboarding.testingConnection' : 'onboarding.testConnection')} onPress={() => { void m.testStorage(); }} />
    </MobilePanel>
    {m.storageTested && <Text accessibilityRole="alert" className="font-sans text-sm text-muted">{t('onboarding.storageTested')}</Text>}
    {m.storageWarning && <Text accessibilityRole="alert" className="font-sans text-sm text-error">{t('onboarding.webdavErrors.webdav_probe_incomplete')}</Text>}
    {m.message && <Text accessibilityRole="alert" className="font-sans text-sm text-error">{m.message}</Text>}
  </MobileSurface>;
}
