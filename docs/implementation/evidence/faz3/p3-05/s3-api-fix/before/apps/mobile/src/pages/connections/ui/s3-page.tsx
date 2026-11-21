import { View, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MobilePanel, MobileSurface } from '../../../widgets/mobile-surface/ui';
import { Text } from '../../../shared/ui/text';
import { PairingButton } from '../../../features/pairing/ui/pairing-button';
import { useS3Backup } from '../../../features/backup-setup/model/use-s3-backup';
import { S3ItemsPanel } from './s3-items-panel';
import type { S3Form, S3Provider } from '../../../shared/api/s3';

export function S3Page({ provider,onBack }: { provider: S3Provider; onBack: () => void }) {
  const { t } = useTranslation(), m = useS3Backup(provider), ready = m.status?.supported === true;
  const fields = (provider === 'amazon-s3' ? ['region','bucket','prefix','accessKey','secret','token'] : ['endpoint','region','bucket','prefix','accessKey','secret','token']) as Array<Exclude<keyof S3Form,'pathStyle'>>;
  return <MobileSurface title={t(`ui.providers.${provider}`)} description={t('destinations.s3.scope')} onBack={onBack}>
    <MobilePanel>
      <Text className="font-sans text-sm text-secondary-text">{t('destinations.s3.custody')}</Text>
      <Text className="font-sans text-sm text-secondary-text">{t(provider === 'amazon-s3' ? 'destinations.s3.security.aws' : 'destinations.s3.security.compatible')}</Text>
      {!ready && <Text accessibilityRole="alert" className="font-sans text-sm text-secondary-text">{t('ui.integrationUnavailable')}</Text>}
      {fields.map(key => <View className="gap-2" key={key}>
        <Text className="font-inter-medium text-sm text-primary-text">{t(`destinations.s3.fields.${key}`)}</Text>
        <TextInput accessibilityLabel={t(`destinations.s3.fields.${key}`)} editable={ready && !m.working && !m.status?.running}
          secureTextEntry={['accessKey','secret','token'].includes(key)} autoCapitalize="none" autoCorrect={false} autoComplete="off" textContentType="none" importantForAutofill="no"
          className="font-sans min-h-[48px] rounded-xl border border-border-subtle bg-surface-1 p-3 text-base text-primary-text"
          value={m.form[key]} onChangeText={value => m.edit(key,value)} />
      </View>)}
      {provider === 's3-compatible' && <PairingButton variant="secondary" disabled={!ready || m.working || m.status?.running}
        label={t(m.form.pathStyle ? 'destinations.s3.pathStyleOn' : 'destinations.s3.pathStyleOff')} onPress={() => m.edit('pathStyle',!m.form.pathStyle)} />}
      <Text className="font-sans text-sm text-secondary-text">{t('destinations.s3.saveHint')}</Text>
      <PairingButton disabled={!ready || m.working || m.status?.running} label={t('destinations.s3.save')} onPress={() => { void m.save(); }} />
      {m.status?.configured && <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-secondary-text">{t('destinations.s3.saved')}</Text>}
      <Text className="font-sans text-sm text-secondary-text">{t('destinations.s3.testHint')}</Text>
      <PairingButton variant="secondary" disabled={!m.status?.canTest || m.dirty || m.working || m.status?.running}
        label={t('destinations.s3.test')} onPress={() => { void m.test(); }} />
      {m.testResult && <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-secondary-text">{t('destinations.s3.testSuccess')}</Text>}
      {provider === 'amazon-s3' && m.status?.canEnable && <>
        <Text className="font-sans text-sm text-secondary-text">{t('destinations.s3.manualHint')}</Text>
        <PairingButton variant="secondary" disabled={m.working || m.dirty}
          label={t(m.status.enabled ? 'destinations.s3.disable' : 'destinations.s3.enable')}
          onPress={() => { void m.action(m.status?.enabled ? 'disableS3' : 'enableS3'); }} />
        <PairingButton disabled={m.working || m.dirty || (!m.status.running && !m.status.canRun)}
          label={t(m.status.running ? 'destinations.s3.pause' : 'destinations.s3.run')}
          onPress={() => { void m.action(m.status?.running ? 'pauseS3' : 'runS3'); }} />
        <Text className="font-sans text-sm text-secondary-text">{t('destinations.s3.automaticHint')}</Text>
        <PairingButton variant="secondary" disabled={m.working || m.dirty || !m.status.canAutomatic}
          label={t(m.status.automaticEnabled ? 'destinations.s3.automaticOff' : 'destinations.s3.automaticOn')}
          onPress={() => { void m.action('automaticS3'); }} />
        {m.status.run && <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-secondary-text">
          {t(`destinations.s3.runStates.${m.status.run.state}`)} · {t('destinations.s3.verified',{ count:m.status.run.counts.verifiedFiles,bytes:m.status.run.counts.verifiedBytes })}
        </Text>}
      </>}
      {m.error && <Text accessibilityRole="alert" className="font-sans text-sm text-danger-text">{t(`destinations.s3.errors.${m.error}`,{ defaultValue:t(`destinations.errors.${m.error}`,{ defaultValue:t('transfer.errors.outcome_unknown') }) })}</Text>}
    </MobilePanel>
    {m.status?.configured && <>
      <S3ItemsPanel key={provider + '-backups'} provider={provider} disabled={m.working || m.dirty || m.status.running} />
      <S3ItemsPanel key={provider + '-issues'} provider={provider} issues disabled={m.working || m.dirty || m.status.running} />
    </>}
  </MobileSurface>;
}
