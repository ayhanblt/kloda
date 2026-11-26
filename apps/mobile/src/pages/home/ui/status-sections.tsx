import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowRight, Check, ChevronRight, Clock3, Cloud, HardDrive, Images, Laptop, Lock, Monitor, QrCode, Server, XCircle, Zap } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Text } from '../../../shared/ui/text';
import { IconTile, PrivacyNote, SectionLabel } from '../../../shared/ui/rich';
import { useThemeColors } from '../../../shared/theme/theme-provider';
import type { NavigateMobile } from '../../../shared/model/mobile-navigation';
import type { DestinationKind, HomeState } from '../model/home-status';

export interface StatusTarget {
  id: string;
  label: string;
  kind: DestinationKind;
  state: HomeState | 'disabled';
  page: 'computer' | 'storage' | 'connections';
}

export function SetupHomeSection({
  sourceCount,
  targetsCount,
  label,
  working,
  onPrimary,
  navigate,
}: {
  sourceCount: number;
  targetsCount: number;
  label: string;
  working: boolean;
  onPrimary: () => void;
  navigate: NavigateMobile;
}) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const setupStepIndex = sourceCount === 0 ? 0 : targetsCount === 0 ? 1 : 2;
  const steps = [
    {
      key: 'step1',
      done: sourceCount > 0,
      current: setupStepIndex === 0,
      title: sourceCount > 0 ? t('statusUi.step1Done') : t('statusUi.step1Todo'),
      sub: t('statusUi.step1Sub'),
      onPress: () => navigate('sources'),
      icon: Images,
    },
    {
      key: 'step2',
      done: targetsCount > 0,
      current: setupStepIndex === 1,
      title: t('statusUi.step2'),
      sub: t('statusUi.step2Sub'),
      onPress: () => navigate('computer'),
      icon: QrCode,
    },
    {
      key: 'step3',
      done: false,
      current: setupStepIndex === 2,
      title: t('statusUi.step3'),
      sub: t('statusUi.step3Sub'),
      onPress: () => navigate('computer'),
      icon: Laptop,
    },
  ] as const;

  return (
    <View className="gap-2.5">
      <SectionLabel
        title={t('statusUi.setupList')}
        action={
          <Text className="font-sans text-xs text-tertiary-text">
            {t('onboarding.step', { current: setupStepIndex + 1, total: 3 })}
          </Text>
        }
      />
      <View className="flex-row gap-1.5 px-1" accessible={false}>
        {[0, 1, 2].map((index) => (
          <View
            key={index}
            className={`h-1 flex-1 rounded-full ${index < setupStepIndex ? 'bg-brand' : index === setupStepIndex ? 'bg-brand/60' : 'bg-surface-2'}`}
          />
        ))}
      </View>
      <View className="gap-2.5">
        {steps.map((step) => {
          const StepIcon = step.done ? Check : step.icon;
          return (
            <Pressable
              key={step.key}
              accessibilityRole="button"
              accessibilityLabel={step.title}
              onPress={step.onPress}
              className={`min-h-[72px] flex-row items-center gap-3 rounded-3xl border bg-surface-1 px-4 py-3 active:opacity-80 ${step.current ? 'border-brand/40' : 'border-border-subtle'}`}
            >
              <IconTile tone={step.done ? 'brand' : step.current ? 'solid' : 'neutral'}>
                <StepIcon
                  size={20}
                  color={step.current ? c['on-brand'] : step.done ? c['brand-text'] : c['text-secondary']}
                />
              </IconTile>
              <View className={`min-w-0 flex-1 gap-0.5 ${!step.done && !step.current ? 'opacity-60' : ''}`}>
                <View className="flex-row items-center gap-2">
                  <Text className="text-base font-inter-semibold text-primary-text">{step.title}</Text>
                  {step.current && (
                    <View className="rounded-md bg-brand-subtle px-1.5 py-0.5">
                      <Text className="text-xs font-inter-medium text-brand-text">{t('statusUi.recommended')}</Text>
                    </View>
                  )}
                </View>
                <Text className="font-sans text-xs text-secondary-text">{step.sub}</Text>
              </View>
              {(step.done || step.current) && <ChevronRight size={18} color={c['text-tertiary']} />}
            </Pressable>
          );
        })}
      </View>

      <SectionLabel title={t('statusUi.otherTargets')} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('statusUi.addOther')}
        onPress={() => navigate('add-connection')}
        className="min-h-[72px] flex-row items-center gap-3 rounded-3xl border border-border-subtle bg-surface-1 px-4 py-3 active:opacity-80"
      >
        <IconTile tone="neutral">
          <HardDrive size={20} color={c['text-primary']} />
        </IconTile>
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="text-base font-inter-semibold text-primary-text">{t('statusUi.addOther')}</Text>
          <Text className="font-sans text-xs text-secondary-text">{t('statusUi.addOtherSub')}</Text>
        </View>
        <ChevronRight size={18} color={c['text-tertiary']} />
      </Pressable>

      <PrivacyNote />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: working }}
        disabled={working}
        onPress={onPrimary}
        className={`mt-2 min-h-[64px] w-full flex-row items-center gap-3 rounded-2xl bg-button-brand px-5 py-3 active:opacity-85 ${working ? 'opacity-50' : ''}`}
      >
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="text-base font-inter-semibold text-on-brand">{label}</Text>
          <Text className="font-sans text-xs text-on-brand opacity-80">
            {t(sourceCount ? 'statusUi.ctaPairSub' : 'statusUi.ctaSourcesSub')}
          </Text>
        </View>
        <View className="h-9 w-9 items-center justify-center rounded-full bg-on-action/15">
          <ArrowRight size={18} color={c['on-brand']} />
        </View>
      </Pressable>
      <View className="mt-1 flex-row items-center justify-center gap-1.5 px-2">
        <Lock size={13} color={c['text-tertiary']} />
        <Text className="text-center font-sans text-xs text-tertiary-text">{t('statusUi.lockLine')}</Text>
      </View>
    </View>
  );
}

