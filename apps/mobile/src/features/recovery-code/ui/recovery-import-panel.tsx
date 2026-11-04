import { useTranslation } from 'react-i18next';
import { Platform, TextInput, View } from 'react-native';
import { KeyRound, TriangleAlert } from 'lucide-react-native';
import { Text } from '../../../shared/ui/text';
import { MobilePanel } from '../../../widgets/mobile-surface/ui';
import { PairingButton } from '../../pairing/ui/pairing-button';
import { useThemeColors } from '../../../shared/theme/theme-provider';
import { useRecoveryImport } from '../model/use-recovery-import';

// ADR0029 decisions 4 and 6: an added destination reads the old phone's catalog into restore-only receipts. Broken or
// missing deltas are named, not counted (the count is deltas, not files); restoring stays under "View backups".
export function RecoveryImportPanel({ targetId, onCancel, onBackups }: { targetId: string; onCancel: () => void; onBackups: () => void }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const model = useRecoveryImport(targetId);
  const result = model.result;
  return <MobilePanel>
    <KeyRound size={24} color={colors['text-secondary']} />
    <Text accessibilityRole="header" className="text-base font-inter-semibold text-primary-text">{t('recovery.importTitle')}</Text>
    <Text className="font-sans text-sm text-secondary-text">{t('recovery.importBody')}</Text>
    <View className="gap-2">
      <Text className="font-sans text-sm text-primary-text">{t('recovery.importField')}</Text>
      <TextInput accessibilityLabel={t('recovery.importField')} accessibilityHint={t('recovery.importHint')} editable={!model.working}
        autoCapitalize="characters" autoCorrect={false} autoComplete="off" spellCheck={false} importantForAutofill="no" maxLength={128}
        keyboardType={Platform.OS === 'android' ? 'visible-password' : 'default'}
        className="font-mono min-h-[48px] rounded-xl border border-border-subtle bg-surface-1 p-3 text-base text-primary-text"
        value={model.typed} onChangeText={model.setTyped} />
      <Text className="font-sans text-xs text-secondary-text">{t('recovery.importHint')}</Text>
    </View>
    <PairingButton disabled={model.working || !model.typed.trim()} label={t('recovery.importSubmit')} onPress={() => { void model.submit(); }} />
    {model.working && <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-secondary-text">{t('recovery.importWorking')}</Text>}
    {result && <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-primary-text">
      {result.chains === 0 ? t('recovery.importNone') : t('recovery.importDone', { count: result.imported })}
    </Text>}
    {result && result.unverified > 0 && <View accessibilityRole="alert" className="gap-1 rounded-xl border border-border-subtle bg-surface-2 p-3">
      <View className="flex-row items-center gap-2">
        <TriangleAlert size={16} color={colors['text-secondary']} />
        <Text className="shrink font-inter-semibold text-sm text-primary-text">{t('recovery.unverifiedTitle')}</Text>
      </View>
      <Text className="font-sans text-sm text-secondary-text">{t('recovery.unverifiedBody')}</Text>
    </View>}
    {result && result.imported > 0 && <PairingButton variant="secondary" label={t('ui.conn.viewBackups')} onPress={onBackups} />}
    <PairingButton variant="tertiary" disabled={model.working} label={t('ui.conn.cancel')} onPress={onCancel} />
    {model.error && <Text accessibilityRole="alert" className="font-sans text-sm text-danger-text">
      {t(`transfer.errors.${model.error}`, { defaultValue: t('transfer.errors.outcome_unknown') })}
    </Text>}
  </MobilePanel>;
}
