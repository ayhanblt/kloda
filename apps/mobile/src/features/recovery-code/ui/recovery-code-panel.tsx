import { useTranslation } from 'react-i18next';
import { Platform, TextInput, View } from 'react-native';
import { Copy, Eye, EyeOff, KeyRound } from 'lucide-react-native';
import { Text } from '../../../shared/ui/text';
import { recoveryGroupCount } from '../../../shared/api/recovery-code';
import { MobilePanel } from '../../../widgets/mobile-surface/ui';
import { PairingButton } from '../../pairing/ui/pairing-button';
import { useThemeColors } from '../../../shared/theme/theme-provider';
import { useRecoveryCode } from '../model/use-recovery-code';

const hidden = Array.from({ length: recoveryGroupCount }, () => '••••');

// ADR0029 29/1: shown before the first cloud destination is enabled. The code is masked until "Show code" passes the
// phone's screen lock; two groups typed back confirm it, then `onConfirmed` retries the enable. Without `onCancel` the
// panel only views an already confirmed code (Settings, ADR0029 decision 6); copying is offered while it is shown.
// `confirm` protects destinations enabled before 29/1 (nothing to enable); `renew` shows and confirms a new code.
type Mode = 'enable' | 'confirm' | 'renew';
const confirmLabel: Record<Mode, string> = { enable: 'recovery.confirm', confirm: 'recovery.confirmOnly', renew: 'recovery.renewConfirm' };
export function RecoveryCodePanel({ onConfirmed = () => undefined, onCancel, mode = 'enable' }: { onConfirmed?: () => void; onCancel?: () => void; mode?: Mode }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const model = useRecoveryCode(onConfirmed, Math.random, mode === 'renew');
  const groups = model.groups ?? hidden;
  const filled = model.answers.every((value) => value.trim().length === 4);
  return <MobilePanel>
    <KeyRound size={24} color={colors['text-secondary']} />
    <Text accessibilityRole="header" className="text-base font-inter-semibold text-primary-text">{t(mode === 'renew' ? 'recovery.renewTitleShown' : 'recovery.title')}</Text>
    <Text className="font-sans text-sm text-secondary-text">{t('recovery.body')}</Text>
    <Text className="font-sans text-sm text-secondary-text">{t('recovery.scope')}</Text>
    <Text className="font-inter-semibold text-sm text-primary-text">{t('recovery.warning')}</Text>
    <View accessible accessibilityLabel={model.groups ? t('recovery.codeShown', { code: model.groups.join(', ') }) : t('recovery.codeHidden')}
      className="flex-row flex-wrap gap-2 rounded-xl border border-border-subtle bg-surface-2 p-3">
      {groups.map((group, index) => <Text key={index} className="font-mono text-base text-primary-text">{group}</Text>)}
    </View>
    <PairingButton variant="secondary" disabled={model.working} icon={model.groups ? <EyeOff size={18} /> : <Eye size={18} />}
      label={t(model.groups ? 'recovery.hide' : 'recovery.show')} onPress={() => { if (model.groups) model.hide(); else void model.reveal(); }} />
    {model.groups && <PairingButton variant="secondary" disabled={model.working} icon={<Copy size={18} />} label={t('recovery.copy')} onPress={() => { void model.copy(); }} />}
    {model.copied && <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-secondary-text">{t(Platform.OS === 'ios' ? 'recovery.copiedIos' : 'recovery.copiedAndroid')}</Text>}
    {onCancel && model.confirmable && <>
      <Text className="font-sans text-sm text-secondary-text">{t('recovery.confirmHint')}</Text>
      {model.positions.map((position, index) => <View key={position} className="gap-2">
        <Text className="font-sans text-sm text-primary-text">{t('recovery.group', { number: position + 1 })}</Text>
        <TextInput accessibilityLabel={t('recovery.group', { number: position + 1 })} editable={!model.working} autoCapitalize="characters"
          autoCorrect={false} maxLength={4} keyboardType={Platform.OS === 'android' ? 'visible-password' : 'default'} className="font-mono min-h-[48px] rounded-xl border border-border-subtle bg-surface-1 p-3 text-base text-primary-text"
          value={model.answers[index]} onChangeText={(value) => model.answer(index === 0 ? 0 : 1, value)} />
      </View>)}
      <PairingButton variant="primary" disabled={model.working || !filled} label={t(confirmLabel[mode])} onPress={() => { void model.confirm(); }} />
    </>}
    {onCancel && <PairingButton variant="tertiary" disabled={model.working} label={t(mode === 'renew' ? 'recovery.renewCancel' : 'ui.conn.cancel')} onPress={onCancel} />}
    {model.error && <Text accessibilityRole="alert" className="font-sans text-sm text-danger-text">
      {t(`transfer.errors.${model.error}`, { defaultValue: t('transfer.errors.outcome_unknown') })}
    </Text>}
  </MobilePanel>;
}
