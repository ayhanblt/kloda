import { View, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MobilePanel, MobileSurface } from '../../../widgets/mobile-surface/ui';
import { Text } from '../../../shared/ui/text';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { useSftpBackup } from '../../../features/backup-setup/model/use-sftp-backup';

export function SftpPage({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation(), m = useSftpBackup();
  const ready = m.status?.supported === true;
  const fields = { address:'server',port:'port',root:'folder',username:'username',fingerprint:'fingerprint',password:'password' } as const;
  return <MobileSurface title={t('ui.providers.sftp')} description={t('destinations.sftp.scope')} onBack={onBack}>
    <MobilePanel>
      <Text className="font-sans text-sm text-secondary-text">{t('destinations.sftp.pinHint')}</Text>
      {!ready && <Text accessibilityRole="alert" className="font-sans text-sm text-secondary-text">{t('ui.integrationUnavailable')}</Text>}
      {Object.entries(fields).map(([key,label]) => <View className="gap-2" key={key}>
        <Text className="text-sm font-inter-medium text-primary-text">{t(label === 'password' ? 'onboarding.password' : `ui.providerFields.${label}`)}</Text>
        <TextInput accessibilityLabel={t(label === 'password' ? 'onboarding.password' : `ui.providerFields.${label}`)} editable={ready && !m.working} secureTextEntry={key === 'password'} autoCapitalize="none" autoCorrect={false}
          className="font-sans min-h-[48px] rounded-xl border border-border-subtle bg-surface-1 p-3 text-base text-primary-text"
          value={m.form[key as keyof typeof fields]} onChangeText={value => m.edit(key as keyof typeof fields,value)} />
      </View>)}
      <Text className="font-sans text-sm text-secondary-text">{t('destinations.sftp.enableHint')}</Text>
      <PairingButton disabled={!ready || m.working} label={t('destinations.sftp.saveEnable')} onPress={() => { void m.action('save'); }} />
      {m.status?.configured && <>
        <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-secondary-text">{t(m.status.enabled ? 'destinations.enabled' : 'destinations.disabled')}</Text>
        <PairingButton variant="secondary" disabled={m.working} label={t(m.status.enabled ? 'destinations.disable' : 'destinations.enableSaved')} onPress={() => { void m.action(m.status?.enabled ? 'disable' : 'enable'); }} />
        {m.status.enabled && <PairingButton variant="secondary" disabled={m.working} label={t(m.status.running ? 'destinations.sftp.pause' : 'destinations.sftp.run')} onPress={() => { void m.action(m.status?.running ? 'pause' : 'run'); }} />}
      </>}
      {m.status?.run && <>
        <Text className="font-sans text-sm text-secondary-text">{t('destinations.sftp.lastRun')}</Text>
        <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-secondary-text">{t(`destinations.states.${m.status.run.state}`)}</Text>
        <Text className="font-sans text-sm text-secondary-text">{t('destinations.itemCounts',{ files:m.status.run.counts.completedFiles,totalFiles:m.status.run.counts.files,photos:m.status.run.counts.completedPhotos,totalPhotos:m.status.run.counts.photos })}</Text>
        <Text className="font-sans text-sm text-secondary-text">{t('destinations.attempts',{ access:m.status.run.attempts,os:m.status.run.osAttempts })}</Text>
        {m.status.run.retryAt && <Text className="font-sans text-sm text-secondary-text">{t('transfer.retryAt',{ time:new Date(Number(m.status.run.retryAt)).toLocaleString() })}</Text>}
      </>}
      {(m.error || m.status?.run?.errorCode || m.status?.automaticError) && <Text accessibilityRole="alert" className="font-sans text-sm text-danger-text">{t(`destinations.sftp.errors.${m.error ?? m.status?.run?.errorCode ?? m.status?.automaticError}`,{ defaultValue:t(`destinations.errors.${m.error ?? m.status?.run?.errorCode ?? m.status?.automaticError}`,{ defaultValue:t('transfer.errors.outcome_unknown') }) })}</Text>}
    </MobilePanel>
  </MobileSurface>;
}
