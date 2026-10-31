import { cloneElement, isValidElement, type ReactNode } from 'react';
import { Pressable } from 'react-native';
import { useThemeColors } from '../../../shared/theme/theme-provider';
import { Text } from '../../../shared/ui/text';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'destructive';
  icon?: ReactNode;
}

export function PairingButton({ label, onPress, disabled, variant, icon }: Props) {
  const c = useThemeColors();
  const appearance = variant ?? 'secondary';
  const primary = appearance === 'primary';
  const foreground = primary ? c['on-brand'] : appearance === 'destructive' ? c['danger-text'] : appearance === 'tertiary' ? c['brand-text'] : c['text-primary'];
  const styles = { primary: 'border border-button-brand bg-button-brand', secondary: 'border border-border-strong bg-surface-2', tertiary: 'bg-transparent', destructive: 'bg-surface-2' };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-[48px] min-w-0 shrink flex-row items-center justify-center gap-2 rounded-xl px-4 py-3 active:opacity-70 ${styles[appearance]} ${disabled ? 'opacity-50' : ''}`}
    >
      {isValidElement<{ color?: string }>(icon) ? cloneElement(icon, { color: foreground }) : icon}
      <Text className={`min-w-0 shrink text-center text-sm font-inter-semibold ${primary ? 'text-on-brand' : appearance === 'destructive' ? 'text-danger-text' : appearance === 'tertiary' ? 'text-brand-text' : 'text-primary-text'}`}>{label}</Text>
    </Pressable>
  );
}
