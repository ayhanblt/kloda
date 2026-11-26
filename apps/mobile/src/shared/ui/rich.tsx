import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ChevronRight, ShieldCheck } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useThemeColors } from '../theme/theme-provider';
import { Text } from './text';

export function RichCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <View className={`overflow-hidden rounded-3xl border border-border-subtle bg-surface-1 ${className ?? ''}`}>
      {children}
    </View>
  );
}

export function SectionLabel({ title, count, action }: { title: string; count?: number; action?: ReactNode }) {
  return (
    <View className="mb-2 mt-2 flex-row items-center justify-between gap-3 px-1">
      <View className="flex-row items-baseline gap-2">
        <Text className="font-inter-semibold text-sm text-secondary-text">{title}</Text>
        {count !== undefined && <Text className="font-sans text-xs text-tertiary-text">{count}</Text>}
      </View>
      {action}
    </View>
  );
}

export function IconTile({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'brand' | 'solid' }) {
  const backgrounds = {
    neutral: 'bg-surface-2',
    brand: 'bg-brand-subtle',
    solid: 'bg-brand',
  };
  return <View className={`h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${backgrounds[tone]}`}>{children}</View>;
}

export function BackLink({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-11 self-start flex-row items-center gap-1.5 py-1 active:opacity-70 ${disabled ? 'opacity-50' : ''}`}
    >
      <ArrowLeft size={16} color={colors['text-secondary']} />
      <Text className="font-inter-medium text-sm text-secondary-text">{label}</Text>
    </Pressable>
  );
}

export function StepsBar({ current, total = 3 }: { current: number; total?: number }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-3">
      <View className="flex-row gap-1.5" accessible={false}>
        {Array.from({ length: total }, (_, index) => (
          <View
            key={index}
            className={`h-1.5 w-8 rounded-full ${index + 1 <= current ? 'bg-action' : 'bg-surface-2'}`}
          />
        ))}
      </View>
      <Text className="font-sans text-xs text-secondary-text">{t('onboarding.step', { current, total })}</Text>
    </View>
  );
}

export function ListRow({
  icon,
  title,
  subtitle,
  trailing,
  onPress,
  divider = false,
  tone = 'neutral',
  accessibilityLabel,
  accessibilityHint,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onPress: () => void;
  divider?: boolean;
  tone?: 'neutral' | 'brand' | 'solid';
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      className={`min-h-[56px] flex-row items-center gap-3 px-2.5 py-2.5 active:opacity-80 ${divider ? 'border-t border-border-subtle' : ''}`}
    >
      {icon !== undefined && <IconTile tone={tone}>{icon}</IconTile>}
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="font-inter-medium text-base text-primary-text">{title}</Text>
        {subtitle && <Text className="font-sans text-sm leading-5 text-secondary-text">{subtitle}</Text>}
      </View>
      {trailing !== undefined ? trailing : <ChevronRight size={18} color={colors['text-tertiary']} />}
    </Pressable>
  );
}

export function PrivacyNote() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  return (
    <View className="flex-row items-start gap-3 rounded-2xl bg-brand-subtle p-4">
      <View className="mt-0.5 shrink-0">
        <ShieldCheck size={20} color={colors['brand-text']} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-sm font-inter-semibold text-primary-text">{t('statusUi.privacyTitle')}</Text>
        <Text className="font-sans text-xs leading-5 text-secondary-text">{t('statusUi.privacyBody')}</Text>
      </View>
    </View>
  );
}

export function PillSegmented<T extends string>({
  value,
  onChange,
  options,
  accessibilityLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly { id: T; label: string }[];
  accessibilityLabel: string;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      className="flex-row gap-1 rounded-full border border-border-subtle bg-surface-2 p-1"
    >
      {options.map((option) => {
        const active = value === option.id;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: active }}
            aria-checked={active}
            onPress={() => onChange(option.id)}
            className={`min-h-[40px] flex-1 items-center justify-center rounded-full px-3 ${active ? 'bg-surface-1' : 'bg-transparent'}`}
          >
            <Text
              numberOfLines={1}
              className={`text-sm font-inter-medium ${active ? 'text-brand-text' : 'text-secondary-text'}`}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function NoticeBox({
  children,
  icon,
  tone = 'info',
}: {
  children: ReactNode;
  icon?: ReactNode;
  tone?: 'info' | 'warn' | 'danger' | 'ok';
}) {
  const borderClass = tone === 'danger'
    ? 'border-danger/30 bg-surface-1'
    : tone === 'warn'
      ? 'border-attention/30 bg-surface-1'
      : tone === 'ok'
        ? 'border-brand/30 bg-brand-subtle'
        : 'border-border-subtle bg-surface-1';
  return (
    <View className={`flex-row items-start gap-3 rounded-2xl border ${borderClass} p-3.5`}>
      {icon && <View className="mt-0.5 shrink-0">{icon}</View>}
      <View className="min-w-0 flex-1">{children}</View>
    </View>
  );
}
