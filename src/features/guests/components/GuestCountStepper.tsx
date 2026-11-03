import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useColors } from '@/theme/WeddingThemeContext';
import { useThemedStyles } from '@/theme/useThemedStyles';

/**
 * Maps to `plus_one_allowed`: 1 = guest only, 2 = guest + plus one.
 * Schema has no household size column beyond that boolean.
 */
export function GuestCountStepper({
  value,
  onChange,
  disabled,
  compact,
}: {
  /** Party size 1 or 2. */
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const size = Math.max(1, Math.min(2, value));

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Decrease guest count"
        disabled={disabled || size <= 1}
        hitSlop={8}
        onPress={() => onChange(1)}
        style={({ pressed }) => [
          styles.btn,
          compact && styles.btnCompact,
          (disabled || size <= 1) && styles.btnDisabled,
          pressed && !disabled && size > 1 && styles.pressed,
        ]}>
        <Ionicons name="remove" size={compact ? 14 : 18} color={colors.heading} />
      </Pressable>
      <AppText variant={compact ? 'caption' : 'bodyMedium'} style={styles.value}>
        {size}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Increase guest count"
        disabled={disabled || size >= 2}
        hitSlop={8}
        onPress={() => onChange(2)}
        style={({ pressed }) => [
          styles.btn,
          compact && styles.btnCompact,
          (disabled || size >= 2) && styles.btnDisabled,
          pressed && !disabled && size < 2 && styles.pressed,
        ]}>
        <Ionicons name="add" size={compact ? 14 : 18} color={colors.heading} />
      </Pressable>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  wrapCompact: {
    gap: spacing.xs,
  },
  btn: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCompact: {
    width: 26,
    height: 26,
    borderRadius: radii.sm,
  },
  btnDisabled: {
    opacity: 0.35,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  value: {
    minWidth: 20,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    color: colors.heading,
    fontWeight: '600',
  },
  });
}
