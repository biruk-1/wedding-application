import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { useColors } from '@/theme/WeddingThemeContext';
import { radii } from '@/theme/radii';
import type { AppColors } from '@/theme/types';

export type IconButtonProps = Omit<PressableProps, 'children'> & {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  color?: string;
  variant?: 'ghost' | 'muted' | 'primary';
  style?: StyleProp<ViewStyle>;
};

export function IconButton({
  name,
  size = 22,
  color,
  variant = 'ghost',
  style,
  disabled,
  accessibilityLabel,
  ...rest
}: IconButtonProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const iconColor =
    color ??
    (variant === 'primary' ? colors.primary : variant === 'muted' ? colors.textMuted : colors.success);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={10}
      style={(state) => [
        styles.base,
        variant === 'muted' && styles.muted,
        variant === 'primary' && styles.primary,
        state.pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      {...rest}>
      <Ionicons name={name} size={size} color={iconColor} />
    </Pressable>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  base: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: {
    backgroundColor: colors.surfaceMuted,
  },
  primary: {
    backgroundColor: colors.primaryMuted,
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.45,
  },
  });
}
