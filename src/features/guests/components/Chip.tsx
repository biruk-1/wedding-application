import { memo, useMemo } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useColors } from '@/theme/WeddingThemeContext';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';

/** Selectable pill used for filters and single/multi choice in the guest forms. */
export const Chip = memo(function Chip({
  label,
  selected,
  onPress,
  tone = 'primary',
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  tone?: 'primary' | 'success';
  disabled?: boolean;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const selectedStyle = tone === 'primary' ? styles.selectedPrimary : styles.selectedSuccess;
  const selectedText = tone === 'primary' ? colors.onPrimary : colors.success;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.chip, selected && selectedStyle, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !!disabled }}>
      <AppText variant="caption" style={{ color: selected ? selectedText : colors.textMuted }}>
        {label}
      </AppText>
    </Pressable>
  );
});

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  selectedPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  selectedSuccess: {
    backgroundColor: colors.successMuted,
    borderColor: colors.success,
  },
  disabled: {
    opacity: 0.5,
  },
  });
}