export function ConfiguredHomeSection({
  state,
  targets,
  navigate,
}: {
  state: HomeState;
  targets: StatusTarget[];
  navigate: NavigateMobile;
}) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const protoLabel = (kind: DestinationKind) => kind === 'pc' ? t('statusUi.protoPc') : kind === 'cloud' ? t('statusUi.protoCloud') : t('statusUi.protoNas');

  return (
    <View className="gap-2.5">
      {(state === 'attention' || state === 'error') && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(`statusUi.states.${state}`)}
          onPress={() => navigate('activity')}
          className="min-h-[56px] flex-row items-center gap-3 rounded-2xl border border-border-subtle bg-surface-1 px-4 py-3 active:opacity-80"
        >
          {state === 'error'
            ? <XCircle size={20} color={c['danger-text']} />
            : <AlertTriangle size={20} color={c['attention-text']} />}
          <Text className="min-w-0 flex-1 font-sans text-sm text-primary-text">{t(`statusUi.lines.${state}`)}</Text>
          <ChevronRight size={18} color={c['text-tertiary']} />
        </Pressable>
      )}

      <SectionLabel
        title={t('statusUi.targets')}
        action={
          <Pressable className="min-h-10 flex-row items-center gap-0.5 px-1" accessibilityRole="button" onPress={() => navigate('connections')}>
            <Text className="font-inter-medium text-sm text-brand-text">{t('statusUi.allTargets')}</Text>
            <ChevronRight size={15} color={c['brand-text']} />
          </Pressable>
        }
      />
      <View className="gap-2.5">
        {targets.length ? targets.map((target) => {
          const TargetIcon = target.kind === 'pc' ? Monitor : target.kind === 'cloud' ? Cloud : Server;
          const dotClass = target.state === 'error' ? 'bg-danger' : target.state === 'attention' ? 'bg-attention' : target.state === 'safe' || target.state === 'syncing' ? 'bg-brand' : 'bg-tertiary-text';
          return (
            <Pressable
              key={target.id}
              className="min-h-[72px] flex-row items-center gap-3 rounded-3xl border border-border-subtle bg-surface-1 p-4 active:opacity-80"
              accessibilityRole="button"
              onPress={() => navigate(target.page)}
            >
              <IconTile tone={target.state === 'syncing' ? 'brand' : 'neutral'}>
                <TargetIcon size={20} color={target.state === 'syncing' ? c['brand-text'] : c['text-primary']} />
              </IconTile>
              <View className="min-w-0 flex-1 gap-1">
                <View className="flex-row items-center gap-2">
                  <Text className="shrink text-sm font-inter-semibold text-primary-text">{target.label}</Text>
                  <View className="rounded-md bg-surface-2 px-1.5 py-0.5">
                    <Text className="font-sans text-[11px] text-secondary-text">{protoLabel(target.kind)}</Text>
                  </View>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <View className={`h-[7px] w-[7px] rounded-full ${dotClass}`} />
                  <Text className="font-sans text-xs text-secondary-text">{t(`statusUi.states.${target.state}`)}</Text>
                </View>
              </View>
              <ChevronRight size={18} color={c['text-tertiary']} />
            </Pressable>
          );
        }) : (
          <Pressable
            className="min-h-[72px] flex-row items-center justify-between gap-3 rounded-3xl border border-border-subtle bg-surface-1 p-4 active:opacity-80"
            accessibilityRole="button"
            onPress={() => navigate('connections')}
          >
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-sm font-inter-semibold text-primary-text">{t('statusUi.chooseTarget')}</Text>
              <Text className="font-sans text-xs text-secondary-text">{t('statusUi.explicitTarget')}</Text>
            </View>
            <ChevronRight size={18} color={c['text-tertiary']} />
          </Pressable>
        )}
      </View>

      <SectionLabel
        title={t('statusUi.rules')}
        action={
          <Pressable className="min-h-10 justify-center px-1" accessibilityRole="button" onPress={() => navigate('schedule')}>
            <Text className="font-inter-medium text-sm text-brand-text">{t('statusUi.edit')}</Text>
          </Pressable>
        }
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('ui.schedule.title')}
        onPress={() => navigate('schedule')}
        className="min-h-[68px] flex-row items-center gap-3 rounded-3xl border border-border-subtle bg-surface-1 px-4 py-3 active:opacity-80"
      >
        <IconTile tone="brand">
          <Zap size={20} color={c['brand-text']} />
        </IconTile>
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="text-base font-inter-semibold text-primary-text">{t('ui.schedule.title')}</Text>
          <Text className="font-sans text-xs text-secondary-text">{t('statusUi.explicitTarget')}</Text>
        </View>
        <ChevronRight size={18} color={c['text-tertiary']} />
      </Pressable>

      <SectionLabel
        title={t('statusUi.activity')}
        action={
          <Pressable className="min-h-10 flex-row items-center gap-0.5 px-1" accessibilityRole="button" onPress={() => navigate('activity')}>
            <Text className="font-inter-medium text-sm text-brand-text">{t('statusUi.seeAll')}</Text>
            <ChevronRight size={15} color={c['brand-text']} />
          </Pressable>
        }
      />
      <Pressable
        className="min-h-[72px] flex-row items-center gap-3 rounded-3xl border border-border-subtle bg-surface-1 px-4 py-3 active:opacity-80"
        accessibilityRole="button"
        onPress={() => navigate('activity')}
      >
        <IconTile tone="neutral">
          <Clock3 size={20} color={c['text-primary']} />
        </IconTile>
        <View className="flex-1 gap-1">
          <Text className="text-base font-inter-semibold text-primary-text">{t('statusUi.activity')}</Text>
          <Text className="font-sans text-sm text-secondary-text">{t('statusUi.activityLine')}</Text>
        </View>
        <ChevronRight size={18} color={c['text-tertiary']} />
      </Pressable>

      <PrivacyNote />
    </View>
  );
}
