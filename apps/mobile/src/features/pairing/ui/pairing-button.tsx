import type { ReactNode } from 'react';
import { Pressable } from 'react-native';
import { Text } from '../../../shared/ui/text';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  icon?: ReactNode;
}

export function PairingButton({ label, onPress, disabled, secondary, icon }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-[48px] min-w-0 shrink flex-row items-center justify-center gap-2 rounded-xl px-4 py-3 active:opacity-70 ${secondary ? 'border border-border bg-white' : 'bg-primary'} ${disabled ? 'opacity-50' : ''}`}
    >
      {icon}
      <Text className={`min-w-0 shrink text-center text-base font-inter-semibold ${secondary ? 'text-ink' : 'text-white'}`}>{label}</Text>
    </Pressable>
  );
}
