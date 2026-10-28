import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '../../../shared/ui/tokens';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  icon?: ReactNode;
}

export function PairingButton({ label, onPress, disabled, secondary, icon }: Props) {
  // Keep RN's pressed-style callback: this shared button already uses native StyleSheet styles.
  return (
    <Pressable
      cssInterop={false}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, secondary && styles.secondary, (pressed || disabled) && styles.dimmed]}
    >
      {icon}
      <Text style={[styles.label, secondary && styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { flexShrink: 1, minWidth: 0, minHeight: 48, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.primary, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  secondary: { backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border },
  dimmed: { opacity: 0.5 },
  label: { flexShrink: 1, minWidth: 0, color: colors.elevated, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  secondaryLabel: { color: colors.ink },
});
